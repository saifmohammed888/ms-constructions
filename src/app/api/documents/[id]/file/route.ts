import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/schema";
import { downloadDriveFile } from "@/lib/google";
import { jsonError } from "@/lib/http";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/**
 * Best-effort content type. Some mobile uploads arrive without a type (or as
 * application/octet-stream), which makes `<img>` render broken, so we fall back
 * to the file extension before giving up on octet-stream.
 */
function contentTypeFor(stored: string | null, name: string) {
  const cleaned = (stored || "").toLowerCase().trim();
  if (cleaned && !cleaned.startsWith("application/octet-stream")) return cleaned;
  const ext = /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase() ?? "";
  return EXTENSION_MIME[ext] ?? cleaned ?? "application/octet-stream";
}

export async function GET(req: NextRequest, ctx: Ctx) {
  // An <img> tag cannot show JSON errors, so guard auth with a plain 401 too.
  if (!(await getSession())) return jsonError("Unauthorized", 401);

  const { id } = await ctx.params;
  // Invalid ids would make Postgres throw on the uuid cast, surfacing as a 500.
  if (!UUID_RE.test(id)) return jsonError("Not found", 404);

  const db = await getDb();
  const [existing] = await db.select().from(documents).where(eq(documents.id, id));
  if (!existing) return jsonError("Not found", 404);

  try {
    const file = await downloadDriveFile(existing.driveFileId);
    const disposition = req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
    const safeName = existing.name.replace(/["\r\n]/g, "_");
    const contentType = contentTypeFor(file.mimeType || existing.mimeType, existing.name);
    // Uploads to Drive keep the new file private, so bytes always come through here.
    // Images can be cached briefly to make Work Log grids snappy on mobile.
    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(file.buffer.byteLength),
        "Content-Disposition": `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(existing.name)}`,
        "Cache-Control": contentType.startsWith("image/") ? "private, max-age=3600" : "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    // Never bubble an unhandled error: the Work Log renders an error state from
    // a 4xx/5xx response instead of a broken image.
    console.error("Document file fetch failed", id, err);
    const msg = err instanceof Error ? err.message : "Could not open file";
    return jsonError(msg.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]"), 502);
  }
}
