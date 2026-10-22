import "server-only";
import prisma from "@/lib/prisma";
import { seal, unseal } from "@/lib/google/credentials";
import { mergeRules, type WhatsAppRules } from "./templates";

/**
 * OpenWA gateway settings, entered in Settings → WhatsApp and kept in SystemSetting (the API key and
 * webhook secret encrypted), so no environment variables are needed.
 */
export const WHATSAPP_KEYS = {
  gatewayUrl: "whatsapp_gateway_url",
  sessionId: "whatsapp_session_id",
  apiKey: "whatsapp_api_key",
  webhookSecret: "whatsapp_webhook_secret",
  rules: "whatsapp_rules",
} as const;

export interface WhatsAppConfig {
  gatewayUrl: string;
  sessionId: string;
  apiKey: string;
  webhookSecret: string;
  rules: WhatsAppRules;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: Object.values(WHATSAPP_KEYS) } } });
  const byKey = new Map(rows.map((r) => [r.key, r.value as unknown]));
  return {
    gatewayUrl: str(byKey.get(WHATSAPP_KEYS.gatewayUrl)).replace(/\/+$/, ""),
    sessionId: str(byKey.get(WHATSAPP_KEYS.sessionId)),
    apiKey: unseal(byKey.get(WHATSAPP_KEYS.apiKey)) ?? "",
    webhookSecret: unseal(byKey.get(WHATSAPP_KEYS.webhookSecret)) ?? "",
    rules: mergeRules(byKey.get(WHATSAPP_KEYS.rules)),
  };
}

export const isWhatsAppConfigured = (c: Pick<WhatsAppConfig, "gatewayUrl" | "sessionId" | "apiKey">) => !!(c.gatewayUrl && c.sessionId && c.apiKey);

async function put(key: string, value: unknown) {
  await prisma.systemSetting.upsert({ where: { key }, update: { value: value as never }, create: { key, value: value as never } });
}

export async function saveWhatsAppGateway(input: { gatewayUrl: string; sessionId: string; apiKey?: string; webhookSecret?: string }) {
  await put(WHATSAPP_KEYS.gatewayUrl, input.gatewayUrl.trim().replace(/\/+$/, ""));
  await put(WHATSAPP_KEYS.sessionId, input.sessionId.trim());
  if (input.apiKey) await put(WHATSAPP_KEYS.apiKey, seal(input.apiKey.trim()));
  if (input.webhookSecret) await put(WHATSAPP_KEYS.webhookSecret, seal(input.webhookSecret.trim()));
}

export async function saveWhatsAppRules(rules: WhatsAppRules) {
  await put(WHATSAPP_KEYS.rules, rules as unknown as object);
}

export async function clearWhatsAppGateway() {
  await prisma.systemSetting.deleteMany({ where: { key: { in: [WHATSAPP_KEYS.gatewayUrl, WHATSAPP_KEYS.sessionId, WHATSAPP_KEYS.apiKey, WHATSAPP_KEYS.webhookSecret] } } });
}
