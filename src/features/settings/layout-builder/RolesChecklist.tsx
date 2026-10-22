"use client";

import { roleAssignments } from "@/lib/forms/roles";
import type { FormLayout } from "@/lib/layout-builder/types";

/** Which field plays each role in the job form; unassigned roles are called out. Shown when nothing is selected. */
export default function RolesChecklist({ layout, onSelectField }: { layout: FormLayout; onSelectField: (fieldId: string) => void }) {
  const rows = roleAssignments(layout.schema);
  const missing = rows.filter((r) => !r.field).length;
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-gray-100 bg-slate-50/50">
        <h3 className="font-extrabold text-slate-900 text-[0.95rem]">Field roles</h3>
        <p className="text-[0.72rem] text-slate-500 leading-snug mt-0.5">
          {missing === 0 ? "Every role has a field. Pricing, the board and exports know where to look." : `${missing} role${missing === 1 ? "" : "s"} without a field. Select a field and give it a role in Basics.`}
        </p>
      </div>
      <ul className="flex-1 overflow-y-auto p-3 space-y-1">
        {rows.map(({ role, field, inferred }) => (
          <li key={role.key}>
            <button
              type="button"
              disabled={!field}
              onClick={() => field && onSelectField(field.id)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${field ? "hover:bg-slate-50" : "bg-amber-50/60"}`}
              title={role.hint}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${field ? (inferred ? "bg-violet-300" : "bg-emerald-500") : "bg-amber-500"}`}></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.8rem] font-bold text-slate-800">{role.label}</span>
                <span className={`block text-[0.7rem] truncate ${field ? "text-slate-500" : "text-amber-700 font-semibold"}`}>
                  {field ? `${field.name || field.id}${inferred ? " · guessed from its label" : ""}` : "Not assigned"}
                </span>
              </span>
              {field && <i className="ph-bold ph-caret-right text-slate-300"></i>}
            </button>
          </li>
        ))}
      </ul>
      <p className="px-5 py-3 text-[0.7rem] text-slate-400 border-t border-gray-100 leading-snug">Guessed roles become fixed when you save the layout.</p>
    </div>
  );
}
