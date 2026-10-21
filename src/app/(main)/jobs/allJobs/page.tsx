import JobTable from '@/components/dashboard/JobTable';
import prisma from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth/session";
import { Job } from "@/types";
import { parseJobFilters } from "@/lib/jobs/filters";
import { buildJobWhere } from "@/lib/jobs/where";
import { addDays, businessTodayUtc } from "@/lib/dates";
import { jobScope } from "@/lib/jobs/scope";

export const dynamic = 'force-dynamic';

export default async function AllJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser();
  const scope = await jobScope(user);
  const params = await searchParams;
  const page = Math.max(1, Number(params?.page) || 1);
  const filter = typeof params?.filter === 'string' ? params.filter : undefined;
  const limit = 10;
  const skip = (page - 1) * limit;

  const whereClause = { ...buildJobWhere(parseJobFilters(params)), ...scope };
  // Job dates are calendar dates stored as UTC midnight; "today" is the IST calendar day.
  const today = businessTodayUtc();

  if (filter === 'today_tomorrow') {
    whereClause.date = { gte: today, lt: addDays(today, 2) };
  } else if (filter === 'next_7_days') {
    whereClause.date = { gte: today, lt: addDays(today, 7) };
  } else if (filter === 'hot_dates') {
    whereClause.date = { gte: today };
  }

  const [dbJobs, totalCount] = await Promise.all([
    prisma.job.findMany({
      where: whereClause,
      include: { client: true, order: true },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.job.count({ where: whereClause })
  ]);

  const jobs: Job[] = dbJobs.map((b: typeof dbJobs[number]) => ({
    id: b.id,
    title: b.client.name,
    category: b.category,
    date: b.date.toISOString().split('T')[0],
    time: b.time,
    location: b.location,
    phone: b.client.phone,
    email: b.client.email || '',
    package: b.order?.package.toString() || '',
    advance: b.order?.advance.toString() || '',
    due: b.order?.due.toString() || '',
    status: b.status as any,
    customData: b.customData as Record<string, any> | null
  }));

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <JobTable jobs={jobs} currentPage={page} totalPages={totalPages} />
  );
}
