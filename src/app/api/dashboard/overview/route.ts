import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { route } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/session";
import {
  businessMonthRange,
  businessRangeFromISO,
  businessTodayUtc,
  calendarDateToUtc,
  toBusinessISODate,
} from "@/lib/dates";
import { round2 } from "@/lib/money";
import { asJsonObject } from "@/lib/services/transactions";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CHART_DAYS = 400;

/** Accepts `yyyy-MM-dd` or an ISO instant and returns the business-timezone calendar day. */
function businessDayParam(value: string | null): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : toBusinessISODate(date);
}

const statusIs = (status: string): Prisma.StringFilter => ({ equals: status, mode: "insensitive" });
const statusIsAny = (...statuses: string[]): Prisma.JobWhereInput[] => statuses.map((s) => ({ status: statusIs(s) }));

type DailyRow = { day: string; type: string; total: number };

export const GET = route(async (req) => {
  await requirePermission("view_analytics");
  const { searchParams } = new URL(req.url);

  let fromIso = businessDayParam(searchParams.get("startDate"));
  let toIso = businessDayParam(searchParams.get("endDate"));
  if (!fromIso || !toIso || fromIso > toIso) {
    const month = businessMonthRange();
    fromIso = toBusinessISODate(month.start);
    toIso = toBusinessISODate(month.end);
  }

  // Transactions are instants: bound them by the business-timezone day range.
  const { start, end } = businessRangeFromISO(fromIso, toIso) as { start: Date; end: Date };
  const txWhere: Prisma.TransactionWhereInput = { date: { gte: start, lte: end }, deletedAt: null };
  // Job dates are calendar dates stored as UTC midnight.
  const jobFrom = calendarDateToUtc(fromIso);
  const jobToExclusive = new Date(calendarDateToUtc(toIso).getTime() + DAY_MS);
  const jobRange = { gte: jobFrom, lt: jobToExclusive };

  const today = businessTodayUtc();
  const ninetyDaysOut = new Date(today.getTime() + 91 * DAY_MS);

  const [
    totalJobs,
    upcomingShoots,
    pendingRetouch,
    activeOrders,
    totalActiveOrders,
    unconfirmedJobsCount,
    prefsDoc,
    transactions,
    dailyRows,
    typeAgg,
    jobsForChart,
    upcomingAllJobs,
  ] = await Promise.all([
    prisma.job.count({ where: { deletedAt: null, NOT: { status: statusIs("cancelled") }, date: jobRange } }),
    prisma.job.findMany({
      where: { deletedAt: null, date: { gte: today } },
      select: {
        id: true,
        date: true,
        time: true,
        location: true,
        status: true,
        customData: true,
        client: { select: { name: true, phone: true } },
        order: { select: { package: true } },
      },
      orderBy: { date: "asc" },
      take: 3,
    }),
    // Product orders have been written with both spellings of the ready state.
    prisma.productOrder.count({ where: { OR: [{ status: statusIs("READY_FOR_PICKUP") }, { status: statusIs("READY") }] } }),
    prisma.productOrder.findMany({
      where: { NOT: { status: statusIs("DELIVERED") } },
      select: { id: true, quantity: true, status: true, clientName: true, product: { select: { name: true, price: true } } },
      orderBy: { createdAt: "desc" },
      take: 1,
    }),
    prisma.productOrder.count({ where: { NOT: { status: statusIs("DELIVERED") } } }),
    prisma.job.count({ where: { deletedAt: null, status: statusIs("pending"), date: jobRange } }),
    prisma.systemSetting.findUnique({ where: { key: "UI_PREFERENCES" } }),
    prisma.transaction.findMany({
      where: txWhere,
      orderBy: { date: "desc" },
      take: 10,
      select: { id: true, transactionId: true, amount: true, type: true, category: true, paymentMode: true, description: true, date: true },
    }),
    // Daily totals bucketed by the business-timezone calendar day, aggregated in the database.
    prisma.$queryRaw<DailyRow[]>`
      SELECT to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
             "type"::text AS type,
             COALESCE(SUM("amount"), 0)::float8 AS total
      FROM "Transaction"
      WHERE "deletedAt" IS NULL
        AND ("date" AT TIME ZONE 'UTC') >= ${start}::timestamptz
        AND ("date" AT TIME ZONE 'UTC') <= ${end}::timestamptz
      GROUP BY 1, 2`,
    prisma.transaction.groupBy({ by: ["type"], _sum: { amount: true }, where: txWhere }),
    prisma.job.findMany({
      where: { deletedAt: null, NOT: { OR: statusIsAny("delivered", "cancelled") } },
      select: { id: true, date: true, status: true, category: true, customData: true, client: { select: { name: true } } },
      orderBy: { date: "asc" },
      take: 500,
    }),
    prisma.job.findMany({
      where: { deletedAt: null, date: { gte: today, lt: ninetyDaysOut } },
      select: { date: true, order: { select: { package: true } } },
      take: 5000,
    }),
  ]);

  const periodIncome = round2(typeAgg.find((t) => t.type === "INCOME")?._sum.amount ?? 0);
  const periodExpense = round2(typeAgg.find((t) => t.type === "EXPENSE")?._sum.amount ?? 0);

  const dailyDataMap: Record<string, { date: string; income: number; expense: number }> = {};
  for (let t = jobFrom.getTime(), n = 0; t < jobToExclusive.getTime() && n < MAX_CHART_DAYS; t += DAY_MS, n++) {
    const day = new Date(t).toISOString().slice(0, 10);
    dailyDataMap[day] = { date: day, income: 0, expense: 0 };
  }
  for (const row of dailyRows) {
    const bucket = dailyDataMap[row.day];
    if (!bucket) continue;
    if (row.type === "INCOME") bucket.income = round2(bucket.income + Number(row.total));
    if (row.type === "EXPENSE") bucket.expense = round2(bucket.expense + Number(row.total));
  }
  const revenueChartData = Object.values(dailyDataMap).sort((a, b) => a.date.localeCompare(b.date));

  const albumStages = ["shoot completed", "designing", "printing", "album work in progress"];
  const jobBreakdownData = jobsForChart
    .flatMap((job) => {
      const cd = asJsonObject(job.customData);
      const inclusions = cd.fld_b_inclusions;
      const isAlbum =
        job.category === "Album" ||
        (Array.isArray(inclusions) || typeof inclusions === "string" ? inclusions.includes("Album") : false) ||
        !!cd.album_status ||
        !!cd.fld_b_album_status;
      const qualifies = isAlbum || albumStages.includes((job.status || "").trim().toLowerCase());
      const albumStatus = typeof cd.fld_b_album_status === "string" && cd.fld_b_album_status ? cd.fld_b_album_status : "Pending";
      if (!qualifies || albumStatus.trim().toLowerCase() === "delivered") return [];
      return [{ id: job.id, clientName: job.client?.name || "Unknown", status: albumStatus, date: job.date }];
    })
    .slice(0, 5);

  const prefs = asJsonObject(prefsDoc?.value);
  const hotDateBenchmark = Number(prefs.hotDateBenchmark ?? prefs.hotDateThreshold ?? 50000) || 50000;

  const dateSums: Record<string, number> = {};
  for (const job of upcomingAllJobs) {
    const day = toBusinessISODate(job.date);
    dateSums[day] = (dateSums[day] || 0) + (job.order?.package || 0);
  }
  const hotDatesCount = Object.values(dateSums).filter((sum) => sum >= hotDateBenchmark).length;

  return NextResponse.json({
    totalJobs,
    upcomingShoots,
    pendingRetouch,
    topOrder: activeOrders[0] || null,
    totalActiveOrders,
    transactions,
    periodIncome,
    periodExpense,
    periodNet: round2(periodIncome - periodExpense),
    hotDatesCount,
    revenueChartData,
    jobBreakdownData,
    unconfirmedJobsCount,
  });
});
