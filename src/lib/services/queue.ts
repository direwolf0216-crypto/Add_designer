import "server-only";
import prisma from "@/lib/prisma";
import { badRequest, notFound } from "@/lib/api/http";
import type { SessionUser } from "@/lib/auth/session";
import { jobScope } from "@/lib/jobs/scope";
import { PRIORITY_STYLE, type Priority } from "@/lib/jobs/priority";
import { assignPlaces } from "@/lib/jobs/queueOrder";
import { recordJobActivity } from "@/lib/services/activity";
import { stageInWhere } from "@/lib/services/teams";

export const MAX_QUEUE = 200;

const priorityChange = (from: Priority, to: Priority) => ({
  field: "priority",
  label: "Priority",
  from: PRIORITY_STYLE[from].label,
  to: PRIORITY_STYLE[to].label,
});

/** Change one job's priority; it joins the end of its new priority group. */
export async function setJobPriority(actor: Pick<SessionUser, "id" | "role">, jobId: string, priority: Priority) {
  const scope = await jobScope(actor);
  await prisma.$transaction(async (tx) => {
    const job = await tx.job.findFirst({ where: { id: jobId, deletedAt: null, ...scope }, select: { priority: true } });
    if (!job) throw notFound("Job not found");
    if (job.priority === priority) return;
    await tx.job.update({ where: { id: jobId }, data: { priority, queuePosition: null, updatedById: actor.id } });
    await recordJobActivity(tx, {
      jobId,
      actorId: actor.id,
      type: "UPDATED",
      summary: `Priority: ${PRIORITY_STYLE[job.priority].label} → ${PRIORITY_STYLE[priority].label}`,
      changes: [priorityChange(job.priority, priority)],
    });
  });
}

/**
 * Save a team queue's order after a drag: `items` is the whole queue as now shown, top first. Each job
 * gets its place, and the priority of the group it was dropped into.
 */
export async function reorderQueue(actor: Pick<SessionUser, "id" | "role">, teamId: string, items: { id: string; priority: Priority }[]) {
  if (items.length > MAX_QUEUE) throw badRequest("The queue is too long to reorder at once");
  if (new Set(items.map((i) => i.id)).size !== items.length) throw badRequest("A job appears twice");
  const [team, scope] = await Promise.all([prisma.team.findUnique({ where: { id: teamId }, select: { stages: true } }), jobScope(actor)]);
  if (!team) throw notFound("Team not found");

  await prisma.$transaction(async (tx) => {
    const jobs = await tx.job.findMany({
      where: { id: { in: items.map((i) => i.id) }, deletedAt: null, ...scope, AND: [...((scope.AND as object[]) ?? []), stageInWhere(team.stages)] },
      select: { id: true, priority: true, queuePosition: true },
    });
    // Jobs that left the queue meanwhile (moved on, trashed) are skipped, not an error.
    const current = new Map(jobs.map((j) => [j.id, j]));
    const kept = items.filter((i) => current.has(i.id));
    // The rest of the queue (beyond what was shown) keeps its places below the reordered top.
    const below = await tx.job.groupBy({
      by: ["priority"],
      where: { deletedAt: null, id: { notIn: kept.map((i) => i.id) }, queuePosition: { not: null }, ...stageInWhere(team.stages) },
      _min: { queuePosition: true },
    });
    const floors = Object.fromEntries(below.map((b) => [b.priority, b._min.queuePosition!]));
    const changed = assignPlaces(kept, floors)
      .map((item) => ({ ...item, before: current.get(item.id)! }))
      .filter((c) => c.before.queuePosition !== c.place || c.before.priority !== c.priority);
    if (!changed.length) return;
    // One statement for the whole queue rather than a round trip per job.
    await tx.$executeRaw`
      UPDATE "Job" AS j SET "queuePosition" = v.place, "priority" = v.priority::"JobPriority"
      FROM (SELECT unnest(${changed.map((c) => c.id)}::text[]) AS id,
                   unnest(${changed.map((c) => c.place)}::float8[]) AS place,
                   unnest(${changed.map((c) => c.priority)}::text[]) AS priority) AS v
      WHERE j."id" = v.id`;
    for (const c of changed) {
      if (c.before.priority === c.priority) continue;
      await recordJobActivity(tx, {
        jobId: c.id,
        actorId: actor.id,
        type: "UPDATED",
        summary: `Priority: ${PRIORITY_STYLE[c.before.priority].label} → ${PRIORITY_STYLE[c.priority].label}`,
        changes: [priorityChange(c.before.priority, c.priority)],
      });
    }
  }, { timeout: 20000 });
}
