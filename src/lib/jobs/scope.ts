import "server-only";
import type { Prisma } from "@prisma/client";
import prisma, { type TxClient } from "@/lib/prisma";
import { notFound } from "@/lib/api/http";
import { roleHasPermission, type SessionUser } from "@/lib/auth/session";

/**
 * Which jobs a user may see. Users without `view_all_jobs` only see jobs assigned to them.
 * Merge into every Job query: `where: { ...(await jobScope(user)), ...rest }`.
 */
export async function jobScope(user: Pick<SessionUser, "id" | "role">): Promise<Prisma.JobWhereInput> {
  if (await roleHasPermission(user.role, "view_all_jobs")) return {};
  return { assignments: { some: { userId: user.id } } };
}

/** Same scope expressed for rows that reference a job (transactions, invoices). */
export async function jobRelationScope(user: Pick<SessionUser, "id" | "role">): Promise<Prisma.JobWhereInput | null> {
  const scope = await jobScope(user);
  return Object.keys(scope).length === 0 ? null : scope;
}

/** 404 (not 403, so existence isn't revealed) unless the job exists, isn't trashed and is in scope. */
export async function assertJobVisible(jobId: string, user: Pick<SessionUser, "id" | "role">, db: TxClient | typeof prisma = prisma) {
  const job = await db.job.findFirst({ where: { id: jobId, ...(await jobScope(user)) }, select: { id: true } });
  if (!job) throw notFound("Job not found");
}

/**
 * Transactions a user may see in ledgers: payments on jobs outside their scope are hidden unless they
 * recorded them. Non-job transactions are unaffected.
 */
export async function transactionJobScope(user: Pick<SessionUser, "id" | "role">): Promise<Prisma.TransactionWhereInput> {
  const scope = await jobRelationScope(user);
  if (!scope) return {};
  return { OR: [{ jobId: null }, { job: scope }, { userId: user.id }] };
}
