import JobTable from "@/components/dashboard/JobTable";
import PageHeader from "@/components/ui/page-header";
import StatCard from "@/components/ui/stat-card";
import EmptyState from "@/components/ui/empty-state";
import prisma from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth/session";
import { loadJobTablePage } from "@/lib/jobs/jobTablePage";
import { jobScope } from "@/lib/jobs/scope";
import { addDays, businessTodayUtc } from "@/lib/dates";
import PageReveal from "@/components/motion/PageReveal";
import type React from "react";

export const dynamic = "force-dynamic";

const NOT_CLOSED = { NOT: [{ status: { equals: "Delivered", mode: "insensitive" as const } }, { status: { equals: "Cancelled", mode: "insensitive" as const } }] };

/** Jobs assigned to the signed-in user. */
async function MyJobsPageContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const active = typeof params.filter === "string" ? params.filter : undefined;
  const mine = { assignments: { some: { userId: user.id } } };

  const today = businessTodayUtc();
  const base = { ...(await jobScope(user)), ...mine };
  const [{ jobs, page, totalPages, total }, all, dueSoon, thisWeek, overdue] = await Promise.all([
    loadJobTablePage(user, params, mine),
    prisma.job.count({ where: base }),
    prisma.job.count({ where: { ...base, ...NOT_CLOSED, date: { gte: today, lt: addDays(today, 2) } } }),
    prisma.job.count({ where: { ...base, ...NOT_CLOSED, date: { gte: today, lt: addDays(today, 7) } } }),
    prisma.job.count({ where: { ...base, ...NOT_CLOSED, date: { lt: today } } }),
  ]);

  const tiles = [
    { id: undefined, label: "Assigned to me", value: all, icon: "ph-user-focus", tone: "slate" as const },
    { id: "today_tomorrow", label: "Due today & tomorrow", value: dueSoon, icon: "ph-alarm", tone: "orange" as const },
    { id: "next_7_days", label: "Next 7 days", value: thisWeek, icon: "ph-calendar-check", tone: "sky" as const },
    { id: "overdue", label: "Past due date", value: overdue, icon: "ph-warning-octagon", tone: "rose" as const },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon="ph-briefcase"
        title="My Jobs"
        subtitle={`${all} job${all === 1 ? "" : "s"} assigned to you`}
      />

      <nav aria-label="My jobs filters" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <div key={t.label} className="animate-rise" style={{ ["--i" as string]: i }}>
          <StatCard
            icon={t.icon}
            label={t.label}
            value={t.value}
            tone={t.tone}
            href={t.id ? `/jobs/my-jobs?filter=${t.id}` : "/jobs/my-jobs"}
            selected={active === t.id}
          />
          </div>
        ))}
      </nav>

      {total === 0 ? (
        <EmptyState
          icon="ph-tray"
          title={active ? "Nothing here for this filter" : "No jobs assigned to you yet"}
          description={active ? "Try another filter above." : "When a job is assigned to you it shows up here, and you'll get a notification."}
        />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.25)] backdrop-blur">
          <JobTable jobs={jobs} currentPage={page} totalPages={totalPages} />
        </div>
      )}
    </div>
  );
}

export default async function MyJobsPage(props: React.ComponentProps<typeof MyJobsPageContent>) {
  return (
    <PageReveal>
      <MyJobsPageContent {...props} />
    </PageReveal>
  );
}
