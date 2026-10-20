import { NextResponse } from "next/server";
import { route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";
import { getGoogleDriveAccess } from "@/lib/googleDriveAuth";

// The Google Picker runs in the browser and needs the user's own OAuth token (drive.file scope).
export const GET = route(async () => {
  const user = await requireUser();
  const { accessToken, expiresAt } = await getGoogleDriveAccess(user);

  return NextResponse.json(
    { accessToken, expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : null },
    { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } }
  );
});
