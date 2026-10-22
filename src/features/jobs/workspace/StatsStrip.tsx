"use client";

import Link from "next/link";
import type { WorkspaceData, WorkspaceFocus } from "@/lib/jobs/workspace";
import { useWorkspaceUrl } from "./url";

const TILES: { id: WorkspaceFocus; label: string; icon: string; key: keyof WorkspaceData["stats"]; tone: string }[] = [
  { id: "active", label: "Open jobs", icon: "ph-stack", key: "active", tone: "from-slate-800 to-slate-950" },
  { id: "due_today", label: "Due today", icon: "ph-alarm", key: "dueToday", tone: "from-orange-500 to-amber-500" },
  { id: "overdue", label: "Overdue", icon: "ph-warning-octagon", key: "overdue", tone: "from-rose-500 to-red-600" },
  { id: "ready", label: "Ready", icon: "ph-package", key: "ready", tone: "from-emerald-500 to-teal-500" },
  { id: "unassigned", label: "Unassigned", icon: "ph-user-circle-dashed", key: "unassigned", tone: "from-violet-500 to-indigo-500" },
];

/** KPI tiles that double as quick filters (click again to clear). */
export default function StatsStrip({ data }: { data: WorkspaceData }) {
  const { hrefWith } = useWorkspaceUrl();
  // Every job in "My jobs" is assigned by definition, so that tile would always read 0.
  const tiles = data.params.scope === "mine" ? TILES.filter((t) => t.id !== "unassigned") : TILES;
  return (
    <nav aria-label="Quick filters" className={`grid grid-cols-2 gap-3 ${tiles.length === 5 ? "sm:grid-cols-3 xl:grid-cols-5" : "sm:grid-cols-4"}`}>
      {tiles.map((t, i) => {
        const selected = data.params.focus === t.id;
        const value = data.stats[t.key];
        return (
          <Link
            key={t.id}
            href={hrefWith({ focus: selected ? null : t.id, more: null })}
            scroll={false}
            aria-pressed={selected}
            style={{ ["--i" as string]: i }}
            className={`animate-rise group flex items-center gap-3 rounded-3xl border bg-white/85 p-3.5 backdrop-blur transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${selected ? "border-slate-900 shadow-[0_14px_34px_-16px_rgba(15,23,42,0.45)]" : "border-slate-200/80 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-18px_rgba(15,23,42,0.3)]"} ${t.id === "active" && tiles.length === 5 ? "col-span-2 sm:col-span-1" : ""}`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ${t.tone}`}>
              <i className={`ph-bold ${t.icon}`} aria-hidden="true"></i>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400">{t.label}</span>
              <span className={`block text-xl font-black tabular-nums ${t.id === "overdue" && value > 0 ? "text-rose-600" : "text-slate-900"}`}>{value}</span>
            </span>
            {selected && <i className="ph-bold ph-x ml-auto text-xs text-slate-400" aria-label="Clear filter"></i>}
          </Link>
        );
      })}
    </nav>
  );
}
