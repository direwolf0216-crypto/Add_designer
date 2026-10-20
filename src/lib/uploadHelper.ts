export const MAX_DRIVE_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function uploadFileToDrive(file: File | Blob, moduleName: string, categoryName: string = "Uncategorized", dateStr?: string) {
  if (file.size > MAX_DRIVE_UPLOAD_BYTES) {
    throw new Error("File exceeds the 20MB limit");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("module", moduleName);
  formData.append("category", categoryName);

  if (dateStr) {
    formData.append("date", dateStr);
  }

  const res = await fetch("/api/integrations/google/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    if (res.status === 401 || errorData.error === "reauth_required") {
      throw new Error("Your Google Drive connection has expired. Please go to Settings > Integrations to reconnect.");
    }
    if (res.status === 404) {
      throw new Error("Google Drive is not connected. Please go to Settings > Integrations to connect it.");
    }
    throw new Error(errorData.error || "Failed to upload file to Google Drive");
  }

  const data = await res.json();
  return { driveFile: data };
}
