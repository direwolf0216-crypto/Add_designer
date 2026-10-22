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

  const changeStatus = async (newStatus: string) => {
    if (!job) return;
    setIsUpdatingStatus(true);

    // A board stage moves the card and sets the status together; any other status only sets the status.
    const isStage = stageOptions(layout as Parameters<typeof stageOptions>[0]).some((s) => s.label.toLowerCase() === newStatus.toLowerCase());
    const res = isStage
      ? await updateJobTrackingAction(job.id, { customData: { fld_b_status: newStatus }, status: newStatus })
      : await updateJobStatusAction(job.id, newStatus);

    setIsUpdatingStatus(false);
    if (res.success) afterStatusChange(newStatus);
    else toast.error("Failed to update status");
  };

  /** Move the job to `cancelStage`, keeping the charge and reason with it. */
  const cancelJob = async (cancelStage: string, input: { charge: number; reason: string }) => {
    if (!job) return false;
    setIsUpdatingStatus(true);
    const res = await updateJobTrackingAction(job.id, {
      status: cancelStage,
      customData: { fld_b_job_status: cancelStage, fld_b_status: cancelStage, [CANCELLATION_KEY]: { ...input, at: new Date().toISOString() } },
    });
    setIsUpdatingStatus(false);
    if (res.success) afterStatusChange(cancelStage);
    else toast.error(res.error || "Couldn't cancel the job");
    return res.success;
  };

  /** Put a cancelled job back at `stage` and drop the cancellation details. */
  const reopenJob = async (stage: string) => {
    if (!job) return false;
    setIsUpdatingStatus(true);
    const res = await updateJobTrackingAction(job.id, { status: stage, customData: { fld_b_job_status: stage, fld_b_status: stage, [CANCELLATION_KEY]: null } });
    setIsUpdatingStatus(false);
    if (res.success) afterStatusChange(stage);
    else toast.error(res.error || "Couldn't reopen the job");
    return res.success;
  };

  /** Update a STATUS_PICKER stored in customData (e.g. a finishing status); `fld_b_status` is the job status. */
  const changeSectionStatus = async (fieldId: string, newStatus: string) => {
    if (!job) return;
    if (fieldId === "fld_b_status") return changeStatus(newStatus);

    setIsUpdatingStatus(true);
    const updates: { customData: Record<string, unknown>; status?: string } = { customData: { [fieldId]: newStatus } };
    if (fieldId === "fld_b_job_status") updates.status = newStatus;
    const res = await updateJobTrackingAction(job.id, updates);
    setIsUpdatingStatus(false);

    if (res.success) afterStatusChange(newStatus);
    else toast.error("Failed to update status");
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
