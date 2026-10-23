import "server-only";
import prisma from "@/lib/prisma";
import { computeBalance } from "@/lib/money";
import { normalizePhone } from "./phone";
import { CHAT_TEMPLATES, renderTemplate, withoutMissing, type ChatMessageKind } from "./templates";

const money = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const day = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

export interface ChatMessage {
  kind: ChatMessageKind;
  label: string;
  hint: string;
  text: string;
}

export interface JobChat {
  customer: string;
  /** International digits for wa.me, or null when the job's phone can't be used. */
  phone: string | null;
  /** The phone as stored on the job, to show when it can't be used. */
  rawPhone: string;
  messages: ChatMessage[];
}

/**
 * The ready-made WhatsApp messages for one job's customer, filled with the job's current details.
 * Messages with money in them are only offered to people who can see amounts, and the payment
 * reminder only when something is actually due.
 */
export async function jobChatMessages(jobId: string, { showAmounts }: { showAmounts: boolean }): Promise<JobChat | null> {
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
  const vars = {
    customer: job.client?.name ?? "",
    job: job.jobNumber ?? `#${job.id.slice(0, 8)}`,
    category: job.category ?? "",
    status: job.stage ?? job.status ?? "",
    due: day(job.dueDate ?? job.date),
    shop: s.business_name || "Add designer",
    phone: s.business_phone || "",
    upi: s.business_upi_id || "",
    ...(showAmounts ? { total: money(balance.total), paid: money(balance.paid), balance: money(balance.due) } : {}),
  };
  const fill = (kind: ChatMessageKind) => renderTemplate(withoutMissing(CHAT_TEMPLATES[kind], vars), vars);

  const messages: ChatMessage[] = [{ kind: "stageChanged", label: "Status update", hint: `Job is now ${vars.status || "updated"}`, text: fill("stageChanged") }];
  if (showAmounts && balance.due > 0) messages.push({ kind: "paymentDue", label: "Payment reminder", hint: `Balance ${money(balance.due)}${vars.upi ? " with the UPI ID" : ""}`, text: fill("paymentDue") });
  messages.push(
    showAmounts
      ? { kind: "jobCreated", label: "Order confirmation", hint: "Due date and the amounts", text: fill("jobCreated") }
      : { kind: "jobCreatedNoAmounts", label: "Order confirmation", hint: "Job and its due date", text: fill("jobCreatedNoAmounts") }
  );

  const rawPhone = job.client?.phone ?? "";
  return { customer: vars.customer, phone: normalizePhone(rawPhone), rawPhone, messages };
}
