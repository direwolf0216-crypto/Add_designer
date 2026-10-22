"use client";

import CustomDropdown from "@/components/ui/CustomDropdown";
import { VALIDATION_PATTERNS, isNumericType } from "@/lib/forms/validation";
import type { FieldValidation } from "@/lib/layout-builder/types";
import type { FieldEditorProps } from "./types";

const input =
  "w-full text-sm font-semibold text-slate-800 bg-white border border-gray-300 rounded-lg h-[38px] px-3 outline-none focus:border-orange-500 transition-all placeholder:font-normal placeholder:text-slate-400";

const TEXT_TYPES = new Set(["SINGLE_LINE", "MULTI_LINE", "EMAIL", "PHONE"]);

/** Bounds, length and format checks applied when the form is saved. */
export default function ValidationEditor({ field, onChange }: FieldEditorProps) {
  const numeric = isNumericType(field.type);
  if (!numeric && !TEXT_TYPES.has(field.type)) return null;
  const v: FieldValidation = field.validation ?? {};
  const set = (patch: Partial<FieldValidation>) => {
    const next: FieldValidation = { ...v, ...patch };
    (Object.keys(next) as (keyof FieldValidation)[]).forEach((k) => { if (next[k] === undefined || next[k] === "" || (typeof next[k] === "number" && Number.isNaN(next[k]))) delete next[k]; });
    onChange({ validation: Object.keys(next).length ? next : undefined });
  };
  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

  return (
    <div className="pt-4 border-t border-gray-100">
      <label className="text-[0.75rem] font-bold text-slate-600 mb-2 block">Validation</label>
      {numeric ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Minimum</span>
            <input type="text" inputMode="decimal" value={v.min ?? ""} onChange={(e) => set({ min: num(e.target.value) })} placeholder="none" className={input} />
          </div>
          <div>
            <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Maximum</span>
            <input type="text" inputMode="decimal" value={v.max ?? ""} onChange={(e) => set({ max: num(e.target.value) })} placeholder="none" className={input} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div>
            <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Format</span>
            <CustomDropdown
              options={[
                { label: "Anything", value: "" },
                ...Object.entries(VALIDATION_PATTERNS).map(([key, p]) => ({ label: p.label, value: key })),
                { label: "Custom pattern (regex)", value: "custom" },
              ]}
              value={v.pattern ?? ""}
              onChange={(val) => set({ pattern: (val || undefined) as FieldValidation["pattern"], regex: val === "custom" ? v.regex : undefined })}
              className="h-[38px] text-sm font-semibold"
            />
          </div>
          {v.pattern === "custom" && (
            <input type="text" value={v.regex ?? ""} onChange={(e) => set({ regex: e.target.value })} placeholder="e.g. ^INV-\\d+$" className={`${input} font-mono`} spellCheck={false} />
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Min length</span>
              <input type="text" inputMode="numeric" value={v.minLength ?? ""} onChange={(e) => set({ minLength: num(e.target.value) })} placeholder="none" className={input} />
            </div>
            <div>
              <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Max length</span>
              <input type="text" inputMode="numeric" value={v.maxLength ?? ""} onChange={(e) => set({ maxLength: num(e.target.value) })} placeholder="none" className={input} />
            </div>
          </div>
        </div>
      )}
      <div className="mt-2">
        <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Message when it fails</span>
        <input type="text" value={v.message ?? ""} onChange={(e) => set({ message: e.target.value })} placeholder="Optional, e.g. Enter the shop's GST number" className={input} />
      </div>
    </div>
  );
}
