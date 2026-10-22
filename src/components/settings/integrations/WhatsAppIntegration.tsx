"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/swr";
import CustomMultiDropdown from "@/components/ui/CustomMultiDropdown";
import { PLACEHOLDERS, type WhatsAppRules } from "@/lib/whatsapp/templates";

type Config = {
  configured: boolean;
  gatewayUrl: string;
  sessionId: string;
  hasApiKey: boolean;
  apiKeyHint: string;
  webhookSecret: string;
  webhookUrl: string;
  rules: WhatsAppRules;
  defaults: WhatsAppRules;
};
type Status = { status: string; phone: string | null; pushName: string | null; lastError: string | null };
type LogRow = { id: string; direction: string; kind: string; phone: string; body: string; status: string; error: string | null; createdAt: string; job: { id: string; jobNumber: string | null; client: { name: string } | null } | null };

const inputClass =
  "w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-all focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100";
const KIND_LABEL: Record<string, string> = { job_created: "Job confirmed", stage_changed: "Status update", payment_due: "Payment reminder", assigned: "Assignment", handoff: "Team hand-off", manual: "Manual", inbound: "Reply" };
const STATUS_CLS: Record<string, string> = { sent: "bg-blue-50 text-blue-700", delivered: "bg-emerald-50 text-emerald-700", read: "bg-emerald-100 text-emerald-800", failed: "bg-red-50 text-red-700", queued: "bg-slate-100 text-slate-600", received: "bg-violet-50 text-violet-700" };

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3 cursor-pointer group" onClick={() => onChange(!on)}>
      <div className={`relative mt-0.5 w-10 h-5 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-emerald-500" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? "translate-x-5" : "translate-x-0"}`}></span>
      </div>
      <div className="min-w-0">
        <span className="block text-sm font-bold text-slate-800 group-hover:text-slate-900">{label}</span>
        {hint && <span className="block text-[0.72rem] text-slate-500 leading-snug">{hint}</span>}
      </div>
    </div>
  );
}

/** Settings → WhatsApp: a self-hosted OpenWA gateway, what gets sent to customers and staff, and the message log. */
export default function WhatsAppIntegration() {
  const { data, mutate, isLoading } = useSWR<Config>("/api/integrations/whatsapp/config", fetcher, { revalidateOnFocus: false });
  const { data: stages } = useSWR<{ teams: unknown[]; stages: { label: string }[] }>("/api/teams", fetcher, { revalidateOnFocus: false });
  const { data: log, mutate: mutateLog } = useSWR<{ messages: LogRow[] }>("/api/integrations/whatsapp/messages?limit=30", fetcher, { revalidateOnFocus: false, refreshInterval: 30_000 });

  const [gateway, setGateway] = useState<{ gatewayUrl: string; sessionId: string; apiKey: string } | null>(null);
  const [rules, setRules] = useState<WhatsAppRules | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [testTo, setTestTo] = useState("");
  const [seededFor, setSeededFor] = useState<Config | undefined>(undefined);
  if (data && data !== seededFor) {
    setSeededFor(data);
    setGateway({ gatewayUrl: data.gatewayUrl, sessionId: data.sessionId, apiKey: "" });
    setRules(data.rules);
  }

  const post = async (action: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch("/api/integrations/whatsapp/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Request failed");
    return body;
  };

  const saveGateway = async () => {
    if (!gateway) return;
    setBusy("gateway");
    try {
      const res = await fetch("/api/integrations/whatsapp/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gateway }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save");
      await mutate();
      toast.success("Gateway saved", { description: "Now check the connection and register the webhook." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const checkStatus = async () => {
    setBusy("status");
    try {
      setStatus(await post("status"));
    } catch (e) {
      setStatus(null);
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const registerWebhook = async () => {
    if (!data) return;
    setBusy("webhook");
    try {
      const r = await post("register-webhook", { webhookUrl: data.webhookUrl });
      toast.success(r.existing ? "Webhook already registered" : "Webhook registered", { description: "Delivery status and customer replies will arrive here." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const sendTest = async () => {
    setBusy("test");
    try {
      await post("send-test", { to: testTo });
      toast.success("Test message sent");
      mutateLog();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const saveRules = async () => {
    if (!rules) return;
    setBusy("rules");
    try {
      const res = await fetch("/api/integrations/whatsapp/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save");
      await mutate();
      toast.success("Messages saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const disconnect = async () => {
    setBusy("disconnect");
    try {
      await fetch("/api/integrations/whatsapp/config", { method: "DELETE" });
      await mutate();
      setStatus(null);
      toast.success("WhatsApp disconnected");
    } finally {
      setBusy(null);
    }
  };

  const rulesChanged = !!rules && !!data && JSON.stringify(rules) !== JSON.stringify(data.rules);
  const stageOptions = (stages?.stages ?? []).map((s) => s.label);
  const statusTone = status?.status === "ready" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : status ? "text-amber-700 bg-amber-50 border-amber-200" : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-[1.15rem] font-bold text-slate-900 mb-1 flex items-center gap-2">
              <i className="ph-fill ph-whatsapp-logo text-emerald-500 text-2xl" aria-hidden="true"></i> WhatsApp
            </h2>
            <p className="text-sm text-slate-500">
              Messages go out through your own OpenWA gateway, a self-hosted server linked to the shop&apos;s WhatsApp number. Customers get job and payment updates; staff get assignments and queue hand-offs.
            </p>
          </div>
          {data?.configured && (
            <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-emerald-700">Set up</span>
          )}
        </div>

        {isLoading || !gateway || !data ? (
          <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 md:col-span-2">
              <span className="text-[0.8rem] font-semibold text-slate-700">Gateway URL</span>
              <input className={inputClass} placeholder="https://wa.yourdomain.com" inputMode="url" value={gateway.gatewayUrl} onChange={(e) => setGateway({ ...gateway, gatewayUrl: e.target.value })} autoComplete="off" />
              <span className="text-[0.7rem] text-slate-400">Where OpenWA runs (port 2785 unless you put it behind a domain). Vercel can&apos;t host it; a small VPS, Render or Railway instance can.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.8rem] font-semibold text-slate-700">Session id or name</span>
              <input className={inputClass} placeholder="e.g. adddesigner" value={gateway.sessionId} onChange={(e) => setGateway({ ...gateway, sessionId: e.target.value })} autoComplete="off" />
              <span className="text-[0.7rem] text-slate-400">The session you created and paired in the OpenWA dashboard.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.8rem] font-semibold text-slate-700">API key</span>
              <input className={inputClass} type="password" placeholder={data.hasApiKey ? `Saved (${data.apiKeyHint}) — paste to replace` : "Printed once when OpenWA first starts"} value={gateway.apiKey} onChange={(e) => setGateway({ ...gateway, apiKey: e.target.value })} autoComplete="new-password" />
              <span className="text-[0.7rem] text-slate-400">Stored encrypted; never shown again.</span>
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={saveGateway} disabled={busy === "gateway"} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                <i className={`ph-bold ${busy === "gateway" ? "ph-circle-notch animate-spin" : "ph-floppy-disk"}`}></i> Save gateway
              </button>
              <button type="button" onClick={checkStatus} disabled={!data.configured || busy === "status"} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <i className={`ph-bold ${busy === "status" ? "ph-circle-notch animate-spin" : "ph-plugs-connected"}`}></i> Check connection
              </button>
              <button type="button" onClick={registerWebhook} disabled={!data.configured || busy === "webhook"} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <i className={`ph-bold ${busy === "webhook" ? "ph-circle-notch animate-spin" : "ph-webhooks-logo"}`}></i> Register webhook
              </button>
              {data.configured && (
                <button type="button" onClick={disconnect} disabled={busy === "disconnect"} className="ml-auto rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Disconnect</button>
              )}
            </div>
            {status && (
              <div className={`md:col-span-2 rounded-xl border px-4 py-3 text-sm ${statusTone}`}>
                <span className="font-bold">Session {status.status === "ready" ? "connected" : status.status.replace(/_/g, " ")}</span>
                {status.phone && <span> · +{status.phone}{status.pushName ? ` (${status.pushName})` : ""}</span>}
                {status.status !== "ready" && <span className="block text-[0.75rem] mt-0.5">{status.status === "qr_ready" ? "Scan the QR code in the OpenWA dashboard to link the shop's number." : status.lastError || "Open the OpenWA dashboard to start or re-link the session."}</span>}
              </div>
            )}
            <div className="md:col-span-2 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-[0.75rem] text-slate-600">
              <span className="font-bold text-slate-700">Webhook URL</span> <code className="break-all">{data.webhookUrl}</code>
              <span className="block mt-1">Register it with the button above (it signs deliveries with a secret kept here), or add it in the OpenWA dashboard with secret <code className="break-all">{data.webhookSecret || "— save the gateway first —"}</code>.</span>
            </div>
            {data.configured && (
              <div className="md:col-span-2 flex flex-col sm:flex-row gap-2">
                <input className={inputClass} placeholder="Send a test to… e.g. 98765 43210" inputMode="tel" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                <button type="button" onClick={sendTest} disabled={!testTo.trim() || busy === "test"} className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  <i className={`ph-bold ${busy === "test" ? "ph-circle-notch animate-spin" : "ph-paper-plane-tilt"}`}></i> Send test
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {rules && data && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">What gets sent</h3>
              <p className="text-sm text-slate-500">Staff receive messages only if their profile has a mobile number and WhatsApp notifications switched on.</p>
            </div>
            <button type="button" onClick={saveRules} disabled={!rulesChanged || busy === "rules"} className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              <i className={`ph-bold ${busy === "rules" ? "ph-circle-notch animate-spin" : "ph-floppy-disk"}`}></i> {rulesChanged ? "Save messages" : "Saved"}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 flex flex-col gap-4">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><i className="ph-bold ph-user text-orange-500"></i> Customers</h4>
              <Toggle on={rules.customer.jobCreated} onChange={(v) => setRules({ ...rules, customer: { ...rules.customer, jobCreated: v } })} label="Job confirmed" hint="When a job is created." />
              <div>
                <span className="block text-sm font-bold text-slate-800 mb-1.5">Status updates at these stages</span>
                <CustomMultiDropdown options={stageOptions.length ? stageOptions : rules.customer.stages} value={rules.customer.stages} onChange={(v) => setRules({ ...rules, customer: { ...rules.customer, stages: Array.isArray(v) ? v : [v as string] } })} placeholder="No status messages" />
              </div>
              <Toggle on={rules.customer.paymentDueOnInvoice} onChange={(v) => setRules({ ...rules, customer: { ...rules.customer, paymentDueOnInvoice: v } })} label="Payment reminder with the invoice" hint="When an invoice is generated and a balance is due. You can also send it any time from the job." />
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.8rem] font-semibold text-slate-700">Country code for 10-digit numbers</span>
                <input className={`${inputClass} max-w-[8rem]`} value={rules.defaultCountryCode} onChange={(e) => setRules({ ...rules, defaultCountryCode: e.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" />
              </label>
            </section>
            <section className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 flex flex-col gap-4">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><i className="ph-bold ph-users-three text-orange-500"></i> Staff</h4>
              <Toggle on={rules.staff.assigned} onChange={(v) => setRules({ ...rules, staff: { ...rules.staff, assigned: v } })} label="Assigned to a job" />
              <Toggle on={rules.staff.handoff} onChange={(v) => setRules({ ...rules, staff: { ...rules.staff, handoff: v } })} label="Job enters their team's queue" />
            </section>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-bold text-slate-900 mb-1">Message templates</h4>
            <p className="text-[0.75rem] text-slate-500 mb-3">
              Placeholders: {PLACEHOLDERS.map((p) => <code key={p.key} title={p.meaning} className="mx-0.5 rounded bg-slate-100 px-1 py-0.5 text-[0.7rem]">{p.key}</code>)}
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {([["jobCreated", "Job confirmed"], ["stageChanged", "Status update"], ["paymentDue", "Payment reminder"], ["assigned", "Assigned (staff)"], ["handoff", "Team hand-off (staff)"]] as const).map(([key, label]) => (
                <label key={key} className="flex flex-col gap-1.5">
                  <span className="text-[0.8rem] font-semibold text-slate-700 flex items-center justify-between">
                    {label}
                    {rules.templates[key] !== data.defaults.templates[key] && (
                      <button type="button" onClick={() => setRules({ ...rules, templates: { ...rules.templates, [key]: data.defaults.templates[key] } })} className="text-[0.7rem] font-bold text-orange-600">Reset</button>
                    )}
                  </span>
                  <textarea rows={3} className={`${inputClass} resize-y`} value={rules.templates[key]} onChange={(e) => setRules({ ...rules, templates: { ...rules.templates, [key]: e.target.value } })} maxLength={1000} />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-base font-bold text-slate-900 mb-1">Recent messages</h3>
        <p className="text-sm text-slate-500 mb-4">Delivery status arrives through the webhook. Customer replies are attached to their latest job and notify the team.</p>
        {!log ? (
          <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        ) : log.messages.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">Nothing sent yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {log.messages.map((m) => (
              <li key={m.id} className="py-3 flex items-start gap-3">
                <i className={`ph-bold mt-0.5 ${m.direction === "IN" ? "ph-arrow-down-left text-violet-500" : "ph-arrow-up-right text-emerald-500"}`}></i>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[0.75rem]">
                    <span className="font-bold text-slate-800">+{m.phone}</span>
                    <span className="text-slate-400">{KIND_LABEL[m.kind] ?? m.kind}</span>
                    {m.job && <a href={`/jobs/details/${m.job.id}`} className="text-orange-600 font-semibold hover:underline">{m.job.jobNumber ?? "job"}{m.job.client ? ` · ${m.job.client.name}` : ""}</a>}
                    <span className={`rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${STATUS_CLS[m.status] ?? "bg-slate-100 text-slate-600"}`}>{m.status}</span>
                    <span className="text-slate-400 ml-auto">{new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-0.5 line-clamp-2">{m.body}</p>
                  {m.error && <p className="text-[0.72rem] text-red-600 mt-0.5">{m.error}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
