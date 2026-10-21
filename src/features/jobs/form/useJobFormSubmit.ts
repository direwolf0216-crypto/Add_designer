"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FieldErrors } from "react-hook-form";
import { toast } from "sonner";
import { saveJobAction } from "@/app/actions";
import { invalidateAll } from "@/lib/swr";
import { uploadFileToDrive } from "@/lib/uploadHelper";
import { JOB_FORM_FIELD_MAP } from "@/lib/forms/fieldMap";
import type { JobFormData } from "@/lib/validations/job";
import {
  buildJobFormData,
  emptyRepeatableSections,
  missingMandatoryFields,
  prepareFileValues,
  withoutHiddenFields,
  type IsVisible,
} from "@/lib/jobs/formMapping";
import type { JobFormState } from "./useJobFormState";

const FLASH_CLASSES = ["bg-red-50", "p-2", "rounded-xl", "transition-colors", "duration-500"];

/** Scroll a field container into view and flash it red. */
function flashField(fieldName: string) {
  setTimeout(() => {
    const element = document.getElementById(`field-container-${fieldName}`);
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

    const formData = buildJobFormData({
      data: values,
      repeatableData,
      financialRates,
      installments,
      layout: layoutSchema,
      fieldMap: JOB_FORM_FIELD_MAP,
    });
    const result = await saveJobAction(formData);

    if (result.success && result.data) {
      toast.success(job ? "Job updated successfully!" : "Job created successfully!");
      invalidateAll();
      router.refresh();
      onSaved();
    } else {
      toast.error("Failed to save job. Please check your inputs.");
    }
    setIsSubmittingLocal(false);
  };

  const onError = (errors: FieldErrors<JobFormData>) => {
    const firstError = Object.keys(errors)[0];
    if (firstError) document.getElementById(`field-container-${firstError}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return { onSubmit, onError, isSubmittingLocal };
}
