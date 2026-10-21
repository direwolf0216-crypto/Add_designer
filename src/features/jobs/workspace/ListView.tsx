"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AssigneeAvatars from "@/features/jobs/assignees/AssigneeAvatars";
import Amount from "@/components/data/Amount";
import type { WorkspaceData, WorkspaceSort } from "@/lib/jobs/workspace";
import JobCard from "./JobCard";
import StageBadge from "./StageBadge";
import DueChip from "./DueChip";
import { useWorkspaceUrl } from "./url";

const COLUMNS: { key: WorkspaceSort | null; label: string; className: string }[] = [
  { key: null, label: "Job", className: "w-[30%]" },
  { key: null, label: "Stage", className: "w-[18%]" },
  { key: "due", label: "Due", className: "w-[13%]" },
  { key: "amount", label: "Amount", className: "w-[16%] text-right" },
  { key: null, label: "Assigned", className: "w-[12%]" },
  { key: "order", label: "Ordered", className: "w-[11%]" },
];

/** Dense, sortable job table (cards on small screens), server-paginated. */
export default function ListView({ data }: { data: WorkspaceData }) {
  const router = useRouter();
  const { hrefWith } = useWorkspaceUrl();
  const list = data.list!;
  const { sort, dir } = data.params;
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const stageColor = (stage: string) => data.stages.find((s) => s.label === stage)?.color;
  const columns = data.canSeeAmounts ? COLUMNS : COLUMNS.filter((c) => c.key !== "amount");

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/85 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)] backdrop-blur">
      {/* Desktop table */}
      <table className="hidden w-full table-fixed text-left md:table">
        <thead>
          <tr className="border-b border-slate-100 text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400">
            {columns.map((c) => {
              const active = c.key && sort === c.key;
              return (
                <th key={c.label} scope="col" className={`px-4 py-3 ${c.className}`} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.key ? (
                    <Link
                      href={hrefWith({ sort: c.key, dir: active && dir === "asc" ? "desc" : "asc" })}
                      scroll={false}
                      className={`inline-flex items-center gap-1 hover:text-slate-700 ${active ? "text-slate-700" : ""}`}
                    >
                      {c.label}
                      <i className={`ph-bold ${active ? (dir === "asc" ? "ph-caret-up" : "ph-caret-down") : "ph-caret-up-down"} text-[10px]`} aria-hidden="true"></i>
                    </Link>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {list.jobs.map((job, i) => (
            <tr
              key={job.id}
              onClick={() => router.push(`/jobs/details/${job.id}`)}
              className="animate-rise cursor-pointer border-b border-slate-100/80 transition-colors last:border-0 hover:bg-orange-50/40"
              style={{ ["--i" as string]: Math.min(i, 10) }}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 text-xs font-black text-white">
                    {job.clientName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <Link href={`/jobs/details/${job.id}`} onClick={(e) => e.stopPropagation()} className="block truncate text-sm font-extrabold text-slate-900 hover:text-orange-600">
                      {job.clientName}
                    </Link>
                    <p className="truncate text-xs font-semibold text-slate-400">
                      <span className="font-mono">{job.jobNumber ?? `#${job.id.slice(-6).toUpperCase()}`}</span> · {job.category || "Uncategorised"}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <StageBadge stage={job.stage} color={stageColor(job.stage)} />
              </td>
              <td className="px-4 py-3">
                <DueChip due={job.dueDate} today={data.today} closed={/deliver|cancel/i.test(job.stage)} />
              </td>
              {job.amount !== null && (
                <td className="px-4 py-3 text-right">
                  <Amount value={job.amount} className="block text-sm font-extrabold text-slate-900" />
                  {job.amount > 0 && (
                    <span className={`text-[0.7rem] font-bold ${(job.balance ?? 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {(job.balance ?? 0) > 0 ? (
                        <>
                          <Amount value={job.balance ?? 0} maxChars={9} /> due
                        </>
                      ) : (
                        "Paid"
                      )}
                    </span>
                  )}
                </td>
              )}
              <td className="px-4 py-3">
                <AssigneeAvatars assignees={job.assignees.map((a) => ({ ...a, user: { ...a.user, image: a.user.image ?? undefined } }))} size={26} />
              </td>
              <td className="px-4 py-3 text-xs font-semibold text-slate-500">{job.orderDate.split("-").reverse().join("/")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2.5 p-3 md:hidden">
        {list.jobs.map((job) => (
          <JobCard key={job.id} job={job} today={data.today} stages={data.stages} showStage />
        ))}
      </div>

      {list.jobs.length === 0 && <p className="py-16 text-center text-sm font-semibold text-slate-400">No jobs match these filters.</p>}

      {list.total > 0 && (
        <nav className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs font-bold text-slate-500" aria-label="Pagination">
          <span>
            {(list.page - 1) * list.pageSize + 1}–{Math.min(list.page * list.pageSize, list.total)} of {list.total}
          </span>
          <div className="flex items-center gap-1">
            <PageLink href={hrefWith({ page: String(list.page - 1) })} disabled={list.page <= 1} icon="ph-caret-left" label="Previous page" />
            <span className="px-2 text-slate-700">
              {list.page} / {pages}
            </span>
            <PageLink href={hrefWith({ page: String(list.page + 1) })} disabled={list.page >= pages} icon="ph-caret-right" label="Next page" />
          </div>
        </nav>
      )}
    </div>
  );
}

function PageLink({ href, disabled, icon, label }: { href: string; disabled: boolean; icon: string; label: string }) {
  if (disabled) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300" aria-disabled="true">
        <i className={`ph-bold ${icon}`} aria-hidden="true"></i>
      </span>
    );
  }
  return (
    <Link href={href} scroll={false} aria-label={label} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
      <i className={`ph-bold ${icon}`} aria-hidden="true"></i>
    </Link>
  );
}
