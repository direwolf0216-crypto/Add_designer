import "server-only";
import { after } from "next/server";
import prisma from "@/lib/prisma";
import { computeBalance } from "@/lib/money";
import { getWhatsAppConfig, isWhatsAppConfigured, type WhatsAppConfig } from "./config";
import { renderTemplate } from "./templates";
import { sendWhatsApp } from "./send";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const money = (n: number) => `Rs ${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const day = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

/** Everything the templates can mention about one job, read fresh so the numbers are current. */
export async function jobTemplateVars(jobId: string) {
  const [job, payments, settings] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId }, include: { client: true, order: true } }),
    prisma.transaction.findMany({ where: { jobId, type: "INCOME", deletedAt: null }, select: { amount: true } }),
    prisma.systemSetting.findMany({ where: { key: { in: ["business_name", "business_phone", "business_upi_id"] } } }),
  ]);
  if (!job) return null;
  const s = Object.fromEntries(settings.map((r) => [r.key, typeof r.value === "string" ? r.value : ""]));
  const cd = (job.customData && typeof job.customData === "object" ? job.customData : {}) as Record<string, unknown>;
  const discount = Number.parseFloat(String(cd.fld_b_discount ?? "")) || 0;
  const balance = computeBalance({ packageAmount: Number(job.order?.package ?? 0), discount, payments: payments.map((p) => ({ amount: Number(p.amount) })) });
  return {
    job,
    balance,
    vars: {
      customer: job.client?.name ?? "",
      job: job.jobNumber ?? `#${job.id.slice(0, 8)}`,
      category: job.category ?? "",
      status: job.stage ?? job.status ?? "",
      due: day(job.dueDate ?? job.date),
      total: money(balance.total),
      paid: money(balance.paid),
      balance: money(balance.due),
      upi: s.business_upi_id || "",
      shop: s.business_name || "Add designer",
      phone: s.business_phone || "",
      link: `${APP_URL}/jobs/details/${job.id}`,
    },
  };
}

type CfgPromise = Promise<WhatsAppConfig>;
const ready = async (p: CfgPromise) => { const c = await p; return isWhatsAppConfigured(c) ? c : null; };

/** Customer messages after a job is created or its stage changes. Runs after the response. */
export function whatsappAfterJobSaved(jobId: string, opts: { created: boolean; stageBefore?: string | null; stageAfter?: string | null }) {
  after(async () => {
    try {
      const cfg = await ready(getWhatsAppConfig());
      if (!cfg) return;
      const stageChanged = !!opts.stageAfter && (opts.stageBefore ?? "").toLowerCase() !== opts.stageAfter.toLowerCase();
      const notifyStage = stageChanged && !opts.created && cfg.rules.customer.stages.some((s) => s.toLowerCase() === opts.stageAfter!.toLowerCase());
      if (!(opts.created && cfg.rules.customer.jobCreated) && !notifyStage) return;
      const ctx = await jobTemplateVars(jobId);
      if (!ctx?.job.client?.phone) return;
      const kind = opts.created ? "job_created" : "stage_changed";
      const template = opts.created ? cfg.rules.templates.jobCreated : cfg.rules.templates.stageChanged;
      await sendWhatsApp({ kind, to: ctx.job.client.phone, body: renderTemplate(template, ctx.vars), jobId }, cfg);
    } catch (e) {
      console.error("[whatsapp] job event failed", e);
    }
  });
}

/** Payment reminder to the customer; used when an invoice is generated and from the job's Send on WhatsApp action. */
export async function whatsappPaymentDue(jobId: string, cfg?: WhatsAppConfig | null) {
  const c = cfg ?? (await ready(getWhatsAppConfig()));
  if (!c) return { ok: false, error: "WhatsApp is not set up" };
  const ctx = await jobTemplateVars(jobId);
  if (!ctx?.job.client?.phone) return { ok: false, error: "The customer has no phone number" };
  if (ctx.balance.due <= 0) return { ok: false, error: "Nothing is due on this job" };
  return sendWhatsApp({ kind: "payment_due", to: ctx.job.client.phone, body: renderTemplate(c.rules.templates.paymentDue, ctx.vars), jobId }, c);
}

export function whatsappAfterInvoice(jobId: string) {
  after(async () => {
    try {
      const cfg = await ready(getWhatsAppConfig());
      if (!cfg || !cfg.rules.customer.paymentDueOnInvoice) return;
      await whatsappPaymentDue(jobId, cfg);
    } catch (e) {
      console.error("[whatsapp] invoice reminder failed", e);
    }
  });
}

/** Staff who opted in (profile toggle) and have a phone. */
async function staffRecipients(userIds: string[]) {
  if (!userIds.length) return [];
  return prisma.user.findMany({ where: { id: { in: userIds }, status: "ACTIVE", whatsappNotifs: true, phone: { not: null } }, select: { id: true, name: true, phone: true } });
}

/** Tell newly assigned staff. Runs after the response. */
export function whatsappAfterAssigned(jobId: string, userIds: string[], actorName: string) {
  if (!userIds.length) return;
  after(async () => {
    try {
      const cfg = await ready(getWhatsAppConfig());
      if (!cfg || !cfg.rules.staff.assigned) return;
      const [ctx, people] = await Promise.all([jobTemplateVars(jobId), staffRecipients(userIds)]);
      if (!ctx) return;
      for (const p of people) {
        await sendWhatsApp({ kind: "assigned", to: p.phone, body: renderTemplate(cfg.rules.templates.assigned, { ...ctx.vars, staff: p.name ?? "", actor: actorName }), jobId, userId: p.id }, cfg);
      }
    } catch (e) {
      console.error("[whatsapp] assignment message failed", e);
    }
  });
}

/** Tell a team's members a job joined their queue. Runs after the response. */
export function whatsappAfterHandoff(jobId: string, teamName: string, userIds: string[], actorName: string) {
  if (!userIds.length) return;
  after(async () => {
    try {
      const cfg = await ready(getWhatsAppConfig());
      if (!cfg || !cfg.rules.staff.handoff) return;
      const [ctx, people] = await Promise.all([jobTemplateVars(jobId), staffRecipients(userIds)]);
      if (!ctx) return;
      for (const p of people) {
        await sendWhatsApp({ kind: "handoff", to: p.phone, body: renderTemplate(cfg.rules.templates.handoff, { ...ctx.vars, staff: p.name ?? "", actor: actorName, team: teamName }), jobId, userId: p.id }, cfg);
      }
    } catch (e) {
      console.error("[whatsapp] hand-off message failed", e);
    }
  });
}
