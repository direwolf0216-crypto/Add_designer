import "server-only";
import prisma, { type TxClient } from "@/lib/prisma";
import { badRequest } from "@/lib/api/http";
import { recordJobActivity } from "@/lib/services/activity";
import { after } from "next/server";
import { createNotification } from "@/lib/notifications";

export const MAX_ASSIGNEES = 20;

/** Pure: which user ids were added/removed between two assignment sets. */
export function assignmentDiff(current: string[], next: string[]) {
  const cur = new Set(current);
  const nxt = new Set(next);
  return {
    added: [...nxt].filter((id) => !cur.has(id)),
    removed: [...cur].filter((id) => !nxt.has(id)),
  };
}

/**
 * Replace a job's assignees inside `tx`, recording activity for each change. Only active users can be
 * assigned. Returns the added/removed ids; call `notifyAssigned` after the transaction commits.
 */
export async function syncAssignments(tx: TxClient, jobId: string, userIds: string[], actorId: string) {
  const unique = [...new Set(userIds)];
  if (unique.length > MAX_ASSIGNEES) throw badRequest(`A job can have at most ${MAX_ASSIGNEES} assignees`);

  const users = unique.length
    ? await tx.user.findMany({ where: { id: { in: unique }, status: "ACTIVE" }, select: { id: true, name: true, email: true } })
    : [];
  if (users.length !== unique.length) throw badRequest("Some selected users don't exist or are inactive");

  const current = await tx.jobAssignment.findMany({ where: { jobId }, select: { userId: true, user: { select: { name: true, email: true } } } });
  const { added, removed } = assignmentDiff(current.map((a) => a.userId), unique);

  if (removed.length) await tx.jobAssignment.deleteMany({ where: { jobId, userId: { in: removed } } });
  if (added.length) {
    await tx.jobAssignment.createMany({
      data: added.map((userId) => ({ jobId, userId, assignedById: actorId })),
      skipDuplicates: true,
    });
  }

  const nameOf = (id: string) => {
    const u = users.find((x) => x.id === id) ?? current.find((x) => x.userId === id)?.user;
    return u?.name || u?.email || "a user";
  };
  if (added.length) {
    await recordJobActivity(tx, {
      jobId,
      actorId,
      type: "ASSIGNED",
      summary: `Assigned ${added.map(nameOf).join(", ")}`,
      changes: added.map((id) => ({ field: "assignee", label: "Assignee", from: null, to: nameOf(id) })),
    });
  }
  if (removed.length) {
    await recordJobActivity(tx, {
      jobId,
      actorId,
      type: "UNASSIGNED",
      summary: `Unassigned ${removed.map(nameOf).join(", ")}`,
      changes: removed.map((id) => ({ field: "assignee", label: "Assignee", from: nameOf(id), to: null })),
    });
  }
  return { added, removed };
}

/** Notify newly assigned users (skipping the person who assigned them). Runs after the response. */
export function notifyAssigned(job: { id: string; jobNumber: string | null; clientName?: string }, userIds: string[], actorId: string) {
  const recipients = userIds.filter((id) => id !== actorId);
  if (recipients.length === 0) return;
  after(async () => {
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { name: true, email: true } });
    const who = actor?.name?.trim() || actor?.email?.trim() || "Someone";
    await Promise.all(
      recipients.map((userId) =>
        createNotification({
          userId,
          type: "JOB_ASSIGNED",
          title: "New job assigned to you",
          message: `${who} assigned you to job ${job.jobNumber || ""}${job.clientName ? ` (${job.clientName})` : ""}.`,
          actionUrl: `/jobs/details/${job.id}`,
          entityId: job.id,
          entityType: "job",
        })
      )
    );
  });
}
