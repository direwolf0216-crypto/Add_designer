"use client";

import { useState } from "react";
import { useSlidingPill } from "@/components/motion/useSlidingPill";
import Link from "next/link";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useGlobalForm } from "@/components/providers/GlobalFormProvider";
import { usePermissions } from "@/hooks/usePermissions";
import type { WorkspaceData, WorkspaceJob } from "@/lib/jobs/workspace";
import { downloadCsv, toCsv } from "@/lib/export/csv";
import { saveTablesPdf } from "@/lib/export/pdf";
import { toLocalISODate } from "@/lib/dates";
import { useWorkspaceUrl } from "./url";
import FiltersMenu from "./FiltersMenu";

const VIEWS = [
  { id: "board", label: "Board", icon: "ph-kanban" },
  { id: "list", label: "List", icon: "ph-rows" },
  { id: "schedule", label: "Schedule", icon: "ph-calendar-dots" },
  { id: "queue", label: "Queue", icon: "ph-list-numbers" },
] as const;

function Segmented<T extends string>({ value, options, hrefFor, label, compact = false }: { value: T; options: { id: T; label: string; icon?: string; badge?: number }[]; hrefFor: (id: T) => string; label: string; /** Icons only below `sm` (labels stay for screen readers). */ compact?: boolean }) {
  // The clicked tab lights up at once; the real value takes over when the new view arrives.
  const [picked, setPicked] = useState<{ from: T; to: T } | null>(null);
  if (picked && picked.from !== value) setPicked(null);
  const shown = picked ? picked.to : value;
  const { ref: pillRef, style: pillStyle } = useSlidingPill<HTMLDivElement>(shown);
  return (
    <div ref={pillRef} role="tablist" aria-label={label} className="relative inline-flex rounded-2xl bg-slate-900/5 p-1 ring-1 ring-slate-900/5 backdrop-blur">
      {pillStyle && <span aria-hidden="true" data-sliding-pill className="rounded-xl bg-white shadow-sm" style={pillStyle} />}
      {options.map((o) => {
        const active = o.id === shown;
        return (
          <Link
            key={o.id}
            role="tab"
            aria-selected={active}
            href={hrefFor(o.id)}
            scroll={false}
            // Full prefetch: every tab's view is ready before it's clicked (kept fresh by staleTimes).
            prefetch={true}
            data-nav-scope="jobs-view"
            data-pill-key={o.id}
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && o.id !== value) setPicked({ from: value, to: o.id });
            }}
            title={compact ? o.label : undefined}
            className={`relative z-10 inline-flex items-center gap-1.5 rounded-xl py-1.5 text-sm font-bold transition-colors duration-300 ${compact ? "px-2.5 sm:px-3" : "px-3"} ${active ? "text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
          >
            {o.icon && <i className={`ph-bold ${o.icon} ${compact ? "text-[15px]" : ""}`} aria-hidden="true"></i>}
            <span className={compact ? "sr-only sm:not-sr-only" : undefined}>{o.label}</span>
            {o.badge !== undefined && (
              <span className={`rounded-full px-1.5 text-[0.65rem] font-black ${active ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-600"}`}>{o.badge}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export default function WorkspaceHeader({ data }: { data: WorkspaceData }) {
  const { hrefWith, searchParams } = useWorkspaceUrl();
  const { openJobForm } = useGlobalForm();
  const { checkPermission } = usePermissions();
  const [exporting, setExporting] = useState(false);
  const { params } = data;

  const exportJobs = async (kind: "csv" | "pdf") => {
    setExporting(true);
    try {
      const res = await fetch(`/api/jobs/export?${searchParams.toString()}`);
      if (!res.ok) throw new Error();
      const { jobs, canSeeAmounts } = (await res.json()) as { jobs: WorkspaceJob[]; canSeeAmounts: boolean };
      if (!jobs.length) {
        toast.info("No jobs match the current filters");
        return;
      }
      const head = ["Job #", "Client", "Phone", "Category", "Stage", "Due date", "Ordered", ...(canSeeAmounts ? ["Amount", "Balance"] : []), "Assigned to"];
      const rows = jobs.map((j) => [
        j.jobNumber ?? "",
        j.clientName,
        j.clientPhone,
        j.category,
        j.stage,
        j.dueDate ?? "",
        j.orderDate,
        // jsPDF's built-in fonts have no rupee glyph; plain numbers are clearer in exports anyway.
        ...(canSeeAmounts ? [String(j.amount ?? 0), String(j.balance ?? 0)] : []),
        j.assignees.map((a) => a.user.name).filter(Boolean).join(", "),
      ]);
      const name = `jobs-${toLocalISODate()}`;
      if (kind === "csv") downloadCsv(`${name}.csv`, toCsv([head, ...rows]));
      else await saveTablesPdf(`${name}.pdf`, `Jobs (${jobs.length})`, [{ head: [head], body: rows }]);
      toast.success(`Exported ${jobs.length} job${jobs.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl md:p-6">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-orange-300/40 via-pink-300/30 to-violet-300/30 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-wrap items-center gap-4">
        <div className="flex min-w-[15rem] flex-1 items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-lg shadow-slate-900/25">
            <i className="ph-bold ph-briefcase text-[22px]" aria-hidden="true"></i>
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-slate-950">Jobs</h1>
            <p className="text-sm font-medium text-slate-500 sm:truncate">
              {params.scope === "mine" ? "Jobs assigned to you" : "Every print job across the press"} · {data.stats.active} open
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <i className={`ph-bold ${exporting ? "ph-circle-notch animate-spin" : "ph-download-simple"}`} aria-hidden="true"></i>
              Export
            </PopoverTrigger>
            <PopoverContent align="end" className="!w-48 !rounded-2xl !p-1.5">
              {(["csv", "pdf"] as const).map((k) => (
                <button key={k} type="button" onClick={() => exportJobs(k)} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <i className={`ph-bold ${k === "csv" ? "ph-file-csv" : "ph-file-pdf"}`} aria-hidden="true"></i>
                  {k === "csv" ? "Spreadsheet (CSV)" : "PDF document"}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          {checkPermission("create_jobs") && (
            <button
              type="button"
              onClick={() => openJobForm()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-[filter,box-shadow] hover:shadow-xl hover:brightness-105"
            >
              <i className="ph-bold ph-plus" aria-hidden="true"></i>
              New job
            </button>
          )}
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3">
        {data.canSeeAll ? (
          <Segmented
            label="Whose jobs"
            value={params.scope}
            options={[
              { id: "mine", label: "My jobs", icon: "ph-user-focus", badge: data.stats.mineActive },
              { id: "all", label: "All jobs", icon: "ph-users-three" },
            ]}
            hrefFor={(id) => hrefWith({ scope: id === "all" ? null : id, more: null })}
          />
        ) : (
          <span className="inline-flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-1.5 text-sm font-bold text-orange-700 ring-1 ring-orange-100">
            <i className="ph-bold ph-user-focus" aria-hidden="true"></i>
            My jobs
          </span>
        )}
        <div className="flex items-center gap-2">
          <FiltersMenu data={data} />
          <Segmented
            label="View"
            compact
            value={params.view}
            options={VIEWS.map((v) => ({ ...v }))}
            hrefFor={(id) => hrefWith({ view: id === "board" ? null : id, more: null, sort: null, dir: null, team: id === "queue" ? params.team || null : null })}
          />
        </div>
      </div>
    </header>
  );
}
