import { NextResponse } from "next/server";
import { route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";
import { getWhatsAppConfig, isWhatsAppConfigured } from "@/lib/whatsapp/config";

export const dynamic = "force-dynamic";

/** Whether WhatsApp sending is set up (any signed-in user; drives the Send on WhatsApp button). */
export const GET = route(async () => {
  await requireUser();
  const c = await getWhatsAppConfig();
  return NextResponse.json({ enabled: isWhatsAppConfigured(c), templates: isWhatsAppConfigured(c) ? c.rules.templates : null });
});
