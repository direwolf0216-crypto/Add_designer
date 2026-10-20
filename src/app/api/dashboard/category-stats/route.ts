import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { route } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/session";
import { businessMonthRange, calendarDateToUtc, toBusinessISODate } from "@/lib/dates";
import { round2 } from "@/lib/money";
import { asJsonObject } from "@/lib/services/transactions";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOT_CANCELLED: Prisma.JobWhereInput = { NOT: { status: { equals: "cancelled", mode: "insensitive" } } };

type Stats = { activeJobs: number; pendingDelivery: number; monthlyRevenue: number };

/** The job's category column, falling back to the legacy custom field for rows saved without one. */
function jobCategory(category: string | null, customData: unknown): string | null {
  if (category?.trim()) return category.trim();
  const legacy = asJsonObject(customData).fld_b_job_category;
  return typeof legacy === "string" && legacy.trim() ? legacy.trim() : null;
}

export const GET = route(async () => {
  await requirePermission("view_analytics");

  // Job dates are calendar dates stored as UTC midnight: compare against the business month's days.
  const month = businessMonthRange();
  const monthStart = calendarDateToUtc(toBusinessISODate(month.start));
  const monthEndExclusive = new Date(calendarDateToUtc(toBusinessISODate(month.end)).getTime() + DAY_MS);

  const [statusCounts, legacyJobs, monthJobs] = await Promise.all([
    prisma.job.groupBy({
      by: ["category", "status"],
      _count: { _all: true },
      where: { deletedAt: null, ...NOT_CANCELLED },
    }),
    prisma.job.findMany({
      where: { deletedAt: null, category: "", ...NOT_CANCELLED },
      select: { status: true, customData: true },
      take: 2000,
    }),
    prisma.job.findMany({
      where: { deletedAt: null, date: { gte: monthStart, lt: monthEndExclusive }, ...NOT_CANCELLED },
      select: { category: true, customData: true, order: { select: { package: true } } },
      take: 5000,
    }),
  ]);

  const stats = new Map<string, Stats>();
  const bucket = (category: string) => {
    let s = stats.get(category);
    if (!s) stats.set(category, (s = { activeJobs: 0, pendingDelivery: 0, monthlyRevenue: 0 }));
    return s;
  };
  const countStatus = (category: string, status: string, count: number) => {
    const s = bucket(category);
    const normalized = status.trim().toLowerCase();
    if (normalized !== "delivered" && normalized !== "cancelled") s.activeJobs += count;
    if (normalized === "ready for delivery") s.pendingDelivery += count;
  };

  for (const row of statusCounts) {
    const category = row.category?.trim();
    if (category) countStatus(category, row.status ?? "", row._count._all);
  }
  for (const job of legacyJobs) {
    const category = jobCategory(null, job.customData);
    if (category) countStatus(category, job.status ?? "", 1);
  }
  for (const job of monthJobs) {
    const category = jobCategory(job.category, job.customData);
    if (category && job.order?.package) {
      const s = bucket(category);
      s.monthlyRevenue = round2(s.monthlyRevenue + (Number(job.order.package) || 0));
    }
  }

  return NextResponse.json([...stats.entries()].map(([category, s]) => ({ category, ...s })));
});
