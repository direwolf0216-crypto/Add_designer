"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteJobAction, generateInvoiceAction, updateJobStatusAction, updateJobTrackingAction } from "@/app/actions";
import { invalidateJobs } from "@/lib/swr";
import type { DetailsJob } from "@/lib/jobs/resolveJobFields";
import { CANCELLATION_KEY } from "@/lib/jobs/cancellation";
import { stageOptions } from "@/lib/jobs/tracking";
import type { FormLayout } from "@/lib/forms/types";


/** Actions available from the job details view: status changes, delete and invoice. */
export function useJobMutations({ job, layout, refreshJob, onDeleted }: { job: DetailsJob | null; layout?: FormLayout | null; refreshJob: () => void; onDeleted: () => void }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  const afterStatusChange = (newStatus: string) => {
    toast.success(`Status updated to ${newStatus}`);
    refreshJob();
    // Globally invalidate SWR keys so Jobs list, Calendar, Dashboard, and Finishing Status sync instantly
    invalidateJobs();
    router.refresh();
  };

  /**
   * Run a status save with the pills locked, and always unlock them afterwards (a dropped connection
   * used to leave them spinning). Resolves to whether the save worked.
   */
  const runStatusUpdate = async (save: () => Promise<{ success: boolean; error?: string }>, newStatus: string, failMessage: string) => {
    setIsUpdatingStatus(true);
    try {
      const res = await save();
      if (res.success) afterStatusChange(newStatus);
      else toast.error(res.error || failMessage);
      return res.success;
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
      return false;
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const changeStatus = async (newStatus: string) => {
    if (!job) return;
    // A board stage moves the card and sets the status together; any other status only sets the status.
    const isStage = stageOptions(layout as Parameters<typeof stageOptions>[0]).some((s) => s.label.toLowerCase() === newStatus.toLowerCase());
    await runStatusUpdate(
      () => (isStage ? updateJobTrackingAction(job.id, { customData: { fld_b_status: newStatus }, status: newStatus }) : updateJobStatusAction(job.id, newStatus)),
      newStatus,
      "Failed to update status"
    );
  };

  /** Move the job to `cancelStage`, keeping the charge and reason with it. */
  const cancelJob = async (cancelStage: string, input: { charge: number; reason: string }) => {
    if (!job) return false;
    return runStatusUpdate(
      () =>
        updateJobTrackingAction(job.id, {
          status: cancelStage,
          customData: { fld_b_job_status: cancelStage, fld_b_status: cancelStage, [CANCELLATION_KEY]: { ...input, at: new Date().toISOString() } },
        }),
      cancelStage,
      "Couldn't cancel the job"
    );
  };

  /** Put a cancelled job back at `stage` and drop the cancellation details. */
  const reopenJob = async (stage: string) => {
    if (!job) return false;
    return runStatusUpdate(
      () => updateJobTrackingAction(job.id, { status: stage, customData: { fld_b_job_status: stage, fld_b_status: stage, [CANCELLATION_KEY]: null } }),
      stage,
      "Couldn't reopen the job"
    );
  };

  /** Update a STATUS_PICKER stored in customData (e.g. a finishing status); `fld_b_status` is the job status. */
  const changeSectionStatus = async (fieldId: string, newStatus: string) => {
    if (!job) return;
    if (fieldId === "fld_b_status") return changeStatus(newStatus);

    const updates: { customData: Record<string, unknown>; status?: string } = { customData: { [fieldId]: newStatus } };
    if (fieldId === "fld_b_job_status") updates.status = newStatus;
    await runStatusUpdate(() => updateJobTrackingAction(job.id, updates), newStatus, "Failed to update status");
  };

  const deleteJob = async () => {
    if (!job) return;
    setIsDeleting(true);
    try {
      const res = await deleteJobAction(job.id);
      if (res.success) {
        toast.success("Job deleted successfully!");
        onDeleted();
        invalidateJobs();
        router.refresh();
      } else {
        toast.error("Failed to delete job.");
      }
    } catch {
      toast.error("Failed to delete job");
    } finally {
      setIsDeleting(false);
    }
  };

  const generateInvoice = async () => {
    if (!job) return;
    setIsGeneratingInvoice(true);
    try {
      const res = await generateInvoiceAction(job.id);
      if (!res.success) {
        toast.error(res.error || "Failed to generate invoice");
        return;
      }
      toast.success("Invoice generated successfully!");
      window.open(`/api/invoices/${res.invoiceId}/pdf`, "_blank");
    } catch {
      toast.error("Failed to generate invoice");
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  return {
    changeStatus,
    changeSectionStatus,
    cancelJob,
    reopenJob,
    deleteJob,
    generateInvoice,
    isDeleting,
    isUpdatingStatus,
    isGeneratingInvoice,
  };
}
