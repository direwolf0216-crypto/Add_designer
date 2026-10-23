"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import JobStatusStepper from "@/components/dashboard/JobStatusStepper";
import type { FormLayout } from "@/lib/forms/types";
import { buildStatusSteps, resolveFinancials, type DetailsJob } from "@/lib/jobs/resolveJobFields";
import { isCancelStage, readCancellation, refundDue } from "@/lib/jobs/cancellation";
import { formatINR } from "@/lib/money";
import CancelJobDialog from "./CancelJobDialog";

/**
 * The job's stage as a slim bar at the top of the details: click any stage to move the job there.
 * Cancelling is deliberately not a stage on the track: it has its own button (with an optional
 * cancellation charge) and, once cancelled, the track is replaced by a cancellation banner.
 */
export default function JobTimeline({
  job, layout, canEdit, showAmounts, busy, onStatusChange, onCancel, onReopen,
}: {
  job: DetailsJob;
  layout: FormLayout | null;
  canEdit: boolean;
  showAmounts: boolean;
  busy?: boolean;
  onStatusChange: (status: string) => void;
  onCancel: (cancelStage: string, input: { charge: number; reason: string }) => Promise<boolean>;
  onReopen: (stage: string) => Promise<boolean>;
}) {
  const all = buildStatusSteps(layout);
  const steps = all.filter((s) => !isCancelStage(s.value));
  const cancelStep = all.find((s) => isCancelStage(s.value));
  const cancelled = isCancelStage(job.status) || isCancelStage(job.customData?.fld_b_status);
  const info = readCancellation(job.customData);
  const { advanceAmount } = resolveFinancials(job);
  const [open, setOpen] = useState(false);
  // The stage whose pill was tapped, shown with a spinner until the save finishes.
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [wasBusy, setWasBusy] = useState(!!busy);
  if (!!busy !== wasBusy) {
    setWasBusy(!!busy);
    if (!busy) setPendingStatus(null);
  }

  if (cancelled) {
    const refund = refundDue(advanceAmount, info?.charge ?? 0);
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-rose-100 bg-gradient-to-r from-rose-50 to-white px-4 py-3 shadow-sm sm:flex-row sm:items-center">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-md shadow-rose-500/30">
          <i className="ph-bold ph-x-circle text-lg" aria-hidden="true"></i>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-rose-700">
            Job cancelled{info?.at ? ` on ${new Date(info.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
          </p>
          <p className="text-xs font-medium text-slate-600">
            {info?.reason ? `${info.reason} · ` : ""}
            {showAmounts
              ? advanceAmount > 0
                ? `Advance ${formatINR(advanceAmount)} · charge ${formatINR(info?.charge ?? 0)} · refund due ${formatINR(refund)}`
                : "No advance was paid."
              : "Cancellation recorded."}
          </p>
        </div>
        {canEdit && steps[0] && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onReopen(steps[0].value)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            <i className="ph-bold ph-arrow-counter-clockwise" aria-hidden="true"></i>
            Reopen job
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:gap-3">
      <div className="flex shrink-0 items-center gap-2" title="Status">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-50">
          <Clock className="h-3.5 w-3.5 text-pink-500" />
        </div>
        <h3 className="text-[13px] font-bold text-slate-800 sm:sr-only">Status</h3>
      </div>
      <JobStatusStepper
        steps={steps}
        currentStatus={job.status || (steps.length > 0 ? steps[0].value : "Pending")}
        onStatusChange={(val) => {
          setPendingStatus(val);
          onStatusChange(val);
        }}
        pendingStatus={busy ? pendingStatus : null}
        className="min-w-0 flex-1"
      />
      {canEdit && cancelStep && (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold text-rose-600 ring-1 ring-rose-200 transition-colors hover:bg-rose-50 sm:self-auto print:hidden"
          >
            <i className="ph-bold ph-x-circle" aria-hidden="true"></i>
            Cancel job
          </button>
          <CancelJobDialog
            open={open}
            onOpenChange={setOpen}
            clientName={job.client?.name || job.title || "This client"}
            advance={advanceAmount}
            showAmounts={showAmounts}
            busy={busy}
            onConfirm={async (input) => {
              if (await onCancel(cancelStep.value, input)) setOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}
