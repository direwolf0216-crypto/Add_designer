"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatINR } from "@/lib/money";
import { refundDue } from "@/lib/jobs/cancellation";

/**
 * "Cancel this job?" with an optional cancellation charge taken from the advance and an optional reason.
 * The charge is never required; leaving it empty refunds the whole advance.
 */
export default function CancelJobDialog({
  open, onOpenChange, clientName, advance, showAmounts, busy, onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  /** Advance paid so far (₹); drives the refund preview. */
  advance: number;
  showAmounts: boolean;
  busy?: boolean;
  onConfirm: (input: { charge: number; reason: string }) => void | Promise<void>;
}) {
  const [charge, setCharge] = useState("");
  const [reason, setReason] = useState("");
  const chargeNum = parseFloat(charge) || 0;
  const tooMuch = chargeNum > advance;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent showCloseButton={false} className="!max-w-md !gap-0 !rounded-3xl !p-0 overflow-hidden">
        <div className="flex items-start gap-3 border-b border-rose-100 bg-rose-50/70 px-6 py-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-lg shadow-rose-500/30">
            <i className="ph-bold ph-x-circle text-xl" aria-hidden="true"></i>
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-lg font-black text-slate-900">Cancel this job?</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              {clientName}&apos;s job leaves the board and its queue. You can reopen it later.
            </DialogDescription>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          {showAmounts && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.8rem] font-bold text-slate-700">Cancellation charge <span className="font-medium text-slate-400">(optional)</span></span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                <input
                  inputMode="decimal"
                  value={charge}
                  onChange={(e) => setCharge(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  className={`h-11 w-full rounded-xl border bg-white pl-8 pr-4 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 ${tooMuch ? "border-rose-400 focus:ring-rose-500/20" : "border-gray-200 focus:border-orange-400 focus:ring-orange-500/15"}`}
                />
              </div>
              <span className={`text-[0.75rem] ${tooMuch ? "font-semibold text-rose-600" : "text-slate-500"}`}>
                {tooMuch
                  ? `The charge can't be more than the ${formatINR(advance)} advance.`
                  : advance > 0
                    ? `Advance paid ${formatINR(advance)} · refund due to client ${formatINR(refundDue(advance, chargeNum))}`
                    : "No advance has been paid on this job."}
              </span>
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.8rem] font-bold text-slate-700">Reason <span className="font-medium text-slate-400">(optional)</span></span>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder="e.g. Client changed their mind"
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/15"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button type="button" disabled={busy} onClick={() => onOpenChange(false)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-50">
            Keep job
          </button>
          <button
            type="button"
            disabled={busy || tooMuch}
            onClick={() => onConfirm({ charge: showAmounts ? chargeNum : 0, reason: reason.trim() })}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-rose-500/25 hover:brightness-105 disabled:opacity-50"
          >
            {busy && <i className="ph-bold ph-circle-notch animate-spin" aria-hidden="true"></i>}
            Cancel job
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
