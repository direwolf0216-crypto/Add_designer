"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useGlobalForm } from "@/components/providers/GlobalFormProvider";
import { useLayoutPreview } from "@/components/providers/LayoutPreviewProvider";
import { invalidateFinance } from "@/lib/swr";
import { uploadFileToDrive } from "@/lib/uploadHelper";
import { TRANSACTION_FIELD_MAP } from "@/lib/forms/fieldMap";
import { collapseFileArray, isUploadableFile } from "@/lib/forms/files";
import { isVisibleIn } from "@/lib/forms/visibility";
import {
  apiFieldErrors,
  buildTransactionRequest,
  selectedCategories,
  successToast,
  toPayload,
  transactionLayoutDefaults,
  transactionToForm,
  validateTransactionForm,
  withRecordDate,
  type TransactionFormValues,
} from "@/lib/transactions/formMapping";
import TransactionField from "./TransactionField";
import { useTransactionFormData } from "./useTransactionFormData";

/** Create/edit income or expense, driven by the TRANSACTION_FORM layout; opened via useGlobalForm().openTransactionForm. */
function TransactionFormDialogInner() {
  const { isTransactionFormOpen: isOpen, transactionInitialData, closeTransactionForm } = useGlobalForm();
  const searchParams = useSearchParams();
  const { editTransaction, isTxLoading, layoutSchema, driveStatus } = useTransactionFormData();
  const { preview } = useLayoutPreview();
  const userId = useSession().data?.user?.id ?? null;
  const isEditMode = !!editTransaction;

  const [form, setForm] = useState<TransactionFormValues>({ type: "INCOME", status: "SETTLED" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset the form whenever the modal opens or its source data arrives (adjusted during render, not in an effect).
  const formSyncDeps = [isOpen, editTransaction, isTxLoading, layoutSchema, searchParams, transactionInitialData];
  const [prevFormSyncDeps, setPrevFormSyncDeps] = useState<unknown[] | null>(null);
  if (!prevFormSyncDeps || formSyncDeps.some((dep, i) => dep !== prevFormSyncDeps[i])) {
    setPrevFormSyncDeps(formSyncDeps);
    if (isOpen && !isTxLoading) {
      if (editTransaction) {
        setForm(transactionToForm(editTransaction));
      } else if (layoutSchema?.sections) {
        setForm(
          transactionLayoutDefaults(layoutSchema, TRANSACTION_FIELD_MAP, {
            type: searchParams.get("type") || transactionInitialData?.type,
            category: searchParams.get("category") || transactionInitialData?.category,
            userId,
          })
        );
      }
      setErrors({});
    }
  }

  const set = (key: string) => (value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSuccess = () => {
    invalidateFinance();
    closeTransactionForm();
  };

  const handleSubmit = async () => {
    const errs = validateTransactionForm(form, layoutSchema, TRANSACTION_FIELD_MAP);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setIsSubmitting(true);

    let payload = toPayload(form);

    try {
      const uploadPromises = [];
      for (const key in payload) {
        const valToProcess = collapseFileArray(payload[key]);
        if (valToProcess !== payload[key]) payload[key] = valToProcess;
        if (isUploadableFile(valToProcess)) {
          uploadPromises.push(
            uploadFileToDrive(valToProcess, "Transactions", payload.category || "Uncategorized", payload.date).then((uploaded) => ({ key, uploaded }))
          );
        }
      }
      for (const result of await Promise.all(uploadPromises)) payload[result.key] = result.uploaded.driveFile;
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
      setIsSubmitting(false);
      return;
    }

    payload = withRecordDate(payload, layoutSchema, TRANSACTION_FIELD_MAP);

    try {
      const request = buildTransactionRequest(payload, isEditMode ? editTransaction : null);
      const res = await fetch(request.url, {
        method: request.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });

      if (res.ok) {
        const { title, description } = successToast(form, selectedCategories(payload.category).length, isEditMode);
        toast.success(title, { description });
        onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        const fieldErrors = apiFieldErrors(res.status, data);
        if (fieldErrors) {
          setErrors(fieldErrors);
          toast.error("Please fix the highlighted fields.");
        } else {
          toast.error(data.error || "Failed to save. Please try again.");
        }
      }
    } catch {
      toast.error("Network error. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVisible = (rule: Parameters<typeof isVisibleIn>[0]) => isVisibleIn(rule, form, TRANSACTION_FIELD_MAP);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeTransactionForm()}>
      <DialogContent className="max-w-[700px] w-[calc(100vw-2rem)] sm:w-full sm:max-w-[700px] p-0 bg-transparent border-0 shadow-none overflow-visible">
        <div className="bg-slate-50 rounded-3xl overflow-hidden shadow-2xl flex flex-col w-full max-h-[90dvh] relative">
          <div className="px-5 sm:px-8 pt-5 sm:pt-7 pb-4 sm:pb-5 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[0.65rem] font-bold text-orange-500 uppercase tracking-[1px]">{isEditMode ? "Edit Record" : "New Record"}</span>
                <DialogTitle className="text-[1.5rem] font-extrabold text-slate-900 mt-0.5">{isEditMode ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
              </div>
            </div>
          </div>

          {preview && (
            <div className="shrink-0 flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-5 py-2 text-[0.8rem] font-semibold text-amber-800">
              <i className="ph-fill ph-eye"></i> Preview of the unsaved layout. Nothing entered here is saved.
            </div>
          )}
          <div className="px-5 sm:px-8 py-5 sm:py-6 overflow-y-auto flex-1 min-h-0">
            {layoutSchema?.sections ? (
              layoutSchema.sections.map((section) => {
                if (section.visibilityRule && !isVisible(section.visibilityRule)) return null;

                return (
                  <div key={section.id} className="bg-white rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-sm border border-slate-100">
                    <div className="flex flex-col mb-5">
                      <div className="flex items-center gap-2.5 font-extrabold text-[1.1rem] text-slate-900 tracking-tight">
                        <i className={`ph-fill ${section.icon || "ph-squares-four"} text-orange-500 text-[1.2rem]`}></i> {section.title}
                      </div>
                      {section.description && <div className="text-[0.85rem] text-slate-500 mt-1 font-medium leading-[1.4]">{section.description}</div>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                      {section.fields.map((field) => {
                        if (field.visibilityRule && !isVisible(field.visibilityRule)) return null;
                        return (
                          <React.Fragment key={field.id}>
                            <TransactionField field={field} form={form} errors={errors} set={set} driveStatus={driveStatus} />
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex justify-center p-10"><i className="ph ph-circle-notch animate-spin text-2xl text-slate-400"></i></div>
            )}
          </div>

          <div className="px-5 sm:px-8 py-4 sm:py-5 bg-white border-t border-slate-100 flex justify-end gap-3 z-10 relative shrink-0 rounded-b-3xl">
            <button
              onClick={() => closeTransactionForm()}
              className="px-4 sm:px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={preview ? undefined : handleSubmit}
              disabled={preview || isSubmitting}
              className="whitespace-nowrap px-5 sm:px-8 py-2.5 rounded-xl font-bold text-sm text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {preview ? (
                <><i className="ph-bold ph-eye"></i> Preview only</>
              ) : isSubmitting ? (
                <><i className="ph ph-circle-notch animate-spin"></i> Saving...</>
              ) : (
                <><i className={`ph-bold ${isEditMode ? "ph-pencil-simple" : "ph-floppy-disk"}`}></i> {isEditMode ? "Save Changes" : "Save Transaction"}</>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TransactionFormDialog() {
  return (
    <Suspense fallback={null}>
      <TransactionFormDialogInner />
    </Suspense>
  );
}
