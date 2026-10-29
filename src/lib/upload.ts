/**
 * Upload helpers shared by every photo / file picker in the app.
 *
 * Mobile browsers are picky about photo uploads:
 * - Phone cameras often name files `image.jpg` or leave the name empty, and the
 *   MIME type can be empty or `application/octet-stream`. We backfill a real
 *   extension + type so Google Drive stores a viewable image and our previews
 *   (`/api/documents/:id/file`) serve the right Content-Type.
 * - Mobile radios are flaky right after the camera closes, so `uploadDocument`
 *   retries once on a network failure.
 */

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/pdf": "pdf",
};

const EXTENSION_MIME: Record<string, string> = {
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
};

function extensionOf(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match ? match[1].toLowerCase() : "";
}

function extensionForMime(mime: string) {
  return MIME_EXTENSION[mime.toLowerCase()] ?? (mime.toLowerCase().startsWith("image/") ? mime.slice(6).split("+")[0] : "");
}

/**
 * Give camera/gallery output a stable, unique-ish name and a usable MIME type,
 * so uploads don't fail or come back unviewable.
 */
export function normalizeUploadFile(file: File, index = 0): File {
  const rawType = (file.type || "").toLowerCase();
  const baseName = (file.name || "").trim();
  const ext = extensionOf(baseName) || extensionForMime(rawType) || "jpg";
  const mime =
    rawType && !/octet-stream/.test(rawType) ? rawType : (EXTENSION_MIME[ext] ?? "image/jpeg");

  let name = baseName;
  if (!name) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    name = `photo-${stamp}-${index + 1}.${ext}`;
  } else if (!extensionOf(name)) {
    name = `${name}.${ext}`;
  }
  // Keep names URL/Drive friendly.
  name = name.replace(/[\\/:*?"<>|\r\n]+/g, "-");

  if (name === file.name && mime === file.type) return file;

  // Rebuild the File so FormData part headers carry the corrected type/name.
  // Image files from the camera can be a few MB; keep it in memory only.
  const blob = file.slice(0, file.size, mime);
  return new File([blob], name, { type: mime, lastModified: file.lastModified });
}

/** Files reported by an <input type="file"> change event, normalised for upload. */
export function filesFromInput(input: HTMLInputElement | null): File[] {
  return Array.from(input?.files ?? []).map((file, index) => normalizeUploadFile(file, index));
}

export type UploadOutcome<T> = { ok: true; data: T } | { ok: false; file: File; error: string };

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text.slice(0, 200) };
  }
}

function errorMessage(body: unknown, fallback: string) {
  return typeof body === "object" && body && "error" in body && typeof (body as { error?: unknown }).error === "string"
    ? ((body as { error: string }).error || fallback)
    : fallback;
}

/**
 * POST one file to /api/documents/upload.
 *
 * `cache: "no-store"` avoids service-worker / HTTP-cache surprises on mobile, and
 * we retry once on a network failure (mobile radios are flaky right after the
 * camera closes).
 */
export async function uploadDocument<T = unknown>(
  file: File,
  opts: { category?: string; tags?: string; retries?: number } = {},
): Promise<UploadOutcome<T>> {
  const retries = opts.retries ?? 1;
  let lastError = "Upload failed";

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("category", opts.category ?? "misc");
    if (opts.tags) fd.set("tags", opts.tags);

    try {
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd, cache: "no-store" });
      const body = await readJson(res);
      if (!res.ok) return { ok: false, file, error: errorMessage(body, "Upload failed") };
      if (!body || typeof body !== "object") return { ok: false, file, error: "Upload returned no data" };
      return { ok: true, data: body as T };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Upload failed";
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }

  return { ok: false, file, error: lastError };
}

/** Upload many files sequentially (mobile networks don't like parallel bodies). */
export async function uploadDocuments<T = unknown>(
  files: File[],
  opts: { category?: string; tags?: string; onProgress?: (done: number, total: number) => void } = {},
): Promise<{ uploaded: T[]; failed: Array<{ file: File; error: string }> }> {
  const uploaded: T[] = [];
  const failed: Array<{ file: File; error: string }> = [];
  let done = 0;

  for (const raw of files) {
    const file = normalizeUploadFile(raw, done);
    const result = await uploadDocument<T>(file, opts);
    if (result.ok) uploaded.push(result.data);
    else failed.push({ file, error: result.error });
    done += 1;
    opts.onProgress?.(done, files.length);
  }

  return { uploaded, failed };
}
