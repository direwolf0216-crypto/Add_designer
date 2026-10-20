import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { HttpError, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";
import { getGoogleDriveAccess } from "@/lib/googleDriveAuth";

export const GET = route(async () => {
  const user = await requireUser();

  let accessToken: string;
  try {
    ({ accessToken } = await getGoogleDriveAccess(user));
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return NextResponse.json({ connected: false });
    if (error instanceof HttpError && error.status === 401) {
      return NextResponse.json({ connected: false, reauthRequired: true });
    }
    throw error;
  }

  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId: user.id, provider: "google-drive" } },
    select: { connectedEmail: true },
  });
  let email = integration?.connectedEmail || "Connected Account";

  if (!integration?.connectedEmail) {
    try {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userInfoRes.ok) {
        const userInfo = (await userInfoRes.json()) as { email?: string };
        if (userInfo.email) email = userInfo.email;
      } else if (userInfoRes.status === 401) {
        return NextResponse.json({ connected: false, reauthRequired: true });
      }
    } catch {
      // Display-only lookup; the connection itself is still valid.
    }
  }

  return NextResponse.json({ connected: true, email });
});

export const DELETE = route(async () => {
  const user = await requireUser();

  const account = await prisma.account.findFirst({
    where: { userId: user.id, provider: "google-drive" },
    select: { access_token: true, refresh_token: true },
  });

  // Revoking the refresh token revokes the whole grant; fall back to the access token.
  const token = account?.refresh_token || account?.access_token;
  if (token) {
    try {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      });
    } catch (error) {
      console.error("[google-drive] token revoke failed", error instanceof Error ? error.name : "unknown");
    }
  }

  await prisma.$transaction([
    prisma.account.deleteMany({ where: { userId: user.id, provider: "google-drive" } }),
    prisma.userIntegration.deleteMany({ where: { userId: user.id, provider: "google-drive" } }),
  ]);

  return NextResponse.json({ success: true });
});
