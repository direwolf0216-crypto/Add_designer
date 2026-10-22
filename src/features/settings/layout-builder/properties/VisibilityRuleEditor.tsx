"use client";

import ConditionsEditor from "./ConditionsEditor";
import type { FieldEditorProps } from "./types";

const EMPTY_RULE = { match: "all" as const, conditions: [{ fieldId: "", operator: "EQUALS" as const, values: [] as string[] }] };

/** "Show conditionally": show the field only while its conditions hold. */
export default function VisibilityRuleEditor({ field: selectedField, layout: activeLayout, onChange: updateSelectedField }: FieldEditorProps) {
  const enabled = !!selectedField.visibilityRule;
  return (
    <div>
      <label className="text-[0.75rem] font-bold text-slate-600 mb-3 block">Conditional Visibility</label>
      <div
        className="flex items-center gap-3 cursor-pointer group mb-3"
        // Switching off leaves the key with an undefined value; JSON.stringify drops it on save.
        onClick={() => updateSelectedField({ visibilityRule: enabled ? undefined : EMPTY_RULE })}
      >
        <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${enabled ? "bg-orange-500" : "bg-slate-300"}`}>
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? "translate-x-5" : "translate-x-0"}`}></span>
        </div>
        <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Show conditionally</span>
      </div>
      {enabled && selectedField.visibilityRule && (
        <ConditionsEditor layout={activeLayout} fieldId={selectedField.id} rule={selectedField.visibilityRule} onChange={(rule) => updateSelectedField({ visibilityRule: rule })} />
      )}
    </div>
  );
}
