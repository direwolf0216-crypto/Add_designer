"use client";

import FieldRenderer from "@/components/forms/FieldRenderer";
import { JOB_FORM_FIELD_MAP, allFields, fieldNameFor } from "@/lib/forms/fieldMap";
import type { FormField, FormSection } from "@/lib/forms/types";
import { newRepeatableEntry, removeRepeatableEntry, shiftRatesAfterRemoval, sortFinancialFields } from "@/lib/jobs/formMapping";
import { globalFieldsOf, jobDetailsSection } from "@/lib/jobs/multiJob";
import EntryAssigneePicker from "./EntryAssigneePicker";
import JobField from "./JobField";
import JobFieldBlock from "./JobFieldBlock";
import { useJobFormContext } from "./JobFormContext";

const toFieldName = (id: string) => fieldNameFor(JOB_FORM_FIELD_MAP, id);

/**
 * A repeatable layout section. For the Job Details section every entry is a separate job: its dates,
 * category, items and assignees live together in one "Job n" card, and "Add another job" adds a card.
 * Other repeatable sections keep the classic shape (shared fields once, items repeated).
 */
export default function RepeatableSection({ section }: { section: FormSection }) {
  const { job, form, layoutSchema, isVisible, repeatableData, setRepeatableData, setFinancialRates, deleteConfirm, setDeleteConfirm, entryAssignees, setEntryAssignees } = useJobFormContext();
  const secKey = `rep_${section.id}`;
  const isFinancial = section.id === "sec_job_financial";
  const globalFields = globalFieldsOf(section);
  const itemFields = section.fields.filter((f) => f.isRepeatableField !== false);
  const statusF = allFields(layoutSchema).find((f) => f.type === "STATUS_PICKER");
  const entries = repeatableData[secKey] || [];
  const isJobs = jobDetailsSection(layoutSchema)?.id === section.id;
  // Editing an older job that holds several items keeps the classic layout (one job, many items).
  const perJob = isJobs && (!job || entries.length <= 1);

  const updateEntryField = (index: number, fieldName: string, value: unknown) => {
    setRepeatableData((prev) => {
      const arr = [...(prev[secKey] || [])];
      if (!arr[index]) arr[index] = {};
      arr[index] = { ...arr[index], [fieldName]: value };
      return { ...prev, [secKey]: arr };
    });
    // The first job's dates/status also drive the flat form values (availability, record date, edit mode).
    if (index === 0 && globalFields.some((f) => globalName(f) === fieldName)) form.setValue(fieldName as never, value as never);
  };
  const globalName = (f: FormField) => (statusF && f.id === statusF.id ? "status" : toFieldName(f.id));

  const removeEntry = (index: number) => {
    const count = entries.length;
    setRepeatableData((prev) => removeRepeatableEntry(prev, secKey, index));
    setFinancialRates((prev) => shiftRatesAfterRemoval(prev, secKey, index, count));
    if (isJobs) setEntryAssignees((prev) => prev.filter((_, i) => i !== index));
    setDeleteConfirm(null);
  };

  const addEntry = () => {
    const fresh = newRepeatableEntry(section, JOB_FORM_FIELD_MAP);
    if (perJob) {
      // A new job starts with the previous job's dates so the common case needs no retyping.
      const last = entries[entries.length - 1] ?? {};
      for (const f of globalFields) {
        const name = globalName(f);
        if (last[name] !== undefined) fresh[name] = last[name];
        else if (name === "date") fresh[name] = form.getValues("date" as never);
      }
    }
    setRepeatableData((prev) => ({ ...prev, [secKey]: [...(prev[secKey] || []), fresh] }));
    if (isJobs) setEntryAssignees((prev) => [...prev, []]);
  };

  const globalValue = (entry: Record<string, unknown>, index: number, name: string) =>
    entry?.[name] !== undefined ? entry[name] : index === 0 ? form.watch(name as never) : "";

  const renderField = (field: FormField, index: number, entry: Record<string, unknown>, isGlobal: boolean) => {
    if (field.visibilityRule && !isVisible(field.visibilityRule)) return null;
    if (!job && field.type === "STATUS_PICKER") return null;
    const name = isGlobal ? globalName(field) : toFieldName(field.id);
    return (
      <div key={field.id} id={`field-container-${name}-${index}`} className="flex flex-col gap-1.5 relative">
        <label className="text-[0.75rem] font-bold text-slate-600 uppercase tracking-[0.5px]">
          {field.name} {field.mandatory && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <div className="relative mt-1">
          <FieldRenderer
            field={field}
            name={name}
            value={isGlobal ? globalValue(entry, index, name) : entry ? entry[name] : ""}
            onChange={(val) => updateEntryField(index, name, val)}
            variant="jobRepeatable"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Classic shape: shared fields once at the top. */}
      {!perJob && globalFields.length > 0 && (
        <div className={`grid gap-5 items-start ${isFinancial ? "grid-cols-1 md:grid-cols-12" : "grid-cols-1 md:grid-cols-2"} mb-4`}>
          {(isFinancial ? sortFinancialFields(globalFields, JOB_FORM_FIELD_MAP, true) : globalFields).map((field) => {
            const fieldName = globalName(field);
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

      {entries.map((entry, entryIdx) => (
        <div key={entryIdx} className={`relative rounded-2xl border bg-white p-5 shadow-sm group/rep ${perJob ? "border-slate-200" : "border-slate-200 rounded-xl"}`}>
          {perJob && (
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-xs font-black text-white shadow-md">{entryIdx + 1}</span>
              <div>
                <p className="text-sm font-extrabold text-slate-900">Job {entryIdx + 1}</p>
                <p className="text-[11px] text-slate-500">{job ? "This job's dates, item and people." : "Saved as its own job with its own dates, item and people."}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {perJob && globalFields.map((f) => renderField(f, entryIdx, entry ?? {}, true))}
            {itemFields.map((f) => renderField(f, entryIdx, entry ?? {}, false))}
            {isJobs && (
              <EntryAssigneePicker
                value={entryAssignees[entryIdx] ?? []}
                onChange={(ids) => setEntryAssignees((prev) => { const next = [...prev]; while (next.length <= entryIdx) next.push([]); next[entryIdx] = ids; return next; })}
                hint="They see this job in My Jobs and get notified"
              />
            )}
          </div>
          {entryIdx > 0 && (
            <button type="button" onClick={() => setDeleteConfirm({ sectionId: section.id, index: entryIdx })} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover/rep:opacity-100 focus:opacity-100 transition-opacity" aria-label={perJob ? `Remove job ${entryIdx + 1}` : "Remove entry"}>
              <i className="ph-bold ph-trash text-lg"></i>
            </button>
          )}
          {deleteConfirm?.sectionId === section.id && deleteConfirm?.index === entryIdx && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex items-center justify-center gap-4 z-10 border border-red-100 shadow-sm">
              <span className="text-slate-800 font-bold text-[0.95rem]">{perJob ? `Remove job ${entryIdx + 1}?` : "Remove this entry?"}</span>
              <button type="button" onClick={() => removeEntry(entryIdx)} className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-[0.9rem] transition-colors shadow-lg shadow-red-500/20">Remove</button>
              <button type="button" onClick={() => setDeleteConfirm(null)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[0.9rem] transition-colors shadow-sm">Keep</button>
            </div>
          )}
        </div>
      ))}

      {perJob && job ? (
        <p className="text-xs font-medium text-slate-400">To add another job for this client, use New job from the Jobs page.</p>
      ) : (
        <button type="button" onClick={addEntry} className="mt-2 w-full py-4 border border-dashed border-emerald-300 rounded-2xl bg-emerald-50/50 text-emerald-600 font-bold text-[0.95rem] hover:bg-emerald-50 transition-colors flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-[1rem]">
            <i className="ph-bold ph-plus"></i> {perJob ? "Add another job" : "Add Another Item"}
          </div>
          <span className="text-[0.8rem] font-medium text-emerald-600/70">{perJob ? "Each job has its own dates, item and assignees" : "Add multiple items with different specifications"}</span>
        </button>
      )}
    </div>
  );
}
