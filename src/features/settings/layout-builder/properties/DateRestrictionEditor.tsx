"use client";

import type { FormField } from "@/lib/layout-builder/types";

interface DateRestrictionEditorProps {
  field: FormField;
  onChange: (updates: Partial<FormField>) => void;
}

/** DATE fields: "Restrict Future Dates" toggle. */
export default function DateRestrictionEditor({ field: selectedField, onChange: updateSelectedField }: DateRestrictionEditorProps) {
  return (
    <div className="pt-4 mt-4 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2 border border-blue-200 bg-blue-50/50 p-3 rounded-lg relative">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 shrink-0 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
            <i className="ph-fill ph-calendar-blank text-lg"></i>
          </div>
          <div className="flex-1 min-w-0 flex items-center">
            <h4 className="text-[0.8rem] font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
              Restrict Future Dates
              <div className="group relative flex items-center">
                <i className="ph-fill ph-info text-slate-400 hover:text-blue-500 cursor-help transition-colors text-[1.1rem]"></i>
                <div className="absolute bottom-full -left-4 mb-2 w-64 p-2.5 bg-slate-800 text-white text-[0.75rem] font-medium rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none text-left leading-relaxed">
                  Prevent selecting dates in the future.
                  <div className="mt-1.5 pt-1.5 border-t border-slate-700/50 text-slate-300 italic text-[0.7rem]">
                    Example: Users will only be able to select today or past dates.
                  </div>
                  <div className="absolute top-full left-5 border-4 border-transparent border-t-slate-800"></div>
                </div>
              </div>
            </h4>
          </div>
        </div>
        <div
          onClick={() => {
            const currentEnabled = !!selectedField.restrictFutureDate;
            updateSelectedField({
              restrictFutureDate: !currentEnabled
            });
          }}
          className={`relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer shrink-0 ml-4 ${selectedField.restrictFutureDate ? 'bg-blue-500' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${selectedField.restrictFutureDate ? 'translate-x-4' : 'translate-x-0'}`}></span>
        </div>
      </div>
    </div>
  );
}
