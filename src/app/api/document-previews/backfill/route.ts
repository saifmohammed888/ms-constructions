import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { downloadDriveFile } from "@/lib/google";
import { getSession } from "@/lib/session";
import { heicToJpeg, HEIC_TYPES } from "@/lib/heic";
import { makeThumbnail, saveThumbnail } from "@/lib/thumbnails";
import { route } from "@/lib/http";

export const runtime = "nodejs";
// Each call downloads a small batch from Drive, so give it room.
export const maxDuration = 60;

const BATCH = 10;
const IMAGE_NAME = "[.](jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?)$";

type Row = Record<string, unknown>;
function rowsOf(result: unknown): Row[] {
  return (Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])) as Row[];
}

/**
 * Creates previews for photos uploaded before previews existed. Call it again
 * while `remaining` is above 0. Files that fail are left as they are and counted.
 */
export const POST = route(async () => {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const pending = rowsOf(await db.execute(sql`
    SELECT d.id, d.drive_file_id AS "driveFileId", d.name, d.mime_type AS "mimeType"
    FROM documents d
    WHERE NOT EXISTS (SELECT 1 FROM document_thumbnails t WHERE t.document_id = d.id)
      AND (d.mime_type LIKE 'image/%' OR d.name ~* ${IMAGE_NAME})
    ORDER BY d.uploaded_at DESC
    LIMIT ${BATCH}
  `)) as { id: string; driveFileId: string; name: string; mimeType: string | null }[];

  let processed = 0;
  let failed = 0;
  for (const doc of pending) {
    try {
      const file = await downloadDriveFile(doc.driveFileId);
      const isHeic = HEIC_TYPES.has((doc.mimeType ?? "").toLowerCase()) || /\.(heic|heif)$/i.test(doc.name);
      const source = isHeic ? await heicToJpeg(file.buffer) : file.buffer;
      await saveThumbnail(db, doc.id, await makeThumbnail(source));
      processed += 1;
    } catch (err) {
      failed += 1;
      console.error("Preview backfill failed for", doc.id, err);
    }
  }
  const [left] = rowsOf(await db.execute(sql`
    SELECT count(*)::int AS n FROM documents d
    WHERE NOT EXISTS (SELECT 1 FROM document_thumbnails t WHERE t.document_id = d.id)
      AND (d.mime_type LIKE 'image/%' OR d.name ~* ${IMAGE_NAME})
  `));
  return NextResponse.json({ processed, failed, remaining: Number(left?.n ?? 0) }, { headers: { "Cache-Control": "no-store" } });
});
