"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fetcher } from "@/lib/swr";
import { sendJobWhatsAppAction } from "@/app/actions";

type Kind = "jobCreated" | "stageChanged" | "paymentDue" | "custom";

const CHOICES: { kind: Kind; label: string; hint: string; icon: string }[] = [
  { kind: "stageChanged", label: "Status update", hint: "Where the job is right now", icon: "ph-flag" },
  { kind: "paymentDue", label: "Payment reminder", hint: "Balance due with the UPI ID", icon: "ph-currency-inr" },
  { kind: "jobCreated", label: "Job confirmation", hint: "Order summary with the due date", icon: "ph-check-circle" },
  { kind: "custom", label: "Write a message", hint: "Anything else", icon: "ph-pencil-simple" },
];

/** Send one of the WhatsApp templates (or a custom text) to this job's customer. */
export default function SendWhatsAppDialog({ open, jobId, customerName, customerPhone, balanceDue, onClose }: { open: boolean; jobId: string; customerName: string; customerPhone: string; balanceDue: number; onClose: () => void }) {
  const { data } = useSWR<{ enabled: boolean }>(open ? "/api/integrations/whatsapp/status" : null, fetcher);
  const [kind, setKind] = useState<Kind>("stageChanged");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const r = await sendJobWhatsAppAction(jobId, { kind, text });
      if (r.success) {
        toast.success("Sent on WhatsApp", { description: `To ${customerName} at ${customerPhone}` });
        onClose();
        setText("");
      } else {
        toast.error(r.error || "Couldn't send");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[460px] sm:max-w-[460px] rounded-2xl p-0 overflow-hidden border-0">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <i className="ph-fill ph-whatsapp-logo text-2xl"></i>
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-lg font-extrabold text-slate-900">Send on WhatsApp</DialogTitle>
            <DialogDescription className="mt-0.5 text-sm text-slate-600">To {customerName} · {customerPhone}</DialogDescription>
          </div>
        </div>
        <div className="px-6 py-4 space-y-2">
          {data && !data.enabled && (
            <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[0.8rem] text-amber-800">WhatsApp is not set up yet. An admin can connect it under Settings, WhatsApp.</p>
          )}
          {CHOICES.map((c) => {
            const disabled = c.kind === "paymentDue" && balanceDue <= 0;
            return (
              <button
                key={c.kind}
                type="button"
                disabled={disabled}
                onClick={() => setKind(c.kind)}
                className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-40 ${kind === c.kind ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-white hover:border-emerald-200"}`}
              >
                <i className={`ph-bold ${c.icon} text-lg ${kind === c.kind ? "text-emerald-600" : "text-slate-400"}`}></i>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-800">{c.label}</span>
                  <span className="block text-[0.72rem] text-slate-500">{disabled ? "Nothing is due on this job" : c.hint}</span>
                </span>
                {kind === c.kind && <i className="ph-bold ph-check text-emerald-600"></i>}
              </button>
            );
          })}
          {kind === "custom" && (
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={4000}
              placeholder="Type the message…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          )}
          <p className="text-[0.7rem] text-slate-400">Templates come from Settings, WhatsApp. Every message is kept in the log there.</p>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={send} disabled={sending || (kind === "custom" && !text.trim()) || data?.enabled === false} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
            {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <i className="ph-bold ph-paper-plane-tilt"></i>}
            Send
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
