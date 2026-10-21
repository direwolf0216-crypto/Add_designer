import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { HttpError, forbidden, parseJson, route } from "@/lib/api/http";
import { requireUser, userCan } from "@/lib/auth/session";
import { REAUTH_REQUIRED, folderCachePrefix, getGoogleDriveToken } from "@/lib/googleDriveAuth";

const bodySchema = z.object({
  fileId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/, "Invalid fileId"),
});

/** Makes a Drive file "anyone with the link can view" so teammates can open it. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const { fileId } = await parseJson(req, bodySchema);
  const accessToken = await getGoogleDriveToken(user);
  const auth = { Authorization: `Bearer ${accessToken}` };

  const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,parents`, {
    headers: auth,
  });
  if (metaRes.status === 401) throw new HttpError(401, REAUTH_REQUIRED);
  if (!metaRes.ok) throw new HttpError(404, "File not found in your Google Drive");
  const meta = (await metaRes.json()) as { parents?: string[] };

  // Files inside this user's app folders were uploaded through the app; anything else needs manage_jobs.
  const appFolders = await prisma.systemSetting.findMany({
    where: { key: { startsWith: folderCachePrefix(user.id) } },
    select: { value: true },
  });
  const appFolderIds = new Set(appFolders.map((f) => f.value).filter((v): v is string => typeof v === "string"));
  const inAppFolder = (meta.parents ?? []).some((p) => appFolderIds.has(p));
  if (!inAppFolder && !(await userCan(user, "manage_jobs"))) {
    throw forbidden("You do not have permission to share this file");
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  if (!response.ok) {
    console.error("[google-drive] share failed", { status: response.status });
    throw new HttpError(response.status === 403 || response.status === 404 ? response.status : 502, "Failed to share file");
  }

  return NextResponse.json({ success: true });
});
