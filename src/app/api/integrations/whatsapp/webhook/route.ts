import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { getWhatsAppConfig } from "@/lib/whatsapp/config";
import { phoneFromChatId } from "@/lib/whatsapp/phone";
import { broadcastNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** Verifies `X-OpenWA-Signature: sha256=<hex HMAC-SHA256 of the raw body>` against the saved secret. */
function verify(raw: string, header: string | null, secret: string): boolean {
  if (!secret || !header) return false;
  const given = header.replace(/^sha256=/i, "").trim();
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (given.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

type Envelope = { event?: string; data?: Record<string, unknown>; sessionId?: string };

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** Deliveries from the OpenWA gateway: delivery status for what we sent, and customer replies. */
export async function POST(req: Request) {
  const raw = await req.text();
  const cfg = await getWhatsAppConfig();
  if (!verify(raw, req.headers.get("x-openwa-signature"), cfg.webhookSecret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  let body: Envelope;
  try {
    body = JSON.parse(raw) as Envelope;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const event = body.event ?? "";
  const data = body.data ?? {};

  if (event === "message.ack" || event === "message.failed" || event === "message.sent") {
    const providerId = str(data.messageId) || str(data.id);
    if (providerId) {
      const ack = typeof data.ack === "number" ? data.ack : Number.parseInt(str(data.ack), 10);
      const status =
        event === "message.failed" ? "failed"
        : str(data.status) || (ack >= 3 ? "read" : ack >= 2 ? "delivered" : "sent");
      await prisma.whatsAppMessage.updateMany({ where: { providerId }, data: { status, ...(event === "message.failed" ? { error: str(data.error) || "Failed at the gateway" } : {}) } });
    }
    return NextResponse.json({ ok: true });
  }

  if (event === "message.received") {
    const fromMe = data.fromMe === true;
    const chatId = str(data.from) || str(data.chatId);
    const phone = str(data.senderPhone).replace(/\D/g, "") || phoneFromChatId(chatId);
    const text = str(data.body) || str(data.text) || (data.hasMedia ? "[media]" : "");
    if (fromMe || !phone || chatId.endsWith("@g.us")) return NextResponse.json({ ok: true });
    // Attach the reply to the customer's latest job so it shows in that job's WhatsApp log.
    const job = await prisma.job.findFirst({
      where: { deletedAt: null, client: { phone: { endsWith: phone.slice(-10) } } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, jobNumber: true, client: { select: { name: true } } },
    });
    await prisma.whatsAppMessage.create({
      data: { direction: "IN", kind: "inbound", phone, chatId: chatId || `${phone}@c.us`, body: text.slice(0, 4000), status: "received", providerId: str(data.id) || null, jobId: job?.id ?? null },
    });
    await broadcastNotification({
      type: "JOB_UPDATED",
      title: `WhatsApp reply from ${job?.client?.name ?? phone}`,
      message: `${text.slice(0, 140)}${job ? ` (job ${job.jobNumber ?? ""})` : ""}`,
      actionUrl: job ? `/jobs/details/${job.id}` : "/settings?section=whatsapp",
      entityId: job?.id,
      entityType: "job",
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: event });
}
