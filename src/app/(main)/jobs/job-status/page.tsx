import prisma from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth/session";
import JobStatusClient from "./JobStatusClient";
import { jobScope } from "@/lib/jobs/scope";

export const dynamic = "force-dynamic";

export default async function JobStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requirePageUser();
  const scope = await jobScope(user);
  const params = await searchParams;
  const initialTab = params?.tab || 'Pending';
  
  const [dbJobs, teamUsers] = await Promise.all([
    prisma.job.findMany({
      where: { ...scope, 
        deletedAt: null,
      },
      select: {
        id: true,
        jobNumber: true,
        category: true,
        date: true,
        time: true,
        location: true,
        status: true,
        finishingStatus: true,
        customData: true,
        createdAt: true,
        updatedAt: true,
        client: { select: { id: true, name: true, phone: true } },
        order: { select: { id: true, package: true, advance: true, due: true } },
        assignments: { select: { userId: true, user: { select: { id: true, name: true, image: true } } } },
      },
      orderBy: [
        { date: 'desc' },
        { time: 'desc' }
      ],
      // Status board shows the most recent jobs; older ones are reachable from All Jobs.
      take: 1000,
    }),
    prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, role: true }
    })
  ]);

  // Filter for jobs that have a specific printing status
  const jobJobs = dbJobs.filter(b => {
    let customData = {};
    try {
      if (b.customData) {
        customData = typeof b.customData === 'string' ? JSON.parse(b.customData) : b.customData;
      }
    } catch(e) {}
    
    // We are a printing press now, so all jobs are relevant
    return true;
  });

  // Serialize to avoid Next.js issues with dates
  const serializedJobs = jobJobs.map(b => {
    let cd: any = {};
    try {
      cd = typeof b.customData === 'string' ? JSON.parse(b.customData) : (b.customData || {});
    } catch(e) {}

    if (!cd.fld_b_job_status && (b.status || '').trim().toLowerCase() === 'delivered') {
      cd.fld_b_job_status = 'Delivered';
    }

    return {
      ...b,
      date: b.date.toISOString(),
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      customData: JSON.stringify(cd)
    };
  });

  return <JobStatusClient jobs={serializedJobs as any} teamUsers={teamUsers} initialTab={initialTab} />;
}
