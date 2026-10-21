"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteJobAction, generateInvoiceAction, updateJobStatusAction, updateJobTrackingAction } from "@/app/actions";
import { invalidateJobs } from "@/lib/swr";
import type { DetailsJob } from "@/lib/jobs/resolveJobFields";

/** Statuses that are written through the tracking action (also mirrored into customData). */
const TRACKING_STATUSES = ["designing", "printing", "ready for delivery", "delivered"];

/** Actions available from the job details view: status changes, delete, invoice and PDF export. */
export function useJobMutations({ job, refreshJob, onDeleted }: { job: DetailsJob | null; refreshJob: () => void; onDeleted: () => void }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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

    const res = TRACKING_STATUSES.includes(newStatus.toLowerCase())
      ? await updateJobTrackingAction(job.id, { customData: { fld_b_job_status: newStatus }, status: newStatus })
      : await updateJobStatusAction(job.id, newStatus);

    setIsUpdatingStatus(false);
    if (res.success) afterStatusChange(newStatus);
    else toast.error("Failed to update status");
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

  /** Snapshot of #job-details-content as a single-page PDF. */
  const exportJob = async () => {
    setIsExporting(true);
    try {
      const element = document.getElementById("job-details-content");
      if (!element || !job) return;
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.height > canvas.width ? "p" : "l",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`Job_Export_${job.jobNumber || job.id.slice(-6).toUpperCase()}.pdf`);
      toast.success("Job exported successfully!");
    } catch {
      toast.error("Failed to export job");
    } finally {
      setIsExporting(false);
    }
  };

  return {
    changeStatus,
    changeSectionStatus,
    deleteJob,
    generateInvoice,
    exportJob,
    isDeleting,
    isUpdatingStatus,
    isGeneratingInvoice,
    isExporting,
  };
}
