import "server-only";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { Job } from "@/types";
import type { SessionUser } from "@/lib/auth/session";
import { parseJobFilters } from "@/lib/jobs/filters";
import { buildJobWhere } from "@/lib/jobs/where";
import { jobScope } from "@/lib/jobs/scope";
import { addDays, businessTodayUtc } from "@/lib/dates";

type Params = Record<string, string | string[] | undefined>;

/** Shared loader for the All Jobs and My Jobs tables: URL filters, visibility scope, pagination. */
export async function loadJobTablePage(user: SessionUser, params: Params, extraWhere: Prisma.JobWhereInput = {}, pageSize = 10) {
  const page = Math.max(1, Number(params?.page) || 1);
  const filter = typeof params?.filter === "string" ? params.filter : undefined;

  const where: Prisma.JobWhereInput = { ...buildJobWhere(parseJobFilters(params)), ...(await jobScope(user)) };
  if (Object.keys(extraWhere).length) where.AND = [extraWhere];
  // Job dates are calendar dates stored as UTC midnight; "today" is the IST calendar day.
  const today = businessTodayUtc();
  if (filter === "today_tomorrow") where.date = { gte: today, lt: addDays(today, 2) };
  else if (filter === "next_7_days") where.date = { gte: today, lt: addDays(today, 7) };
  else if (filter === "hot_dates") where.date = { gte: today };
  else if (filter === "overdue") where.date = { lt: today };

  const [rows, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include: {
        client: true,
        order: true,
        assignments: { select: { userId: true, user: { select: { id: true, name: true, image: true } } } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.job.count({ where }),
  ]);

  const jobs: Job[] = rows.map((b) => ({
    id: b.id,
    jobNumber: b.jobNumber,
    title: b.client.name,
    category: b.category,
    date: b.date.toISOString().split("T")[0],
    time: b.time,
    location: b.location,
    phone: b.client.phone,
    email: b.client.email || "",
    package: b.order?.package.toString() || "",
    advance: b.order?.advance.toString() || "",
    due: b.order?.due.toString() || "",
    status: b.status,
    customData: b.customData as Record<string, unknown> | null,
    assignees: b.assignments,
  }));

  return { jobs, page, totalPages: Math.ceil(total / pageSize), total };
}
