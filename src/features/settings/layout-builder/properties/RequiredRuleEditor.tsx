"use client";

import ConditionsEditor from "./ConditionsEditor";
import type { FieldEditorProps } from "./types";

/** "Required when": the field must be filled in only while its conditions hold. */
export default function RequiredRuleEditor({ field: selectedField, layout: activeLayout, onChange: updateSelectedField }: FieldEditorProps) {
  const enabled = !!selectedField.mandatoryRule;
  if (selectedField.mandatory) {
    return (
      <div className="pt-4 border-t border-gray-100">
        <label className="text-[0.75rem] font-bold text-slate-600 mb-1 block">Required when</label>
        <p className="text-[0.75rem] text-slate-500 leading-snug">This field is always required. Turn off “Mandatory Field” in Basics to require it only in some cases.</p>
      </div>
    );
  }
  return (
    <div className="pt-4 border-t border-gray-100">
      <label className="text-[0.75rem] font-bold text-slate-600 mb-3 block">Required when</label>
      <div
        className="flex items-center gap-3 cursor-pointer group mb-3"
        onClick={() => updateSelectedField({ mandatoryRule: enabled ? undefined : { match: "all", conditions: [{ fieldId: "", operator: "EQUALS", values: [] }] } })}
      >
        <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${enabled ? "bg-orange-500" : "bg-slate-300"}`}>
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? "translate-x-5" : "translate-x-0"}`}></span>
        </div>
        <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Required only in some cases</span>
      </div>
      {enabled && selectedField.mandatoryRule && (
        <ConditionsEditor layout={activeLayout} fieldId={selectedField.id} rule={selectedField.mandatoryRule} onChange={(rule) => updateSelectedField({ mandatoryRule: rule })} />
      )}
    </div>
  );
}
