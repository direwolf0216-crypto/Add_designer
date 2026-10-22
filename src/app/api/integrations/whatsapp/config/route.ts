import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { parseJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import { clearWhatsAppGateway, getWhatsAppConfig, isWhatsAppConfigured, saveWhatsAppGateway, saveWhatsAppRules } from "@/lib/whatsapp/config";
import { DEFAULT_RULES, mergeRules } from "@/lib/whatsapp/templates";

export const dynamic = "force-dynamic";

const mask = (s: string) => (s.length > 8 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s ? "••••••" : "");

/** Where the gateway should post events; shown in Settings so the admin can register it. */
const webhookUrl = (reqUrl: string) => `${(process.env.NEXT_PUBLIC_APP_URL || new URL(reqUrl).origin).replace(/\/$/, "")}/api/integrations/whatsapp/webhook`;

export const GET = route(async (req) => {
  await requireAdmin();
  const c = await getWhatsAppConfig();
  return NextResponse.json({
    configured: isWhatsAppConfigured(c),
    gatewayUrl: c.gatewayUrl,
    sessionId: c.sessionId,
    hasApiKey: !!c.apiKey,
    apiKeyHint: mask(c.apiKey),
    hasWebhookSecret: !!c.webhookSecret,
    webhookSecret: c.webhookSecret,
    webhookUrl: webhookUrl(req.url),
    rules: c.rules,
    defaults: DEFAULT_RULES,
  });
});

const gatewaySchema = z.object({
  gatewayUrl: z.string().trim().url("Enter the gateway URL, e.g. https://wa.example.com").max(300),
  sessionId: z.string().trim().min(1, "Enter the session id or name").max(120),
  apiKey: z.string().trim().max(500).optional().default(""),
});

const rulesSchema = z.object({
  defaultCountryCode: z.string().regex(/^\d{1,4}$/),
  customer: z.object({ jobCreated: z.boolean(), stages: z.array(z.string().max(100)).max(30), paymentDueOnInvoice: z.boolean() }),
  staff: z.object({ assigned: z.boolean(), handoff: z.boolean() }),
  templates: z.object({ jobCreated: z.string().max(1000), stageChanged: z.string().max(1000), paymentDue: z.string().max(1000), assigned: z.string().max(1000), handoff: z.string().max(1000) }),
});

const bodySchema = z.union([z.object({ gateway: gatewaySchema }), z.object({ rules: rulesSchema })]);

export const PUT = route(async (req) => {
  await requireAdmin();
  const body = await parseJson(req, bodySchema);
  const current = await getWhatsAppConfig();
  if ("gateway" in body) {
    if (!body.gateway.apiKey && !current.apiKey) return NextResponse.json({ error: "Paste the gateway's API key" }, { status: 400 });
    // One webhook secret per installation, generated here so the admin never has to invent one.
    const webhookSecret = current.webhookSecret || randomBytes(24).toString("hex");
    await saveWhatsAppGateway({ ...body.gateway, webhookSecret });
  } else {
    await saveWhatsAppRules(mergeRules(body.rules));
  }
  return NextResponse.json({ success: true });
});

export const DELETE = route(async () => {
  await requireAdmin();
  await clearWhatsAppGateway();
  return NextResponse.json({ success: true });
});
