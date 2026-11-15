import sharp from "sharp";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

type AppDb = Awaited<ReturnType<typeof getDb>>;

// Large enough to read a drawing thumbnail on a phone, small enough that a
// grid of hundreds loads in a few seconds.
const THUMB_SIZE = 480;

/** A small WebP preview. Rotation follows the phone's EXIF orientation. */
export async function makeThumbnail(input: Buffer) {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
}

export async function saveThumbnail(db: AppDb, documentId: string, data: Buffer) {
  await db.execute(sql`
    INSERT INTO document_thumbnails (document_id, mime_type, data)
    VALUES (${documentId}::uuid, 'image/webp', ${data})
    ON CONFLICT (document_id) DO UPDATE SET data = EXCLUDED.data, created_at = now()
  `);
}

export async function loadThumbnail(db: AppDb, documentId: string) {
  const result = await db.execute(sql`SELECT data, mime_type FROM document_thumbnails WHERE document_id = ${documentId}::uuid`);
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as { data: Uint8Array; mime_type: string }[];
  return rows[0] ? { data: Buffer.from(rows[0].data), mime: rows[0].mime_type } : null;
}
