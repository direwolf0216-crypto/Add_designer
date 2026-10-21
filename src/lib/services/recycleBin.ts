import "server-only";
import type { Prisma, RecycleBin } from "@prisma/client";
import prisma, { type TxClient } from "@/lib/prisma";
import { badRequest, conflict, errorResponse, forbidden, notFound } from "@/lib/api/http";
import { type SessionUser, userCan } from "@/lib/auth/session";
import { getGoogleDriveToken } from "@/lib/googleDriveAuth";
import { hardDeleteJob, refreshOrderTotals, restoreJob } from "@/lib/services/jobs";
import { adjustProductOrder } from "@/lib/services/transactions";
import { paymentLabel, recordJobActivity } from "@/lib/services/activity";

export type BinItemType = "job" | "transaction" | "TRANSACTION_GROUP" | "product-order";

/** Canonical item type; legacy entries used 'booking' (jobs) and 'frame' (product orders). */
export function normalizeItemType(itemType: string): BinItemType | null {
  switch (itemType) {
    case "job":
    case "booking":
      return "job";
    case "transaction":
    case "TRANSACTION_GROUP":
      return itemType;
    case "product-order":
    case "frame":
      return "product-order";
    default:
      return null;
  }
}

/** Raw itemType values stored for a canonical type, for filtering bin queries. */
export function storedItemTypes(type: BinItemType): string[] {
  if (type === "job") return ["job", "booking"];
  if (type === "product-order") return ["product-order", "frame"];
  return [type];
}

type TxSnapshot = { id: string; userId: string | null; customData: unknown; deletedAt: unknown };

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const str = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);

function toTxSnapshot(value: unknown): TxSnapshot | null {
  const r = asRecord(value);
  const id = str(r.id);
  if (!id) return null;
  return { id, userId: str(r.userId) ?? null, customData: r.customData, deletedAt: r.deletedAt ?? null };
}

/** Transactions recorded in an entry's snapshot. */
function snapshotTransactions(type: BinItemType, entry: RecycleBin): TxSnapshot[] {
  const data = asRecord(entry.originalData);
  if (type === "transaction") {
    return [toTxSnapshot({ ...data, id: entry.itemId })].filter((t): t is TxSnapshot => t !== null);
  }
  const list = type === "TRANSACTION_GROUP" ? data.children : type === "product-order" ? data.transactions : undefined;
  return Array.isArray(list) ? list.map(toTxSnapshot).filter((t): t is TxSnapshot => t !== null) : [];
}

/**
 * Ids of the transactions that were hidden together with a product order. Older entries did not
 * record them, so fall back to the snapshot's transactions that were still live when it was trashed.
 */
function productOrderTransactionIds(entry: RecycleBin): string[] {
  const data = asRecord(entry.originalData);
  if (Array.isArray(data.deletedTransactionIds)) {
    return data.deletedTransactionIds.filter((id): id is string => typeof id === "string");
  }
  return snapshotTransactions("product-order", entry)
    .filter((t) => t.deletedAt === null)
    .map((t) => t.id);
}

const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,200}$/;

/** Google Drive file ids referenced from a customData blob ({ fieldKey: { id, name, ... } }). */
function driveFileIds(customData: unknown): string[] {
  const ids: string[] = [];
  for (const value of Object.values(asRecord(customData))) {
    for (const item of Array.isArray(value) ? value : [value]) {
      const id = asRecord(item).id;
      if (typeof id === "string" && DRIVE_FILE_ID.test(id)) ids.push(id);
    }
  }
  return ids;
}

async function canActOnTransactions(user: SessionUser, txs: TxSnapshot[]) {
  if (await userCan(user, "manage_transactions")) return true;
  return txs.length > 0 && txs.every((t) => t.userId === user.id);
}

async function refreshJobs(tx: TxClient, jobIds: Iterable<string | null>) {
  for (const jobId of new Set(jobIds)) {
    if (jobId) await refreshOrderTotals(tx, jobId);
  }
}

/** Throws 409 if any of the jobs is itself in the bin: its payments come back with it. */
async function assertJobsLive(tx: TxClient, jobIds: (string | null)[]) {
  const ids = [...new Set(jobIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return;
  const trashed = await tx.job.count({ where: { id: { in: ids }, deletedAt: { not: null } } });
  if (trashed > 0) throw conflict("Restore the job this payment belongs to first");
}

/** Remove the bin row last, so it only disappears once the restore/delete above has succeeded. */
async function removeEntry(tx: TxClient, entryId: string) {
  // Also serialises concurrent requests for the same entry: the loser finds nothing and rolls back.
  const { count } = await tx.recycleBin.deleteMany({ where: { id: entryId } });
  if (count === 0) throw notFound();
}

const optionalDate = (value: unknown) => {
  if (typeof value !== "string" && !(value instanceof Date)) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};
const optionalNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

async function restoreProductOrder(tx: TxClient, entry: RecycleBin) {
  const data = asRecord(entry.originalData);
  const productId = str(data.productId);
  if (!productId) throw badRequest("This order's snapshot is incomplete and cannot be restored");

  await tx.productOrder.create({
    data: {
      id: entry.itemId,
      orderNumber: str(data.orderNumber) ?? null,
      productId,
      quantity: optionalNumber(data.quantity) ?? 1,
      status: str(data.status) ?? "PENDING",
      clientName: typeof data.clientName === "string" ? data.clientName : "",
      clientPhone: str(data.clientPhone) ?? null,
      customData: data.customData == null ? undefined : (data.customData as Prisma.InputJsonValue),
      dueDate: optionalDate(data.dueDate) ?? null,
      discountAmount: optionalNumber(data.discountAmount) ?? 0,
      date: optionalDate(data.date),
      createdAt: optionalDate(data.createdAt),
      updatedAt: optionalDate(data.updatedAt),
    },
  });

  const ids = productOrderTransactionIds(entry);
  if (ids.length === 0) return;
  const rows = await tx.transaction.findMany({ where: { id: { in: ids }, deletedAt: undefined }, select: { jobId: true } });
  await tx.transaction.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null, productOrderId: entry.itemId } });
  await refreshJobs(tx, rows.map((r) => r.jobId));
}

/** Restore one recycle-bin entry. Authorization depends on the item type. */
export async function restoreItem(entry: RecycleBin, user: SessionUser) {
  const type = normalizeItemType(entry.itemType);
  if (!type) throw badRequest("This item type cannot be restored");

  if (type === "job" || type === "product-order") {
    if (!(await userCan(user, "manage_jobs"))) throw forbidden();
  } else if (!(await canActOnTransactions(user, snapshotTransactions(type, entry)))) {
    throw forbidden();
  }

  await prisma.$transaction(
    async (tx) => {
      if (type === "job") {
        const job = await tx.job.findUnique({ where: { id: entry.itemId }, select: { id: true } });
        if (!job) throw notFound("This job no longer exists");
        if (!(await userCan(user, "view_all_jobs"))) {
          const assigned = await tx.jobAssignment.findUnique({ where: { jobId_userId: { jobId: entry.itemId, userId: user.id } } });
          if (!assigned) throw notFound("This job no longer exists");
        }
        await restoreJob(tx, entry.itemId, entry.originalData, user.id);
        await refreshOrderTotals(tx, entry.itemId);
      } else if (type === "transaction" || type === "TRANSACTION_GROUP") {
        const where: Prisma.TransactionWhereInput =
          type === "transaction"
            ? { id: entry.itemId, deletedAt: undefined }
            : { id: { in: snapshotTransactions(type, entry).map((t) => t.id) }, deletedAt: undefined };
        const rows = await tx.transaction.findMany({ where });
        if (rows.length === 0) throw notFound("This transaction no longer exists");
        await assertJobsLive(tx, rows.map((r) => r.jobId));
        await tx.transaction.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { deletedAt: null } });
        // Undo the product-order advance reduction applied when the payment was deleted.
        for (const row of rows) {
          if (!row.deletedAt) continue;
          await adjustProductOrder(tx, row, "reapply");
          if (row.jobId) {
            await recordJobActivity(tx, { jobId: row.jobId, actorId: user.id, type: "PAYMENT_RESTORED", summary: `Restored ${row.type === "INCOME" ? "payment" : "expense"} ${paymentLabel(row.amount, row.paymentMode)}` });
          }
        }
        await refreshJobs(tx, rows.map((r) => r.jobId));
      } else {
        await restoreProductOrder(tx, entry);
      }

      await removeEntry(tx, entry.id);
      await tx.systemLog.create({
        data: { userId: user.id, action: "RECYCLE_BIN_RESTORE", details: `Restored ${type} ${entry.itemId} from recycle bin` },
      });
    },
    { timeout: 20000 }
  );
}

/**
 * Permanently delete one recycle-bin entry and the data it holds, in FK-safe order. `user` is null
 * for the purge cron. Returns the Drive files that belonged to the deleted rows; delete those only
 * after this has committed (see deleteDriveFiles).
 */
export async function purgeItem(entry: RecycleBin, user: SessionUser | null): Promise<{ driveFileIds: string[] }> {
  if (user && user.role !== "ADMIN") throw forbidden();
  const type = normalizeItemType(entry.itemType);
  const files: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      // Rows that are no longer trashed (restored some other way) are left alone; only the stale entry goes.
      if (type === "job") {
        const job = await tx.job.findUnique({ where: { id: entry.itemId }, select: { deletedAt: true } });
        if (job?.deletedAt) {
          const txs = await tx.transaction.findMany({ where: { jobId: entry.itemId, deletedAt: undefined }, select: { id: true } });
          // Payments trashed on their own would otherwise leave bin entries pointing at nothing.
          await tx.recycleBin.deleteMany({ where: { itemType: "transaction", itemId: { in: txs.map((t) => t.id) } } });
          await hardDeleteJob(tx, entry.itemId);
        }
      } else if (type) {
        const snapshot = snapshotTransactions(type, entry);
        const where: Prisma.TransactionWhereInput =
          type === "transaction"
            ? { id: entry.itemId, deletedAt: { not: null } }
            : type === "TRANSACTION_GROUP"
              ? { OR: [{ id: { in: snapshot.map((t) => t.id) } }, { groupId: entry.itemId }], deletedAt: { not: null } }
              : { id: { in: productOrderTransactionIds(entry) }, productOrderId: null, deletedAt: { not: null } };

        // The order row is removed when it is trashed; if it exists again it was restored and is live.
        const orderLive = type === "product-order" && (await tx.productOrder.count({ where: { id: entry.itemId } })) > 0;
        const orderGone = type === "product-order" && !orderLive;

        const rows = orderLive ? [] : await tx.transaction.findMany({ where, select: { id: true, jobId: true } });
        if (rows.length > 0) {
          await tx.transaction.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
          await refreshJobs(tx, rows.map((r) => r.jobId));
        }

        const deleted = new Set(rows.map((r) => r.id));
        for (const t of snapshot) if (deleted.has(t.id)) files.push(...driveFileIds(t.customData));
        if (orderGone) files.push(...driveFileIds(asRecord(entry.originalData).customData));
      }
      // Unknown legacy types have nothing we can safely delete; the entry itself is removed.

      await removeEntry(tx, entry.id);
      await tx.systemLog.create({
        data: {
          userId: user?.id ?? null,
          action: user ? "RECYCLE_BIN_DELETE" : "CRON_PURGE_RECYCLE_BIN",
          details: `Permanently deleted ${entry.itemType} ${entry.itemId} from recycle bin`,
        },
      });
    },
    { timeout: 20000 }
  );

  return { driveFileIds: [...new Set(files)] };
}

/** Best-effort removal of Drive files after the database delete has committed. Failures are logged. */
export async function deleteDriveFiles(user: SessionUser, fileIds: string[]) {
  if (fileIds.length === 0) return;
  let accessToken: string;
  try {
    accessToken = await getGoogleDriveToken({ user: { id: user.id, email: user.email } });
  } catch (e) {
    console.error(`[recycle-bin] cannot delete ${fileIds.length} Drive file(s): no usable Drive token`, e);
    return;
  }
  for (const fileId of fileIds) {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok && res.status !== 404) {
        console.error(`[recycle-bin] failed to delete Drive file ${fileId}: ${res.status} ${await res.text()}`);
      }
    } catch (e) {
      console.error(`[recycle-bin] failed to delete Drive file ${fileId}`, e);
    }
  }
}

export type BulkResult = { done: string[]; failed: { id: string; status: number; error: string }[] };

/** Apply `fn` to each entry independently; one failing entry does not stop (or roll back) the others. */
export async function forEachEntry(entries: RecycleBin[], fn: (entry: RecycleBin) => Promise<void>): Promise<BulkResult> {
  const result: BulkResult = { done: [], failed: [] };
  for (const entry of entries) {
    try {
      await fn(entry);
      result.done.push(entry.id);
    } catch (e) {
      const res = errorResponse(e);
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      result.failed.push({ id: entry.id, status: res.status, error: body.error ?? "Failed" });
    }
  }
  return result;
}
