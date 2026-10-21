"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAllFields } from "@/lib/layout-builder/reducer";
import type { FieldEditorProps } from "./types";

/** STATUS_PICKER fields: block statuses that represent a future stage relative to a date field. */
export default function StatusRestrictionEditor({ field: selectedField, layout: activeLayout, onChange: updateSelectedField }: FieldEditorProps) {
  const allFields = getAllFields(activeLayout);

  return (
    <div className="pt-4 mt-4 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2 border border-blue-200 bg-blue-50/50 p-3 rounded-lg relative">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 shrink-0 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
            <i className="ph-fill ph-shield-check text-lg"></i>
          </div>
          <div className="flex-1 min-w-0 flex items-center">
            <h4 className="text-[0.8rem] font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
              Restrict Updating Status for Future Dates
              <div className="group relative flex items-center">
                <i className="ph-fill ph-info text-slate-400 hover:text-blue-500 cursor-help transition-colors text-[1.1rem]"></i>
                <div className="absolute bottom-full -left-4 mb-2 w-64 p-2.5 bg-slate-800 text-white text-[0.75rem] font-medium rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none text-left leading-relaxed">
                  Prevent changing status to a value that represents a future stage.
                  <div className="mt-1.5 pt-1.5 border-t border-slate-700/50 text-slate-300 italic text-[0.7rem]">
                    Example: If the job date is tomorrow, &quot;Printing Completed&quot; cannot be selected today.
                  </div>
                  <div className="absolute top-full left-5 border-4 border-transparent border-t-slate-800"></div>
                </div>
              </div>
            </h4>
          </div>
        </div>
        <div
          onClick={() => {
            const currentEnabled = !!selectedField.futureDateRestriction?.enabled;
            updateSelectedField({
              futureDateRestriction: {
                enabled: !currentEnabled,
                dateFieldId: selectedField.futureDateRestriction?.dateFieldId || '',
                restrictedStatuses: selectedField.futureDateRestriction?.restrictedStatuses || []
              }
            });
          }}
          className={`relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer shrink-0 ml-4 ${selectedField.futureDateRestriction?.enabled ? 'bg-blue-500' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${selectedField.futureDateRestriction?.enabled ? 'translate-x-4' : 'translate-x-0'}`}></span>
        </div>
      </div>

      {selectedField.futureDateRestriction?.enabled && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mt-3">
          <div className="mb-4">
            <label className="text-[0.75rem] font-bold text-slate-600 flex items-center gap-1 mb-2">
              Based on date field:
            </label>
            <Select
              value={selectedField.futureDateRestriction.dateFieldId}
              onValueChange={(val) => updateSelectedField({
                futureDateRestriction: {
                  ...selectedField.futureDateRestriction!,
                  dateFieldId: val || ''
                }
              })}
            >
              <SelectTrigger className="w-full text-sm font-semibold text-slate-800 bg-white border border-gray-300 rounded-lg h-10 outline-none focus:border-blue-400 transition-colors">
                <SelectValue placeholder="Select Date Field">
                  {allFields.find(f => f.id === selectedField.futureDateRestriction?.dateFieldId)?.name || selectedField.futureDateRestriction?.dateFieldId || "Select Date Field"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {allFields
                  .filter(f => f.type === "DATE")
                  .map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[0.75rem] font-bold text-slate-600 flex items-center gap-1 mb-2">
              Select restricted statuses:
            </label>
            <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto no-scrollbar p-1">
              {(selectedField.statusOptions || []).map(opt => {
                const isRestricted = selectedField.futureDateRestriction?.restrictedStatuses?.includes(opt.label);
                return (
                  <label key={opt.label} className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isRestricted ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 bg-white text-transparent group-hover:border-blue-400'}`}>
                      <i className="ph-bold ph-check text-[0.6rem]"></i>
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={isRestricted}
                      onChange={(e) => {
                        const currentStatuses = selectedField.futureDateRestriction?.restrictedStatuses || [];
                        const newStatuses = e.target.checked
                          ? [...currentStatuses, opt.label]
                          : currentStatuses.filter(s => s !== opt.label);

                        updateSelectedField({
                          futureDateRestriction: {
                            ...selectedField.futureDateRestriction!,
                            restrictedStatuses: newStatuses
                          }
                        });
                      }}
                    />
                    <span className="text-sm font-semibold text-slate-700">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
