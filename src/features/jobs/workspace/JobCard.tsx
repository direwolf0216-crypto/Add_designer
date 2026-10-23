"use client";

import type { PointerEvent } from "react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AssigneeAvatars from "@/features/jobs/assignees/AssigneeAvatars";
import Amount from "@/components/data/Amount";
import type { WorkspaceJob } from "@/lib/jobs/workspace";
import type { StageOption } from "@/lib/jobs/tracking";
import { PRIORITY_STYLE, PRIORITY_TINT } from "@/lib/jobs/priority";
import DueChip from "./DueChip";
import { stageHex, stageIcon } from "./stageStyle";

type Props = {
  job: WorkspaceJob;
  today: string;
  stages?: StageOption[];
  /** Enables the "Move to" menu. */
  onMove?: (jobId: string, stage: string) => void;
  /** Enables dragging the card between board columns (pointer down on the card). */
  onDragStart?: (e: PointerEvent<HTMLElement>) => void;
  showStage?: boolean;
  /** What the viewer's team calls this stage (defaults to the stage itself). */
  stageLabel?: string;
  /** "lg" on wide boards with few columns: more padding and bigger type. */
  size?: "md" | "lg";
};

// "Ready for Delivery" is still open; only Delivered and Cancelled are closed.
const CLOSED = /^delivered$|cancel/i;

export default function JobCard({ job, today, stages = [], onMove, onDragStart, showStage = false, stageLabel, size = "md" }: Props) {
  const draggable = Boolean(onDragStart);
  const lg = size === "lg";
  const amount = job.amount ?? 0;
  const balance = job.balance ?? 0;
  const paidPct = amount > 0 ? Math.min(100, Math.round(((job.paid ?? 0) / amount) * 100)) : 0;
  const closed = CLOSED.test(job.stage);
  const stageColor = stages.find((s) => s.label === job.stage)?.color;
  // Urgent, High and Low cards are tinted in their priority colour; Normal stays plain.
  const tint = PRIORITY_TINT[job.priority];
  const priorityHex = PRIORITY_STYLE[job.priority].hex;

  return (
    <article
      onPointerDown={onDragStart}
      data-priority={job.priority}
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white ${lg ? "p-5" : "p-3.5"} shadow-[0_4px_16px_-10px_rgba(15,23,42,0.25)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_30px_-14px_rgba(15,23,42,0.35)] ${draggable ? "cursor-grab select-none [-webkit-touch-callout:none]" : ""}`}
      style={tint ? { borderColor: `${priorityHex}${tint.border}`, backgroundImage: `linear-gradient(135deg, ${priorityHex}${tint.wash} 0%, #ffffff 58%)` } : undefined}
    >
      {tint && <span className="pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r-full" style={{ backgroundColor: `${priorityHex}${tint.bar}` }} aria-hidden="true" />}
      <Link href={`/jobs/details/${job.id}`} draggable={false} className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400" aria-label={`Open ${job.jobNumber ?? "job"} for ${job.clientName}`} />

      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-mono font-bold tracking-wide text-slate-400 ${lg ? "text-xs" : "text-[0.65rem]"}`}>{job.jobNumber ?? `#${job.id.slice(-6).toUpperCase()}`}</p>
          <h3 className={`truncate font-extrabold text-slate-900 ${lg ? "text-base" : "text-sm"}`}>{job.clientName}</h3>
        </div>
        {onMove && stages.length > 0 && (
          <Popover>
            <PopoverTrigger
              data-no-drag
              className="pointer-events-auto -mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-700 focus-visible:opacity-100 group-hover:opacity-100"
              aria-label="Move to stage"
            >
              <i className="ph-bold ph-dots-three-vertical" aria-hidden="true"></i>
            </PopoverTrigger>
            <PopoverContent align="end" className="!w-56 !rounded-2xl !p-1.5">
              <p className="px-2 pb-1 pt-1.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400">Move to</p>
              {stages
                .filter((s) => s.label !== job.stage)
                .map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => onMove(job.id, s.label)}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <i className={`ph-bold ${stageIcon(s.label)}`} style={{ color: stageHex(s.color) }} aria-hidden="true"></i>
                    {s.label}
                  </button>
                ))}
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className={`pointer-events-none relative z-10 flex flex-wrap items-center gap-1.5 ${lg ? "mt-3" : "mt-2"}`}>
        {job.priority !== "NORMAL" && (
          <span
            className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[0.7rem] font-black"
            style={{ color: PRIORITY_STYLE[job.priority].hex, backgroundColor: `${PRIORITY_STYLE[job.priority].hex}14` }}
          >
            <i className={`ph-bold ${PRIORITY_STYLE[job.priority].icon}`} aria-hidden="true"></i>
            {PRIORITY_STYLE[job.priority].label}
          </span>
        )}
        <span className="max-w-full truncate rounded-lg bg-slate-100 px-2 py-0.5 text-[0.7rem] font-bold text-slate-600">{job.category || "Uncategorised"}</span>
        {showStage && (
          <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[0.7rem] font-bold" style={{ color: stageHex(stageColor), backgroundColor: `${stageHex(stageColor)}14` }}>
            <i className={`ph-bold ${stageIcon(job.stage)}`} aria-hidden="true"></i>
            {stageLabel ?? job.stage}
          </span>
        )}
        <DueChip due={job.dueDate} today={today} closed={closed} />
      </div>

      {amount > 0 && (
        <div className="pointer-events-none relative z-10 mt-3">
          <div className={`mb-1 flex items-baseline justify-between font-bold ${lg ? "text-sm" : "text-[0.7rem]"}`}>
            <Amount value={amount} maxChars={10} className="text-slate-800" />
            {balance > 0 ? (
              <span className="text-rose-600">
                <Amount value={balance} maxChars={9} /> due
              </span>
            ) : (
              <span className="text-emerald-600">Paid</span>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-[width] duration-500" style={{ width: `${paidPct}%` }} />
          </div>
        </div>
      )}

      <div className="pointer-events-none relative z-10 mt-3 flex items-center justify-between gap-2">
        <AssigneeAvatars assignees={job.assignees.map((a) => ({ ...a, user: { ...a.user, image: a.user.image ?? undefined } }))} size={lg ? 28 : 24} />
        {job.location && (
          <span className="flex min-w-0 items-center gap-1 truncate text-[0.7rem] font-semibold text-slate-400">
            <i className="ph-bold ph-map-pin" aria-hidden="true"></i>
            <span className="truncate">{job.location}</span>
          </span>
        )}
      </div>
    </article>
  );
}
