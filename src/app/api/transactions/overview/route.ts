import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { route } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/session";
import { businessDayRange, businessRangeFromISO, toBusinessISODate } from "@/lib/dates";
import { round2 } from "@/lib/money";
import { transactionJobScope } from "@/lib/jobs/scope";
import { addIsoDays, buildWeekSummary, mondayOf } from "@/lib/transactions/weekly";
import { splitByPaymentMode } from "@/lib/transactions/paymentModes";

/** Accepts `yyyy-MM-dd` or an ISO instant and returns the business-timezone calendar day. */
function businessDayParam(value: string | null): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : toBusinessISODate(date);
}

export const GET = route(async (req) => {
  const user = await requirePermission("view_transactions");
  const { searchParams } = new URL(req.url);

  const scope = await transactionJobScope(user);
  const where: Prisma.TransactionWhereInput = { deletedAt: null, AND: [scope] };
  const { start, end } = businessRangeFromISO(
    businessDayParam(searchParams.get("startDate")),
    businessDayParam(searchParams.get("endDate"))
  );
  if (start || end) where.date = { ...(start && { gte: start }), ...(end && { lte: end }) };

  const today = businessDayRange();
  const todayWhere: Prisma.TransactionWhereInput = { date: { gte: today.start, lte: today.end }, deletedAt: null, AND: [scope] };
  // Current Mon..Sun week plus the previous week (IST calendar days), for the weekly cards.
  const todayIso = toBusinessISODate();
  const weekRange = businessRangeFromISO(addIsoDays(mondayOf(todayIso), -7), addIsoDays(mondayOf(todayIso), 6));

  const [typeAgg, categoryExpenses, recentTransactions, todayTransactions, todayTypeAgg, weekRows, todayModeAgg] = await Promise.all([
    prisma.transaction.groupBy({ by: ["type"], _sum: { amount: true }, where }),
    prisma.transaction.groupBy({ by: ["category"], _sum: { amount: true }, where: { ...where, type: "EXPENSE" } }),
    prisma.transaction.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 100 }),
    prisma.transaction.findMany({ where: todayWhere, orderBy: { date: "desc" }, take: 200 }),
    prisma.transaction.groupBy({ by: ["type"], _sum: { amount: true }, where: todayWhere }),
    prisma.transaction.findMany({
      where: { deletedAt: null, AND: [scope], date: { gte: weekRange.start, lte: weekRange.end } },
      select: { amount: true, type: true, date: true, category: true },
      take: 50000,
    }),
    // Every one of today's transactions by payment mode (the list above is capped).
    prisma.transaction.groupBy({ by: ["type", "paymentMode"], _sum: { amount: true }, where: todayWhere }),
  ]);

  const sumFor = (rows: typeof typeAgg, type: "INCOME" | "EXPENSE") =>
    round2(rows.find((t) => t.type === type)?._sum.amount ?? 0);

  const todayIncome = sumFor(todayTypeAgg, "INCOME");
  const todayExpense = sumFor(todayTypeAgg, "EXPENSE");

  return NextResponse.json({
    totalIncome: sumFor(typeAgg, "INCOME"),
    totalExpenses: sumFor(typeAgg, "EXPENSE"),
    expensesByCategory: Object.fromEntries(categoryExpenses.map((c) => [c.category, round2(c._sum.amount ?? 0)])),
    recentTransactions,
    todayTransactions,
    todayIncome,
    todayExpense,
    todayNet: round2(todayIncome - todayExpense),
    todayByMode: splitByPaymentMode(todayModeAgg.map((r) => ({ type: r.type, paymentMode: r.paymentMode, amount: r._sum.amount }))),
    week: buildWeekSummary(weekRows, todayIso),
  });
});
