"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FieldErrors } from "react-hook-form";
import { toast } from "sonner";
import { saveJobAction } from "@/app/actions";
import { invalidateAll } from "@/lib/swr";
import { uploadFileToDrive } from "@/lib/uploadHelper";
import { JOB_FORM_FIELD_MAP } from "@/lib/forms/fieldMap";
import { isVisibleIn } from "@/lib/forms/visibility";
import type { JobFormData } from "@/lib/validations/job";
import {
  buildJobFormData,
  emptyRepeatableSections,
  fieldValidationErrors,
  missingMandatoryFields,
  prepareFileValues,
  withoutHiddenFields,
  type IsVisible,
} from "@/lib/jobs/formMapping";
import { findDiscountKey, parseCurrency } from "@/lib/jobs/pricing";
import { entryValidationErrors, globalFieldsOf, jobDetailsSection, missingEntryFields, splitIntoJobs, withFirstEntryDefaults } from "@/lib/jobs/multiJob";
import { findRoleField } from "@/lib/forms/roles";
import { fieldNameFor } from "@/lib/forms/fieldMap";
import type { JobFormState } from "./useJobFormState";

const FLASH_CLASSES = ["bg-red-50", "p-2", "rounded-xl", "transition-colors", "duration-500"];

/** Scroll a field container into view and flash it red. */
function flashField(fieldName: string, index?: number) {
  setTimeout(() => {
    const element = document.getElementById(index === undefined ? `field-container-${fieldName}` : `field-container-${fieldName}-${index}`) ?? document.getElementById(`field-container-${fieldName}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add(...FLASH_CLASSES);
      setTimeout(() => element.classList.remove(...FLASH_CLASSES), 500);
    }
  }, 100);
}

/**
 * Validate, upload attachments and save the job in a single saveJobAction call (job fields,
 * repeatable entries, rates and installments together).
 */
export function useJobFormSubmit(state: JobFormState, isVisible: IsVisible, onSaved: () => void) {
  const { form, job, layoutSchema, repeatableData, financialRates, installments } = state;
  const { setError, clearErrors } = form;
  const router = useRouter();
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);

  const onSubmit = async (data: JobFormData) => {
    clearErrors();

    // Every repeatable section needs at least one entry.
    const emptySections = emptyRepeatableSections(layoutSchema, repeatableData);
    emptySections.forEach((section) => toast.error(`Please add at least one entry for ${section.title || "the repeatable section"}.`));
    if (emptySections.length > 0) {
      setIsSubmittingLocal(false);
      return;
    }

    // Mandatory checks for visible fields (custom inputs are set via setValue, not natively required).
    const missing = missingMandatoryFields(layoutSchema, data, isVisible, JOB_FORM_FIELD_MAP);
    missing.forEach(({ fieldName, message }) => setError(fieldName, { type: "manual", message }));
    if (missing.length > 0) {
      flashField(missing[0].fieldName);
      setIsSubmittingLocal(false);
      return;
    }
    // Bounds, length and format rules set in the layout builder.
    const invalid = fieldValidationErrors(layoutSchema, data, isVisible, JOB_FORM_FIELD_MAP);
    invalid.forEach(({ fieldName, message }) => setError(fieldName, { type: "manual", message }));
    if (invalid.length > 0) {
      toast.error(invalid[0].message);
      flashField(invalid[0].fieldName);
      setIsSubmittingLocal(false);
      return;
    }
    // Each job entry needs its own mandatory fields (dates, size, quantity …).
    const jdSection = jobDetailsSection(layoutSchema);
    const perJob = !!jdSection && (!job || (repeatableData[`rep_${jdSection.id}`] ?? []).length <= 1);
    const entriesData = perJob ? withFirstEntryDefaults(layoutSchema, JOB_FORM_FIELD_MAP, repeatableData, data as Record<string, unknown>) : repeatableData;
    if (perJob) {
      const missingInEntries = missingEntryFields(layoutSchema, JOB_FORM_FIELD_MAP, entriesData, (rule, entry) =>
        isVisibleIn(rule, { ...(data as Record<string, unknown>), ...(entry ?? {}) }, JOB_FORM_FIELD_MAP)
      );
      if (missingInEntries.length > 0) {
        const first = missingInEntries[0];
        toast.error(`Job ${first.index + 1}: ${first.message}`);
        flashField(first.fieldName, first.index);
        setIsSubmittingLocal(false);
        return;
      }
    }
    // Bounds and formats inside each Job Details entry (a negative quantity, say), when editing too.
    if (jdSection) {
      const invalidInEntries = entryValidationErrors(layoutSchema, JOB_FORM_FIELD_MAP, entriesData, (rule, entry) =>
        isVisibleIn(rule, { ...(data as Record<string, unknown>), ...(entry ?? {}) }, JOB_FORM_FIELD_MAP)
      );
      if (invalidInEntries.length > 0) {
        const first = invalidInEntries[0];
        toast.error(perJob ? `Job ${first.index + 1}: ${first.message}` : `Item ${first.index + 1}: ${first.message}`);
        flashField(first.fieldName, first.index);
        setIsSubmittingLocal(false);
        return;
      }
    }

    // Hidden fields are not submitted.
    let values: Record<string, any> = withoutHiddenFields(data, layoutSchema, isVisible, JOB_FORM_FIELD_MAP);

    setIsSubmittingLocal(true);
    try {
      const prepared = prepareFileValues(values);
      values = prepared.data;
      const uploadResults = await Promise.all(
        prepared.uploads.map(({ key, file }) =>
          uploadFileToDrive(file, "Jobs", values.category || "Uncategorized", values.date).then((uploaded) => ({ key, uploaded }))
        )
      );
      for (const result of uploadResults) values[result.key] = JSON.stringify(result.uploaded);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
      setIsSubmittingLocal(false);
      return;
    }

    // Create: one job per Job Details entry, each with its own dates, item, rate, share of the advance and people.
    if (perJob && jdSection) {
      const secKey = `rep_${jdSection.id}`;
      const discountKey = findDiscountKey(values, layoutSchema, JOB_FORM_FIELD_MAP);
      const jobs = splitIntoJobs({
        layout: layoutSchema,
        fieldMap: JOB_FORM_FIELD_MAP,
        repeatableData: entriesData,
        financialRates,
        installments,
        discount: discountKey ? parseCurrency(String(values[discountKey] ?? "0")) : 0,
        fallbackPackage: parseCurrency(String(values.package ?? "0")),
        rules: state.pricingRules,
      });
      const groupId = jobs.length > 1 ? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())) : undefined;
      const globalNames = globalFieldsOf(jdSection).map((f) => fieldNameFor(JOB_FORM_FIELD_MAP, f.id));
      // The job's category column follows the field with the Job category role (the built-in id maps to "category").
      const categoryField = findRoleField(layoutSchema, "category");
      const categoryKey = categoryField ? fieldNameFor(JOB_FORM_FIELD_MAP, categoryField.id) : "category";
      let created = 0;
      for (const j of jobs) {
        const data: Record<string, unknown> = { ...values, ...j.globals, package: String(j.packageAmount), category: (j.entry[categoryKey] as string | undefined) || (j.entry.category as string | undefined) || (values[categoryKey as keyof typeof values] as string | undefined) || (values.category as string | undefined) || "" };
        if (discountKey && jobs.length > 1) data[discountKey] = String(Math.max(0, j.lineTotal - j.packageAmount));
        // Only the first job keeps the form's own id (edit mode has exactly one job).
        if (j.index > 0) delete data.id;
        if (groupId) data.fld_job_group = groupId;
        for (const name of globalNames) if (j.globals[name] === undefined && name !== "date" && name !== "status") delete data[name];
        const formData = buildJobFormData({
          data,
          repeatableData: { ...entriesData, [secKey]: [j.entry] },
          financialRates: j.financialRates,
          installments: job ? installments : j.installments,
          layout: layoutSchema,
          fieldMap: JOB_FORM_FIELD_MAP,
          rules: state.pricingRules,
        });
        formData.set("assigneeIds", JSON.stringify(state.entryAssignees[j.index] ?? []));
        const result = await saveJobAction(formData);
        if (!(result.success && result.data)) {
          const reason = !result.success ? result.errors?._form?.[0] : undefined;
          toast.error(jobs.length > 1 ? `Job ${j.index + 1} could not be saved${created ? ` (${created} saved)` : ""}. ${reason ?? "Please check its fields."}` : reason ?? "Failed to save job. Please check your inputs.");
          invalidateAll();
          router.refresh();
          setIsSubmittingLocal(false);
          return;
        }
        created++;
      }
      toast.success(job ? "Job updated successfully!" : created > 1 ? `Created ${created} jobs` : "Job created successfully!");
      invalidateAll();
      router.refresh();
      onSaved();
      setIsSubmittingLocal(false);
      return;
    }

    const formData = buildJobFormData({
      data: values,
      repeatableData,
      financialRates,
      installments,
      layout: layoutSchema,
      fieldMap: JOB_FORM_FIELD_MAP,
      rules: state.pricingRules,
    });
    formData.set("assigneeIds", JSON.stringify(state.entryAssignees[0] ?? []));
    const result = await saveJobAction(formData);

    if (result.success && result.data) {
      toast.success(job ? "Job updated successfully!" : "Job created successfully!");
      invalidateAll();
      router.refresh();
      onSaved();
    } else {
      toast.error((!result.success ? result.errors?._form?.[0] : undefined) ?? "Failed to save job. Please check your inputs.");
    }
    setIsSubmittingLocal(false);
  };

  const onError = (errors: FieldErrors<JobFormData>) => {
    const firstError = Object.keys(errors)[0];
    if (firstError) document.getElementById(`field-container-${firstError}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return { onSubmit, onError, isSubmittingLocal };
}
