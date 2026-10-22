import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
import { jobScope } from "@/lib/jobs/scope";
import { teamStagesFor } from "@/lib/services/teams";
import { stageOptions } from "@/lib/jobs/tracking";

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

const finishingStages = ["printing completed", "designing", "printing", "finishing in progress"];
const FINISHING_WORK = /binding|lamination|framing/i;

export const GET = route(async (req) => {
  const user = await requirePermission("view_analytics");
  const [scope, teamStages] = await Promise.all([jobScope(user), teamStagesFor(user.id)]);
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
    upcomingJobs,
    pendingProofs,
    activeOrders,
    totalActiveOrders,
    unconfirmedJobsCount,
    prefsDoc,
    transactions,
    dailyRows,
    typeAgg,
    modeAgg,
    jobsForChart,
    upcomingAllJobs,
    jobLayout,
    stageGroups,
  ] = await Promise.all([
    prisma.job.count({ where: { ...scope, deletedAt: null, NOT: { status: statusIs("cancelled") }, date: jobRange } }),
    prisma.job.findMany({
      where: { ...scope, deletedAt: null, date: { gte: today } },
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
    prisma.job.count({ where: { ...scope, deletedAt: null, status: statusIs("pending"), date: jobRange } }),
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
    prisma.transaction.groupBy({ by: ["type", "paymentMode"], _sum: { amount: true }, where: txWhere }),
    // Candidate finishing jobs, filtered in the database; only a handful are shown.
    prisma.job.findMany({
      where: {
        ...scope,
        deletedAt: null,
        NOT: { OR: statusIsAny("delivered", "cancelled") },
        OR: [
          ...["bind", "lamin", "fram"].map((word) => ({ category: { contains: word, mode: "insensitive" as const } })),
          { customData: { path: ["fld_b_finishing_status"], not: Prisma.AnyNull } },
          { customData: { path: ["fld_b_inclusions"], string_contains: "Bind" } },
          ...finishingStages.map((stage) => ({ status: { equals: stage, mode: "insensitive" as const } })),
        ],
      },
      select: { id: true, date: true, status: true, category: true, customData: true, client: { select: { name: true } } },
      orderBy: { date: "asc" },
      take: 25,
    }),
    // Per-day package totals for the hot-date count, summed in the database (not 5,000 rows over the wire).
    prisma.$queryRaw<{ day: string; total: number }[]>`
      SELECT to_char(j."date", 'YYYY-MM-DD') AS day, COALESCE(SUM(o."package"), 0)::float8 AS total
      FROM "Job" j
      LEFT JOIN "Order" o ON o."jobId" = j."id"
      WHERE j."deletedAt" IS NULL
        AND j."date" >= ${today} AND j."date" < ${ninetyDaysOut}
        ${Object.keys(scope).length > 0
          ? Prisma.sql`AND (EXISTS (SELECT 1 FROM "JobAssignment" a WHERE a."jobId" = j."id" AND a."userId" = ${user.id})
              OR lower(j."stage") = ANY(${teamStages.map((st) => st.toLowerCase())}::text[]))`
          : Prisma.empty}
      GROUP BY 1`,
    prisma.formLayout.findUnique({ where: { formKey: "JOB_FORM" }, select: { schema: true } }),
    // Every job in scope by board stage; the open ones become the press pipeline.
    prisma.job.groupBy({ by: ["stage"], where: { ...scope, deletedAt: null }, _count: { _all: true } }),
  ]);

  // Press pipeline: open jobs per board stage, in board order (no stage yet counts as the first stage).
  const boardStages = stageOptions(jobLayout?.schema as Parameters<typeof stageOptions>[0]);
  const stageCounts = new Map<string, number>();
  for (const g of stageGroups) {
    const key = (g.stage || boardStages[0]?.label || "Pending").toLowerCase();
    stageCounts.set(key, (stageCounts.get(key) ?? 0) + g._count._all);
  }
  const pipeline = boardStages
    .filter((s) => !/^delivered$|cancel/i.test(s.label.trim()))
    .map((s) => ({ stage: s.label, count: stageCounts.get(s.label.toLowerCase()) ?? 0 }));

  const periodIncome = round2(typeAgg.find((t) => t.type === "INCOME")?._sum.amount ?? 0);
  const periodExpense = round2(typeAgg.find((t) => t.type === "EXPENSE")?._sum.amount ?? 0);
  // Cash / UPI / other split of the same period, for the KPI tiles (matches the ledger's Net today card).
  const byMode = { cash: { income: 0, expense: 0 }, upi: { income: 0, expense: 0 }, other: { income: 0, expense: 0 } };
  for (const row of modeAgg) {
    const mode = (row.paymentMode || "").toLowerCase();
    const bucket = mode === "cash" ? byMode.cash : mode === "upi" ? byMode.upi : byMode.other;
    bucket[row.type === "INCOME" ? "income" : "expense"] += row._sum.amount ?? 0;
  }
  const periodByMode = Object.fromEntries(Object.entries(byMode).map(([k, v]) => [k, { income: round2(v.income), expense: round2(v.expense), net: round2(v.income - v.expense) }]));

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

  const jobBreakdownData = jobsForChart
    .flatMap((job) => {
      const cd = asJsonObject(job.customData);
      const inclusions = cd.fld_b_inclusions;
      const inclusionList = Array.isArray(inclusions) ? inclusions : typeof inclusions === "string" ? [inclusions] : [];
      const isFinishing =
        FINISHING_WORK.test(job.category || "") ||
        inclusionList.some((item) => typeof item === "string" && FINISHING_WORK.test(item)) ||
        !!cd.fld_b_finishing_status;
      const qualifies = isFinishing || finishingStages.includes((job.status || "").trim().toLowerCase());
      const finishingStatus = typeof cd.fld_b_finishing_status === "string" && cd.fld_b_finishing_status ? cd.fld_b_finishing_status : "Pending";
      if (!qualifies || finishingStatus.trim().toLowerCase() === "delivered") return [];
      return [{ id: job.id, clientName: job.client?.name || "Unknown", status: finishingStatus, date: job.date }];
    })
    .slice(0, 5);

  const prefs = asJsonObject(prefsDoc?.value);
  const hotDateBenchmark = Number(prefs.hotDateBenchmark ?? prefs.hotDateThreshold ?? 50000) || 50000;

  const dateSums: Record<string, number> = {};
  for (const row of upcomingAllJobs) dateSums[row.day] = row.total;
  const hotDatesCount = Object.values(dateSums).filter((sum) => sum >= hotDateBenchmark).length;

  return NextResponse.json({
    totalJobs,
    upcomingJobs,
    pendingProofs,
    topOrder: activeOrders[0] || null,
    totalActiveOrders,
    transactions,
    periodIncome,
    periodExpense,
    periodNet: round2(periodIncome - periodExpense),
    periodByMode,
    hotDatesCount,
    revenueChartData,
    jobBreakdownData,
    unconfirmedJobsCount,
    pipeline,
  });
});
