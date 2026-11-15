/**
 * Upload limits shared by the browser and the server, so a file that the phone
 * accepts is never rejected later by the API, and vice versa.
 */

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const ALLOWED_MIME_TYPES = new Set(Object.values(EXTENSION_MIME));

export function extensionOf(name: string) {
  return /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase() ?? "";
}

/**
 * Mobile cameras and some file managers send an empty or generic MIME type.
 * Prefer the extension in that case, then the declared type.
 */
export function resolveMimeType(declared: string | null | undefined, name: string) {
  const type = (declared || "").toLowerCase().trim();
  if (type && !type.startsWith("application/octet-stream")) return type;
  return EXTENSION_MIME[extensionOf(name)] ?? (type || "application/octet-stream");
}

/** Returns a user-facing problem with the file, or null when it can be uploaded. */
export function uploadProblem(file: { size: number; name: string; type: string }) {
  if (file.size === 0) return "That file is empty. Try again.";
  if (file.size > MAX_UPLOAD_BYTES) return "File must be under 50 MB.";
  const mime = resolveMimeType(file.type, file.name);
  if (!ALLOWED_MIME_TYPES.has(mime)) return "This file type is not supported. Use a photo, PDF, Word or Excel file.";
  return null;
}
