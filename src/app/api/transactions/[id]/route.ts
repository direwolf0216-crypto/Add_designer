import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { route, parseJson, notFound } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/session";
import { businessDayRange } from "@/lib/dates";
import { round2 } from "@/lib/money";
import { DEFAULT_LAYOUTS } from "@/lib/defaultLayouts";
import {
  asJsonObject,
  loadTransactionForWrite,
  restoreTransactionTx,
  softDeleteTransactionTx,
  updateTransaction,
} from "@/lib/services/transactions";

const NO_STORE = { "Cache-Control": "private, no-store" };

type LayoutField = { id: string; name: string; type: string };

const STANDARD_FIELD_IDS = new Set(["fld_tx_amount", "fld_tx_type", "fld_tx_date", "fld_tx_category", "fld_tx_mode", "fld_tx_desc"]);

function layoutFields(schema: unknown): LayoutField[] {
  const sections = (asJsonObject(schema).sections ?? []) as unknown[];
  if (!Array.isArray(sections)) return [];
  return sections.flatMap((section) => {
    const fields = asJsonObject(section).fields;
    if (!Array.isArray(fields)) return [];
    return fields.map((raw) => {
      const field = asJsonObject(raw);
      const id = String(field.id ?? "");
      return { id, name: String(field.name || id), type: String(field.type || "SINGLE_LINE") };
    });
  });
}

/** Payment rows synthesised for jobs created before installments were stored as transactions. */
async function legacyAdvance(id: string) {
  const jobId = id.replace("legacy-advance-", "");
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      client: { select: { name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      order: true,
    },
  });
  if (!job || job.deletedAt) throw notFound("Job not found for legacy transaction");

  const customData = asJsonObject(job.customData);
  const advanceAmount = Number(job.order?.advance || customData.fld_b_advance || 0) || 0;
  const paymentMode = String(customData.paymentMode || customData.fld_b_payment_mode || "Cash");

  return {
    transaction: {
      id,
      transactionId: id,
      amount: advanceAmount,
      type: "INCOME",
      date: job.date,
      category: "JOB",
      paymentMode,
      description: "Advance Payment (Legacy)",
      status: "SETTLED",
      customData: {},
      attachmentUrl: null,
      job: { id: job.id, jobNumber: job.jobNumber, category: job.category, client: { name: job.client?.name || "" } },
      user: job.createdBy || null,
      productOrder: null,
      customFields: [],
    },
    impact: { dayIncome: advanceAmount, dayExpenses: 0, dayNet: advanceAmount, categoryTotal: advanceAmount, categoryShare: 100 },
  };
}

export const GET = route<{ id: string }>(async (_request, { params }) => {
  await requirePermission("view_transactions");
  const { id } = await params;

  if (id.startsWith("legacy-advance-")) {
    return NextResponse.json(await legacyAdvance(id), { headers: NO_STORE });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      job: { select: { id: true, jobNumber: true, category: true, client: { select: { name: true } } } },
      user: { select: { id: true, name: true, email: true } },
      productOrder: { select: { id: true, orderNumber: true } },
    },
  });
  if (!transaction || transaction.deletedAt) throw notFound("Transaction not found");

  const { start, end } = businessDayRange(transaction.date);
  const dayWhere = { date: { gte: start, lte: end }, deletedAt: null };

  const [byType, categoryAggregate, layout] = await Promise.all([
    prisma.transaction.groupBy({ by: ["type"], _sum: { amount: true }, where: dayWhere }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { ...dayWhere, type: transaction.type, category: transaction.category },
    }),
    prisma.formLayout.findUnique({ where: { formKey: "TRANSACTION_FORM" } }),
  ]);

  const dayIncome = round2(byType.find((t) => t.type === "INCOME")?._sum.amount ?? 0);
  const dayExpenses = round2(byType.find((t) => t.type === "EXPENSE")?._sum.amount ?? 0);
  const categoryTotal = round2(categoryAggregate._sum.amount ?? 0);
  const typeTotal = transaction.type === "INCOME" ? dayIncome : dayExpenses;
  const customData = asJsonObject(transaction.customData);

  const fallbackLayout = DEFAULT_LAYOUTS.find((item) => item.formKey === "TRANSACTION_FORM");
  const fields = layoutFields(layout?.schema ?? fallbackLayout?.schema);
  const fieldById = new Map(fields.map((f) => [f.id, f]));

  const customAttachment = Object.entries(customData).find(([key, value]) => {
    if (typeof value !== "string" || !value) return false;
    const definition = fieldById.get(key);
    const searchable = `${key} ${definition?.name || ""} ${definition?.type || ""}`.toLowerCase();
    return /(attachment|receipt|invoice|bill|document|file|upload)/.test(searchable);
  });

  const customFields = Object.entries(customData)
    .filter(
      ([key, value]) =>
        !STANDARD_FIELD_IDS.has(key) &&
        !["attachmentUrl", "receiptUrl"].includes(key) &&
        key !== customAttachment?.[0] &&
        !key.startsWith("$ACTION") &&
        value !== null &&
        value !== undefined &&
        value !== ""
    )
    .map(([key, value]) => {
      const definition = fieldById.get(key);
      return {
        id: key,
        label: definition?.name || key.replace(/^fld_tx_/, "").replace(/_/g, " "),
        type: definition?.type || "SINGLE_LINE",
        value,
      };
    });

  const attachmentUrl =
    transaction.attachmentUrl ||
    (typeof customData.attachmentUrl === "string" ? customData.attachmentUrl : null) ||
    (typeof customData.receiptUrl === "string" ? customData.receiptUrl : null) ||
    (typeof customAttachment?.[1] === "string" ? customAttachment[1] : null) ||
    null;

  return NextResponse.json(
    {
      transaction: { ...transaction, attachmentUrl, customFields },
      impact: {
        dayIncome,
        dayExpenses,
        dayNet: round2(dayIncome - dayExpenses),
        categoryTotal,
        categoryShare: typeTotal > 0 ? (categoryTotal / typeTotal) * 100 : 0,
      },
    },
    { headers: NO_STORE }
  );
});

export const PUT = route<{ id: string }>(async (request, { params }) => {
  const user = await requirePermission("view_transactions");
  const { id } = await params;
  const body = await parseJson(request, z.record(z.string(), z.unknown()));
  const updated = await updateTransaction(id, body, user);
  return NextResponse.json(updated, { headers: NO_STORE });
});

const patchSchema = z.object({ deletedAt: z.union([z.string(), z.null()]) });

/** `{ deletedAt: <date> }` trashes and `{ deletedAt: null }` restores, via the same paths as DELETE / recycle bin. */
export const PATCH = route<{ id: string }>(async (request, { params }) => {
  const user = await requirePermission("view_transactions");
  const { id } = await params;
  const { deletedAt } = await parseJson(request, patchSchema);
  const row = await loadTransactionForWrite(id, user);

  const transaction = await prisma.$transaction(async (tx) => {
    if (deletedAt === null) await restoreTransactionTx(tx, row);
    else await softDeleteTransactionTx(tx, row, user.id);
    return tx.transaction.findUniqueOrThrow({ where: { id } });
  });
  return NextResponse.json({ message: "Transaction updated successfully", transaction });
});

export const DELETE = route<{ id: string }>(async (_request, { params }) => {
  const user = await requirePermission("view_transactions");
  const { id } = await params;
  const row = await loadTransactionForWrite(id, user);
  if (row.deletedAt) throw notFound("Transaction not found");

  await prisma.$transaction((tx) => softDeleteTransactionTx(tx, row, user.id));
  return NextResponse.json({ success: true }, { headers: NO_STORE });
});
