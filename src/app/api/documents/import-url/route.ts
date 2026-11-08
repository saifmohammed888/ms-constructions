import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/schema";
import { jsonError } from "@/lib/http";
import { uploadDriveFile } from "@/lib/google";
import { DOC_CATEGORIES, type DocCategory } from "@/lib/constants";
import { getSession } from "@/lib/session";
import {
  IMPORT_MAX_BYTES,
  allowedImageMime,
  checkImportUrl,
  parseTags,
  sourceTag,
} from "@/lib/import-url";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  url?: unknown;
  name?: unknown;
  category?: unknown;
  tags?: unknown;
  /** Stable id of the source photo (e.g. Google Photos item id). Makes the import idempotent. */
  sourceKey?: unknown;
};

function cleanName(raw: unknown, mime: string) {
  const ext = mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1] || "jpg";
  const base = (typeof raw === "string" ? raw : "")
    .trim()
    .replace(/[\\/:*?"<>|\r\n]+/g, "-")
    .slice(0, 150);
  if (!base) return `import-${Date.now()}.${ext}`;
  return /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}.${ext}`;
}

/**
 * POST /api/documents/import-url
 * Body: { url, name?, category?, tags?: string[] | "a,b", sourceKey? }
 * Fetches an allow-listed public image server-side, stores it in Drive and
 * creates a documents row (same shape as /api/documents/upload).
 * If a document already carries the same `src:<sourceKey>` tag it is returned
 * unchanged with `{ duplicate: true }`.
 */
export async function POST(req: NextRequest) {
  if (!(await getSession())) return jsonError("Unauthorized", 401);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError("Send JSON: { url, name, category, tags, sourceKey }");
  }

  const check = checkImportUrl(body.url);
  if (!check.ok) return jsonError(check.error);

  const categoryRaw = String(body.category || "photos");
  const category = (DOC_CATEGORIES as readonly string[]).includes(categoryRaw)
    ? (categoryRaw as DocCategory)
    : "misc";
  const srcTag = sourceTag(body.sourceKey);
  const tags = [...new Set([...parseTags(body.tags), ...(srcTag ? [srcTag] : [])])];

  const db = await getDb();

  if (srcTag) {
    const [existing] = await db
      .select()
      .from(documents)
      .where(sql`${srcTag} = ANY(${documents.tags})`)
      .limit(1);
    if (existing) {
      return NextResponse.json({ ...existing, duplicate: true }, { headers: { "Cache-Control": "no-store" } });
    }
  }

  let res: Response;
  try {
    res = await fetch(check.url, {
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: "image/*" },
    });
  } catch {
    return jsonError("Could not download the image (timeout or network error)", 502);
  }
  if (!res.ok) return jsonError(`Image host answered ${res.status}`, 502);

  const mimeType = allowedImageMime(res.headers.get("content-type"));
  if (!mimeType) return jsonError("The url did not return a supported image");

  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > IMPORT_MAX_BYTES) return jsonError("Image is larger than 15 MB");

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) return jsonError("The image was empty");
  if (buffer.length > IMPORT_MAX_BYTES) return jsonError("Image is larger than 15 MB");

  const name = cleanName(body.name, mimeType);

  try {
    const meta = await uploadDriveFile({ name, mimeType, buffer, category });
    if (!meta.id) return jsonError("Upload failed: Drive did not return a file id");
    const [row] = await db
      .insert(documents)
      .values({
        name: meta.name || name,
        driveFileId: meta.id,
        thumbnailUrl: meta.thumbnailLink || null,
        webViewLink: meta.webViewLink || null,
        mimeType: meta.mimeType || mimeType,
        sizeBytes: meta.size ? Number(meta.size) : buffer.length,
        category,
        tags,
      })
      .returning();
    return NextResponse.json(row, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Document import failed", err);
    const msg = err instanceof Error ? err.message : "Import failed";
    return jsonError(msg.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]"), 400);
  }
}
