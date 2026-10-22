"use client";

import React, { Suspense, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGlobalForm } from "@/components/providers/GlobalFormProvider";
import { JOB_FORM_FIELD_MAP } from "@/lib/forms/fieldMap";
import { isVisibleIn } from "@/lib/forms/visibility";
import type { VisibilityRule } from "@/lib/forms/types";
import { withAvailability } from "@/lib/jobs/availability";
import { JobFormProvider, type JobFormContextValue } from "./JobFormContext";
import { jobDetailsSection } from "@/lib/jobs/multiJob";
import JobFormSection from "./JobFormSection";
import { useJobFormState } from "./useJobFormState";
import { useJobFormSubmit } from "./useJobFormSubmit";
import { usePermissions } from "@/hooks/usePermissions";
import { layoutWithoutMoney } from "@/lib/jobs/amounts";

/** Create/edit job dialog driven by the JOB_FORM layout; opened through useGlobalForm().openJobForm. */
function JobFormDialogInner() {
  const { isJobFormOpen, jobToEditId, jobInitialDate, closeJobForm } = useGlobalForm();
  const loaded = useJobFormState({ isOpen: isJobFormOpen, jobToEditId, initialDate: jobInitialDate });
  const { checkPermission } = usePermissions();
  // Roles without "See amounts" get the form without its Financials section; the server keeps
  // the stored price and payments when they save.
  const canSeeAmounts = checkPermission("view_amounts");
  const shownLayout = useMemo(() => (canSeeAmounts ? loaded.layoutSchema : layoutWithoutMoney(loaded.layoutSchema)), [canSeeAmounts, loaded.layoutSchema]);
  const state = canSeeAmounts ? loaded : { ...loaded, layoutSchema: shownLayout };
  const { form, job, layoutSchema, teamUsers, allJobs, installments } = state;
  const { register, handleSubmit, watch, formState: { isSubmitting } } = form;

  const [deleteConfirm, setDeleteConfirm] = useState<{ sectionId: string; index: number } | null>(null);

  // Subscribes to every field so visibility rules and computed values re-render.
  const formValues = watch();
  const isVisible = (rule: VisibilityRule | null | undefined) => isVisibleIn(rule, formValues, JOB_FORM_FIELD_MAP);
  const usersWithAvailability = withAvailability(teamUsers, allJobs, job?.id, watch("date"), watch("time"));

  const { onSubmit, onError, isSubmittingLocal } = useJobFormSubmit(state, isVisible, closeJobForm);

  const ctx: JobFormContextValue = { ...state, isVisible, usersWithAvailability, deleteConfirm, setDeleteConfirm };

  const sections = layoutSchema?.sections;
  // Each Job Details entry becomes its own job when creating.
  const jdSection = jobDetailsSection(layoutSchema);
  const jobCount = !job && jdSection ? Math.max(1, (state.repeatableData[`rep_${jdSection.id}`] ?? []).length) : 1;

  return (
    <Dialog open={isJobFormOpen} onOpenChange={(open) => {
      if (!open) { closeJobForm(); }
    }}>
      <DialogContent className="max-w-[800px] sm:max-w-[800px] w-[95vw] sm:w-full p-0 bg-transparent overflow-visible border-0 shadow-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, type: "spring", bounce: 0.4 }}
          className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col h-[96dvh] max-h-[96dvh] relative overflow-hidden"
        >
          <DialogHeader className="bg-gradient-to-r from-blue-700 to-blue-600 px-5 py-4 sm:px-6 sm:py-5 relative shrink-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-[14px] bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                <i className="ph-fill ph-printer text-white text-xl"></i>
              </div>
              <div className="flex flex-col">
                <span className="text-[0.65rem] sm:text-[0.7rem] font-bold text-orange-300 uppercase tracking-[1px] mb-0.5 leading-none">Job Registration</span>
                <DialogTitle className="text-[1.2rem] sm:text-[1.4rem] font-extrabold text-white leading-tight">
                  {job ? "Edit Printing Job" : "Create Printing Job"}
                </DialogTitle>
                <span className="text-[0.75rem] text-blue-100 font-medium mt-0.5 leading-none">Enter job details to get started</span>
              </div>
            </div>
          </DialogHeader>
          <div className="bg-slate-50 px-5 py-6 sm:px-10 sm:py-8 flex-1 overflow-y-auto">
            <form id="job-form" onSubmit={handleSubmit(onSubmit, onError)} className="hidden">
              <input type="hidden" {...register("installments")} value={JSON.stringify(installments)} />
            </form>
            {sections ? (
              <JobFormProvider value={ctx}>
                {sections.map((section, idx) => (
                  <React.Fragment key={section.id}>
                    <JobFormSection section={section} index={idx} />
                  </React.Fragment>
                ))}
              </JobFormProvider>
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-500">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-orange-500 rounded-full animate-spin mr-3"></div> Loading form layout...
              </div>
            )}
          </div>
          <div className="bg-slate-50/80 border-t border-slate-200/60 px-4 py-4 sm:px-6 sm:py-4 flex justify-between items-center rounded-b-2xl sm:rounded-b-3xl shrink-0">
            <button type="button" className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-[12px] font-bold text-[0.9rem] bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer flex items-center gap-2" onClick={() => closeJobForm()}>
              <i className="ph-bold ph-x text-[1rem]"></i> Cancel
            </button>
            <button type="button" className="px-6 py-2.5 sm:px-8 sm:py-3 rounded-[12px] font-bold text-[0.9rem] bg-blue-600 text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 hover:-translate-y-[1px] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50" disabled={isSubmitting || isSubmittingLocal} onClick={handleSubmit(onSubmit, onError)}>
              <i className="ph-bold ph-check-circle text-[1rem]"></i> {(isSubmitting || isSubmittingLocal) ? "Saving..." : job ? "Save Changes" : jobCount > 1 ? `Create ${jobCount} Jobs` : "Create Job"}
            </button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

export default function JobFormDialog() {
  return (
    <Suspense fallback={null}>
      <JobFormDialogInner />
    </Suspense>
  );
}
