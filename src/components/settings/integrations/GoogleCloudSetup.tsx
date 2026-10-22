"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/swr";

type Config = {
  configured: boolean;
  source: "settings" | "env" | "none";
  clientId: string;
  hasSecret: boolean;
  secretHint: string;
  apiKey: string;
  appId: string;
  redirectUri: string;
};

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-mono text-[0.8rem] text-slate-800 shadow-sm transition-all placeholder:font-sans placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-4 focus:ring-orange-500/10";

/**
 * Settings → Google Drive → "Google Cloud setup" (admins). The OAuth client id and secret, plus the optional
 * Picker key and project number, are saved on the server so the integration needs no environment variables.
 */
export default function GoogleCloudSetup({ onSaved }: { onSaved?: () => void }) {
  const { data, mutate, isLoading } = useSWR<Config>("/api/integrations/google/config", fetcher, { revalidateOnFocus: false });
  const [draft, setDraft] = useState<{ clientId: string; clientSecret: string; apiKey: string; appId: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const form = draft ?? { clientId: data?.clientId ?? "", clientSecret: "", apiKey: data?.apiKey ?? "", appId: data?.appId ?? "" };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...form, [k]: e.target.value });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy; select the text instead");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/google/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save the credentials");
      setDraft(null);
      await mutate();
      onSaved?.();
      toast.success("Google Cloud credentials saved", { description: "Everyone can now connect their Drive from this page." });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      const res = await fetch("/api/integrations/google/config", { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't remove the credentials");
      setDraft(null);
      await mutate();
      onSaved?.();
      toast.success("Saved credentials removed");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRemoving(false);
    }
  };

  const statusChip = isLoading ? null : data?.source === "settings" ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-1 text-xs font-bold text-green-700"><i className="ph-fill ph-check-circle" aria-hidden="true"></i> Saved in settings</span>
  ) : data?.source === "env" ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-1 text-xs font-bold text-sky-700"><i className="ph-fill ph-terminal-window" aria-hidden="true"></i> From environment</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700"><i className="ph-fill ph-warning" aria-hidden="true"></i> Not set up</span>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
            <i className="ph-bold ph-key text-lg" aria-hidden="true"></i>
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900">Google Cloud setup</h3>
            <p className="text-xs text-slate-500">One-time, admin only. Paste the OAuth client from your Google Cloud project; nothing to add in Vercel.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statusChip}
          <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
            {open ? "Hide" : data?.configured ? "Edit" : "Set up"}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 bg-slate-50/60 px-6 py-6 sm:px-8">
          <ol className="mb-6 grid gap-3 text-[0.85rem] text-slate-600 sm:grid-cols-3">
            <li className="rounded-xl border border-slate-100 bg-white p-3"><span className="mb-1 block text-[0.65rem] font-extrabold uppercase tracking-wider text-orange-500">Step 1</span>In <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="font-bold text-slate-900 underline underline-offset-2">Google Cloud → Credentials</a>, create an <strong>OAuth client ID</strong> of type Web application and enable the Google Drive API.</li>
            <li className="rounded-xl border border-slate-100 bg-white p-3"><span className="mb-1 block text-[0.65rem] font-extrabold uppercase tracking-wider text-orange-500">Step 2</span>Add this redirect URI to the client:
              <button type="button" onClick={() => data && copy(data.redirectUri)} className="mt-1.5 flex w-full items-center gap-2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-left font-mono text-[0.7rem] text-white hover:bg-slate-800" title="Copy">
                <span className="truncate">{data?.redirectUri ?? "…"}</span>
                <i className="ph-bold ph-copy ml-auto shrink-0" aria-hidden="true"></i>
              </button>
            </li>
            <li className="rounded-xl border border-slate-100 bg-white p-3"><span className="mb-1 block text-[0.65rem] font-extrabold uppercase tracking-wider text-orange-500">Step 3</span>Paste the client ID and secret below. The API key and project number are only needed for the file picker.</li>
          </ol>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 md:col-span-2">
              <span className="text-[0.8rem] font-semibold text-slate-700">OAuth client ID <span className="text-rose-500">*</span></span>
              <input className={inputClass} value={form.clientId} onChange={set("clientId")} placeholder="1234567890-abc123.apps.googleusercontent.com" autoComplete="off" spellCheck={false} />
            </label>
            <label className="flex flex-col gap-1.5 md:col-span-2">
              <span className="text-[0.8rem] font-semibold text-slate-700">OAuth client secret {data?.hasSecret && data.source === "settings" ? <span className="font-normal text-slate-400">(saved as {data.secretHint}; leave empty to keep it)</span> : <span className="text-rose-500">*</span>}</span>
              <input className={inputClass} type="password" value={form.clientSecret} onChange={set("clientSecret")} placeholder={data?.hasSecret && data.source === "settings" ? "••••••••••••" : "GOCSPX-…"} autoComplete="new-password" spellCheck={false} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.8rem] font-semibold text-slate-700">API key <span className="font-normal text-slate-400">(optional, for the picker)</span></span>
              <input className={inputClass} value={form.apiKey} onChange={set("apiKey")} placeholder="AIza…" autoComplete="off" spellCheck={false} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.8rem] font-semibold text-slate-700">Project number <span className="font-normal text-slate-400">(optional, for the picker)</span></span>
              <input className={inputClass} value={form.appId} onChange={set("appId")} placeholder="1234567890" inputMode="numeric" autoComplete="off" />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">The secret is encrypted before it is stored and is never shown again.</p>
            <div className="flex items-center gap-2">
              {data?.source === "settings" && (
                <button type="button" onClick={remove} disabled={removing} className="rounded-xl px-3.5 py-2 text-sm font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50">
                  {removing ? "Removing…" : "Remove"}
                </button>
              )}
              <button type="button" onClick={save} disabled={saving || !form.clientId.trim()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">
                {saving && <i className="ph-bold ph-circle-notch animate-spin" aria-hidden="true"></i>}
                Save credentials
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
