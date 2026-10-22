import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import { clearGoogleCredentials, getGoogleCredentials, googleRedirectUri, saveGoogleCredentials } from "@/lib/google/credentials";

export const dynamic = "force-dynamic";

const mask = (s: string) => (s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s ? "••••••" : "");

/** Settings → Google Drive → Google Cloud setup. Admins only; the client secret is never sent back. */
export const GET = route(async (req) => {
  await requireAdmin();
  const c = await getGoogleCredentials();
  return NextResponse.json({
    configured: c.source !== "none",
    source: c.source,
    clientId: c.clientId,
    hasSecret: Boolean(c.clientSecret),
    secretHint: mask(c.clientSecret),
    apiKey: c.apiKey,
    appId: c.appId,
    redirectUri: googleRedirectUri(req.url),
  });
});

const bodySchema = z.object({
  clientId: z.string().trim().min(10).max(200).regex(/\.apps\.googleusercontent\.com$/, "Client IDs end with .apps.googleusercontent.com"),
  clientSecret: z.string().trim().max(200).optional().default(""),
  apiKey: z.string().trim().max(200).optional().default(""),
  appId: z.string().trim().max(64).regex(/^\d*$/, "The app id is the numeric project number").optional().default(""),
});

export const PUT = route(async (req) => {
  await requireAdmin();
  const body = await parseJson(req, bodySchema);
  const current = await getGoogleCredentials();
  if (!body.clientSecret && !(current.source === "settings" && current.clientSecret)) {
    return NextResponse.json({ error: "Paste the client secret from Google Cloud" }, { status: 400 });
  }
  await saveGoogleCredentials(body);
  return NextResponse.json({ success: true });
});

export const DELETE = route(async () => {
  await requireAdmin();
  await clearGoogleCredentials();
  return NextResponse.json({ success: true });
});
