import Link from "next/link";
import JobTable from "@/components/dashboard/JobTable";
import { requirePageUser } from "@/lib/auth/session";
import { loadJobTablePage } from "@/lib/jobs/jobTablePage";

export const dynamic = "force-dynamic";

const QUICK_FILTERS = [
  { id: undefined, label: "All my jobs" },
  { id: "today_tomorrow", label: "Due today & tomorrow" },
  { id: "next_7_days", label: "Next 7 days" },
  { id: "overdue", label: "Past due date" },
] as const;

/** Jobs assigned to the signed-in user. */
export default async function MyJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const active = typeof params.filter === "string" ? params.filter : undefined;
  const { jobs, page, totalPages, total } = await loadJobTablePage(user, params, {
    assignments: { some: { userId: user.id } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="My jobs filter">
        {QUICK_FILTERS.map((f) => {
          const selected = active === f.id;
          return (
            <Link
              key={f.label}
              href={f.id ? `/jobs/my-jobs?filter=${f.id}` : "/jobs/my-jobs"}
              role="tab"
              aria-selected={selected}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
        <span className="ml-auto text-xs font-semibold text-slate-500">
          {total} job{total === 1 ? "" : "s"} assigned to you
        </span>
      </div>
      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No jobs are assigned to you{active ? " for this filter" : " yet"}.
        </div>
      ) : (
        <JobTable jobs={jobs} currentPage={page} totalPages={totalPages} />
      )}
    </div>
  );
}
