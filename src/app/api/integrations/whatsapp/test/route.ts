import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import { getWhatsAppConfig, isWhatsAppConfigured } from "@/lib/whatsapp/config";
import { GatewayError, getSession, listWebhooks, registerWebhook } from "@/lib/whatsapp/client";
import { sendWhatsApp } from "@/lib/whatsapp/send";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["status", "register-webhook", "send-test"]),
  to: z.string().max(30).optional(),
  webhookUrl: z.string().url().max(300).optional(),
});

/** Settings → WhatsApp: check the session, register this app's webhook, or send a test message. */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const { action, to, webhookUrl } = await parseJson(req, bodySchema);
  const cfg = await getWhatsAppConfig();
  if (!isWhatsAppConfigured(cfg)) return NextResponse.json({ error: "Save the gateway URL, session and API key first" }, { status: 400 });
  try {
    if (action === "status") {
      const s = await getSession(cfg);
      return NextResponse.json({ status: s.status, phone: s.phone ?? null, pushName: s.pushName ?? null, lastError: s.lastError ?? null });
    }
    if (action === "register-webhook") {
      if (!webhookUrl) return NextResponse.json({ error: "Missing webhook URL" }, { status: 400 });
      const existing = await listWebhooks(cfg).catch(() => []);
      const list = Array.isArray(existing) ? existing : existing.items ?? existing.data ?? [];
      const already = list.find((w) => w.url === webhookUrl);
      if (already) return NextResponse.json({ registered: true, existing: true, id: already.id });
      const created = await registerWebhook(cfg, webhookUrl, cfg.webhookSecret);
      return NextResponse.json({ registered: true, existing: false, id: created.id });
    }
    const result = await sendWhatsApp({ kind: "manual", to, body: `Test message from ${process.env.NEXT_PUBLIC_APP_NAME || "Add designer"}: WhatsApp is connected. Sent by ${admin.name ?? "an admin"}.` }, cfg);
    return result.ok ? NextResponse.json({ sent: true }) : NextResponse.json({ error: result.error }, { status: 400 });
  } catch (e) {
    const status = e instanceof GatewayError && e.status === 401 ? 401 : 502;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
});
