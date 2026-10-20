import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";
import { REAUTH_REQUIRED, getGoogleDriveToken } from "@/lib/googleDriveAuth";

// Never image/svg+xml: SVG can carry script and this response is served from our origin.
const SAFE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_BYTES = 20 * 1024 * 1024;

const fileIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10,200}$/, "Invalid fileId");

export const GET = route(async (req) => {
  const user = await requireUser();
  const fileId = fileIdSchema.parse(new URL(req.url).searchParams.get("fileId") ?? "");
  const accessToken = await getGoogleDriveToken(user);
  const auth = { Authorization: `Bearer ${accessToken}` };

  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,size`,
    { headers: auth }
  );
  if (metaRes.status === 401) throw new HttpError(401, REAUTH_REQUIRED);
  if (!metaRes.ok) {
    throw new HttpError(metaRes.status === 404 || metaRes.status === 403 ? 404 : 502, "Failed to fetch thumbnail");
  }
  const meta = (await metaRes.json()) as { mimeType?: string; size?: string };
  const mimeType = meta.mimeType?.toLowerCase() ?? "";
  if (!SAFE_IMAGE_TYPES.has(mimeType)) throw new HttpError(415, "File is not a supported image");
  if (Number(meta.size) > MAX_BYTES) throw new HttpError(413, "Image is too large");

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: auth });
  if (!response.ok) throw new HttpError(502, "Failed to fetch thumbnail");

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) throw new HttpError(413, "Image is too large");

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=300",
    },
  });
});
