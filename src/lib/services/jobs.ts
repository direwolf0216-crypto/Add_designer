import "server-only";
import { Prisma } from "@prisma/client";
import prisma, { type TxClient } from "@/lib/prisma";
import { computeBalance, parseAmount, round2 } from "@/lib/money";
import { newJobNumber, newTransactionRef, withUniqueRetry } from "@/lib/ids";
import { calendarDateToUtc } from "@/lib/dates";
import { notFound } from "@/lib/api/http";

/** Statuses that mean the shoot happened and album work should start. */
export const SHOOT_DONE_STATUSES = ["Shoot Completed", "Completed"];
export const isShootDone = (status?: string | null) => !!status && SHOOT_DONE_STATUSES.includes(status);

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
  albumStatus?: string;
  galleryDelivered?: boolean;
  packageName?: string;
  notes?: string;
  inclusions?: unknown;
  attachments?: unknown;
  photographers?: unknown;
  customData: Record<string, unknown>;
};

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
    select: { id: true },
  });
  const existingIds = new Set(existing.map((t) => t.id));
  const keptIds = new Set<string>();
  const saved: (InstallmentInput & { amount: string })[] = [];

  for (const inst of installments) {
    const amount = parseAmount(inst.amount);
    if (amount <= 0) continue;
    const date = inst.date ? new Date(inst.date) : new Date();
    const paymentMode = inst.paymentMode || "Cash";

    if (inst.transactionId && existingIds.has(inst.transactionId)) {
      await tx.transaction.update({ where: { id: inst.transactionId }, data: { amount, date, paymentMode } });
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
  }

  // Installments removed in the form are soft-deleted only now, on save — cancelling the form keeps them.
  const removed = [...existingIds].filter((id) => !keptIds.has(id));
  if (removed.length > 0) {
    await tx.transaction.updateMany({ where: { id: { in: removed } }, data: { deletedAt: new Date() } });
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
export async function saveJob(input: SaveJobInput, userId: string) {
  // A unique-ref collision aborts the Postgres transaction, so the whole transaction is retried
  // (with fresh random refs) rather than the single insert.
  return withUniqueRetry(() => saveJobOnce(input, userId), () => "");
}

async function saveJobOnce(input: SaveJobInput, userId: string) {
  return prisma.$transaction(
    async (tx) => {
      const existing = input.id
        ? await tx.job.findUnique({ where: { id: input.id }, include: { order: true } })
        : null;
      if (input.id && (!existing || existing.deletedAt)) {
        throw notFound("Job not found");
      }

      const client = await resolveClient(tx, input.client, existing?.clientId);

      const customData: Record<string, unknown> = {
        ...((existing?.customData as Record<string, unknown> | null) ?? {}),
        ...input.customData,
      };
      // Album work starts (as Pending) when the shoot is marked done, and is cleared otherwise.
      if (isShootDone(input.status)) {
        if (!existing || !isShootDone(existing.status) || !customData.fld_b_album_status) {
          customData.fld_b_album_status = customData.fld_b_album_status || "Pending";
        }
      } else {
        delete customData.fld_b_album_status;
      }

      const common = {
        category: input.category,
        time: input.time ?? "",
        location: input.location ?? "",
        status: input.status,
        packageName: input.packageName,
        notes: input.notes,
        inclusions: asJson(input.inclusions),
        attachments: asJson(input.attachments),
        photographers: asJson(input.photographers),
        albumStatus: input.albumStatus ? (input.albumStatus.toUpperCase() as "PENDING" | "IN_PROGRESS" | "DELIVERED") : undefined,
        galleryDelivered: input.galleryDelivered,
        customData: customData as Prisma.InputJsonValue,
        updatedById: userId,
      };

      const date = jobDate(input);
      const job = existing
        ? await tx.job.update({
          where: { id: existing.id },
          data: { ...common, clientId: client.id, ...(date ? { date } : {}) },
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

      const installments = await syncInstallments(
        tx,
        job.id,
        job.jobNumber || `#${job.id.slice(0, 8)}`,
        client.name,
        userId,
        input.installments
      );

      const packageAmount = round2(input.packageAmount);
      await tx.order.upsert({
        where: { jobId: job.id },
        create: { jobId: job.id, package: packageAmount, installments: installments as Prisma.InputJsonValue },
        update: { package: packageAmount, installments: installments as Prisma.InputJsonValue },
      });
      const order = await refreshOrderTotals(tx, job.id);

      await tx.systemLog.create({
        data: {
          userId,
          action: existing ? "JOB_UPDATED" : "JOB_CREATED",
          details: existing ? `Updated job ID: ${job.id}` : `Created job ID: ${job.id} for client ${client.name}`,
        },
      });

      return { job, client, order, installments, created: !existing };
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
    return existing;
  });
}

/** Restore a soft-deleted job and exactly the payments that were hidden with it. */
export async function restoreJob(tx: TxClient, jobId: string, originalData: unknown) {
  const data = (originalData ?? {}) as { deletedTransactionIds?: string[] };
  await tx.job.update({ where: { id: jobId }, data: { deletedAt: null } });
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
