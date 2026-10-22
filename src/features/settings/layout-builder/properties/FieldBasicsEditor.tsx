"use client";

import { findOtherRecordDateField } from "@/lib/layout-builder/reducer";
import type { FieldEditorProps } from "./types";
import type { FieldRole } from "@/lib/layout-builder/types";
import RolePicker from "./RolePicker";
import DefaultValueEditor from "./DefaultValueEditor";

interface FieldBasicsEditorProps extends FieldEditorProps {
  /** Id of the section that contains the field (drives the "Add Entry block" toggle for repeatable sections). */
  sectionId: string | null;
  /** Assigns a role (exclusive per layout); only the job form has roles. */
  onRoleChange?: (role: FieldRole | null) => void;
}

/** Label, mandatory, repeatable-entry and record-date settings. */
export default function FieldBasicsEditor({ field: selectedField, layout: activeLayout, sectionId: selectedSectionId, onChange: updateSelectedField, onRoleChange }: FieldBasicsEditorProps) {
  const parentSection = activeLayout?.schema.sections.find(s => s.id === selectedSectionId);
  const existingRecordDateField = selectedField.type === "DATE" ? findOtherRecordDateField(activeLayout, selectedField) : null;

  return (
    <>
      {/* Field Label */}
      <div>
        <label className="text-[0.75rem] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
          Field Label <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={selectedField.name ?? ''}
          onChange={(e) => updateSelectedField({ name: e.target.value })}
          className="w-full text-sm font-semibold text-slate-800 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all"
        />
      </div>

      {activeLayout.formKey === "JOB_FORM" && onRoleChange && (
        <RolePicker field={selectedField} layout={activeLayout} onChange={onRoleChange} />
      )}

      <DefaultValueEditor field={selectedField} layout={activeLayout} onChange={updateSelectedField} />

      {/* Older layouts have Size as a plain text field: switching the type keeps the id, so saved jobs keep their sizes. */}
      {selectedField.type === "SINGLE_LINE" && (selectedField.name ?? "").toLowerCase().includes("size") && (
        <button
          type="button"
          onClick={() => updateSelectedField({ type: "SIZE" })}
          className="w-full flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-left transition-colors hover:border-violet-300 hover:bg-violet-100/70"
        >
          <i className="ph-bold ph-ruler text-violet-600 text-lg"></i>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-violet-800">Convert to Size field</span>
            <span className="block text-[0.7rem] leading-snug text-violet-600">Adds the ft / in / cm / mm / m picker. Existing jobs keep their sizes.</span>
          </span>
        </button>
      )}

      {/* Sample text shown inside the empty control */}
      {selectedField.type !== "CHECKBOX" && (
        <div>
          <label className="text-[0.75rem] font-bold text-slate-600 mb-1.5 flex items-center justify-between gap-2">
            <span>Sample text</span>
            {selectedField.placeholder ? (
              <button
                type="button"
                onClick={() => updateSelectedField({ placeholder: undefined })}
                className="text-[0.7rem] font-bold text-orange-600 hover:text-orange-700 transition-colors"
              >
                Reset
              </button>
            ) : null}
          </label>
          <input
            type="text"
            value={selectedField.placeholder ?? ''}
            maxLength={200}
            onChange={(e) => updateSelectedField({ placeholder: e.target.value || undefined })}
            placeholder={defaultSampleText(selectedField)}
            className="w-full text-sm font-semibold text-slate-800 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:font-normal placeholder:text-slate-400"
          />
          <p className="mt-1.5 text-[0.7rem] text-slate-500 leading-snug">
            Shown in grey inside the field until someone types or picks a value, e.g. &ldquo;Rahul Sharma&rdquo; or &ldquo;3 x 6 ft&rdquo;.
          </p>
        </div>
      )}

      {/* Mandatory Toggle */}
      <div className="pt-2">
        <label
          className="flex items-center gap-3 cursor-pointer group"
          onClick={(e) => {
            e.preventDefault();
            updateSelectedField({ mandatory: !selectedField.mandatory });
          }}
        >
          <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${selectedField.mandatory ? 'bg-orange-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${selectedField.mandatory ? 'translate-x-5' : 'translate-x-0'}`}></span>
          </div>
          <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Mandatory Field</span>
        </label>
      </div>

      {/* Include in Repeatable Sub-Section */}
      {parentSection?.isRepeatable && (
        <div className="pt-2 border-t border-gray-100">
          <label
            className="flex items-center gap-3 cursor-pointer group"
            onClick={(e) => {
              e.preventDefault();
              // Default to true if undefined
              const currentVal = selectedField.isRepeatableField !== false;
              updateSelectedField({ isRepeatableField: !currentVal });
            }}
          >
            <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${selectedField.isRepeatableField !== false ? 'bg-orange-500' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${selectedField.isRepeatableField !== false ? 'translate-x-5' : 'translate-x-0'}`}></span>
            </div>
            <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Include in Add Entry block</span>
          </label>
        </div>
      )}

      {/* Record Date Toggle (DATE only) */}
      {selectedField.type === "DATE" && (
        <div className="pt-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={(e) => {
                e.preventDefault();
                if (existingRecordDateField) {
                  return; // Disabled if another exists
                }
                updateSelectedField({ isRecordDate: !selectedField.isRecordDate });
              }}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${existingRecordDateField ? 'bg-slate-200 cursor-not-allowed opacity-50' : selectedField.isRecordDate ? 'bg-orange-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${selectedField.isRecordDate ? 'translate-x-5' : 'translate-x-0'}`}></span>
            </div>
            <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Use as Record Date</span>
          </label>
          {existingRecordDateField && (
            <p className="text-red-500 text-[0.7rem] font-medium mt-1">
              Only one date field can be the record date. Disable {existingRecordDateField.name} first.
            </p>
          )}
        </div>
      )}
    </>
  );
}

/** What the control shows when no sample text has been set, mirroring the form fields' own fallbacks. */
function defaultSampleText(field: FieldEditorProps["field"]): string {
  const name = field.name || "value";
  switch (field.type) {
    case "DATE": return "Select Date...";
    case "TIME": return "e.g. HH:MM AM/PM";
    case "PICK_LIST":
    case "MULTI_SELECT":
    case "USER_PICKLIST":
    case "MULTI_USER_PICKLIST":
      return `Select ${name}...`;
    case "STATUS_PICKER": return "Select Status...";
    case "SIZE": return "e.g. 3 x 6";
    default: return `e.g. Enter ${name}...`;
  }
}
