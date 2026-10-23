import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";
import { businessDayRange, businessRangeFromISO, toBusinessISODate } from "@/lib/dates";
import { round2 } from "@/lib/money";
import { transactionJobScope } from "@/lib/jobs/scope";
import { addIsoDays, buildWeekSummary, mondayOf } from "@/lib/transactions/weekly";
import { splitByPaymentMode } from "@/lib/transactions/paymentModes";

/**
 * What the Daily Ledger shows: today's transactions and totals (with the Cash / UPI / Bank split) and
 * this week against last week. Used by GET /api/transactions/overview and by the ledger page, which
 * sends it with the page so the figures appear without waiting for the app's scripts.
 */
export async function loadLedgerOverview(user: SessionUser) {
  const scope = await transactionJobScope(user);
  const today = businessDayRange();
  const todayWhere: Prisma.TransactionWhereInput = { date: { gte: today.start, lte: today.end }, deletedAt: null, AND: [scope] };
  // Current Mon..Sun week plus the previous week (IST calendar days), for the weekly cards.
  const todayIso = toBusinessISODate();
  const weekRange = businessRangeFromISO(addIsoDays(mondayOf(todayIso), -7), addIsoDays(mondayOf(todayIso), 6));

  const [todayTransactions, todayTypeAgg, weekRows, todayModeAgg] = await Promise.all([
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

  const sumFor = (type: "INCOME" | "EXPENSE") => round2(todayTypeAgg.find((t) => t.type === type)?._sum.amount ?? 0);
  const todayIncome = sumFor("INCOME");
  const todayExpense = sumFor("EXPENSE");

  return {
    todayTransactions,
    todayIncome,
    todayExpense,
    todayNet: round2(todayIncome - todayExpense),
    todayByMode: splitByPaymentMode(todayModeAgg.map((r) => ({ type: r.type, paymentMode: r.paymentMode, amount: r._sum.amount }))),
    week: buildWeekSummary(weekRows, todayIso),
  };
}
