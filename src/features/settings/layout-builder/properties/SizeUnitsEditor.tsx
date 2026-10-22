"use client";

import { useState } from "react";
import { CONVERTIBLE_UNITS, DEFAULT_SIZE_UNITS, defaultUnitFor, unitsFor } from "@/lib/jobs/size";
import type { FieldEditorProps } from "./types";

/** SIZE fields: which units the picker offers and which one is preselected. */
export default function SizeUnitsEditor({ field, onChange }: FieldEditorProps) {
  const units = unitsFor(field);
  const defaultUnit = defaultUnitFor(field);
  const [draft, setDraft] = useState("");

  const commit = (next: string[], nextDefault?: string) =>
    onChange({ sizeUnits: next, defaultUnit: nextDefault ?? (next.includes(defaultUnit) ? defaultUnit : next[0]) });

  const addUnit = () => {
    const u = draft.trim().replace(/\s+/g, "").slice(0, 8);
    if (!u) return;
    if (units.some((x) => x.toLowerCase() === u.toLowerCase())) { setDraft(""); return; }
    commit([...units, u]);
    setDraft("");
  };

  const removeUnit = (u: string) => {
    if (units.length <= 1) return;
    commit(units.filter((x) => x !== u));
  };

  return (
    <div className="pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className="text-[0.75rem] font-bold text-slate-600">Units</label>
        {JSON.stringify(units) !== JSON.stringify(DEFAULT_SIZE_UNITS) && (
          <button type="button" onClick={() => onChange({ sizeUnits: undefined, defaultUnit: undefined })} className="text-[0.7rem] font-bold text-orange-600 hover:text-orange-700 transition-colors">
            Reset
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {units.map((u) => {
          const isDefault = u === defaultUnit;
          return (
            <span
              key={u}
              className={`inline-flex items-center gap-1 rounded-lg border pl-2.5 pr-1 py-1 text-xs font-bold transition-colors ${
                isDefault ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-600 hover:border-violet-200"
              }`}
            >
              <button type="button" onClick={() => commit(units, u)} title={isDefault ? "Preselected unit" : "Make this the preselected unit"} className="inline-flex items-center gap-1">
                {isDefault && <i className="ph-fill ph-star text-[0.7rem] text-violet-500"></i>}
                {u}
              </button>
              <button
                type="button"
                onClick={() => removeUnit(u)}
                disabled={units.length <= 1}
                aria-label={`Remove ${u}`}
                className="rounded-md p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 transition-colors"
              >
                <i className="ph-bold ph-x text-[0.7rem]"></i>
              </button>
            </span>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          maxLength={8}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUnit(); } }}
          placeholder="Add a unit, e.g. yd"
          className="min-w-0 flex-1 text-sm font-semibold text-slate-800 border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:font-normal placeholder:text-slate-400"
        />
        <button type="button" onClick={addUnit} disabled={!draft.trim()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40 transition-colors">
          Add
        </button>
      </div>
      <p className="mt-2 text-[0.7rem] text-slate-500 leading-snug">
        Tap a unit to preselect it. Per-sq-ft pricing converts {CONVERTIBLE_UNITS.join(", ")} (sqft and sqm take the area as one number); other units are priced per piece.
      </p>
    </div>
  );
}
