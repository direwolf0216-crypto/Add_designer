import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import prisma from "@/lib/prisma";

/**
 * Google Cloud credentials for the Drive integration. Admins enter them in Settings → Google Drive and
 * they live in SystemSetting (the client secret encrypted), so no environment variables are needed.
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / NEXT_PUBLIC_GOOGLE_* still work as a fallback.
 */
export type GoogleCredentials = {
  clientId: string;
  clientSecret: string;
  /** Browser key for the Google Picker (optional; the picker falls back to the OAuth token alone). */
  apiKey: string;
  /** Google Cloud project number, shown to the Picker as its app id (optional). */
  appId: string;
  source: "settings" | "env" | "none";
};

export const GOOGLE_SETTING_KEYS = {
  clientId: "google_oauth_client_id",
  clientSecret: "google_oauth_client_secret",
  apiKey: "google_api_key",
  appId: "google_app_id",
} as const;
const ALL_KEYS = Object.values(GOOGLE_SETTING_KEYS);

type Sealed = { v: 1; iv: string; tag: string; data: string };

function sealKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required to store Google credentials");
  return createHash("sha256").update(`google-credentials:${secret}`).digest();
}

export function seal(plain: string): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

export function unseal(sealed: unknown): string | null {
  const s = sealed as Sealed | null;
  if (!s || s.v !== 1 || !s.iv || !s.tag || !s.data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", sealKey(), Buffer.from(s.iv, "base64"));
    decipher.setAuthTag(Buffer.from(s.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(s.data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function fromEnv(): GoogleCredentials {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  return {
    clientId,
    clientSecret,
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "",
    appId: process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? "",
    source: clientId && clientSecret ? "env" : "none",
  };
}

/** Saved credentials first, then the environment. Never throws: a missing database yields the env values. */
export async function getGoogleCredentials(): Promise<GoogleCredentials> {
  const env = fromEnv();
  try {
    const rows = await prisma.systemSetting.findMany({ where: { key: { in: ALL_KEYS } } });
    const str = (key: string) => {
      const v = rows.find((r) => r.key === key)?.value;
      return typeof v === "string" ? v.trim() : "";
    };
    const clientId = str(GOOGLE_SETTING_KEYS.clientId);
    const clientSecret = unseal(rows.find((r) => r.key === GOOGLE_SETTING_KEYS.clientSecret)?.value) ?? "";
    if (clientId && clientSecret) {
      return {
        clientId,
        clientSecret,
        apiKey: str(GOOGLE_SETTING_KEYS.apiKey) || env.apiKey,
        appId: str(GOOGLE_SETTING_KEYS.appId) || env.appId,
        source: "settings",
      };
    }
  } catch {
    // Fall through to the environment.
  }
  return env;
}

export async function saveGoogleCredentials(input: { clientId: string; clientSecret?: string; apiKey: string; appId: string }) {
  const writes = [
    prisma.systemSetting.upsert({ where: { key: GOOGLE_SETTING_KEYS.clientId }, update: { value: input.clientId }, create: { key: GOOGLE_SETTING_KEYS.clientId, value: input.clientId } }),
    prisma.systemSetting.upsert({ where: { key: GOOGLE_SETTING_KEYS.apiKey }, update: { value: input.apiKey }, create: { key: GOOGLE_SETTING_KEYS.apiKey, value: input.apiKey } }),
    prisma.systemSetting.upsert({ where: { key: GOOGLE_SETTING_KEYS.appId }, update: { value: input.appId }, create: { key: GOOGLE_SETTING_KEYS.appId, value: input.appId } }),
  ];
  // An empty secret keeps the one already saved, so admins can edit the other fields without re-pasting it.
  if (input.clientSecret) {
    const sealed = seal(input.clientSecret) as unknown as Record<string, string | number>;
    writes.push(prisma.systemSetting.upsert({ where: { key: GOOGLE_SETTING_KEYS.clientSecret }, update: { value: sealed }, create: { key: GOOGLE_SETTING_KEYS.clientSecret, value: sealed } }));
  }
  await prisma.$transaction(writes);
}

export async function clearGoogleCredentials() {
  await prisma.systemSetting.deleteMany({ where: { key: { in: ALL_KEYS } } });
}

/** The OAuth redirect URI to register in Google Cloud for this deployment. */
export function googleRedirectUri(requestUrl: string): string {
  const base = process.env.NEXTAUTH_URL || new URL(requestUrl).origin;
  return `${base.replace(/\/$/, "")}/api/auth/callback/google-drive`;
}
