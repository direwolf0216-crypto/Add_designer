import "server-only";
import prisma from "@/lib/prisma";
import { HttpError } from "@/lib/api/http";
import { getGoogleCredentials } from "@/lib/google/credentials";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const FOLDER_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EXPIRY_SKEW_SECONDS = 300;

/** Accepts a user id, a SessionUser, or a NextAuth session (legacy callers). */
type DriveOwner =
  | string
  | { id: string }
  | { user?: { id?: string | null; email?: string | null } | null }
  | null
  | undefined;

function ownerId(owner: DriveOwner): string | null {
  if (!owner) return null;
  if (typeof owner === "string") return owner;
  if ("id" in owner && typeof owner.id === "string") return owner.id;
  if ("user" in owner && typeof owner.user?.id === "string") return owner.user.id;
  return null;
}

/** Thrown messages are stable so callers can branch on them; HttpError lets route() map them directly. */
export const REAUTH_REQUIRED = "reauth_required";
export const NOT_CONNECTED = "No Google Drive account connected";

export type DriveToken = { accessToken: string; expiresAt: number | null };

/** The signed-in user's Drive access token, refreshed when it is within five minutes of expiring. */
export async function getGoogleDriveAccess(owner: DriveOwner): Promise<DriveToken> {
  const userId = ownerId(owner);
  if (!userId) throw new HttpError(401, "Unauthorized");

  const account = await prisma.account.findFirst({
    where: { userId, provider: "google-drive" },
    select: { id: true, access_token: true, refresh_token: true, expires_at: true },
  });
  if (!account?.access_token) throw new HttpError(404, NOT_CONNECTED);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const isExpired = account.expires_at != null && nowSeconds > account.expires_at - EXPIRY_SKEW_SECONDS;
  if (!isExpired) return { accessToken: account.access_token, expiresAt: account.expires_at };

  if (!account.refresh_token) throw new HttpError(401, REAUTH_REQUIRED);

  const { clientId, clientSecret } = await getGoogleCredentials();
  if (!clientId || !clientSecret) {
    console.error("[google-drive] Google Cloud credentials are not configured (Settings → Google Drive)");
    throw new HttpError(503, "Google Drive is not configured");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });
  const tokens = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
  };

  if (!response.ok || !tokens.access_token) {
    if (tokens.error === "invalid_grant") throw new HttpError(401, REAUTH_REQUIRED);
    console.error("[google-drive] token refresh failed", { status: response.status, error: tokens.error });
    throw new HttpError(502, "Could not refresh Google Drive access");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + (Number(tokens.expires_in) || 3600);
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: tokens.access_token,
      expires_at: expiresAt,
      // Google only returns a new refresh token when it rotates it.
      refresh_token: tokens.refresh_token ?? account.refresh_token,
    },
  });

  return { accessToken: tokens.access_token, expiresAt };
}

export async function getGoogleDriveToken(owner: DriveOwner): Promise<string> {
  return (await getGoogleDriveAccess(owner)).accessToken;
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function folderIsUsable(folderId: string, accessToken: string): Promise<boolean> {
  const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(folderId)}?fields=id,trashed`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return false;
  const data = (await res.json().catch(() => null)) as { trashed?: boolean } | null;
  return Boolean(data && !data.trashed);
}

/** Folder ids are cached per user in SystemSetting under `google_drive_folder_<userId>_...`. */
export function folderCachePrefix(userId: string): string {
  return `google_drive_folder_${userId}_`;
}

export async function getOrCreateFolder(
  name: string,
  parentId: string | null,
  accessToken: string,
  userId: string
): Promise<string> {
  const cacheKey = `${folderCachePrefix(userId)}${parentId || "root"}_${name}`;

  const cached = await prisma.systemSetting.findUnique({ where: { key: cacheKey } });
  if (cached && typeof cached.value === "string") {
    const fresh = Date.now() - cached.updatedAt.getTime() < FOLDER_CACHE_TTL_MS;
    if (fresh) return cached.value;
    if (await folderIsUsable(cached.value, accessToken)) {
      // Touch the row to restart the TTL.
      await prisma.systemSetting.upsert({
        where: { key: cacheKey },
        update: { value: cached.value },
        create: { key: cacheKey, value: cached.value },
      });
      return cached.value;
    }
  }

  const parentQuery = parentId ? `'${escapeDriveQuery(parentId)}' in parents` : "'root' in parents";
  const query = `name='${escapeDriveQuery(name)}' and mimeType='${FOLDER_MIME}' and ${parentQuery} and trashed=false`;
  const searchParams = new URLSearchParams({ q: query, spaces: "drive", fields: "files(id)", orderBy: "createdTime" });

  let folderId: string | null = null;
  const searchRes = await fetch(`${DRIVE_API}/files?${searchParams}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (searchRes.ok) {
    const searchData = (await searchRes.json().catch(() => null)) as { files?: { id: string }[] } | null;
    // Oldest first, so concurrent uploads that each created a folder converge on the same one.
    folderId = searchData?.files?.[0]?.id ?? null;
  }

  if (!folderId) {
    const createRes = await fetch(`${DRIVE_API}/files?fields=id`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
    });
    if (!createRes.ok) {
      console.error("[google-drive] folder create failed", { status: createRes.status });
      throw new HttpError(502, "Failed to create Google Drive folder");
    }
    folderId = ((await createRes.json()) as { id: string }).id;
  }

  await prisma.systemSetting.upsert({
    where: { key: cacheKey },
    update: { value: folderId },
    create: { key: cacheKey, value: folderId },
  });

  return folderId;
}
