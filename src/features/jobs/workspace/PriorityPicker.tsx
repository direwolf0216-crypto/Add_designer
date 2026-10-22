"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PRIORITIES, PRIORITY_STYLE, type Priority } from "@/lib/jobs/priority";

/** Priority chip that opens a menu of the four priorities. */
export default function PriorityPicker({ value, onChange, compact = false, disabled = false }: { value: Priority; onChange: (p: Priority) => void; compact?: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const style = PRIORITY_STYLE[value];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={`Priority: ${style.label}`}
        title="Change priority"
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border bg-white font-bold shadow-sm transition-[background-color,box-shadow] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-60 ${compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"} ${value === "NORMAL" ? "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50" : ""}`}
        // Urgent / High / Low keep their own colour; Normal is a plain white chip so it still reads as a control.
        style={value === "NORMAL" ? undefined : { color: style.hex, backgroundColor: `${style.hex}12`, borderColor: `${style.hex}55` }}
      >
        <i className={`ph-bold ${style.icon}`} style={value === "NORMAL" ? { color: "#94a3b8" } : undefined} aria-hidden="true"></i>
        {style.label}
        <i className="ph-bold ph-caret-down text-[0.65rem]" aria-hidden="true"></i>
      </PopoverTrigger>
      <PopoverContent align="end" className="!w-44 !rounded-2xl !p-1.5">
        <p className="px-2 pb-1 pt-1.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400">Priority</p>
        {PRIORITIES.map((p) => {
          const s = PRIORITY_STYLE[p];
          return (
            <button
              key={p}
              type="button"
              onClick={() => {
                setOpen(false);
                onChange(p);
              }}
              className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-semibold hover:bg-slate-50 ${p === value ? "bg-slate-50 text-slate-900" : "text-slate-700"}`}
            >
              <i className={`ph-bold ${s.icon}`} style={{ color: s.hex }} aria-hidden="true"></i>
              <span className="flex-1">{s.label}</span>
              {p === value && <i className="ph-bold ph-check text-xs text-orange-500" aria-hidden="true"></i>}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
