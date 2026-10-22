"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useGlobalForm } from "@/components/providers/GlobalFormProvider";
import { usePermissions } from "@/hooks/usePermissions";
import { JOB_DETAILS_FIELD_MAP } from "@/lib/forms/fieldMap";
import { resolveFinancials, resolveJobSummary, resolveSpecEntries } from "@/lib/jobs/resolveJobFields";
import ClientCard from "./ClientCard";
import DeleteJobDialog from "./DeleteJobDialog";
import DynamicSectionsView from "./DynamicSectionsView";
import FinancialsCard from "./FinancialsCard";
import JobAssignees from "./JobAssignees";
import JobHeaderActions from "./JobHeaderActions";
import JobPriority from "./JobPriority";
import JobSpecsCard from "./JobSpecsCard";
import JobSummaryStrip from "./JobSummaryStrip";
import JobTabs, { type JobDetailsTab } from "./JobTabs";
import JobTimeline from "./JobTimeline";
import { exportJobPdf } from "./exportJobPdf";
import { isCancelStage, readCancellation } from "@/lib/jobs/cancellation";
import { toast } from "sonner";
import { useJob } from "./useJob";
import { usePricingRules } from "@/hooks/usePricingRules";
import { useJobMutations } from "./useJobMutations";
import { layoutWithoutMoney } from "@/lib/jobs/amounts";
import SendWhatsAppDialog from "./SendWhatsAppDialog";
import { WHATSAPP_UI_ENABLED } from "@/lib/whatsapp/flags";

export type { JobDetailsTab } from "./JobTabs";

export interface JobDetailsViewProps {
  /** Render as a full page for this job (the /jobs/details/[id] route) instead of the global dialog. */
  standaloneJobId?: string;
  /** Tabs after the built-in "Details" tab, e.g. an admin-only "Activity" tab. The tab bar shows once there are any. */
  extraTabs?: JobDetailsTab[];
}

const DETAILS_TAB = { id: "details", label: "Details" };

export default function JobDetailsView({ standaloneJobId, extraTabs = [] }: JobDetailsViewProps) {
  const router = useRouter();
  const { checkPermission } = usePermissions();
  const canManageTransactions = checkPermission("create_transactions");
  const canEditJobs = checkPermission("edit_jobs");
  const canDeleteJobs = checkPermission("delete_jobs");
  // Without "See amounts" the API already strips money; hide the cards and rows that would show ₹0.
  const canSeeAmounts = checkPermission("view_amounts");
  const { openJobForm, isJobDetailsOpen, jobDetailsId: contextJobId, closeJobDetails } = useGlobalForm();

  const jobDetailsId = standaloneJobId || contextJobId;
  const isVisible = standaloneJobId ? true : isJobDetailsOpen;

  const { job, refreshJob, layoutSchema: fullLayout, teamUsers } = useJob(jobDetailsId, isVisible);
  const layoutSchema = canSeeAmounts ? fullLayout : layoutWithoutMoney(fullLayout ?? null);
  const pricingRules = usePricingRules();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [activeTabId, setActiveTabId] = useState(DETAILS_TAB.id);
  const [isExporting, setIsExporting] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const mutations = useJobMutations({
    job,
    layout: layoutSchema,
    refreshJob,
    onDeleted: () => {
      setIsDeleteConfirmOpen(false);
      closeJobDetails();
    },
  });

  const handleClose = () => {
    // Back inside the app; deep links (search, notifications) go to the jobs board instead of leaving.
    closeJobDetails();
  };

  const exportPdf = async () => {
    if (!job) return;
    setIsExporting(true);
    try {
      await exportJobPdf(job, layoutSchema ?? null, JOB_DETAILS_FIELD_MAP, canSeeAmounts, pricingRules);
    } catch {
      toast.error("Couldn't build the PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const tabs = [DETAILS_TAB, ...extraTabs];
  const activeExtraTab = extraTabs.find((t) => t.id === activeTabId);

  const isCancelled = !!job && (isCancelStage(job.status) || isCancelStage(job.customData?.fld_b_status));

  const renderDetails = () => {
    if (!job) return null;
    const summary = resolveJobSummary(job, layoutSchema, JOB_DETAILS_FIELD_MAP);
    return (
      <>
        {/* Status first: the stage is what people change most, so it sits right under the header. */}
        <div className="mb-4">
          <JobTimeline
            job={job}
            layout={layoutSchema}
            canEdit={canEditJobs}
            showAmounts={canSeeAmounts}
            busy={mutations.isUpdatingStatus}
            onStatusChange={mutations.changeStatus}
            onCancel={mutations.cancelJob}
            onReopen={mutations.reopenJob}
          />
        </div>

        <JobSummaryStrip job={job} summary={summary} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-6">
            <ClientCard job={job} />
            {canSeeAmounts && <FinancialsCard financials={resolveFinancials(job)} cancellation={isCancelled ? readCancellation(job.customData) ?? { charge: 0, reason: "", at: "" } : null} />}
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-6">
            <JobSpecsCard entries={resolveSpecEntries(job, layoutSchema, JOB_DETAILS_FIELD_MAP, summary, pricingRules)} showAmounts={canSeeAmounts} />
          </div>

          {/* Dynamic Content Mapping (Sections not covered above) */}
          <DynamicSectionsView job={job} layout={layoutSchema} fieldMap={JOB_DETAILS_FIELD_MAP} />
        </div>
      </>
    );
  };

  const content = (
    <div className={`w-full bg-[#fcfcfc] flex flex-col relative print:!h-auto print:!max-h-none print:overflow-visible print:rounded-none print:border-0 print:shadow-none ${standaloneJobId ? "md:h-[calc(100dvh-8.5rem)] md:overflow-hidden rounded-3xl border border-slate-200/80 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.35)]" : "overflow-hidden h-[100dvh] sm:h-[90dvh] max-h-[100dvh] sm:max-h-[90dvh] rounded-none sm:rounded-[2rem] shadow-2xl"}`}>
      {!job ? (
        <div className="flex-1 flex flex-col items-center justify-center p-20 min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mb-4" />
          <p className="text-slate-500 font-medium">Loading job details...</p>
        </div>
      ) : (
        <div className={`flex-1 flex flex-col w-full relative ${standaloneJobId ? "md:h-full md:overflow-hidden" : "h-full overflow-hidden"}`}>
          {/* Header */}
          {/* A div, not <header>: the print stylesheet hides headers, and this one names the job on the printout. */}
          <div className={`shrink-0 top-0 z-40 bg-[#fcfcfc] px-4 sm:px-6 md:px-8 py-4 border-b border-slate-100 flex flex-col gap-4 print:static print:border-0 print:px-0 ${standaloneJobId ? "md:sticky" : "sticky"}`}>
            {/* Back Button */}
            <div className="flex justify-between items-center w-full">
              <button
                onClick={handleClose}
                className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors bg-white shadow-sm print:hidden"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Jobs
              </button>
            </div>

            {/* Title & Actions Row */}
            <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{job.client?.name || job.title || "Job Details"}</h1>
                  <span className="print:hidden">
                    <JobPriority jobId={job.id} priority={job.priority} canEdit={canEditJobs} onChanged={refreshJob} />
                  </span>
                </div>
                <p className="text-sm text-slate-500 font-medium">
                  {(() => {
                    const category = resolveJobSummary(job, layoutSchema, JOB_DETAILS_FIELD_MAP).displayCategory;
                    return [category !== "N/A" ? category : null, job.jobNumber].filter(Boolean).join(" · ") || "Print job";
                  })()}
                </p>
                {Array.isArray(job.relatedJobs) && job.relatedJobs.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500 print:hidden">
                    <span>Same order:</span>
                    {(job.relatedJobs as { id: string; jobNumber: string | null; category: string; stage: string | null }[]).map((r) => (
                      <Link key={r.id} href={`/jobs/details/${r.id}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-200">
                        <span className="font-mono">{r.jobNumber ?? r.id.slice(-6).toUpperCase()}</span>
                        <span className="font-semibold text-slate-500">· {r.category || "Uncategorised"}</span>
                      </Link>
                    ))}
                  </p>
                )}
              </div>

              <JobHeaderActions
                job={job}
                canEditJobs={canEditJobs}
                canDeleteJobs={canDeleteJobs}
                cancelled={isCancelled}
                canManageTransactions={canManageTransactions && canSeeAmounts}
                isExporting={isExporting}
                isGeneratingInvoice={mutations.isGeneratingInvoice}
                onEdit={() => {
                  openJobForm(job.id, undefined);
                  closeJobDetails();
                }}
                onDelete={() => setIsDeleteConfirmOpen(true)}
                onExport={exportPdf}
                onInvoice={mutations.generateInvoice}
                onWhatsApp={WHATSAPP_UI_ENABLED && canEditJobs && job.client?.phone ? () => setWhatsAppOpen(true) : undefined}
                assigneesSlot={<JobAssignees job={job} teamUsers={teamUsers} />}
              />
            </div>

            <div className="print:hidden"><JobTabs tabs={tabs} activeId={activeTabId} onChange={setActiveTabId} /></div>
          </div>

          <main id="job-details-content" className={`flex-1 px-4 sm:px-6 md:px-8 pb-10 pt-6 flex flex-col gap-6 print:overflow-visible print:px-0 ${standaloneJobId ? "md:overflow-y-auto" : "overflow-y-auto"}`}>
            {activeExtraTab ? activeExtraTab.render(job.id) : renderDetails()}
          </main>
        </div>
      )}

      {WHATSAPP_UI_ENABLED && job?.client?.phone && (
        <SendWhatsAppDialog
          open={whatsAppOpen}
          jobId={job.id}
          customerName={job.client.name || job.title || "the customer"}
          customerPhone={job.client.phone}
          balanceDue={resolveFinancials(job).dueAmount}
          onClose={() => setWhatsAppOpen(false)}
        />
      )}
      <DeleteJobDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen} onConfirm={mutations.deleteJob} isDeleting={mutations.isDeleting} />
    </div>
  );

  if (standaloneJobId) return content;

  return (
    <Dialog open={isVisible} onOpenChange={(open) => {
      if (!open) closeJobDetails();
    }}>
      <DialogContent className="!max-w-[1300px] w-full sm:w-[95vw] p-0 bg-transparent border-0 shadow-none">
        <DialogTitle className="sr-only">{job?.client?.name ? `${job.client.name} job details` : "Job Details"}</DialogTitle>
        {content}
      </DialogContent>
    </Dialog>
  );
}
