"use client";

import RevealLabel from "@/components/motion/RevealLabel";
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import DatePickerInput from "@/components/ui/DatePickerInput";
import { useAssignableUsers } from "@/features/jobs/assignees/AssigneePicker";
import { Avatar } from "@/features/jobs/assignees/AssigneeAvatars";
import type { WorkspaceData } from "@/lib/jobs/workspace";
import { addIsoDays } from "@/lib/transactions/weekly";
import { OptionList, summarize, type FilterOption } from "./FilterMenu";
import { stageHex } from "./stageStyle";
import { useWorkspaceUrl } from "./url";

type Pane = "stage" | "category" | "due" | "assignee";

const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

function duePresets(today: string) {
  const monthEnd = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  return [
    { id: "today", label: "Today", from: today, to: today },
    { id: "week", label: "Next 7 days", from: today, to: addIsoDays(today, 6) },
    { id: "month", label: "This month", from: `${today.slice(0, 7)}-01`, to: monthEnd.toISOString().slice(0, 10) },
  ];
}

/**
 * Local copy of a URL list value so quick successive picks build on each other
 * instead of on a URL that hasn't caught up yet.
 */
function useDraft(value: string[]) {
  const key = value.join(",");
  const [draft, setDraft] = useState(value);
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) {
    setLastKey(key);
    setDraft(value);
  }
  return [draft, setDraft] as const;
}

/** One "Filters" button: job search plus Stage / Category / Due / Assignee, each drilling into its own list. URL-backed. */
export default function FiltersMenu({ data }: { data: WorkspaceData }) {
  const { update } = useWorkspaceUrl();
  const { params } = data;
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<Pane | null>(null);

  // Search lives here (not in the popup) so a pending debounce survives the popup closing.
  const [q, setQ] = useState(params.q);
  const [lastQ, setLastQ] = useState(params.q);
  if (lastQ !== params.q) {
    setLastQ(params.q);
    setQ(params.q);
  }
  useEffect(() => {
    if (q === params.q) return;
    const t = setTimeout(() => update({ q: q.trim() || null, more: null }), 300);
    return () => clearTimeout(t);
  }, [q, params.q, update]);

  const [stages, setStages] = useDraft(params.stages);
  const [categories, setCategories] = useDraft(params.categories);
  const csv = (v: string[]) => v.join(",") || null;

  const showAssignee = data.canSeeAll && params.scope === "all";
  const users = useAssignableUsers(showAssignee);

  const stageOptions: FilterOption[] = data.stages.map((s) => ({ value: s.label, label: s.label, dot: stageHex(s.color) }));
  const categoryOptions: FilterOption[] = data.categories.map((c) => ({ value: c, label: c }));
  const assigneeOptions: FilterOption[] = [
    { value: "unassigned", label: "Unassigned", leading: <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400"><i className="ph-bold ph-user-circle-dashed text-sm" aria-hidden="true"></i></span> },
    ...users.map((u) => ({ value: u.id, label: u.name, hint: u.roleName, leading: <Avatar name={u.name} image={u.image} size={24} ring={false} /> })),
  ];

  const presets = duePresets(data.today);
  const preset = presets.find((p) => p.from === params.from && p.to === params.to);
  const dueSummary = preset?.label ?? (params.from || params.to ? `${params.from ? shortDate(params.from) : "…"} – ${params.to ? shortDate(params.to) : "…"}` : undefined);

  const rows: { id: Pane; label: string; icon: string; summary?: string }[] = [
    { id: "stage", label: "Stage", icon: "ph-kanban", summary: summarize(stageOptions, stages) },
    ...(categoryOptions.length ? [{ id: "category" as const, label: "Category", icon: "ph-tag", summary: summarize(categoryOptions, categories) }] : []),
    { id: "due", label: "Due date", icon: "ph-calendar-blank", summary: dueSummary },
    ...(showAssignee ? [{ id: "assignee" as const, label: "Assignee", icon: "ph-user", summary: summarize(assigneeOptions, params.assignee ? [params.assignee] : []) }] : []),
  ];
  const count = rows.filter((r) => r.summary).length + (params.q ? 1 : 0);

  const resetAll = () => {
    setQ("");
    setStages([]);
    setCategories([]);
    update({ q: null, stages: null, categories: null, assignee: null, from: null, to: null, more: null });
  };

  const paneTitle = rows.find((r) => r.id === pane)?.label;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPane(null);
      }}
    >
      <PopoverTrigger
        aria-label={count ? `Filters, ${count} applied` : "Filters"}
        className={`group inline-flex h-10 shrink-0 items-center rounded-xl px-3 text-sm font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/15 ${
          count ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <i className="ph-bold ph-sliders-horizontal text-[16px]" aria-hidden="true"></i>
        <RevealLabel>Filters</RevealLabel>
        {count > 0 && <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[0.65rem] font-black text-white">{count}</span>}
      </PopoverTrigger>

      <PopoverContent align="end" className="!w-[min(92vw,320px)] !gap-0 !rounded-2xl !p-1.5 !shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)]">
        {pane === null ? (
          <div key="root" className="animate-in fade-in-0 slide-in-from-left-2 duration-150">
            <div className="relative p-1">
              <i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-sm text-slate-400" aria-hidden="true"></i>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Job #, client, phone…"
                aria-label="Search within jobs"
                autoFocus
                className="h-9 w-full rounded-xl bg-slate-50 pl-9 pr-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            <ul className="mt-1 flex flex-col">
              {rows.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setPane(r.id)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-50">
                    <i className={`ph-bold ${r.icon} text-[15px] ${r.summary ? "text-orange-500" : "text-slate-400"}`} aria-hidden="true"></i>
                    <span className="text-sm font-bold text-slate-800">{r.label}</span>
                    <span className={`ml-auto max-w-[9.5rem] truncate text-xs font-semibold ${r.summary ? "text-slate-700" : "text-slate-400"}`}>{r.summary ?? "Any"}</span>
                    <i className="ph-bold ph-caret-right text-[11px] text-slate-300" aria-hidden="true"></i>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex items-center justify-between border-t border-slate-100 px-2.5 pt-2 pb-1">
              <span className="text-[11px] font-semibold text-slate-400">{count ? `${count} active` : "No filters"}</span>
              <button type="button" onClick={resetAll} disabled={!count} className="text-xs font-bold text-slate-500 hover:text-rose-500 disabled:opacity-40 disabled:hover:text-slate-500">
                Reset all
              </button>
            </div>
          </div>
        ) : (
          <div key={pane} className="animate-in fade-in-0 slide-in-from-right-2 duration-150">
            <div className="mb-1 flex items-center gap-1 border-b border-slate-100 pb-1.5">
              <button type="button" onClick={() => setPane(null)} aria-label="Back to filters" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-900">
                <i className="ph-bold ph-caret-left text-xs" aria-hidden="true"></i>
              </button>
              <span className="text-sm font-extrabold text-slate-900">{paneTitle}</span>
            </div>

            {pane === "stage" && (
              <OptionList
                options={stageOptions}
                multi
                searchable={false}
                isOn={(v) => stages.includes(v)}
                onPick={(v) => {
                  const next = stages.includes(v) ? stages.filter((x) => x !== v) : [...stages, v];
                  setStages(next);
                  update({ stages: csv(next), more: null });
                }}
              />
            )}
            {pane === "category" && (
              <OptionList
                options={categoryOptions}
                multi
                searchable={categoryOptions.length > 8}
                isOn={(v) => categories.includes(v)}
                onPick={(v) => {
                  const next = categories.includes(v) ? categories.filter((x) => x !== v) : [...categories, v];
                  setCategories(next);
                  update({ categories: csv(next), more: null });
                }}
              />
            )}
            {pane === "assignee" && (
              <OptionList
                options={assigneeOptions}
                multi={false}
                searchable={users.length > 6}
                isOn={(v) => v === params.assignee}
                onPick={(v) => {
                  update({ assignee: v === params.assignee ? null : v, more: null });
                  setPane(null);
                }}
              />
            )}
            {pane === "due" && (
              <>
                <ul className="flex flex-col">
                  {presets.map((p) => {
                    const on = preset?.id === p.id;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => update(on ? { from: null, to: null, more: null } : { from: p.from, to: p.to, more: null })}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold transition-colors ${on ? "bg-orange-50/70 text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}
                        >
                          {p.label}
                          {on && <i className="ph-bold ph-check text-xs text-orange-500" aria-hidden="true"></i>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 px-2.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400">Custom range</p>
                <div className="grid grid-cols-2 gap-1.5 p-1.5">
                  <DatePickerInput value={params.from || null} onChange={(v) => update({ from: v || null, more: null })} placeholder="From" />
                  <DatePickerInput value={params.to || null} onChange={(v) => update({ to: v || null, more: null })} placeholder="To" />
                </div>
              </>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
