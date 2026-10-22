"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/swr";
import QRCode from "qrcode";
import { BUSINESS_DETAILS } from "@/lib/constants";

type Values = Record<string, string>;

type Field = { key: string; label: string; placeholder?: string; hint?: string; multiline?: boolean; inputMode?: "tel" | "email" | "url" | "decimal" };

const GROUPS: { title: string; icon: string; description: string; fields: Field[] }[] = [
  {
    title: "Branding",
    icon: "ph-image",
    description: "Logo and services line printed at the top of every invoice.",
    fields: [
      { key: "business_tagline", label: "Services line", placeholder: "OFFSET PRINTING · DIGITAL PRINTING · XEROX | BINDING · LAMINATION", hint: "Separate items with · or |. Leave empty for the default line." },
    ],
  },
  {
    title: "Shop details",
    icon: "ph-storefront",
    description: "Printed in the invoice header and contact bar.",
    fields: [
      { key: "business_name", label: "Shop name", placeholder: "ADDESIGNER LASER PRINTER", hint: "Used in “For … / Authorised Signatory”." },
      { key: "business_address", label: "Address", placeholder: BUSINESS_DETAILS.address, multiline: true, hint: "Put each line on its own line to control how it prints." },
      { key: "business_phone", label: "Phone", placeholder: BUSINESS_DETAILS.phone, inputMode: "tel" },
      { key: "business_phone_2", label: "Second phone", placeholder: "Optional", inputMode: "tel" },
      { key: "business_email", label: "Email", placeholder: BUSINESS_DETAILS.email, inputMode: "email" },
      { key: "business_website", label: "Website", placeholder: "Optional, e.g. www.adddesigner.in", inputMode: "url" },
    ],
  },
  {
    title: "Tax",
    icon: "ph-receipt",
    description: "Leave the GST rate empty if you don't charge GST; the CGST / SGST rows then stay off the invoice.",
    fields: [
      { key: "business_gstin", label: "GSTIN", placeholder: "Optional" },
      { key: "business_gst_rate", label: "GST rate (%)", placeholder: "e.g. 18 (split as 9% CGST + 9% SGST)", inputMode: "decimal" },
    ],
  },
  {
    title: "QR codes",
    icon: "ph-qr-code",
    description: "Scanned from the printed invoice: a Google review code on every invoice, and a payment code while money is still due.",
    fields: [],
  },
  {
    title: "Bank & UPI",
    icon: "ph-bank",
    description: "Shown under Bank Details on the invoice. Only the filled-in lines are printed.",
    fields: [
      { key: "business_bank_name", label: "Bank name", placeholder: "e.g. HDFC Bank" },
      { key: "business_bank_account_name", label: "Account name" },
      { key: "business_bank_account_no", label: "Account number" },
      { key: "business_bank_ifsc", label: "IFSC code" },
      { key: "business_bank_branch", label: "Branch" },
      { key: "business_upi_id", label: "UPI ID", placeholder: "e.g. adddesigner@okhdfc" },
    ],
  },
];

const inputClass =
  "w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-all focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10";

const LOGO_MAX_WIDTH = 720;
const LOGO_MAX_BYTES = 350_000;

/** Reads an image file, scales it to at most 720px wide and returns a PNG data URL small enough to store. */
async function fileToLogoDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LOGO_MAX_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/png");
  if (url.length > LOGO_MAX_BYTES) throw new Error("That image is too detailed to store; try a simpler or smaller logo.");
  return url;
}

/** Image picker with preview; stores the image as a data URL in a business_* setting. */
function ImageField({
  value,
  onChange,
  title,
  hint,
  emptyLabel,
  alt,
  square = false,
}: {
  value: string;
  onChange: (v: string) => void;
  title: string;
  hint: string;
  emptyLabel: string;
  alt: string;
  /** QR codes: a square preview box. */
  square?: boolean;
}) {
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      toast.error("Use a PNG, JPEG or WebP image");
      return;
    }
    try {
      onChange(await fileToLogoDataUrl(file));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className={`flex items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-200 bg-white px-4 ${square ? "h-28 w-28 shrink-0" : "h-24 w-full sm:w-64"}`}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL preview
          <img src={value} alt={alt} className={`${square ? "max-h-24" : "max-h-20"} max-w-full object-contain`} />
        ) : (
          <span className="text-center text-xs font-semibold text-slate-400">{emptyLabel}</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.8rem] font-semibold text-slate-700">{title}</span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <i className="ph-bold ph-upload-simple" aria-hidden="true"></i>
            {value ? "Replace" : "Upload"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={pick} />
          </label>
          {value && (
            <button type="button" onClick={() => onChange("")} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
              Remove
            </button>
          )}
        </div>
        <span className="text-[0.7rem] text-slate-400">{hint}</span>
      </div>
    </div>
  );
}

/** A Google review / Maps link turned into the review QR, so no QR image is needed. */
function ReviewLinkField({ link, onLink, onQr }: { link: string; onLink: (v: string) => void; onQr: (dataUrl: string) => void }) {
  const [busy, setBusy] = useState(false);
  const valid = /^https?:\/\/\S+$/i.test(link.trim());
  const generate = async () => {
    if (!valid) {
      toast.error("Paste the full link, starting with https://");
      return;
    }
    setBusy(true);
    try {
      onQr(await QRCode.toDataURL(link.trim(), { width: 320, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } }));
      toast.success("Review QR generated", { description: "Save to print it on new invoices." });
    } catch {
      toast.error("Couldn't make a QR from that link");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-1.5 sm:pl-[8.25rem]">
      <span className="text-[0.8rem] font-semibold text-slate-700">…or generate it from your review link</span>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className={inputClass}
          placeholder="https://g.page/r/… or a Google Maps link"
          inputMode="url"
          value={link}
          onChange={(e) => onLink(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void generate(); } }}
          maxLength={500}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={generate}
          disabled={busy || !link.trim()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
        >
          <i className={`ph-bold ${busy ? "ph-circle-notch animate-spin" : "ph-qr-code"}`} aria-hidden="true"></i>
          Generate QR
        </button>
      </div>
      <span className="text-[0.7rem] text-slate-400">In Google Maps, open your business, choose Share, and copy the link. Google Business Profile also gives a short review link.</span>
    </div>
  );
}

/** Settings → Business Details: the shop's details that print on every invoice. */
export default function BusinessDetails() {
  const { data, mutate, isLoading } = useSWR<Values>("/api/settings/system?group=business", fetcher, { revalidateOnFocus: false });
  const [draft, setDraft] = useState<Values | null>(null);
  const [draftFor, setDraftFor] = useState<Values | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Reset the draft whenever fresh values arrive from the server.
  if (data && data !== draftFor) {
    setDraftFor(data);
    setDraft({ ...data });
  }

  const changed = draft && data ? Object.keys(draft).filter((k) => (draft[k] ?? "") !== (data[k] ?? "")) : [];

  const save = async () => {
    if (!draft || changed.length === 0) return;
    if (draft.business_gst_rate && !(Number(draft.business_gst_rate) >= 0 && Number(draft.business_gst_rate) <= 28)) {
      toast.error("GST rate should be a number between 0 and 28.");
      return;
    }
    setSaving(true);
    try {
      for (const key of changed) {
        const res = await fetch("/api/settings/system", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value: (draft[key] ?? "").trim() }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save");
      }
      await mutate();
      toast.success("Business details saved", { description: "New invoices will use them straight away." });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[1.15rem] font-bold text-slate-900 mb-1">Business Details</h2>
          <p className="text-sm text-slate-500">Your shop&apos;s logo, contact, tax and bank details as they appear on every invoice. Empty fields are left off the invoice.</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || changed.length === 0}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <i className={`ph-bold ${saving ? "ph-circle-notch animate-spin" : "ph-floppy-disk"}`} aria-hidden="true"></i>
          {saving ? "Saving…" : changed.length ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "Saved"}
        </button>
      </div>

      {isLoading || !draft ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {GROUPS.map((group) => (
            <section key={group.title} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-orange-500 shadow-sm ring-1 ring-slate-100">
                  <i className={`ph-bold ${group.icon} text-lg`} aria-hidden="true"></i>
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{group.title}</h3>
                  <p className="text-xs text-slate-500">{group.description}</p>
                </div>
              </div>
              {group.title === "Branding" && (
                <div className="mb-4">
                  <ImageField
                    value={draft.business_logo ?? ""}
                    onChange={(v) => setDraft({ ...draft, business_logo: v })}
                    title="Invoice logo"
                    alt="Invoice logo"
                    emptyLabel="Default Add designer logo"
                    hint="PNG, JPEG or WebP. Wide logos look best; it is scaled to fit 220 × 60 pt on the invoice."
                  />
                </div>
              )}
              {group.title === "QR codes" && (
                <div className="flex flex-col gap-5">
                  <ImageField
                    square
                    value={draft.business_review_qr ?? ""}
                    onChange={(v) => setDraft({ ...draft, business_review_qr: v })}
                    title="Google review QR"
                    alt="Google review QR"
                    emptyLabel="Built-in review QR"
                    hint="Printed in the footer of every invoice next to “We value your feedback”."
                  />
                  <ReviewLinkField
                    link={draft.business_review_url ?? ""}
                    onLink={(v) => setDraft({ ...draft, business_review_url: v })}
                    onQr={(dataUrl) => setDraft({ ...draft, business_review_qr: dataUrl })}
                  />
                  <ImageField
                    square
                    value={draft.business_gpay_qr ?? ""}
                    onChange={(v) => setDraft({ ...draft, business_gpay_qr: v })}
                    title="GPay / UPI payment QR"
                    alt="GPay payment QR"
                    emptyLabel={draft.business_upi_id ? "Generated from your UPI ID" : "No payment QR"}
                    hint="Printed under Bank Details only while the invoice has a balance due. Without an upload, a QR is generated from the UPI ID when one is set."
                  />
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {group.fields.map((f) => (
                  <label key={f.key} className={`flex flex-col gap-1.5 ${f.multiline ? "md:col-span-2" : ""}`}>
                    <span className="text-[0.8rem] font-semibold text-slate-700">{f.label}</span>
                    {f.multiline ? (
                      <textarea
                        rows={2}
                        className={`${inputClass} resize-none`}
                        placeholder={f.placeholder}
                        value={draft[f.key] ?? ""}
                        onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                        maxLength={500}
                      />
                    ) : (
                      <input
                        className={inputClass}
                        placeholder={f.placeholder}
                        inputMode={f.inputMode}
                        value={draft[f.key] ?? ""}
                        onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                        maxLength={500}
                        autoComplete="off"
                      />
                    )}
                    {f.hint && <span className="text-[0.7rem] text-slate-400">{f.hint}</span>}
                  </label>
                ))}
              </div>
            </section>
          ))}
          <p className="text-xs text-slate-400">
            Shown in grey: the details the invoice uses today when a field is empty (from the shop&apos;s saved details).
          </p>
        </div>
      )}
    </div>
  );
}
