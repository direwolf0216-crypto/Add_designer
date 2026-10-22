import "server-only";
import prisma from "@/lib/prisma";
import { getWhatsAppConfig, isWhatsAppConfigured, type WhatsAppConfig } from "./config";
import { sendText } from "./client";
import { chatIdFor, normalizePhone } from "./phone";

export type OutboundKind = "job_created" | "stage_changed" | "payment_due" | "assigned" | "handoff" | "manual";

export interface OutboundMessage {
  kind: OutboundKind;
  /** Any phone format; normalised with the configured country code. */
  to: string | null | undefined;
  body: string;
  jobId?: string | null;
  /** Staff recipient, when the message goes to a team member. */
  userId?: string | null;
}

/**
 * Sends one message through the gateway and logs it (queued → sent | failed). Never throws: a WhatsApp
 * problem must not break the job action that triggered it.
 */
export async function sendWhatsApp(msg: OutboundMessage, config?: WhatsAppConfig): Promise<{ ok: boolean; error?: string; id?: string }> {
  const cfg = config ?? (await getWhatsAppConfig());
  if (!isWhatsAppConfigured(cfg)) return { ok: false, error: "WhatsApp is not set up" };
  const phone = normalizePhone(msg.to, cfg.rules.defaultCountryCode);
  if (!phone) return { ok: false, error: "No usable phone number" };
  const body = msg.body.trim();
  if (!body) return { ok: false, error: "Empty message" };

  const row = await prisma.whatsAppMessage.create({
    data: { direction: "OUT", kind: msg.kind, phone, chatId: chatIdFor(phone), body, jobId: msg.jobId ?? null, userId: msg.userId ?? null },
  });
  try {
    const res = await sendText(cfg, row.chatId, body);
    const providerId = res?.messageId ?? res?.id ?? null;
    await prisma.whatsAppMessage.update({ where: { id: row.id }, data: { status: "sent", providerId: providerId ? String(providerId) : null } });
    return { ok: true, id: row.id };
  } catch (e) {
    const error = (e as Error).message.slice(0, 500);
    await prisma.whatsAppMessage.update({ where: { id: row.id }, data: { status: "failed", error } }).catch(() => undefined);
    console.error("[whatsapp] send failed", error);
    return { ok: false, error, id: row.id };
  }
}
