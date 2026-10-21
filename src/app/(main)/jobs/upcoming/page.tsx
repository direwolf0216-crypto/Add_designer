import prisma from "@/lib/prisma";
import { businessTodayUtc } from "@/lib/dates";
import { requirePageUser } from "@/lib/auth/session";
import { Job } from "@/types";
import UpcomingDeliveriesFeed from "./UpcomingDeliveriesFeed";
import { jobScope } from "@/lib/jobs/scope";

export const dynamic = "force-dynamic";

export default async function UpcomingDeliveriesPage() {
  const user = await requirePageUser();
  const scope = await jobScope(user);
  // Job dates are calendar dates stored as UTC midnight; "today" is the IST calendar day.
  const today = businessTodayUtc();

  const dbJobs = await prisma.job.findMany({
    where: { ...scope, 
      deletedAt: null,
      date: { gte: today }
    },
    include: { client: true, order: true },
    orderBy: [
      { date: 'asc' },
      { time: 'asc' }
    ],
    take: 500,
  });

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
          <div className="text-[2rem] font-black text-orange-500 leading-none">{jobs.length}</div>
          <div className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">Scheduled</div>
        </div>
      </div>
      
      <UpcomingDeliveriesFeed jobs={jobs} />
    </div>
  );
}
