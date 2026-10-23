"use client";

import GlideGroup from "@/components/motion/GlideGroup";
import CustomDropdown from "@/components/ui/CustomDropdown";
import CustomMultiDropdown from "@/components/ui/CustomMultiDropdown";
import DatePickerInput from "@/components/ui/DatePickerInput";
import { optionLabels } from "@/lib/forms/options";
import { TODAY_TOKEN, ruleConditions } from "@/lib/forms/visibility";
import { getAllFields } from "@/lib/layout-builder/reducer";
import type { FormField, FormLayout, VisibilityCondition, VisibilityOperator, VisibilityRule } from "@/lib/layout-builder/types";

interface ConditionsEditorProps {
  layout: FormLayout;
  /** The field being edited (excluded from the dependency list). */
  fieldId: string;
  rule: VisibilityRule;
  onChange: (rule: VisibilityRule) => void;
}

const OPERATOR_LABELS: Record<VisibilityOperator, string> = {
  EQUALS: "is any of",
  NOT_EQUALS: "is not",
  CONTAINS: "contains",
  IS_EMPTY: "is empty",
  IS_NOT_EMPTY: "is filled in",
  GREATER_THAN: "is more than",
  LESS_THAN: "is less than",
  BEFORE: "is before",
  AFTER: "is after",
};

const NUMERIC = new Set(["NUMBER", "DECIMAL", "CURRENCY", "PERCENTAGE", "SIZE"]);

/** Operators that make sense for the dependency's type. */
function operatorsFor(dep: FormField | undefined): VisibilityOperator[] {
  const t = dep?.type;
  if (!dep) return ["EQUALS"];
  if (t === "DATE") return ["EQUALS", "BEFORE", "AFTER", "IS_EMPTY", "IS_NOT_EMPTY"];
  if (t && NUMERIC.has(t)) return ["EQUALS", "GREATER_THAN", "LESS_THAN", "IS_EMPTY", "IS_NOT_EMPTY"];
  if (t === "CHECKBOX") return ["EQUALS", "NOT_EQUALS"];
  if (dep.options?.length || dep.statusOptions?.length || t === "MULTI_SELECT") return ["EQUALS", "NOT_EQUALS", "CONTAINS", "IS_EMPTY", "IS_NOT_EMPTY"];
  return ["EQUALS", "NOT_EQUALS", "CONTAINS", "IS_EMPTY", "IS_NOT_EMPTY"];
}

const NO_VALUE = new Set<string>(["IS_EMPTY", "IS_NOT_EMPTY"]);

const input =
  "w-full text-sm font-semibold text-slate-800 bg-white border border-gray-300 rounded-lg h-[40px] px-3 outline-none focus:border-orange-500 transition-all placeholder:font-normal";

/** A list of conditions joined by all / any, with inputs that fit the field each one depends on. */
export default function ConditionsEditor({ layout, fieldId, rule, onChange }: ConditionsEditorProps) {
  const allFields = getAllFields(layout).filter((f) => f.id !== fieldId && !f.archived);
  const conditions = ruleConditions(rule as never) as VisibilityCondition[];
  const match = rule.match ?? "all";

  const commit = (next: VisibilityCondition[], nextMatch = match) =>
    onChange({ match: nextMatch, conditions: next });
  const update = (i: number, patch: Partial<VisibilityCondition>) =>
    commit(conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => commit(conditions.filter((_, idx) => idx !== i));
  const add = () => commit([...conditions, { fieldId: "", operator: "EQUALS", values: [] }]);

  const valueInput = (c: VisibilityCondition, i: number, dep: FormField | undefined) => {
    if (NO_VALUE.has(String(c.operator))) return null;
    const values = c.values ?? [];
    if (dep?.type === "CHECKBOX") {
      return <CustomDropdown options={[{ label: "checked", value: "true" }, { label: "not checked", value: "false" }]} value={values[0] ?? "true"} onChange={(v) => update(i, { values: [v] })} className="h-[40px] text-sm font-semibold" />;
    }
    if (dep?.type === "DATE") {
      const isToday = values[0] === TODAY_TOKEN;
      return (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => update(i, { values: isToday ? [] : [TODAY_TOKEN] })} className={`shrink-0 rounded-lg border px-2.5 h-[40px] text-[0.72rem] font-bold transition-colors ${isToday ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-600"}`}>Today</button>
          <div className="flex-1 min-w-0"><DatePickerInput value={isToday ? null : values[0] ?? null} onChange={(v: string | null) => update(i, { values: v ? [v] : [] })} placeholder="Pick a date" /></div>
        </div>
      );
    }
    const opts = dep?.statusOptions?.length ? dep.statusOptions.map((o) => o.label) : dep?.options?.length ? optionLabels(dep.options) : [];
    if (opts.length && c.operator !== "CONTAINS") {
      return <CustomMultiDropdown options={opts} value={values} onChange={(v) => update(i, { values: Array.isArray(v) ? v : [v as string] })} placeholder="Select values..." />;
    }
    if (dep && NUMERIC.has(dep.type)) {
      return <input type="text" inputMode="decimal" value={values[0] ?? ""} onChange={(e) => update(i, { values: [e.target.value] })} placeholder="e.g. 10" className={input} />;
    }
    return (
      <input
        type="text"
        value={values.join(", ")}
        onChange={(e) => update(i, { values: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        placeholder="e.g. Flex Printing, Visiting Cards"
        className={input}
      />
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      {conditions.length > 1 && (
        <div className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-slate-600">
          When
          <GlideGroup active={match} pillClassName="rounded-md bg-white shadow-sm" className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            {(["all", "any"] as const).map((m) => (
              <button key={m} type="button" data-pill-key={m} onClick={() => commit(conditions, m)} className={`relative z-10 rounded-md px-2.5 py-1 text-[0.72rem] font-bold transition-colors duration-300 ${match === m ? "text-slate-900" : "text-slate-500"}`}>
                {m}
              </button>
            ))}
          </GlideGroup>
          of these hold
        </div>
      )}
      {conditions.map((c, i) => {
        const dep = allFields.find((f) => f.id === c.fieldId);
        const ops = operatorsFor(dep);
        const op = ops.includes(c.operator as VisibilityOperator) ? (c.operator as VisibilityOperator) : ops[0];
        return (
          <div key={i} className="rounded-xl border border-gray-200 bg-slate-50 p-2.5 flex flex-col gap-2 relative">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <CustomDropdown
                  options={allFields.map((f) => ({ label: f.name || f.id, value: f.id }))}
                  value={c.fieldId}
                  onChange={(v) => update(i, { fieldId: v, operator: operatorsFor(allFields.find((f) => f.id === v))[0], values: [] })}
                  placeholder="Choose a field"
                  className="h-[40px] text-sm font-semibold"
                />
              </div>
              <button type="button" onClick={() => remove(i)} aria-label="Remove condition" className="w-8 h-8 shrink-0 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                <i className="ph-bold ph-x"></i>
              </button>
            </div>
            {c.fieldId && (
              <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-2">
                <CustomDropdown options={ops.map((o) => ({ label: OPERATOR_LABELS[o], value: o }))} value={op} onChange={(v) => update(i, { operator: v as VisibilityOperator, values: NO_VALUE.has(v) ? [] : c.values })} className="h-[40px] text-sm font-semibold" />
                <div className={NO_VALUE.has(op) ? "hidden" : ""}>{valueInput({ ...c, operator: op }, i, dep)}</div>
              </div>
            )}
          </div>
        );
      })}
      <button type="button" onClick={add} className="self-start rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-[0.75rem] font-bold text-slate-600 hover:border-orange-400 hover:text-orange-600 transition-colors flex items-center gap-1.5">
        <i className="ph-bold ph-plus"></i> {conditions.length ? "Add another condition" : "Add a condition"}
      </button>
    </div>
  );
}
