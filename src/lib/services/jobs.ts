import "server-only";
import { categoryFromCustomData } from "@/lib/jobs/category";
import { Prisma } from "@prisma/client";
import prisma, { type TxClient } from "@/lib/prisma";
import { computeBalance, parseAmount, round2 } from "@/lib/money";
import { newJobNumber, newTransactionRef, withUniqueRetry } from "@/lib/ids";
import { calendarDateToUtc, recordInstantForDate } from "@/lib/dates";
import { notFound } from "@/lib/api/http";
import { type SessionUser, userCan } from "@/lib/auth/session";
import { jobScope } from "@/lib/jobs/scope";
import { diffJob, layoutFieldLabels, summarizeChanges, type JobSnapshot } from "@/lib/jobs/diffJob";
import { paymentLabel, recordJobActivity } from "@/lib/services/activity";
import { syncAssignments } from "@/lib/services/assignments";
import { deriveJobTracking, statusIsStage, syncStatusWithStage, stageOptions } from "@/lib/jobs/tracking";
import { notifyHandoff, recordHandoff } from "@/lib/services/teams";
import { keepStoredMoney, moneyKeys } from "@/lib/jobs/amounts";
import type { FormLayout } from "@/lib/forms/types";

/** Statuses that mean printing is done and finishing work should start. */
export const PRODUCTION_DONE_STATUSES = ["Printing Completed", "Completed"];
export const isProductionDone = (status?: string | null) => !!status && PRODUCTION_DONE_STATUSES.includes(status);

export type InstallmentInput = {
  amount: string | number;
  date?: string;
  paymentMode?: string;
  /** Id of the Transaction row backing this installment, once saved. */
  transactionId?: string;
};

export type SaveJobInput = {
  id?: string;
  jobNumber?: string;
  client: { name: string; phone?: string; email?: string | null };
  category: string;
  date?: string;
  recordDate?: string;
  time?: string;
  location?: string;
  status: string;
  packageAmount: number;
  installments: InstallmentInput[];
  finishingStatus?: string;
  proofDelivered?: boolean;
  packageName?: string;
  notes?: string;
  inclusions?: unknown;
  attachments?: unknown;
  /** Replace the job's assignees; undefined leaves them unchanged. */
  assigneeIds?: string[];
  customData: Record<string, unknown>;
};

type Actor = Pick<SessionUser, "id" | "role" | "permissions">;

function snapshot(job: {
  category: string; date: Date; time: string; location: string; status: string; notes: string | null;
  packageName: string | null; customData: Prisma.JsonValue | null;
}, client: { name: string; phone: string; email: string | null } | null, packageAmount: number | null | undefined): JobSnapshot {
  return {
    category: job.category,
    date: job.date,
    time: job.time,
    location: job.location,
    status: job.status,
    notes: job.notes,
    packageName: job.packageName,
    clientName: client?.name ?? null,
    clientPhone: client?.phone ?? null,
    clientEmail: client?.email ?? null,
    packageAmount: packageAmount ?? null,
    customData: (job.customData as Record<string, unknown> | null) ?? {},
  };
}

const normalizePhone = (phone?: string) => (phone ?? "").replace(/[^0-9+]/g, "");

function jobDate(input: Pick<SaveJobInput, "recordDate" | "date">): Date | undefined {
  const raw = input.recordDate || input.date;
  if (!raw) return undefined;
  // Calendar dates (yyyy-MM-dd) are stored as UTC midnight so the day never shifts with the server TZ.
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? calendarDateToUtc(raw) : new Date(raw);
}

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return value as Prisma.InputJsonValue;
}

/**
 * Resolve the client for a job. Reuses an existing client with the same phone number; when editing,
 * a client shared with other jobs is never renamed in place.
 */
async function resolveClient(tx: TxClient, input: SaveJobInput["client"], existingClientId?: string) {
  const phone = normalizePhone(input.phone);
  const data = { name: input.name.trim(), phone, email: input.email || null };

  if (existingClientId) {
    // `deletedAt: undefined` opts out of the soft-delete filter: trashed jobs still reference the client.
    const otherJobs = await tx.job.count({ where: { clientId: existingClientId, deletedAt: undefined } });
    if (otherJobs <= 1) {
      return tx.client.update({ where: { id: existingClientId }, data });
    }
    const current = await tx.client.findUnique({ where: { id: existingClientId } });
    if (current && current.name === data.name && current.phone === data.phone) {
      return tx.client.update({ where: { id: existingClientId }, data: { email: data.email } });
    }
  }

  if (phone) {
    const match = await tx.client.findFirst({ where: { phone, name: { equals: data.name, mode: "insensitive" } } });
    if (match) return tx.client.update({ where: { id: match.id }, data: { email: data.email ?? match.email } });
  }
  return tx.client.create({ data });
}

/**
 * Sync installment payments to INCOME transactions inside the same DB transaction:
 * create new ones, update changed ones, soft-delete removed ones. Returns installments with ids.
 */
async function syncInstallments(
  tx: TxClient,
  jobId: string,
  jobNumber: string,
  clientName: string,
  userId: string,
  installments: InstallmentInput[]
) {
  const existing = await tx.transaction.findMany({
    where: { jobId, type: "INCOME", category: "JOB", deletedAt: null },
    select: { id: true, amount: true, paymentMode: true, date: true },
  });
  const existingIds = new Set(existing.map((t) => t.id));
  const existingById = new Map(existing.map((t) => [t.id, t]));
  const keptIds = new Set<string>();
  const saved: (InstallmentInput & { amount: string })[] = [];

  for (const inst of installments) {
    const amount = parseAmount(inst.amount);
    if (amount <= 0) continue;
    const date = recordInstantForDate(inst.date);
    const paymentMode = inst.paymentMode || "Cash";

    if (inst.transactionId && existingIds.has(inst.transactionId)) {
      const prev = existingById.get(inst.transactionId)!;
      await tx.transaction.update({ where: { id: inst.transactionId }, data: { amount, date, paymentMode } });
      if (prev.amount !== amount || prev.paymentMode !== paymentMode || prev.date.getTime() !== date.getTime()) {
        await recordJobActivity(tx, {
          jobId,
          actorId: userId,
          type: "PAYMENT_UPDATED",
          summary: `Updated payment ${paymentLabel(prev.amount, prev.paymentMode)} → ${paymentLabel(amount, paymentMode)}`,
        });
      }
      keptIds.add(inst.transactionId);
      saved.push({ ...inst, amount: String(amount), transactionId: inst.transactionId });
      continue;
    }

    const created = await tx.transaction.create({
      data: {
        amount,
        type: "INCOME",
        category: "JOB",
        status: "SETTLED",
        paymentMode,
        date,
        description: `Advance Payment for Job ${jobNumber} - ${clientName}`,
        transactionId: newTransactionRef(),
        jobId,
        userId,
      },
    });
    keptIds.add(created.id);
    saved.push({ ...inst, amount: String(amount), transactionId: created.id });
    await recordJobActivity(tx, { jobId, actorId: userId, type: "PAYMENT_ADDED", summary: `Recorded payment ${paymentLabel(amount, paymentMode)}` });
  }

  // Installments removed in the form are soft-deleted only now, on save — cancelling the form keeps them.
  const removed = [...existingIds].filter((id) => !keptIds.has(id));
  if (removed.length > 0) {
    await tx.transaction.updateMany({ where: { id: { in: removed } }, data: { deletedAt: new Date() } });
    for (const id of removed) {
      const prev = existingById.get(id)!;
      await recordJobActivity(tx, { jobId, actorId: userId, type: "PAYMENT_DELETED", summary: `Removed payment ${paymentLabel(prev.amount, prev.paymentMode)}` });
    }
  }
  return saved;
}

/** Recompute the order's paid/due figures from the job's actual INCOME transactions. */
export async function refreshOrderTotals(tx: TxClient, jobId: string) {
  const order = await tx.order.findUnique({ where: { jobId } });
  if (!order) return null;
  const payments = await tx.transaction.findMany({
    where: { jobId, type: "INCOME", deletedAt: null },
    select: { amount: true },
  });
  const balance = computeBalance({ packageAmount: order.package, payments });
  return tx.order.update({ where: { jobId }, data: { advance: balance.paid, due: balance.due } });
}

/** Balance for a job derived from its package and non-deleted INCOME transactions. */
export async function getJobBalance(jobId: string) {
  const [order, payments] = await Promise.all([
    prisma.order.findUnique({ where: { jobId } }),
    prisma.transaction.findMany({ where: { jobId, type: "INCOME", deletedAt: null }, select: { amount: true } }),
  ]);
  return computeBalance({ packageAmount: order?.package ?? 0, payments });
}

/**
 * Create or update a job together with its client, order and installment payments in one
 * database transaction, so a failure part-way never leaves orphaned or duplicated payments.
 */
export async function saveJob(input: SaveJobInput, actor: Actor) {
  // Decided outside the transaction: users who can't see every job are put on jobs they create,
  // otherwise the job would vanish from their own lists.
  const [seesAllJobs, seesAmounts, scope] = await Promise.all([userCan(actor, "view_all_jobs"), userCan(actor, "view_amounts"), jobScope(actor)]);
  // A unique-ref collision aborts the Postgres transaction, so the whole transaction is retried
  // (with fresh random refs) rather than the single insert.
  const result = await withUniqueRetry(() => saveJobOnce(input, actor, seesAllJobs, seesAmounts, scope), () => "");
  notifyHandoff(result.handoff, result.job, result.client.name, actor.id);
  return result;
}

async function saveJobOnce(input: SaveJobInput, actor: Actor, seesAllJobs: boolean, seesAmounts: boolean, scope: Prisma.JobWhereInput) {
  const userId = actor.id;
  return prisma.$transaction(
    async (tx) => {
      const existing = input.id
        ? await tx.job.findFirst({ where: { id: input.id, deletedAt: undefined, ...scope }, include: { order: true, client: true } })
        : null;
      if (input.id && (!existing || existing.deletedAt)) {
        throw notFound("Job not found");
      }

      const client = await resolveClient(tx, input.client, existing?.clientId);

      const layout = await tx.formLayout.findUnique({ where: { formKey: "JOB_FORM" }, select: { schema: true } });
      const stored = (existing?.customData as Record<string, unknown> | null) ?? {};
      // Without "See amounts" the money fields were never sent to this user: keep the stored ones.
      const customData: Record<string, unknown> = {
        ...stored,
        ...(seesAmounts ? input.customData : keepStoredMoney(input.customData, stored, moneyKeys(layout?.schema as FormLayout | null))),
      };
      // Finishing work starts (as Pending) when printing is marked done, and is cleared otherwise.
      if (isProductionDone(input.status)) {
        if (!existing || !isProductionDone(existing.status) || !customData.fld_b_finishing_status) {
          customData.fld_b_finishing_status = customData.fld_b_finishing_status || "Pending";
        }
      } else {
        delete customData.fld_b_finishing_status;
      }

      let status = input.status;
      if (statusIsStage(layout?.schema as Parameters<typeof statusIsStage>[0]) && !customData.fld_b_status) {
        const stages = stageOptions(layout?.schema as Parameters<typeof stageOptions>[0]);
        const isStage = stages.some((s) => s.label.toLowerCase() === String(status ?? "").toLowerCase());
        // Keep an existing job's stage; a new job without one starts at the first stage.
        const stage = isStage ? status : existing?.stage ?? stages[0]?.label;
        if (stage) {
          customData.fld_b_status = stage;
          if (!existing || isStage) status = stage;
        }
      }
      const common = {
        // Board stage + due date as real columns (filterable, indexed), derived from the form data.
        ...deriveJobTracking(customData, layout?.schema as Parameters<typeof deriveJobTracking>[1]),
        category: input.category || categoryFromCustomData(customData),
        time: input.time ?? "",
        location: input.location ?? "",
        status,
        packageName: input.packageName,
        notes: input.notes,
        inclusions: asJson(input.inclusions),
        attachments: asJson(input.attachments),
        finishingStatus: input.finishingStatus ? (input.finishingStatus.toUpperCase() as "PENDING" | "IN_PROGRESS" | "DELIVERED") : undefined,
        proofDelivered: input.proofDelivered,
        customData: customData as Prisma.InputJsonValue,
        updatedById: userId,
      };

      // A job that changes stage joins the end of its new queue.
      const queueReset = existing && common.stage !== existing.stage ? { queuePosition: null } : {};
      const date = jobDate(input);
      const job = existing
        ? await tx.job.update({
          where: { id: existing.id },
          data: { ...common, ...queueReset, clientId: client.id, ...(date ? { date } : {}) },
        })
        : await tx.job.create({
          data: {
            ...common,
            jobNumber: input.jobNumber || newJobNumber(),
            clientId: client.id,
            date: date ?? new Date(),
            createdById: userId,
          },
        });

      // Price and payments are only changed by people who can see them.
      const installments = seesAmounts
        ? await syncInstallments(tx, job.id, job.jobNumber || `#${job.id.slice(0, 8)}`, client.name, userId, input.installments)
        : ((existing?.order?.installments as InstallmentInput[] | null) ?? []);

      const packageAmount = seesAmounts ? round2(input.packageAmount) : existing?.order?.package ?? 0;
      const before = existing ? snapshot(existing, existing.client, existing.order?.package) : null;
      await tx.order.upsert({
        where: { jobId: job.id },
        create: { jobId: job.id, package: packageAmount, installments: installments as Prisma.InputJsonValue },
        update: { package: packageAmount, installments: installments as Prisma.InputJsonValue },
      });
      const order = await refreshOrderTotals(tx, job.id);

      // Assignments: explicit list wins; otherwise a creator without view_all_jobs is assigned.
      let assigneeIds = input.assigneeIds;
      if (!existing && !seesAllJobs) assigneeIds = [...new Set([...(assigneeIds ?? []), userId])];
      const assignmentChanges = assigneeIds ? await syncAssignments(tx, job.id, assigneeIds, userId) : { added: [], removed: [] };

      // Activity stream (same transaction as the change).
      const after = snapshot(job, client, packageAmount);
      if (!before) {
        await recordJobActivity(tx, { jobId: job.id, actorId: userId, type: "CREATED", summary: `Created job for ${client.name}` });
      } else {
        const changes = diffJob(before, after, layoutFieldLabels(layout?.schema));
        const statusChange = changes.find((c) => c.field === "status");
        const otherChanges = changes.filter((c) => c.field !== "status");
        if (statusChange) {
          await recordJobActivity(tx, {
            jobId: job.id,
            actorId: userId,
            type: "STATUS_CHANGED",
            summary: `Changed status from ${statusChange.from ?? "—"} to ${statusChange.to ?? "—"}`,
            changes: [statusChange],
          });
        }
        if (otherChanges.length) {
          await recordJobActivity(tx, { jobId: job.id, actorId: userId, type: "UPDATED", summary: summarizeChanges(otherChanges), changes: otherChanges });
        }
      }

      await tx.systemLog.create({
        data: {
          userId,
          action: existing ? "JOB_UPDATED" : "JOB_CREATED",
          details: existing ? `Updated job ID: ${job.id}` : `Created job ID: ${job.id} for client ${client.name}`,
        },
      });

      const handoff = await recordHandoff(tx, existing?.stage, job, userId);
      return { job, client, order, installments, created: !existing, assignmentChanges, handoff };
    },
    { timeout: 20000 }
  );
}

/** Soft-delete a job: hide it and its payments, and record it in the recycle bin for restore. */
export async function softDeleteJob(jobId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.job.findUnique({ where: { id: jobId }, include: { order: true, client: true } });
    if (!existing || existing.deletedAt) return null;

    const now = new Date();
    const txs = await tx.transaction.findMany({ where: { jobId, deletedAt: null }, select: { id: true } });
    await tx.job.update({ where: { id: jobId }, data: { deletedAt: now } });
    // Payments are hidden with the job (not destroyed) so restoring the job brings them back.
    await tx.transaction.updateMany({ where: { jobId, deletedAt: null }, data: { deletedAt: now } });
    await tx.invoice.updateMany({ where: { jobId, deletedAt: null }, data: { deletedAt: now } });

    await tx.recycleBin.create({
      data: {
        itemType: "job",
        itemId: jobId,
        originalData: JSON.parse(JSON.stringify({ ...existing, deletedTransactionIds: txs.map((t) => t.id) })),
        trashedById: userId,
      },
    });
    await tx.systemLog.create({ data: { userId, action: "JOB_SOFT_DELETED", details: `Soft deleted job ID: ${jobId}` } });
    await recordJobActivity(tx, { jobId, actorId: userId, type: "DELETED", summary: "Moved job to the recycle bin" });
    return existing;
  });
}

/** Restore a soft-deleted job and exactly the payments that were hidden with it. */
export async function restoreJob(tx: TxClient, jobId: string, originalData: unknown, actorId?: string) {
  const data = (originalData ?? {}) as { deletedTransactionIds?: string[] };
  await tx.job.update({ where: { id: jobId }, data: { deletedAt: null } });
  await recordJobActivity(tx, { jobId, actorId, type: "RESTORED", summary: "Restored job from the recycle bin" });
  if (Array.isArray(data.deletedTransactionIds) && data.deletedTransactionIds.length > 0) {
    await tx.transaction.updateMany({ where: { id: { in: data.deletedTransactionIds } }, data: { deletedAt: null } });
  } else {
    // Entries trashed before payments were tracked: restore whatever was hidden with the job.
    await tx.transaction.updateMany({ where: { jobId, deletedAt: { not: null } }, data: { deletedAt: null } });
  }
  await tx.invoice.updateMany({ where: { jobId }, data: { deletedAt: null } });
}

/** Permanently delete a job and everything that belongs to it, in FK-safe order. */
export async function hardDeleteJob(tx: TxClient, jobId: string) {
  await tx.transaction.deleteMany({ where: { jobId } });
  // Order and Invoice (with its line items) cascade from Job.
  await tx.job.delete({ where: { id: jobId } });
}

export type JobUpdate = Prisma.JobUncheckedUpdateInput & { assigneeIds?: string[] };

/**
 * Partial update of a visible job (status changes, tracking, API edits) with scope check, assignment sync
 * and activity recording in one transaction. `build` receives the current row and returns the update.
 */
export async function updateJob(
  actor: Actor,
  jobId: string,
  build: (existing: Prisma.JobGetPayload<{ include: { client: true; order: true } }>) => JobUpdate
) {
  const [scope, seesAmounts] = await Promise.all([jobScope(actor), userCan(actor, "view_amounts")]);
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.job.findFirst({ where: { id: jobId, ...scope }, include: { client: true, order: true } });
    if (!existing) throw notFound("Job not found");

    const { assigneeIds, ...data } = build(existing);
    const layout = await tx.formLayout.findUnique({ where: { formKey: "JOB_FORM" }, select: { schema: true } });
    if (data.customData && typeof data.customData === "object" && !seesAmounts) {
      const stored = (existing.customData as Record<string, unknown> | null) ?? {};
      data.customData = keepStoredMoney(data.customData as Record<string, unknown>, stored, moneyKeys(layout?.schema as FormLayout | null)) as Prisma.InputJsonValue;
    }
    // Status and board stage stay equal when they are one picker (the board card and the details page agree).
    if (typeof data.status === "string" || (data.customData && typeof data.customData === "object")) {
      const merged = (data.customData && typeof data.customData === "object" ? data.customData : existing.customData) as Record<string, unknown> | null;
      const synced = syncStatusWithStage(
        layout?.schema as Parameters<typeof syncStatusWithStage>[0],
        { status: existing.status, stage: existing.stage },
        { status: typeof data.status === "string" ? data.status : undefined, customData: { ...(merged ?? {}) } }
      );
      if (synced.status !== undefined) data.status = synced.status;
      data.customData = synced.customData as Prisma.InputJsonValue;
    }
    const tracking = deriveJobTracking(data.customData ?? existing.customData, layout?.schema as Parameters<typeof deriveJobTracking>[1]);
    // A job that changes stage joins the end of its new queue.
    const queueReset = tracking.stage !== existing.stage ? { queuePosition: null } : {};
    const job = await tx.job.update({ where: { id: jobId }, data: { ...data, ...tracking, ...queueReset, updatedById: actor.id } });
    const assignmentChanges = assigneeIds ? await syncAssignments(tx, jobId, assigneeIds, actor.id) : { added: [], removed: [] };

    const changes = diffJob(
      snapshot(existing, existing.client, existing.order?.package),
      snapshot(job, existing.client, existing.order?.package),
      layoutFieldLabels(layout?.schema)
    );
    for (const change of changes) {
      if (change.field === "status") {
        await recordJobActivity(tx, { jobId, actorId: actor.id, type: "STATUS_CHANGED", summary: `Changed status from ${change.from ?? "—"} to ${change.to ?? "—"}`, changes: [change] });
      } else if (change.field === "fld_b_finishing_status") {
        await recordJobActivity(tx, { jobId, actorId: actor.id, type: "FINISHING_UPDATED", summary: `Finishing status: ${change.from ?? "—"} → ${change.to ?? "—"}`, changes: [change] });
      }
    }
    const rest = changes.filter((c) => c.field !== "status" && c.field !== "fld_b_finishing_status");
    if (rest.length) {
      await recordJobActivity(tx, { jobId, actorId: actor.id, type: "UPDATED", summary: summarizeChanges(rest), changes: rest });
    }
    if (!existing.proofDelivered && job.proofDelivered) {
      await recordJobActivity(tx, { jobId, actorId: actor.id, type: "PROOF_DELIVERED", summary: "Marked proof as delivered" });
    }
    const handoff = await recordHandoff(tx, existing.stage, job, actor.id);
    return { before: existing, job, assignmentChanges, handoff };
  });
  notifyHandoff(result.handoff, result.job, result.before.client?.name, actor.id);
  return result;
}
