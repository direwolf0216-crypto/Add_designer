"use client";

import FieldRenderer from "@/components/forms/FieldRenderer";
import { JOB_FORM_FIELD_MAP, allFields, fieldNameFor } from "@/lib/forms/fieldMap";
import type { FormSection } from "@/lib/forms/types";
import { newRepeatableEntry, removeRepeatableEntry, shiftRatesAfterRemoval, sortFinancialFields } from "@/lib/jobs/formMapping";
import JobField from "./JobField";
import JobFieldBlock from "./JobFieldBlock";
import { useJobFormContext } from "./JobFormContext";

const toFieldName = (id: string) => fieldNameFor(JOB_FORM_FIELD_MAP, id);

/**
 * A repeatable layout section (e.g. several print items): fields marked `isRepeatableField: false`
 * are shown once; the others repeat per entry, stored in `repeatableData["rep_<sectionId>"]`.
 */
export default function RepeatableSection({ section }: { section: FormSection }) {
  const { job, layoutSchema, isVisible, repeatableData, setRepeatableData, setFinancialRates, deleteConfirm, setDeleteConfirm } = useJobFormContext();
  const secKey = `rep_${section.id}`;
  const isFinancial = section.id === "sec_job_financial";
  const globalFields = section.fields.filter((f) => f.isRepeatableField === false);
  const statusF = allFields(layoutSchema).find((f) => f.type === "STATUS_PICKER");

  const updateEntryField = (index: number, fieldName: string, value: unknown) => {
    setRepeatableData((prev) => {
      const arr = [...(prev[secKey] || [])];
      if (!arr[index]) arr[index] = {};
      arr[index] = { ...arr[index], [fieldName]: value };
      return { ...prev, [secKey]: arr };
    });
  };

  const removeEntry = (index: number) => {
    const count = (repeatableData[secKey] || []).length;
    setRepeatableData((prev) => removeRepeatableEntry(prev, secKey, index));
    setFinancialRates((prev) => shiftRatesAfterRemoval(prev, secKey, index, count));
    setDeleteConfirm(null);
  };

  const addEntry = () => {
    setRepeatableData((prev) => ({ ...prev, [secKey]: [...(prev[secKey] || []), newRepeatableEntry(section, JOB_FORM_FIELD_MAP)] }));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Render Global Fields (isRepeatableField === false) */}
      {globalFields.length > 0 && (
        <div className={`grid gap-5 items-start ${isFinancial ? "grid-cols-1 md:grid-cols-12" : "grid-cols-1 md:grid-cols-2"} mb-4`}>
          {(isFinancial ? sortFinancialFields(globalFields, JOB_FORM_FIELD_MAP, true) : globalFields).map((field) => {
            let fieldName = toFieldName(field.id);
            if (statusF && field.id === statusF.id) fieldName = "status";
            if (field.visibilityRule && !isVisible(field.visibilityRule)) return null;
            if (!job && field.type === "STATUS_PICKER") return null;
            return (
              <JobFieldBlock key={field.id} field={field} fieldName={fieldName} className={isFinancial ? "md:col-span-4" : field.type === "MULTI_LINE" ? "md:col-span-2" : ""}>
                <JobField field={field} />
              </JobFieldBlock>
            );
          })}
        </div>
      )}

      {(repeatableData[secKey] || []).map((entry, entryIdx) => (
        <div key={entryIdx} className="bg-white border border-slate-200 rounded-xl p-5 relative group/rep shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {section.fields
              .filter((f) => f.isRepeatableField !== false)
              .map((field) => {
                if (field.visibilityRule && !isVisible(field.visibilityRule)) return null;
                const fieldName = toFieldName(field.id);
                return (
                  <div key={field.id} id={`field-container-${fieldName}`} className="flex flex-col gap-1.5 relative">
                    <label className="text-[0.75rem] font-bold text-slate-600 uppercase tracking-[0.5px]">
                      {field.name} {field.mandatory && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <div className="relative mt-1">
                      <FieldRenderer
                        field={field}
                        name={fieldName}
                        value={entry ? entry[fieldName] : ""}
                        onChange={(val) => updateEntryField(entryIdx, fieldName, val)}
                        variant="jobRepeatable"
                      />
                    </div>
                  </div>
                );
              })}
          </div>
          {entryIdx > 0 && (
            <button type="button" onClick={() => setDeleteConfirm({ sectionId: section.id, index: entryIdx })} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover/rep:opacity-100 transition-opacity">
              <i className="ph-bold ph-trash text-lg"></i>
            </button>
          )}
          {deleteConfirm?.sectionId === section.id && deleteConfirm?.index === entryIdx && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-xl flex items-center justify-center gap-4 z-10 border border-red-100 shadow-sm">
              <span className="text-slate-800 font-bold text-[0.95rem]">Remove this entry?</span>
              <button type="button" onClick={() => removeEntry(entryIdx)} className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-[0.9rem] transition-colors shadow-lg shadow-red-500/20">Yes, Remove</button>
              <button type="button" onClick={() => setDeleteConfirm(null)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[0.9rem] transition-colors shadow-sm border border-slate-200">Cancel</button>
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addEntry} className="mt-2 w-full py-4 border border-dashed border-emerald-300 rounded-2xl bg-emerald-50/50 text-emerald-600 font-bold text-[0.95rem] hover:bg-emerald-50 transition-all flex flex-col items-center justify-center gap-1 shadow-sm">
        <div className="flex items-center gap-2 text-[1rem]">
          <i className="ph-bold ph-plus"></i> Add Another Item
        </div>
        <span className="text-[0.8rem] font-medium text-emerald-600/70">Add multiple items with different specifications</span>
      </button>
    </div>
  );
}
