"use client";

import { findOtherRecordDateField } from "@/lib/layout-builder/reducer";
import type { FieldEditorProps } from "./types";

interface FieldBasicsEditorProps extends FieldEditorProps {
  /** Id of the section that contains the field (drives the "Add Entry block" toggle for repeatable sections). */
  sectionId: string | null;
}

/** Label, mandatory, repeatable-entry and record-date settings. */
export default function FieldBasicsEditor({ field: selectedField, layout: activeLayout, sectionId: selectedSectionId, onChange: updateSelectedField }: FieldBasicsEditorProps) {
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
