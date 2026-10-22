import "server-only";
import { z } from "zod";
import { Prisma, type Transaction } from "@prisma/client";
import prisma, { type TxClient } from "@/lib/prisma";
import { round2 } from "@/lib/money";
import { businessMonthRange, toBusinessISODate, recordInstantForDate } from "@/lib/dates";
import { refreshOrderTotals } from "@/lib/services/jobs";
import { type SessionUser, userCan } from "@/lib/auth/session";
import { HttpError, badRequest, conflict, forbidden, notFound } from "@/lib/api/http";
import { broadcastLater } from "@/lib/notifications";
import { paymentLabel, recordJobActivity } from "@/lib/services/activity";

export const MAX_BULK_ITEMS = 100;
const MAX_CUSTOM_FIELDS = 100;

const amountSchema = z
  .union([z.number(), z.string().trim().regex(/^-?\d+(\.\d+)?$/, "Amount must be a positive number.")])
  .transform((v) => round2(Number(v)))
  .pipe(z.number().positive("Amount must be a positive number.").max(1e10));

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/, "A valid date is required.")
  .refine((v) => !Number.isNaN(Date.parse(v)), "A valid date is required.");

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const coreFields = {
  amount: amountSchema,
  type: z.enum(["INCOME", "EXPENSE"], "Type must be INCOME or EXPENSE."),
  date: isoDateSchema,
  category: z.string().trim().min(1, "Category is required.").max(100),
  paymentMode: z.string().trim().min(1, "Payment mode is required.").max(50),
  description: z.string().max(2000).nullish(),
  status: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  recordDate: z.preprocess(emptyToUndefined, isoDateSchema.optional()),
};

/** One transaction as posted by the transaction form. Unknown keys are custom layout fields. */
export const transactionItemSchema = z.looseObject(coreFields);

export const transactionCreateSchema = transactionItemSchema.extend({
  jobId: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  productOrderId: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
});

export const transactionUpdateSchema = transactionItemSchema.partial();

export const bulkTransactionSchema = z
  .array(transactionItemSchema)
  .min(1, "No transactions provided")
  .max(MAX_BULK_ITEMS, `At most ${MAX_BULK_ITEMS} transactions per request`);

type TransactionItem = z.infer<typeof transactionItemSchema>;

export function assertSingleType(items: TransactionItem[]) {
  if (new Set(items.map((i) => i.type)).size > 1) throw new HttpError(422, "All categories must be same type");
}

const CORE_KEYS = new Set([...Object.keys(coreFields), "jobId", "productOrderId"]);
// Keys the client echoes back from a fetched transaction; they are never custom field values.
const RESERVED_KEYS = new Set([
  "id",
  "userId",
  "transactionId",
  "groupId",
  "deletedAt",
  "createdAt",
  "updatedAt",
  "customData",
  "customFields",
  "items",
  "job",
  "user",
  "productOrder",
]);

/** Parse a JSON column (object or legacy JSON string) into a plain object, never throwing. */
export function asJsonObject(value: unknown): Record<string, unknown> {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

/** Custom layout field values from a request body (everything that is not a core column). */
export function extractCustomData(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    // `amount_<category>` keys are per-category amounts of the multi-category form.
    if (CORE_KEYS.has(key) || RESERVED_KEYS.has(key) || key.startsWith("$ACTION") || key.startsWith("amount_")) continue;
    out[key] = value;
  }
  if (Object.keys(out).length > MAX_CUSTOM_FIELDS) throw badRequest("Too many custom fields");
  return out;
}

const jsonOrUndefined = (data: Record<string, unknown>) =>
  Object.keys(data).length > 0 ? (data as Prisma.InputJsonValue) : undefined;

/** Scalar columns for a new transaction row (without transactionId/userId/links). */
export function transactionData(item: TransactionItem) {
  return {
    amount: item.amount,
    type: item.type,
    date: recordInstantForDate(item.recordDate ?? item.date),
    category: item.category,
    paymentMode: item.paymentMode,
    description: item.description?.trim() || null,
    status: item.status || "SETTLED",
    customData: jsonOrUndefined(extractCustomData(item)),
  };
}

/** Editing needs edit_transactions and deleting delete_transactions, whoever recorded the entry. */
export async function assertCanModifyTransaction(user: SessionUser, _row: { userId: string | null }, action: "edit_transactions" | "delete_transactions" = "edit_transactions") {
  if (await userCan(user, action)) return;
  throw forbidden(action === "delete_transactions" ? "You do not have permission to delete transactions" : "You do not have permission to change transactions");
}

/** Partial update shared by PUT /api/transactions and PUT /api/transactions/[id]. */
export async function updateTransaction(id: string, body: unknown, user: SessionUser) {
  const input = transactionUpdateSchema.parse(body);
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw notFound("Transaction not found");
  await assertCanModifyTransaction(user, existing);

  const customData = { ...asJsonObject(existing.customData), ...extractCustomData(input) };
  const date = input.recordDate ?? input.date;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.transaction.update({
      where: { id },
      data: {
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.type && { type: input.type }),
        ...(date && { date: recordInstantForDate(date) }),
        ...(input.category && { category: input.category }),
        ...(input.paymentMode && { paymentMode: input.paymentMode }),
        ...(input.description !== undefined && { description: input.description?.trim() || null }),
        ...(input.status && { status: input.status }),
        ...(Object.keys(customData).length > 0 && { customData: customData as Prisma.InputJsonValue }),
      },
    });
    if (existing.jobId) {
      await refreshOrderTotals(tx, existing.jobId);
      await recordJobActivity(tx, {
        jobId: existing.jobId,
        actorId: user.id,
        type: "PAYMENT_UPDATED",
        summary: `Updated ${existing.type === "INCOME" ? "payment" : "expense"} ${paymentLabel(existing.amount, existing.paymentMode)} → ${paymentLabel(updated.amount, updated.paymentMode)}`,
      });
    }
    return updated;
  });
}

type ProductOrderPaymentKind = "advance" | "due" | null;

// Product-order payments carry no structured marker; they are recognised by the description
// prefix the frames flow writes ("Advance …", "Full Payment …", "Due Collection …").
function productOrderPaymentKind(description: string | null): ProductOrderPaymentKind {
  const d = (description ?? "").trim().toLowerCase();
  if (d.startsWith("advance") || d.startsWith("full payment")) return "advance";
  if (d.startsWith("due collection")) return "due";
  return null;
}

export async function adjustProductOrder(tx: TxClient, row: Transaction, direction: "revert" | "reapply") {
  if (!row.productOrderId) return;
  const kind = productOrderPaymentKind(row.description);
  if (!kind) return;
  const order = await tx.productOrder.findUnique({ where: { id: row.productOrderId } });
  if (!order) return;

  if (kind === "advance") {
    const customData = asJsonObject(order.customData);
    const current = Number(customData.advanceAmount) || 0;
    const advanceAmount = round2(Math.max(0, direction === "revert" ? current - row.amount : current + row.amount));
    await tx.productOrder.update({
      where: { id: order.id },
      data: { customData: { ...customData, advanceAmount } as Prisma.InputJsonValue },
    });
  } else if (direction === "revert") {
    // The pre-collection status and discount are not recorded, so restoring a due collection
    // leaves the order as reverted here. Note: this writes "READY" while the dashboard counts
    // "READY_FOR_PICKUP"; both are accepted there until product-order statuses are unified.
    await tx.productOrder.update({ where: { id: order.id }, data: { status: "READY", discountAmount: 0 } });
  }
}

/**
 * The single soft-delete path for one transaction: hide it, record it in the recycle bin, undo
 * product-order and job balance effects. Idempotent — returns false when it was already deleted.
 */
export async function softDeleteTransactionTx(tx: TxClient, row: Transaction, userId: string) {
  const { count } = await tx.transaction.updateMany({
    where: { id: row.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (count === 0) return false;
  await tx.recycleBin.create({
    data: {
      itemType: "transaction",
      itemId: row.id,
      originalData: JSON.parse(JSON.stringify(row)),
      trashedById: userId,
    },
  });
  await adjustProductOrder(tx, row, "revert");
  if (row.jobId) {
    await refreshOrderTotals(tx, row.jobId);
    await recordJobActivity(tx, { jobId: row.jobId, actorId: userId, type: "PAYMENT_DELETED", summary: `Deleted ${row.type === "INCOME" ? "payment" : "expense"} ${paymentLabel(row.amount, row.paymentMode)}` });
  }
  return true;
}

/** Inverse of softDeleteTransactionTx. Returns false when the row was not deleted. */
export async function restoreTransactionTx(tx: TxClient, row: Transaction, actorId?: string) {
  if (row.jobId) {
    const job = await tx.job.findUnique({ where: { id: row.jobId }, select: { deletedAt: true } });
    if (job?.deletedAt) throw conflict("Restore the job this payment belongs to first");
  }
  const { count } = await tx.transaction.updateMany({
    where: { id: row.id, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  if (count === 0) return false;
  await tx.recycleBin.deleteMany({ where: { itemType: "transaction", itemId: row.id } });
  await adjustProductOrder(tx, row, "reapply");
  if (row.jobId) {
    await refreshOrderTotals(tx, row.jobId);
    await recordJobActivity(tx, { jobId: row.jobId, actorId, type: "PAYMENT_RESTORED", summary: `Restored ${row.type === "INCOME" ? "payment" : "expense"} ${paymentLabel(row.amount, row.paymentMode)}` });
  }
  return true;
}

/** Load a transaction for a write, enforcing existence and the edit or delete permission. */
export async function loadTransactionForWrite(id: string, user: SessionUser, action: "edit_transactions" | "delete_transactions" = "edit_transactions") {
  const row = await prisma.transaction.findUnique({ where: { id } });
  if (!row) throw notFound("Transaction not found");
  await assertCanModifyTransaction(user, row, action);
  return row;
}

/** Year/month (1-12) of an instant in the business timezone. */
export function businessYearMonth(date: Date = new Date()) {
  const [year, month] = toBusinessISODate(date).split("-").map(Number);
  return { year, month };
}

/** Total non-deleted expenses per category within the business month containing `date`. */
export async function monthlyCategorySpend(categories: string[], date: Date = new Date()) {
  if (categories.length === 0) return new Map<string, number>();
  const { start, end } = businessMonthRange(date);
  const rows = await prisma.transaction.groupBy({
    by: ["category"],
    _sum: { amount: true },
    where: { type: "EXPENSE", category: { in: categories }, date: { gte: start, lte: end }, deletedAt: null },
  });
  return new Map(rows.map((r) => [r.category, round2(r._sum.amount ?? 0)]));
}

/** Broadcast a BUDGET_EXCEEDED alert (after the response) when the user's budget for the month is over. */
export async function notifyIfBudgetExceeded(userId: string, category: string, date: Date) {
  const { year, month } = businessYearMonth(date);
  const budget = await prisma.categoryBudget.findUnique({
    where: { category_month_year_userId: { category, month, year, userId } },
  });
  if (!budget) return;
  const spent = (await monthlyCategorySpend([category], date)).get(category) ?? 0;
  if (spent <= budget.monthlyLimit) return;
  broadcastLater({
    title: "Budget Exceeded",
    message: `${category} budget exceeded by ₹${round2(spent - budget.monthlyLimit).toLocaleString("en-IN")}.`,
    type: "BUDGET_EXCEEDED",
    actionUrl: "/settings",
    entityId: budget.id,
    entityType: "budget",
    priority: "HIGH",
  });
}
