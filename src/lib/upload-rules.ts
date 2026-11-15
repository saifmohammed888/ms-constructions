import { TZ } from "@/lib/constants";

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

/** Camera and phone names carry no information; anything else is the owner's own name. */
const GENERIC_STEM = /^(img|dsc|dscn|pxl|image|photo|screenshot|whatsapp image|received|download)?[\s_()-]*\d*$/i;

/** Current time in India as YYYY-MM-DD_HHMM, the start of the library naming convention. */
export function uploadStamp(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}_${part("hour")}${part("minute")}`;
}

/**
 * Give a generic camera file a readable name, e.g. IMG_1184.jpeg becomes
 * 2026-11-15_1542_photos_IMG_1184.jpg. Names the owner chose are left alone.
 */
export function friendlyFileName(name: string, category: string, stamp: string) {
  const ext = extensionOf(name);
  const stem = name.replace(/\.[^.]+$/, "").trim();
  if (!stem || !GENERIC_STEM.test(stem)) return name;
  const safeStem = stem.replace(/\s+/g, "-");
  return `${stamp}_${category}_${safeStem}${ext ? `.${ext}` : ""}`;
}
