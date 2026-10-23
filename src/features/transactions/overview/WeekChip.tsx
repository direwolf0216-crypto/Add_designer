"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import DatePickerInput from "@/components/ui/DatePickerInput";
import { toBusinessISODate } from "@/lib/dates";
import { addIsoDays, mondayOf } from "@/lib/transactions/weekly";

/**
 * The week the Weekly performance cards show: step back and forth with the arrows, or open it to
 * pick This week, Last week or any past week from a calendar. `weekOf` is a day inside the chosen
 * week (null = this week).
 */
export default function WeekChip({ weekOf, rangeLabel, onChange }: { weekOf: string | null; rangeLabel: string; onChange: (weekOf: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const today = toBusinessISODate();
  const thisMonday = mondayOf(today);
  const monday = mondayOf(weekOf ?? today);
  const name = monday === thisMonday ? "This week" : monday === addIsoDays(thisMonday, -7) ? "Last week" : "Week";
  const go = (mon: string) => onChange(mon >= thisMonday ? null : mon);
  const pick = (iso: string | null) => {
    onChange(iso && mondayOf(iso) < thisMonday ? iso : null);
    setOpen(false);
  };
  const arrow = "flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white/90 p-0.5 shadow-sm backdrop-blur">
      <button type="button" aria-label="Previous week" onClick={() => go(addIsoDays(monday, -7))} className={arrow}>
        <i className="ph-bold ph-caret-left text-xs" aria-hidden="true"></i>
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
          <i className="ph-bold ph-calendar-blank text-indigo-500" aria-hidden="true"></i>
          {name} · {rangeLabel}
          <i className="ph-bold ph-caret-down text-[10px] text-slate-400" aria-hidden="true"></i>
        </PopoverTrigger>
        <PopoverContent align="end" className="!w-64 !gap-1 !rounded-2xl !p-1.5">
          {[
            { label: "This week", mon: thisMonday },
            { label: "Last week", mon: addIsoDays(thisMonday, -7) },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => pick(o.mon === thisMonday ? null : o.mon)}
              className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm font-semibold transition-colors hover:bg-slate-50 ${monday === o.mon ? "text-indigo-600" : "text-slate-700"}`}
            >
              {o.label}
              {monday === o.mon && <i className="ph-bold ph-check text-xs" aria-hidden="true"></i>}
            </button>
          ))}
          <div className="border-t border-slate-100 px-1 pb-1 pt-2">
            <p className="mb-1.5 px-1 text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400">Any week</p>
            <DatePickerInput mode="week" disableFutureDates value={weekOf} onChange={(v) => pick(v || null)} placeholder="Pick a week" />
          </div>
        </PopoverContent>
      </Popover>
      <button type="button" aria-label="Next week" disabled={monday >= thisMonday} onClick={() => go(addIsoDays(monday, 7))} className={arrow}>
        <i className="ph-bold ph-caret-right text-xs" aria-hidden="true"></i>
      </button>
    </div>
  );
}
