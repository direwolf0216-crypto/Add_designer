import "server-only";
import { cache } from "react";
import { z } from "zod";
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma, { type TxClient } from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/api/http";
import { recordJobActivity } from "@/lib/services/activity";
import { createNotification, jobLabel } from "@/lib/notifications";

export type TeamSummary = {
  id: string;
  name: string;
  color: string;
  stages: string[];
  members: { id: string; name: string | null; email: string | null; image: string | null; status: string }[];
};

export const teamSchema = z.object({
  name: z.string().trim().min(1, "Give the team a name").max(40),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  stages: z.array(z.string().trim().min(1).max(100)).max(30),
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
  return teams.map((t) => ({ id: t.id, name: t.name, color: t.color, stages: t.stages, members: t.members.map((m) => m.user) }));
}

/** Stages of every team the user belongs to: those jobs are theirs to work on. Cached per request. */
export const teamStagesFor = cache(async (userId: string): Promise<string[]> => {
  const rows = await prisma.teamMember.findMany({ where: { userId }, select: { team: { select: { stages: true } } } });
  return [...new Set(rows.flatMap((r) => r.team.stages))];
});

/** The team that takes over jobs in `stage`, if any. */
export function teamForStage<T extends { stages: string[] }>(teams: T[], stage: string | null | undefined): T | null {
  if (!stage) return null;
  return teams.find((t) => t.stages.some((s) => lower(s) === lower(stage))) ?? null;
}

async function validate(input: TeamInput, exceptId?: string) {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) throw badRequest("Give the team a name");
  const stages = [...new Map(input.stages.map((s) => s.trim()).filter(Boolean).map((s) => [lower(s), s])).values()];
  const memberIds = [...new Set(input.memberIds)];
  if (memberIds.length > MAX_MEMBERS) throw badRequest(`A team can have at most ${MAX_MEMBERS} people`);

  const [others, users] = await Promise.all([
    prisma.team.findMany({ where: exceptId ? { id: { not: exceptId } } : {}, select: { name: true, stages: true } }),
    memberIds.length ? prisma.user.findMany({ where: { id: { in: memberIds }, status: "ACTIVE" }, select: { id: true } }) : [],
  ]);
  if (others.some((t) => lower(t.name) === lower(name))) throw conflict(`There's already a team called ${name}`);
  for (const stage of stages) {
    const owner = teamForStage(others, stage);
    if (owner) throw conflict(`${stage} already belongs to the ${owner.name} team`);
  }
  if (users.length !== memberIds.length) throw badRequest("Some selected people don't exist or are inactive");
  const color = /^#[0-9a-f]{6}$/i.test(input.color ?? "") ? input.color! : "#3b82f6";
  return { name, color, stages, memberIds };
}

export async function createTeam(input: TeamInput) {
  const { name, color, stages, memberIds } = await validate(input);
  return prisma.team.create({
    data: { name, color, stages, members: { create: memberIds.map((userId) => ({ userId })) } },
    select: { id: true },
  });
}

export async function updateTeam(id: string, input: TeamInput) {
  if (!(await prisma.team.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Team not found");
  const { name, color, stages, memberIds } = await validate(input, id);
  await prisma.$transaction(async (tx) => {
    await tx.team.update({ where: { id }, data: { name, color, stages } });
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
 * When a job's stage moves into another team's stages (Designing Completed → the Printing team), record
 * the hand-off on the job inside `tx`. Returns the receiving team; pass it to `notifyHandoff` after commit.
 */
export async function recordHandoff(tx: TxClient, before: string | null | undefined, job: HandoffJob, actorId: string) {
  if (!job.stage || (before && lower(before) === lower(job.stage))) return null;
  const teams = await listTeams(tx);
  const to = teamForStage(teams, job.stage);
  if (!to || teamForStage(teams, before) === to) return null;
  await recordJobActivity(tx, { jobId: job.id, actorId, type: "HANDED_OFF", summary: `Handed to the ${to.name} team (${job.stage})` });
  return to;
}

/** Tell the receiving team (minus whoever moved it) that a job joined their queue. Runs after the response. */
export function notifyHandoff(team: TeamSummary | null, job: HandoffJob, clientName: string | undefined, actorId: string) {
  if (!team) return;
  const recipients = team.members.filter((m) => m.status === "ACTIVE" && m.id !== actorId).map((m) => m.id);
  if (!recipients.length) return;
  after(async () => {
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { name: true, email: true } });
    const who = actor?.name?.trim() || actor?.email?.trim() || "Someone";
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
