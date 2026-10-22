"use client";

import { useState } from "react";
import { getFieldTypeDef } from "@/lib/layout-builder/fieldTypes";
import type { FormField, FormLayout } from "@/lib/layout-builder/types";
import type { BuilderUser } from "./useLayoutBuilder";
import FieldBasicsEditor from "./properties/FieldBasicsEditor";
import OptionsEditor from "./properties/OptionsEditor";
import StatusOptionsEditor from "./properties/StatusOptionsEditor";
import DateRestrictionEditor from "./properties/DateRestrictionEditor";
import StatusRestrictionEditor from "./properties/StatusRestrictionEditor";
import UserPicklistConfigEditor from "./properties/UserPicklistConfigEditor";
import VisibilityRuleEditor from "./properties/VisibilityRuleEditor";
import SizeUnitsEditor from "./properties/SizeUnitsEditor";
import RequiredRuleEditor from "./properties/RequiredRuleEditor";
import ValidationEditor from "./properties/ValidationEditor";
import RolesChecklist from "./RolesChecklist";
import CategoryPricingCard from "./properties/CategoryPricingCard";
import StatusStagesCard from "./properties/StatusStagesCard";
import AudienceEditor from "./properties/AudienceEditor";
import { hasAudience } from "@/lib/forms/audience";
import { effectiveRole } from "@/lib/forms/roles";
import { hasConditions } from "@/lib/forms/visibility";
import { hasValidation } from "@/lib/forms/validation";
import type { FieldRole } from "@/lib/layout-builder/types";

interface PropertiesPanelProps {
  layout: FormLayout;
  field: FormField | null;
  sectionId: string | null;
  users: BuilderUser[];
  onChange: (updates: Partial<FormField>) => void;
  onRemoveOption: (idx: number) => void;
  checkingUsage: boolean;
  onRoleChange: (role: FieldRole | null) => void;
  onSelectField: (fieldId: string) => void;
  /** Field actions (Advanced tab). */
  onDuplicate: () => void;
  onArchive: (archived: boolean) => void;
  onRemove: () => void;
  removing: boolean;
  /** Closes the panel (shown as a bottom sheet below `lg`). */
  onClose?: () => void;
}

type Tab = "basics" | "rules" | "advanced";

/** Right column: properties of the selected field in three tabs: what it is, when it shows, and housekeeping. */
export default function PropertiesPanel({ layout, field: selectedField, sectionId, users, onChange, onRemoveOption, checkingUsage, onRoleChange, onSelectField, onDuplicate, onArchive, onRemove, removing, onClose }: PropertiesPanelProps) {
  const [tab, setTab] = useState<Tab>("basics");
  const typeDef = getFieldTypeDef(selectedField?.type);
  const hasRule =
    hasConditions(selectedField?.visibilityRule) || hasConditions(selectedField?.mandatoryRule) || !!selectedField?.restrictFutureDate || !!selectedField?.futureDateRestriction?.enabled || (!!selectedField && hasValidation(selectedField));

  const tabs: { id: Tab; label: string; dot?: boolean }[] = [
    { id: "basics", label: "Basics" },
    { id: "rules", label: "Rules", dot: hasRule },
    { id: "advanced", label: "Advanced", dot: !!selectedField && hasAudience(selectedField.audience) },
  ];

  return (
    <div
      className={
        selectedField
          ? "fixed inset-x-0 bottom-0 z-[60] flex max-h-[75dvh] w-full shrink-0 flex-col rounded-t-3xl border-t border-gray-200 bg-white shadow-[0_-20px_50px_-20px_rgba(15,23,42,0.35)] lg:static lg:z-auto lg:max-h-none lg:w-[340px] lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none"
          : "hidden w-[340px] shrink-0 flex-col border-l border-gray-200 bg-white lg:flex"
      }
    >
      {selectedField ? (
        <>
          <div className="px-5 py-3.5 border-b border-gray-100 bg-slate-50/50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-slate-600 shadow-sm">
              <i className={`ph ${typeDef?.icon || 'ph-text-t'} text-xl`}></i>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-slate-900 text-[0.95rem] truncate">{selectedField.name || "Field Properties"}</h3>
              <p className="text-[0.7rem] font-semibold text-slate-500 uppercase tracking-wider">
                {typeDef?.label || 'Field'}{selectedField.archived ? " · Archived" : ""}
              </p>
            </div>
            {onClose && (
              <button type="button" onClick={onClose} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 lg:hidden">
                Done
              </button>
            )}
          </div>

          <div className="px-3 pt-3 pb-0 border-b border-gray-100">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative rounded-lg py-1.5 text-[0.78rem] font-bold transition-colors ${
                    tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t.label}
                  {t.dot && <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-violet-500"></span>}
                </button>
              ))}
            </div>
            <div className="h-3"></div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {tab === "basics" && (
              <>
                <FieldBasicsEditor field={selectedField} layout={layout} sectionId={sectionId} onChange={onChange} onRoleChange={onRoleChange} />
                {(selectedField.type === "PICK_LIST" || selectedField.type === "MULTI_SELECT") && (
                  <OptionsEditor field={selectedField} onChange={onChange} onRemoveOption={onRemoveOption} removing={checkingUsage} />
                )}
                {selectedField.type === "STATUS_PICKER" && <StatusOptionsEditor field={selectedField} onChange={onChange} />}
                {selectedField.type === "SIZE" && <SizeUnitsEditor field={selectedField} layout={layout} onChange={onChange} />}
                {/* Settings that live elsewhere but belong to this field, shown in place. */}
                {layout.formKey === "JOB_FORM" && effectiveRole(layout.schema, selectedField) === "category" && <CategoryPricingCard field={selectedField} />}
                {layout.formKey === "JOB_FORM" && selectedField.type === "STATUS_PICKER" && <StatusStagesCard field={selectedField} />}
              </>
            )}

            {tab === "rules" && (
              <>
                <VisibilityRuleEditor field={selectedField} layout={layout} onChange={onChange} />
                <RequiredRuleEditor field={selectedField} layout={layout} onChange={onChange} />
                <ValidationEditor field={selectedField} layout={layout} onChange={onChange} />
                {selectedField.type === "DATE" && <DateRestrictionEditor field={selectedField} onChange={onChange} />}
                {selectedField.type === "STATUS_PICKER" && <StatusRestrictionEditor field={selectedField} layout={layout} onChange={onChange} />}
              </>
            )}

            {tab === "advanced" && (
              <>
                {(selectedField.type === "USER_PICKLIST" || selectedField.type === "MULTI_USER_PICKLIST") && (
                  <UserPicklistConfigEditor field={selectedField} users={users} onChange={onChange} />
                )}

                <AudienceEditor field={selectedField} layout={layout} onChange={onChange} />

                <div className="border-t border-gray-100 pt-4">
                  <label className="text-[0.75rem] font-bold text-slate-600 mb-1.5 block">Field id</label>
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-slate-50 px-3 py-2">
                    <code className="flex-1 truncate text-[0.75rem] text-slate-600">{selectedField.id}</code>
                    <button
                      type="button"
                      onClick={() => { try { navigator.clipboard?.writeText(selectedField.id); } catch { /* clipboard unavailable */ } }}
                      className="text-slate-400 hover:text-slate-700"
                      aria-label="Copy field id"
                      title="Copy"
                    >
                      <i className="ph-bold ph-copy"></i>
                    </button>
                  </div>
                  <p className="mt-1.5 text-[0.7rem] text-slate-500 leading-snug">Saved values are stored under this id, so it never changes when you rename the field.</p>
                </div>

                <div className="space-y-2 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={onDuplicate}
                    className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
                  >
                    <i className="ph-bold ph-copy text-orange-500 text-lg"></i>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-800">Duplicate field</span>
                      <span className="block text-[0.7rem] text-slate-500">Same type, options and rules, placed right after this one.</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onArchive(!selectedField.archived)}
                    className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left hover:border-amber-300 hover:bg-amber-50/50 transition-colors"
                  >
                    <i className={`ph-bold ${selectedField.archived ? "ph-arrow-counter-clockwise text-emerald-600" : "ph-archive text-amber-600"} text-lg`}></i>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-800">{selectedField.archived ? "Restore field" : "Archive field"}</span>
                      <span className="block text-[0.7rem] text-slate-500">
                        {selectedField.archived ? "Shows in the form again." : "Hidden from the form; values already saved stay visible in records."}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onRemove}
                    disabled={removing}
                    className="w-full flex items-center gap-3 rounded-xl border border-red-100 bg-white px-3 py-2.5 text-left hover:border-red-300 hover:bg-red-50/60 transition-colors disabled:opacity-50"
                  >
                    {removing ? <div className="w-4 h-4 border-2 border-red-200 border-t-red-500 rounded-full animate-spin"></div> : <i className="ph-bold ph-trash text-red-500 text-lg"></i>}
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-red-700">Delete field</span>
                      <span className="block text-[0.7rem] text-slate-500">Checks for saved values first and offers Archive when there are any.</span>
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      ) : layout.formKey === "JOB_FORM" ? (
        <RolesChecklist layout={layout} onSelectField={onSelectField} />
      ) : (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-gray-100 shadow-sm">
            <i className="ph ph-cursor-click text-2xl"></i>
          </div>
          <h3 className="font-bold text-slate-700 mb-1">No Field Selected</h3>
          <p className="text-[0.8rem] leading-relaxed">Click a field on the canvas to edit it. Drag types from the palette to add fields, and use ⌘Z to undo.</p>
        </div>
      )}
    </div>
  );
}
