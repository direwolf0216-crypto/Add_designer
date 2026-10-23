"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { prepareInvoiceMessageAction, prepareWhatsAppChatAction } from "@/app/actions";
import { formatPhone, waChatUrl } from "@/lib/whatsapp/phone";

const ICONS: Record<string, string> = {
  stageChanged: "ph-flag",
  paymentDue: "ph-currency-inr",
  jobCreated: "ph-check-circle",
  jobCreatedNoAmounts: "ph-check-circle",
  invoice: "ph-receipt",
  custom: "ph-pencil-simple",
};

/**
 * Chat on WhatsApp (click-to-chat): pick a ready-made message for this job's customer, edit it if
 * needed, and open the chat in the shop's own WhatsApp with the text typed in. Nothing is sent from
 * the server; the person presses Send in WhatsApp.
 */
export default function ChatOnWhatsAppDialog({ open, jobId, onClose }: { open: boolean; jobId: string; onClose: () => void }) {
  const { data, isLoading, mutate } = useSWR(open ? ["whatsapp-chat", jobId] : null, () => prepareWhatsAppChatAction(jobId), { revalidateOnFocus: false });
  const chat = data && "phone" in data ? data : null;
  const [kind, setKind] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  // The invoice message is prepared on demand (it may create the invoice): its text, link and number.
  const [invoice, setInvoice] = useState<{ id: string; number: string; text: string } | null>(null);
  const [preparingInvoice, setPreparingInvoice] = useState(false);
  // The PDF is fetched as soon as the invoice is ready: browsers only allow the share sheet straight
  // after a tap, so Share PDF must not wait for a download.
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState(false);

  const messages = chat?.messages ?? [];
  const current = kind ?? messages[0]?.kind ?? "custom";
  const shown = text ?? messages.find((m) => m.kind === current)?.text ?? "";

  const choose = async (k: string) => {
    setKind(k);
    if (k !== "invoice") return setText(k === "custom" ? "" : messages.find((m) => m.kind === k)?.text ?? "");
    if (invoice) {
      if (!pdfFile) void loadPdf(invoice.id, invoice.number);
      return setText(invoice.text);
    }
    setText("");
    setPreparingInvoice(true);
    try {
      const res = await prepareInvoiceMessageAction(jobId);
      if (res.success && "text" in res) {
        setInvoice({ id: res.invoiceId, number: res.invoiceNumber, text: res.text });
        setText(res.text);
        void loadPdf(res.invoiceId, res.invoiceNumber);
        // The job has an invoice now: refresh the list so its hint names it.
        void mutate();
      } else {
        toast.error((res as { error?: string }).error || "Couldn't prepare the invoice");
      }
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPreparingInvoice(false);
    }
  };
  const close = () => {
    onClose();
    setKind(null);
    setText(null);
    // Next time, prepare the invoice message afresh (amounts may have changed).
    setInvoice(null);
    setPdfFile(null);
    setPdfError(false);
  };
  const loadPdf = async (invoiceId: string, invoiceNumber: string) => {
    setPdfFile(null);
    setPdfError(false);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
      if (!res.ok) throw new Error();
      setPdfFile(new File([await res.blob()], `${invoiceNumber}.pdf`, { type: "application/pdf" }));
    } catch {
      setPdfError(true);
    }
  };
  /** Attach the invoice PDF itself through the device's share sheet (WhatsApp on phones); download it where files can't be shared. */
  const sharePdf = () => {
    if (!pdfFile) return;
    // Called synchronously from the tap, with the file already in hand, so the browser allows it.
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [pdfFile] })) {
      navigator.share({ files: [pdfFile], title: pdfFile.name.replace(/\.pdf$/, ""), text: shown }).catch((e: Error) => {
        if (e.name !== "AbortError") toast.error("Couldn't open the share sheet", { description: e.message });
      });
      return;
    }
    const url = URL.createObjectURL(pdfFile);
    const a = document.createElement("a");
    a.href = url;
    a.download = pdfFile.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast.success(`Saved ${pdfFile.name}`, { description: "Attach it in the WhatsApp chat, or send the link in the message." });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shown);
      toast.success("Message copied");
    } catch {
      toast.error("Couldn't copy the message");
    }
  };

  const error = data && !("phone" in data) ? (data as { error?: string }).error ?? "Couldn't prepare the message" : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-[480px] overflow-hidden rounded-2xl border-0 p-0 sm:max-w-[480px]">
        <div className="flex items-start gap-3 border-b border-gray-100 px-6 pb-4 pt-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/25">
            <i className="ph-fill ph-whatsapp-logo text-2xl" aria-hidden="true"></i>
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-lg font-extrabold text-slate-900">Chat on WhatsApp</DialogTitle>
            <DialogDescription className="mt-0.5 truncate text-sm text-slate-600">
              {chat ? `${chat.customer || "Customer"} · ${chat.phone ? formatPhone(chat.phone) : chat.rawPhone || "no phone"}` : "Preparing the message…"}
            </DialogDescription>
          </div>
        </div>

        <div className="space-y-2 px-6 py-4">
          {isLoading && !data && <div className="h-40 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />}
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
          {chat && !chat.phone && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[0.8rem] text-amber-800">
              {chat.rawPhone ? `“${chat.rawPhone}” isn't a phone number WhatsApp can use.` : "This customer has no phone number."} Edit the job to add a 10-digit mobile number.
            </p>
          )}
          {chat && (
            <>
              <div className="grid gap-2" role="radiogroup" aria-label="Message">
                {[...messages, { kind: "custom", label: "Write your own", hint: "Start from a blank message", text: "" }].map((m) => {
                  const active = current === m.kind;
                  return (
                    <button
                      key={m.kind}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => choose(m.kind)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${active ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-white hover:border-emerald-200"}`}
                    >
                      <i className={`ph-bold ${ICONS[m.kind] ?? "ph-chat-circle"} text-lg ${active ? "text-emerald-600" : "text-slate-400"}`} aria-hidden="true"></i>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-slate-800">{m.label}</span>
                        <span className="block truncate text-[0.72rem] text-slate-500">{m.hint}</span>
                      </span>
                      {m.kind === "invoice" && preparingInvoice ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" aria-label="Preparing the invoice" />
                      ) : (
                        active && <i className="ph-bold ph-check text-emerald-600" aria-hidden="true"></i>
                      )}
                    </button>
                  );
                })}
              </div>
              <label className="block pt-1">
                <span className="mb-1 block text-[0.68rem] font-extrabold uppercase tracking-wider text-slate-400">Message</span>
                <textarea
                  rows={5}
                  value={shown}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={4000}
                  placeholder="Type the message…"
                  aria-label="Message"
                  className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              {current === "invoice" && invoice && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                  <p className="min-w-0 text-[0.75rem] text-emerald-900">
                    <span className="font-bold">{invoice.number}</span> · the link opens the PDF without an account for 90 days.
                  </p>
                  {pdfError ? (
                    <button
                      type="button"
                      onClick={() => loadPdf(invoice.id, invoice.number)}
                      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
                    >
                      <i className="ph-bold ph-arrow-clockwise" aria-hidden="true"></i>
                      Retry PDF
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={sharePdf}
                      disabled={!pdfFile}
                      aria-busy={!pdfFile || undefined}
                      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:cursor-progress disabled:opacity-60"
                    >
                      <i className={`ph-bold ${pdfFile ? "ph-file-pdf" : "ph-circle-notch animate-spin"}`} aria-hidden="true"></i>
                      {pdfFile ? "Share PDF" : "Preparing PDF"}
                    </button>
                  )}
                </div>
              )}
              <p className="text-[0.7rem] text-slate-400">Opens the chat in your WhatsApp with this text typed in. Check it and press Send there.</p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 whitespace-nowrap px-6 pb-6">
          <button type="button" onClick={close} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 sm:px-4">
            Cancel
          </button>
          {chat && (
            <button type="button" onClick={copy} disabled={!shown.trim()} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 sm:px-4">
              <i className="ph-bold ph-copy" aria-hidden="true"></i>
              Copy
            </button>
          )}
          {chat?.phone && shown.trim() ? (
            <a
              href={waChatUrl(chat.phone, shown)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2.5 sm:px-5 text-sm font-bold text-white shadow-md shadow-emerald-500/25 hover:from-emerald-600 hover:to-green-700"
            >
              <i className="ph-fill ph-whatsapp-logo text-base" aria-hidden="true"></i>
              Open WhatsApp
            </a>
          ) : (
            <span aria-disabled="true" className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-emerald-600/40 px-4 py-2.5 sm:px-5 text-sm font-bold text-white">
              <i className="ph-fill ph-whatsapp-logo text-base" aria-hidden="true"></i>
              Open WhatsApp
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
