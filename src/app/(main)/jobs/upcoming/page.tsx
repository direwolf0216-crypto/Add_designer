import Link from "next/link";
import prisma from "@/lib/prisma";
import { businessTodayUtc } from "@/lib/dates";
import { requirePageUser } from "@/lib/auth/session";
import { Job } from "@/types";
import UpcomingDeliveriesFeed from "./UpcomingDeliveriesFeed";
import { jobScope } from "@/lib/jobs/scope";
import PageReveal from "@/components/motion/PageReveal";
import type React from "react";

export const dynamic = "force-dynamic";

const PAGE = 60;

async function UpcomingDeliveriesPageContent({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requirePageUser();
  // Rendered in pages of 60 so a long schedule stays light; "Show more" raises the limit.
  const limit = Math.min(600, Math.max(PAGE, Number((await searchParams).show) || PAGE));
  const scope = await jobScope(user);
  // Job dates are calendar dates stored as UTC midnight; "today" is the IST calendar day.
  const today = businessTodayUtc();

  const where = { ...scope, deletedAt: null, date: { gte: today } };
  const [dbJobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      select: {
        id: true, category: true, date: true, time: true, location: true, status: true,
        client: { select: { name: true, phone: true, email: true } },
        order: { select: { package: true, advance: true, due: true } },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: limit,
    }),
    prisma.job.count({ where }),
  ]);

  const jobs: Job[] = dbJobs.map(b => ({
    id: b.id,
    title: b.client.name,
    category: b.category,
    date: b.date.toISOString().split('T')[0],
    time: b.time,
    location: b.location,
    phone: b.client.phone,
    email: b.client.email || '',
    package: b.order?.package?.toString() || '',
    advance: b.order?.advance?.toString() || '',
    due: b.order?.due?.toString() || '',
    status: b.status as any
  }));

  return (
    <div className="w-full pb-12">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Pending Deliveries</h2>
          <p className="text-slate-500 text-sm mt-1">Focus on logistics, payments, and readiness for your next jobs.</p>
        </div>
        <div className="text-right">
          <div className="text-[2rem] font-black text-orange-500 leading-none">{total}</div>
          <div className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">Scheduled</div>
        </div>
      </div>
      
      <UpcomingDeliveriesFeed jobs={jobs} />
      {total > jobs.length && (
        <div className="mt-8 flex justify-center">
          <Link
            href={`/jobs/upcoming?show=${limit + PAGE}`}
            scroll={false}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <i className="ph-bold ph-caret-double-down" aria-hidden="true"></i>
            Show more ({total - jobs.length} remaining)
          </Link>
        </div>
      )}
    </div>
  );
}

export default async function UpcomingDeliveriesPage(props: React.ComponentProps<typeof UpcomingDeliveriesPageContent>) {
  return (
    <PageReveal>
      <UpcomingDeliveriesPageContent {...props} />
    </PageReveal>
  );
}
