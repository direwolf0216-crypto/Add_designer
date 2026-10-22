"use client";

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

interface PropertiesPanelProps {
  layout: FormLayout;
  field: FormField | null;
  sectionId: string | null;
  users: BuilderUser[];
  onChange: (updates: Partial<FormField>) => void;
  onRemoveOption: (idx: number) => void;
  checkingUsage: boolean;
  /** Closes the panel (shown as a bottom sheet below `lg`). */
  onClose?: () => void;
}

/** Right column: properties of the selected field, composed of per-concern editors. */
export default function PropertiesPanel({ layout, field: selectedField, sectionId, users, onChange, onRemoveOption, checkingUsage, onClose }: PropertiesPanelProps) {
  const typeDef = getFieldTypeDef(selectedField?.type);

  return (
    <div
      className={
        selectedField
          ? "fixed inset-x-0 bottom-0 z-[60] flex max-h-[75dvh] w-full shrink-0 flex-col rounded-t-3xl border-t border-gray-200 bg-white shadow-[0_-20px_60px_-20px_rgba(15,23,42,0.35)] lg:static lg:z-auto lg:max-h-none lg:w-[320px] lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none"
          : "hidden w-[320px] shrink-0 flex-col border-l border-gray-200 bg-white lg:flex"
      }
    >
      {selectedField ? (
        <>
          <div className="px-6 py-4 border-b border-gray-100 bg-slate-50/50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-slate-600 shadow-sm">
              <i className={`ph ${typeDef?.icon || 'ph-text-t'} text-xl`}></i>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-slate-900 text-[0.95rem]">Field Properties</h3>
              <p className="text-[0.7rem] font-semibold text-slate-500 uppercase tracking-wider">{typeDef?.label || 'Field'}</p>
            </div>
            {onClose && (
              <button type="button" onClick={onClose} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-white lg:hidden">
                Done
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <FieldBasicsEditor field={selectedField} layout={layout} sectionId={sectionId} onChange={onChange} />

            {(selectedField.type === "PICK_LIST" || selectedField.type === "MULTI_SELECT") && (
              <OptionsEditor field={selectedField} onChange={onChange} onRemoveOption={onRemoveOption} removing={checkingUsage} />
            )}

            {selectedField.type === "STATUS_PICKER" && <StatusOptionsEditor field={selectedField} onChange={onChange} />}

            {selectedField.type === "DATE" && <DateRestrictionEditor field={selectedField} onChange={onChange} />}

            {selectedField.type === "STATUS_PICKER" && <StatusRestrictionEditor field={selectedField} layout={layout} onChange={onChange} />}

            {(selectedField.type === "USER_PICKLIST" || selectedField.type === "MULTI_USER_PICKLIST") && (
              <UserPicklistConfigEditor field={selectedField} users={users} onChange={onChange} />
            )}

            <VisibilityRuleEditor field={selectedField} layout={layout} onChange={onChange} />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-gray-100 shadow-sm">
            <i className="ph ph-cursor-click text-2xl"></i>
          </div>
          <h3 className="font-bold text-slate-700 mb-1">No Field Selected</h3>
          <p className="text-[0.8rem] leading-relaxed">Click on a field in the canvas to view and edit its properties.</p>
        </div>
      )}
    </div>
  );
}
