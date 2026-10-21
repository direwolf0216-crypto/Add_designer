import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import type { StageOption } from "@/lib/jobs/tracking";
import type { WorkspaceData, WorkspaceJob } from "@/lib/jobs/workspace";
import JobCard from "./JobCard";

function DaySection({ id, badge, tone, title, subtitle, jobs, today, stages }: {
  id: string; badge: ReactNode; tone: string; title: string; subtitle: string; jobs: WorkspaceJob[]; today: string; stages: StageOption[];
}) {
  return (
    <section aria-labelledby={`sched-${id}`}>
      <header className="sticky top-0 z-20 -mx-1 mb-3 flex items-center gap-3 rounded-2xl bg-white/80 px-2 py-2 backdrop-blur">
        <span className={`flex h-10 w-10 flex-col items-center justify-center rounded-2xl text-white shadow-lg ${tone}`}>{badge}</span>
        <div>
          <h2 id={`sched-${id}`} className="text-sm font-extrabold text-slate-900">{title}</h2>
          <p className="text-xs font-semibold text-slate-500">
            {subtitle} · {jobs.length} job{jobs.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {jobs.map((job, i) => (
          <div key={job.id} className="animate-rise" style={{ ["--i" as string]: Math.min(i, 8) }}>
            <JobCard job={job} today={today} stages={stages} showStage />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Delivery schedule: overdue first, then the next 14 days by due date. */
export default function ScheduleView({ data }: { data: WorkspaceData }) {
  const s = data.schedule!;
  const busy = s.days.filter((d) => d.jobs.length > 0);

  if (s.overdue.length === 0 && busy.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 px-6 py-16 text-center">
        <i className="ph-bold ph-calendar-check text-3xl text-emerald-500" aria-hidden="true"></i>
        <p className="mt-2 text-sm font-extrabold text-slate-900">Nothing due in the next 14 days</p>
        {s.undated > 0 && <p className="mt-1 text-sm text-slate-500">{s.undated} open job(s) have no due date yet.</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {s.overdue.length > 0 && (
        <DaySection
          id="overdue"
          badge={<i className="ph-bold ph-warning text-lg" aria-hidden="true"></i>}
          tone="bg-gradient-to-br from-rose-500 to-red-600"
          title="Overdue"
          subtitle="Past their due date"
          jobs={s.overdue}
          today={data.today}
          stages={data.stages}
        />
      )}
      {busy.map((d) => {
        const date = parseISO(d.date);
        const isToday = d.date === data.today;
        return (
          <DaySection
            key={d.date}
            id={d.date}
            badge={
              <>
                <span className="text-[0.55rem] font-bold uppercase leading-none opacity-80">{format(date, "MMM")}</span>
                <span className="text-sm font-black leading-none">{format(date, "d")}</span>
              </>
            }
            tone={isToday ? "bg-gradient-to-br from-orange-500 to-pink-500" : "bg-gradient-to-br from-slate-700 to-slate-900"}
            title={isToday ? "Today" : format(date, "EEEE")}
            subtitle={format(date, "d MMM yyyy")}
            jobs={d.jobs}
            today={data.today}
            stages={data.stages}
          />
        );
      })}
      {s.undated > 0 && <p className="text-center text-xs font-semibold text-slate-400">{s.undated} open job(s) without a due date aren&apos;t shown here.</p>}
    </div>
  );
}
