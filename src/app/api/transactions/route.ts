import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { route, parseJson, intParam, badRequest } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/session";
import { broadcastLater } from "@/lib/notifications";
import { newTransactionRef, withUniqueRetry } from "@/lib/ids";
import { refreshOrderTotals } from "@/lib/services/jobs";
import { paymentLabel, recordJobActivity } from "@/lib/services/activity";
import {
  notifyIfBudgetExceeded,
  transactionCreateSchema,
  transactionData,
  updateTransaction,
} from "@/lib/services/transactions";
import { businessDayRange, businessMonthRange, businessRangeFromISO, businessWeekRange } from "@/lib/dates";
import { transactionJobScope } from "@/lib/jobs/scope";

const PAGE_SIZE = 25;
const NO_STORE = { "Cache-Control": "private, no-store" };

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoMonth = z.string().regex(/^\d{4}-\d{2}$/);

function dateFilter(searchParams: URLSearchParams): Prisma.DateTimeFilter | undefined {
  const dateFrom = isoDay.safeParse(searchParams.get("dateFrom")).data;
  const dateTo = isoDay.safeParse(searchParams.get("dateTo")).data;
  if (dateFrom || dateTo) {
    const { start, end } = businessRangeFromISO(dateFrom, dateTo);
    return { ...(start && { gte: start }), ...(end && { lte: end }) };
  }
  const month = isoMonth.safeParse(searchParams.get("month")).data;
  if (month) {
    const { start, end } = businessMonthRange(businessRangeFromISO(`${month}-01`).start);
    return { gte: start, lte: end };
  }
  const view = searchParams.get("view");
  const range =
    view === "day" ? businessDayRange() : view === "week" ? businessWeekRange() : view === "month" ? businessMonthRange() : null;
  return range ? { gte: range.start, lte: range.end } : undefined;
}

const amountParam = (value: string | null) => {
  const n = value ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
};

export const GET = route(async (request) => {
  const user = await requirePermission("view_transactions");
  const url = new URL(request.url);
  const { searchParams } = url;

  // AND keeps the job-visibility OR separate from any OR the filters below add.
  const where: Prisma.TransactionWhereInput = { deletedAt: null, AND: [await transactionJobScope(user)] };

  const date = dateFilter(searchParams);
  if (date) where.date = date;

  const legacyCategory = searchParams.get("category");
  const categories = searchParams.get("categories")
    ? searchParams.get("categories")!.split(",").map((c) => c.trim()).filter(Boolean).slice(0, 50)
    : legacyCategory && legacyCategory !== "All"
      ? [legacyCategory]
      : [];
  if (categories.length > 0) where.category = { in: categories };

  const amountMin = amountParam(searchParams.get("amountMin"));
  const amountMax = amountParam(searchParams.get("amountMax"));
  if (amountMin !== undefined || amountMax !== undefined) {
    where.amount = { ...(amountMin !== undefined && { gte: amountMin }), ...(amountMax !== undefined && { lte: amountMax }) };
  }

  const type = searchParams.get("type");
  if (type === "INCOME" || type === "EXPENSE") where.type = type;
  const paymentMode = searchParams.get("paymentMode");
  if (paymentMode && paymentMode !== "ALL") where.paymentMode = paymentMode;

  const page = intParam(url, "page", 1, 1, 10_000);

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize: PAGE_SIZE }, { headers: NO_STORE });
});

export const POST = route(async (request) => {
  const user = await requirePermission("view_transactions");
  const body = await parseJson(request, transactionCreateSchema);
  const data = transactionData(body);

  // A unique violation aborts the whole Postgres transaction, so the retry wraps the transaction.
  const created = await withUniqueRetry(
    (transactionId) =>
      prisma.$transaction(async (tx) => {
        if (body.jobId) {
          const job = await tx.job.findUnique({ where: { id: body.jobId }, select: { deletedAt: true } });
          if (!job || job.deletedAt) throw badRequest("Linked job not found");
        }
        if (body.productOrderId) {
          const order = await tx.productOrder.findUnique({ where: { id: body.productOrderId }, select: { id: true } });
          if (!order) throw badRequest("Linked product order not found");
        }
        const row = await tx.transaction.create({
          data: {
            ...data,
            transactionId,
            userId: user.id,
            jobId: body.jobId ?? null,
            productOrderId: body.productOrderId ?? null,
          },
        });
        if (row.jobId && row.type === "INCOME") await refreshOrderTotals(tx, row.jobId);
        if (row.jobId) {
          await recordJobActivity(tx, {
            jobId: row.jobId,
            actorId: user.id,
            type: "PAYMENT_ADDED",
            summary: `Recorded ${row.type === "INCOME" ? "payment" : "expense"} ${paymentLabel(row.amount, row.paymentMode)}`,
          });
        }
        return row;
      }),
    newTransactionRef
  );

  if (created.type === "INCOME") {
    broadcastLater({
      title: "Payment Received",
      message: `A payment of ₹${created.amount.toLocaleString("en-IN")} was logged via ${created.paymentMode}.`,
      type: "PAYMENT_RECEIVED",
      actionUrl: "/transactions",
      entityId: created.id,
      entityType: "transaction",
      skipUserId: user.id,
    });
  } else {
    // The row is already saved; a failed budget check must not turn this into an error response.
    await notifyIfBudgetExceeded(user.id, created.category, created.date).catch((e) =>
      console.error("[transactions] budget check failed", e)
    );
  }

  return NextResponse.json(created, { status: 201, headers: NO_STORE });
});

/** Legacy collection update (`{ id, ...fields }`); same rules as PUT /api/transactions/[id]. */
export const PUT = route(async (request) => {
  const user = await requirePermission("view_transactions");
  const body = await parseJson(request, z.looseObject({ id: z.string().min(1, "Transaction ID required") }));
  const updated = await updateTransaction(body.id, body, user);
  return NextResponse.json(updated, { headers: NO_STORE });
});
