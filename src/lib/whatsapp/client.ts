import "server-only";
import type { WhatsAppConfig } from "./config";

/** Thin client for the OpenWA REST API (https://github.com/rmyndharis/OpenWA). */
type Gateway = Pick<WhatsAppConfig, "gatewayUrl" | "sessionId" | "apiKey">;

export class GatewayError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function call<T>(g: Gateway, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${g.gatewayUrl}/api${path}`, {
      method,
      headers: { "X-API-Key": g.apiKey, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : text) || `HTTP ${res.status}`;
      throw new GatewayError(Array.isArray(msg) ? msg.join(", ") : msg, res.status);
    }
    return data as T;
  } catch (e) {
    if (e instanceof GatewayError) throw e;
    throw new GatewayError(e instanceof Error && e.name === "AbortError" ? "The gateway did not answer within 15 seconds" : `Could not reach the gateway: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

export interface SessionInfo {
  id: string;
  name?: string;
  /** created | initializing | qr_ready | authenticating | ready | disconnected | action_required | failed */
  status: string;
  phone?: string | null;
  pushName?: string | null;
  lastError?: string | null;
}

export const getSession = (g: Gateway) => call<SessionInfo>(g, "GET", `/sessions/${encodeURIComponent(g.sessionId)}`);

export const sendText = (g: Gateway, chatId: string, text: string) =>
  call<{ messageId?: string; id?: string; timestamp?: number }>(g, "POST", `/sessions/${encodeURIComponent(g.sessionId)}/messages/send-text`, { chatId, text: text.slice(0, 4096) });

export const checkNumber = (g: Gateway, phone: string) =>
  call<{ exists: boolean; whatsappId?: string }>(g, "GET", `/sessions/${encodeURIComponent(g.sessionId)}/contacts/check/${encodeURIComponent(phone)}`);

export interface WebhookInfo { id: string; url: string; events: string[]; active?: boolean }

export const listWebhooks = (g: Gateway) => call<WebhookInfo[] | { items?: WebhookInfo[]; data?: WebhookInfo[] }>(g, "GET", `/sessions/${encodeURIComponent(g.sessionId)}/webhooks`);

export const registerWebhook = (g: Gateway, url: string, secret: string) =>
  call<WebhookInfo>(g, "POST", `/sessions/${encodeURIComponent(g.sessionId)}/webhooks`, {
    url,
    secret,
    events: ["message.received", "message.ack", "message.failed", "session.status"],
    retryCount: 3,
  });
