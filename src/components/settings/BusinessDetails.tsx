"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/swr";
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

/** Logo picker with preview; stores the image as a data URL in the business_logo setting. */
function LogoField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-200 bg-white px-4 sm:w-64">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL preview
          <img src={value} alt="Invoice logo" className="max-h-20 max-w-full object-contain" />
        ) : (
          <span className="text-center text-xs font-semibold text-slate-400">Default Add designer logo</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.8rem] font-semibold text-slate-700">Invoice logo</span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <i className="ph-bold ph-upload-simple" aria-hidden="true"></i>
            {value ? "Replace" : "Upload logo"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={pick} />
          </label>
          {value && (
            <button type="button" onClick={() => onChange("")} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
              Use default
            </button>
          )}
        </div>
        <span className="text-[0.7rem] text-slate-400">PNG, JPEG or WebP. Wide logos look best; it is scaled to fit 220 × 60 pt on the invoice.</span>
      </div>
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
                <LogoField value={draft.business_logo ?? ""} onChange={(v) => setDraft({ ...draft, business_logo: v })} />
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
