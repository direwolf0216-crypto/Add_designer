import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { HttpError, badRequest, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";
import { folderCachePrefix, getGoogleDriveToken, getOrCreateFolder } from "@/lib/googleDriveAuth";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
// Multipart framing and the small text fields on top of the file itself.
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 512 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
};
const ALLOWED_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

/** Strip anything that could break out of a header/JSON line or a Drive query, and bound the length. */
function cleanName(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[\u0000-\u001f\u007f"'\\]/g, "").trim().slice(0, max);
  return cleaned || fallback;
}

/** dd-mm-yyyy in IST, matching the folder names already in users' Drives. */
function todayFolderName(): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date())
    .replace(/\//g, "-");
}

function resolveMimeType(file: File): string {
  const declared = file.type.split(";")[0].trim().toLowerCase();
  if (declared) return declared;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "";
}

export const POST = route(async (req) => {
  const user = await requireUser();

  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new HttpError(413, "File exceeds the 20MB limit");
  }

  const accessToken = await getGoogleDriveToken(user);

  const formData = await req.formData().catch(() => {
    throw badRequest("Expected multipart form data");
  });
  const file = formData.get("file");
  if (!(file instanceof File)) throw badRequest("No file uploaded");
  if (file.size === 0) throw badRequest("File is empty");
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "File exceeds the 20MB limit");

  const mimeType = resolveMimeType(file);
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new HttpError(415, "This file type is not allowed");

  const fileName = cleanName(file.name, "upload", 200);
  const moduleName = cleanName(formData.get("module"), "Uncategorized", 100);
  const categoryName = cleanName(formData.get("category"), "Uncategorized", 100);
  const dateStr = cleanName(formData.get("date"), "", 40) || todayFolderName();

  const getFolders = async () => {
    const rootFid = await getOrCreateFolder("Add designer", null, accessToken, user.id);
    const modFid = await getOrCreateFolder(moduleName, rootFid, accessToken, user.id);
    const catFid = await getOrCreateFolder(categoryName, modFid, accessToken, user.id);
    return getOrCreateFolder(dateStr, catFid, accessToken, user.id);
  };

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const boundary = `----kp${randomBytes(16).toString("hex")}`;

  const buildBody = (folderId: string) => {
    const metadata = { name: fileName, mimeType, parents: [folderId] };
    const head =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`;
    return Buffer.concat([Buffer.from(head, "utf8"), fileBuffer, Buffer.from(`\r\n--${boundary}--\r\n`, "utf8")]);
  };

  const upload = (folderId: string) =>
    fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,iconLink", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: buildBody(folderId),
    });

  let uploadRes = await upload(await getFolders());

  // A cached folder was deleted in Drive: forget this user's folder cache and rebuild the path once.
  if (uploadRes.status === 404) {
    await prisma.systemSetting.deleteMany({ where: { key: { startsWith: folderCachePrefix(user.id) } } });
    uploadRes = await upload(await getFolders());
  }

  if (!uploadRes.ok) {
    console.error("[google-drive] upload failed", { status: uploadRes.status });
    if (uploadRes.status === 401) throw new HttpError(401, "reauth_required");
    throw new HttpError(502, "Failed to upload file to Google Drive");
  }

  const uploaded = (await uploadRes.json()) as { id: string; name: string; webViewLink?: string; iconLink?: string };

  // Attachments are opened by teammates whose own Drive tokens (drive.file scope) can't see this
  // file, so keep the existing "anyone with the link can view" behaviour. Set
  // DRIVE_LINK_SHARING=private to keep uploads private to the uploader instead.
  if (process.env.DRIVE_LINK_SHARING !== "private") {
    const shareRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploaded.id)}/permissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });
    if (!shareRes.ok) console.error("[google-drive] link sharing failed", { status: shareRes.status });
  }

  return NextResponse.json({
    id: uploaded.id,
    name: uploaded.name,
    url: uploaded.webViewLink,
    iconUrl: uploaded.iconLink,
  });
});
