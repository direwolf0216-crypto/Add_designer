"use client";

import CustomDropdown from "@/components/ui/CustomDropdown";
import DatePickerInput from "@/components/ui/DatePickerInput";
import { DEFAULT_TOKENS } from "@/lib/forms/defaults";
import { optionLabels } from "@/lib/forms/options";
import type { FieldEditorProps } from "./types";

const inputClass =
  "w-full text-sm font-semibold text-slate-800 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:font-normal placeholder:text-slate-400";

/** What a new record starts with: a literal, or Today / Now / Signed-in user for the types that have one. */
export default function DefaultValueEditor({ field, onChange }: FieldEditorProps) {
  const value = field.defaultValue ?? "";
  const set = (v: string | undefined) => onChange({ defaultValue: v || undefined });
  const t = field.type;
  if (t === "FILE" || t === "IMAGE" || t === "STATUS_PICKER" || t === "SIZE") return null;

  const chip = (label: string, token: string) => (
    <button
      type="button"
      onClick={() => set(value === token ? undefined : token)}
      className={`rounded-lg border px-2.5 py-1 text-[0.72rem] font-bold transition-colors ${
        value === token ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-600 hover:border-violet-200"
      }`}
    >
      {label}
    </button>
  );

  let control: React.ReactNode;
  if (t === "DATE") {
    control = (
      <div className="flex items-center gap-2">
        {chip("Today", DEFAULT_TOKENS.today)}
        <div className="flex-1 min-w-0">
          <DatePickerInput value={value && value !== DEFAULT_TOKENS.today ? value : null} onChange={(v: string | null) => set(v ?? undefined)} placeholder="or a fixed date" />
        </div>
      </div>
    );
  } else if (t === "TIME") {
    control = (
      <div className="flex items-center gap-2">
        {chip("Now", DEFAULT_TOKENS.now)}
        <input type="text" value={value === DEFAULT_TOKENS.now ? "" : value} onChange={(e) => set(e.target.value)} placeholder="or e.g. 10:00 AM" className={inputClass} />
      </div>
    );
  } else if (t === "USER_PICKLIST" || t === "MULTI_USER_PICKLIST") {
    control = <div className="flex items-center gap-2">{chip("Signed-in user", DEFAULT_TOKENS.me)}<span className="text-[0.7rem] text-slate-500">Whoever creates the record.</span></div>;
  } else if (t === "CHECKBOX") {
    control = <div className="flex items-center gap-2">{chip("Checked", "true")}<span className="text-[0.7rem] text-slate-500">Starts ticked.</span></div>;
  } else if ((t === "PICK_LIST" || t === "MULTI_SELECT" || t === "CATEGORY_PICKER") && field.options?.length) {
    const opts = optionLabels(field.options);
    control = <CustomDropdown options={[{ label: "First option (automatic)", value: "" }, ...opts.map((o) => ({ label: o, value: o }))]} value={value} onChange={(v) => set(v)} className="h-[40px] text-sm font-semibold" />;
  } else {
    const numeric = t === "NUMBER" || t === "DECIMAL" || t === "CURRENCY" || t === "PERCENTAGE";
    control = <input type="text" inputMode={numeric ? "decimal" : undefined} value={value} onChange={(e) => set(e.target.value)} placeholder={numeric ? "e.g. 1" : "e.g. Chennai"} className={inputClass} />;
  }

  return (
    <div>
      <label className="text-[0.75rem] font-bold text-slate-600 mb-1.5 flex items-center justify-between">
        <span>Default value</span>
        {value && <button type="button" onClick={() => set(undefined)} className="text-[0.7rem] font-bold text-orange-600 hover:text-orange-700">Clear</button>}
      </label>
      {control}
    </div>
  );
}
