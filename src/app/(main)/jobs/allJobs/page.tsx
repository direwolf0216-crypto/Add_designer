import JobTable from '@/components/dashboard/JobTable';
import prisma from "@/lib/prisma";
import { Job } from "@/types";

export const dynamic = 'force-dynamic';

export default async function AllJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params?.page) || 1;
  const filter = params?.filter;
  const limit = 10;
  const skip = (page - 1) * limit;

  const whereClause: any = { deletedAt: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (filter === 'today_tomorrow') {
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(today.getDate() + 2);
    whereClause.date = { gte: today, lt: dayAfterTomorrow };
  } else if (filter === 'next_7_days') {
    const next7Days = new Date(today);
    next7Days.setDate(today.getDate() + 7);
    whereClause.date = { gte: today, lt: next7Days };
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
