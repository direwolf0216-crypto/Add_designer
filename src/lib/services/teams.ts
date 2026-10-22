import "server-only";
import { cache } from "react";
import { z } from "zod";
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma, { type TxClient } from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/api/http";
import { recordJobActivity } from "@/lib/services/activity";
import { createNotification, jobLabel } from "@/lib/notifications";
import { whatsappAfterHandoff } from "@/lib/whatsapp/events";

export type TeamSummary = {
  id: string;
  name: string;
  color: string;
  stages: string[];
  /** Display name per stage for this team's people, keyed by the stage label (e.g. "Designing Completed" → "Waiting to print"). */
  stageLabels: Record<string, string>;
  members: { id: string; name: string | null; email: string | null; image: string | null; status: string }[];
};

export const teamSchema = z.object({
  name: z.string().trim().min(1, "Give the team a name").max(40),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  stages: z.array(z.string().trim().min(1).max(100)).max(30),
  stageLabels: z.record(z.string().max(100), z.string().trim().max(40)).optional(),
  memberIds: z.array(z.string().min(1).max(64)).max(50),
});
export type TeamInput = z.infer<typeof teamSchema>;

const MAX_MEMBERS = 50;
const lower = (s: string) => s.trim().toLowerCase();

/** Jobs whose board stage is one of `stages` (case-insensitive, like the board columns). */
export function stageInWhere(stages: string[]): Prisma.JobWhereInput {
  return { OR: stages.map((s) => ({ stage: { equals: s, mode: "insensitive" as const } })) };
}

export async function listTeams(db: TxClient | typeof prisma = prisma): Promise<TeamSummary[]> {
  const teams = await db.team.findMany({
    orderBy: { createdAt: "asc" },
    include: { members: { orderBy: { addedAt: "asc" }, select: { user: { select: { id: true, name: true, email: true, image: true, status: true } } } } },
  });
  return teams.map((t) => ({ id: t.id, name: t.name, color: t.color, stages: t.stages, stageLabels: labelsOf(t.stageLabels), members: t.members.map((m) => m.user) }));
}

function labelsOf(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (typeof v === "string" && v.trim()) out[k] = v.trim();
  return out;
}

/** What `stage` is called for someone on these teams (the first team that renames it wins). */
export function stageLabelFor(teams: Pick<TeamSummary, "stages" | "stageLabels">[], stage: string): string {
  for (const t of teams) {
    const key = Object.keys(t.stageLabels).find((k) => lower(k) === lower(stage));
    if (key && t.stageLabels[key]) return t.stageLabels[key];
  }
  return stage;
}

/** Stages of every team the user belongs to: those jobs are theirs to work on. Cached per request. */
export const teamStagesFor = cache(async (userId: string): Promise<string[]> => {
  const rows = await prisma.teamMember.findMany({ where: { userId }, select: { team: { select: { stages: true } } } });
  return [...new Set(rows.flatMap((r) => r.team.stages))];
});

/** Every team whose queue includes `stage` (a stage can belong to several teams). */
export function teamsForStage<T extends { stages: string[] }>(teams: T[], stage: string | null | undefined): T[] {
  if (!stage) return [];
  return teams.filter((t) => t.stages.some((s) => lower(s) === lower(stage)));
}

/** The first team that takes over jobs in `stage`, if any. */
export function teamForStage<T extends { stages: string[] }>(teams: T[], stage: string | null | undefined): T | null {
  return teamsForStage(teams, stage)[0] ?? null;
}

async function validate(input: TeamInput, exceptId?: string) {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) throw badRequest("Give the team a name");
  const stages = [...new Map(input.stages.map((s) => s.trim()).filter(Boolean).map((s) => [lower(s), s])).values()];
  const memberIds = [...new Set(input.memberIds)];
  if (memberIds.length > MAX_MEMBERS) throw badRequest(`A team can have at most ${MAX_MEMBERS} people`);

  const [others, users] = await Promise.all([
    prisma.team.findMany({ where: exceptId ? { id: { not: exceptId } } : {}, select: { name: true } }),
    memberIds.length ? prisma.user.findMany({ where: { id: { in: memberIds }, status: "ACTIVE" }, select: { id: true } }) : [],
  ]);
  if (others.some((t) => lower(t.name) === lower(name))) throw conflict(`There's already a team called ${name}`);
  if (users.length !== memberIds.length) throw badRequest("Some selected people don't exist or are inactive");
  const color = /^#[0-9a-f]{6}$/i.test(input.color ?? "") ? input.color! : "#3b82f6";
  // Labels only for stages the team actually has; an empty label means "use the stage's own name".
  const stageLabels: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.stageLabels ?? {})) {
    const stage = stages.find((s) => lower(s) === lower(k));
    if (stage && v.trim() && lower(v) !== lower(stage)) stageLabels[stage] = v.trim();
  }
  return { name, color, stages, stageLabels, memberIds };
}

export async function createTeam(input: TeamInput) {
  const { name, color, stages, stageLabels, memberIds } = await validate(input);
  return prisma.team.create({
    data: { name, color, stages, stageLabels, members: { create: memberIds.map((userId) => ({ userId })) } },
    select: { id: true },
  });
}

export async function updateTeam(id: string, input: TeamInput) {
  if (!(await prisma.team.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Team not found");
  const { name, color, stages, stageLabels, memberIds } = await validate(input, id);
  await prisma.$transaction(async (tx) => {
    await tx.team.update({ where: { id }, data: { name, color, stages, stageLabels } });
    await tx.teamMember.deleteMany({ where: { teamId: id, userId: { notIn: memberIds } } });
    await tx.teamMember.createMany({ data: memberIds.map((userId) => ({ teamId: id, userId })), skipDuplicates: true });
  });
}

export async function deleteTeam(id: string) {
  const { count } = await prisma.team.deleteMany({ where: { id } });
  if (!count) throw notFound("Team not found");
}

type HandoffJob = { id: string; jobNumber: string | null; stage: string | null };

/**
 * When a job's stage moves into stages of teams that didn't hold it before (Designing Completed → the
 * Printing team), record the hand-off inside `tx`. Returns the receiving teams; pass them to `notifyHandoff`.
 */
export async function recordHandoff(tx: TxClient, before: string | null | undefined, job: HandoffJob, actorId: string) {
  if (!job.stage || (before && lower(before) === lower(job.stage))) return null;
  const teams = await listTeams(tx);
  const had = new Set(teamsForStage(teams, before).map((t) => t.id));
  const to = teamsForStage(teams, job.stage).filter((t) => !had.has(t.id));
  if (!to.length) return null;
  await recordJobActivity(tx, { jobId: job.id, actorId, type: "HANDED_OFF", summary: `Handed to the ${to.map((t) => t.name).join(" and ")} team${to.length > 1 ? "s" : ""} (${job.stage})` });
  return to;
}

/** Tell the receiving teams (minus whoever moved it) that a job joined their queue. Runs after the response. */
export function notifyHandoff(teams: TeamSummary | TeamSummary[] | null, job: HandoffJob, clientName: string | undefined, actorId: string) {
  for (const team of Array.isArray(teams) ? teams : teams ? [teams] : []) notifyTeam(team, job, clientName, actorId);
}

function notifyTeam(team: TeamSummary, job: HandoffJob, clientName: string | undefined, actorId: string) {
  const recipients = team.members.filter((m) => m.status === "ACTIVE" && m.id !== actorId).map((m) => m.id);
  if (!recipients.length) return;
  after(async () => {
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { name: true, email: true } });
    const who = actor?.name?.trim() || actor?.email?.trim() || "Someone";
    whatsappAfterHandoff(job.id, team.name, recipients, who);
    await Promise.all(
      recipients.map((userId) =>
        createNotification({
          userId,
          type: "JOB_ASSIGNED",
          title: `New job in the ${team.name} queue`,
          message: `${who} moved job ${jobLabel(job, clientName)} to ${job.stage}. It's waiting in the ${team.name} queue.`,
          actionUrl: `/jobs?view=queue&team=${team.id}`,
          entityId: job.id,
          entityType: "job",
        })
      )
    );
  });
}
