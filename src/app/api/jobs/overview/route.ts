import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";
import { businessTodayUtc } from "@/lib/dates";
import { round2 } from "@/lib/money";
import { PRODUCTION_DONE_STATUSES } from "@/lib/services/jobs";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PREFS = { currencySymbol: "₹", hotDateBenchmark: 50000 };
const FINISHING_WORK_STATUSES = ["designing", "printing", "finishing in progress"];

const NOT_CANCELLED: Prisma.JobWhereInput = {
  NOT: [
    { status: { equals: "Cancelled", mode: "insensitive" } },
    { status: { equals: "Canceled", mode: "insensitive" } },
  ],
};

function readCustomData(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

const lower = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

export const GET = route(async () => {
  await requireUser();

  // Job.date is a calendar date stored as UTC midnight; day boundaries are IST calendar days.
  const today = businessTodayUtc();
  const day = (offset: number) => new Date(today.getTime() + offset * DAY_MS);

  const [setting, dbJobs, immediateJobs, thisWeekJobs, unconfirmedJobs, pendingDueAgg, finishingJobs] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: "UI_PREFERENCES" } }),
    prisma.job.findMany({
      where: { deletedAt: null, date: { gte: day(-30) } },
      select: {
        id: true,
        jobNumber: true,
        category: true,
        date: true,
        time: true,
        status: true,
        customData: true,
        client: { select: { name: true } },
        order: { select: { package: true } },
      },
      orderBy: { date: "desc" },
      take: 2000,
    }),
    // Today or tomorrow
    prisma.job.count({ where: { deletedAt: null, date: { gte: today, lt: day(2) } } }),
    // Next 7 days, excluding today
    prisma.job.count({ where: { deletedAt: null, date: { gte: day(1), lt: day(8) } } }),
    prisma.job.count({
      where: { deletedAt: null, status: { equals: "Pending", mode: "insensitive" }, date: { gte: today, lt: day(14) } },
    }),
    // Order.due is kept in sync with the job's payments (refreshOrderTotals).
    prisma.order.aggregate({
      _sum: { due: true },
      where: { job: { deletedAt: null, date: { gte: today, lt: day(14) }, ...NOT_CANCELLED } },
    }),
    // Finishing starts once printing is done and stays open until delivered.
    prisma.job.findMany({
      where: {
        deletedAt: null,
        proofDelivered: false,
        OR: [...PRODUCTION_DONE_STATUSES, ...FINISHING_WORK_STATUSES].map((s) => ({ status: { equals: s, mode: "insensitive" as const } })),
      },
      select: { status: true, finishingStatus: true, customData: true },
      take: 5000,
    }),
  ]);

  const prefs =
    setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)
      ? { ...DEFAULT_PREFS, ...(setting.value as Record<string, unknown>) }
      : DEFAULT_PREFS;

  const jobs = dbJobs.map((b) => ({
    id: b.id,
    jobNumber: b.jobNumber,
    title: b.client.name,
    category: b.category,
    date: b.date.toISOString().slice(0, 10),
    time: b.time,
    status: b.status,
    customData: readCustomData(b.customData),
  }));

  const dateStats = new Map<string, { count: number; totalPackage: number }>();
  for (const b of dbJobs) {
    if (b.date < today) continue;
    const key = b.date.toISOString().slice(0, 10);
    const stats = dateStats.get(key) ?? { count: 0, totalPackage: 0 };
    stats.count++;
    stats.totalPackage = round2(stats.totalPackage + (b.order?.package ?? 0));
    dateStats.set(key, stats);
  }
  const benchmark = Number(prefs.hotDateBenchmark) || DEFAULT_PREFS.hotDateBenchmark;
  const hotDates = [...dateStats]
    .filter(([, s]) => s.totalPackage >= benchmark)
    .map(([date, s]) => ({ date, totalAmount: s.totalPackage, count: s.count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let finishingInProgressCount = 0;
  let pendingFinishingCount = 0;
  for (const b of finishingJobs) {
    const finishing = lower(readCustomData(b.customData).fld_b_finishing_status);
    if (finishing === "delivered") continue;
    const inProgress =
      FINISHING_WORK_STATUSES.includes(lower(b.status)) || b.finishingStatus === "IN_PROGRESS" || (finishing !== "" && finishing !== "pending");
    if (inProgress) finishingInProgressCount++;
    else pendingFinishingCount++;
  }

  return NextResponse.json(
    {
      jobs,
      prefs,
      metrics: {
        immediateJobs,
        thisWeekJobs,
        pendingDueAmount: round2(pendingDueAgg._sum.due ?? 0),
        unconfirmedJobs,
        hotDates,
        finishingInProgressCount,
        pendingFinishingCount,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
});
