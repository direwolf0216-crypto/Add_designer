"use client";

import { useMemo, useState, type ReactNode } from "react";

export type FilterOption = { value: string; label: string; dot?: string; hint?: string; leading?: ReactNode };

function Check({ on, round }: { on: boolean; round?: boolean }) {
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center border transition-colors ${round ? "rounded-full" : "rounded-[5px]"} ${on ? "border-orange-500 bg-orange-500 text-white" : "border-slate-300 bg-white"}`}
      aria-hidden="true"
    >
      {on && <i className="ph-bold ph-check text-[9px]"></i>}
    </span>
  );
}

/** Checkbox (multi) or radio (single) option list with optional search. */
export function OptionList({ options, isOn, onPick, multi, searchable }: { options: FilterOption[]; isOn: (v: string) => boolean; onPick: (v: string) => void; multi: boolean; searchable: boolean }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <>
      {searchable && (
        <div className="relative mb-1">
          <i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true"></i>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search options"
            className="h-8 w-full rounded-lg bg-slate-50 pl-8 pr-2 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/15"
          />
        </div>
      )}
      <ul role="listbox" aria-multiselectable={multi} className="max-h-64 overflow-y-auto">
        {shown.length === 0 && <li className="px-2 py-5 text-center text-xs text-slate-400">No matches</li>}
        {shown.map((o) => {
          const on = isOn(o.value);
          return (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => onPick(o.value)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${on ? "bg-orange-50/70 text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}
              >
                <Check on={on} round={!multi} />
                {o.leading}
                {o.dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: o.dot }} />}
                <span className="min-w-0 flex-1 truncate font-semibold">{o.label}</span>
                {o.hint && <span className="text-[11px] font-semibold text-slate-400">{o.hint}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** "Pending" for one pick, "Pending +2" for several, undefined for none. */
export function summarize(options: FilterOption[], values: string[]) {
  if (values.length === 0) return undefined;
  const first = options.find((o) => o.value === values[0])?.label ?? values[0];
  return values.length === 1 ? first : `${first} +${values.length - 1}`;
}
