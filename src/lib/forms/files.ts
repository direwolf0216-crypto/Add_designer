// File-field values before submit. FileAttachment stores an array: freshly picked File/Blob objects,
// already-uploaded `{ driveFile }` objects, or their serialised/data-URL string forms.

/** Whether a value (the first array item) is something FileAttachment produced. */
export function isFileLikeValue(first: unknown): boolean {
  return (
    first instanceof File ||
    first instanceof Blob ||
    (typeof first === "object" && !!first && !!(first as { driveFile?: unknown }).driveFile) ||
    (typeof first === "string" && (first.startsWith("data:") || first.includes("driveFile")))
  );
}

/** A file field holds at most one attachment: collapse `[file]` to `file`; other values pass through. */
export function collapseFileArray(value: unknown): unknown {
  if (Array.isArray(value) && value.length > 0 && isFileLikeValue(value[0])) return value[0];
  return value;
}

/** A picked file that still has to be uploaded to Drive. */
export function isUploadableFile(value: unknown): value is File | Blob {
  return value instanceof File || value instanceof Blob;
}
