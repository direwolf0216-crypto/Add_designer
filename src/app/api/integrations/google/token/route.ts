import { NextResponse } from "next/server";
import { route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";
import { getGoogleDriveAccess } from "@/lib/googleDriveAuth";
import { getGoogleCredentials } from "@/lib/google/credentials";

// The Google Picker runs in the browser and needs the user's own OAuth token (drive.file scope).
export const GET = route(async () => {
  const user = await requireUser();
  const { accessToken, expiresAt } = await getGoogleDriveAccess(user);
  const { apiKey, appId } = await getGoogleCredentials();

  return NextResponse.json(
    { accessToken, expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : null, apiKey, appId },
    { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } }
  );
});
