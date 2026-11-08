/**
 * Helpers for importing a photo from a public image URL (e.g. a Google Photos
 * shared-album image on lh3.googleusercontent.com) into project documents.
 *
 * Only an allow-list of image hosts is accepted so the server can't be used to
 * fetch arbitrary internal or third-party URLs (SSRF).
 */

export const IMPORT_ALLOWED_HOSTS = ["googleusercontent.com", "ggpht.com"] as const;

export const IMPORT_MAX_BYTES = 15 * 1024 * 1024;

export const IMPORT_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
] as const;

export type ImportUrlCheck = { ok: true; url: URL } | { ok: false; error: string };

export function checkImportUrl(raw: unknown): ImportUrlCheck {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "Provide an image url" };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: "That url is not valid" };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Only https urls can be imported" };
  if (url.username || url.password) return { ok: false, error: "Urls with credentials are not allowed" };
  if (url.port && url.port !== "443") return { ok: false, error: "Custom ports are not allowed" };
  const host = url.hostname.toLowerCase();
  const allowed = IMPORT_ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  if (!allowed) return { ok: false, error: `Only images from ${IMPORT_ALLOWED_HOSTS.join(", ")} can be imported` };
  return { ok: true, url };
}

/** Normalise a content-type header to a bare MIME type, or null if it isn't an allowed image. */
export function allowedImageMime(contentType: string | null | undefined): string | null {
  const mime = (contentType || "").split(";")[0].trim().toLowerCase();
  return (IMPORT_ALLOWED_MIME as readonly string[]).includes(mime) ? mime : null;
}

/** Tag used to make imports idempotent: same source key → same document. */
export function sourceTag(sourceKey: unknown): string | null {
  if (typeof sourceKey !== "string") return null;
  const clean = sourceKey.trim().replace(/[^A-Za-z0-9_\-:.]/g, "").slice(0, 120);
  return clean ? `src:${clean}` : null;
}

export function parseTags(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
  return list
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 20);
}
