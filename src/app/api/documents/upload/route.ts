import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/schema";
import { jsonError } from "@/lib/http";
import { uploadDriveFile } from "@/lib/google";
import { DOC_CATEGORIES, type DocCategory } from "@/lib/constants";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const categoryRaw = String(form.get("category") || "misc");
  const tagsRaw = String(form.get("tags") || "");
  if (!(file instanceof File)) return jsonError("Choose a file");
  if (file.size > 50 * 1024 * 1024) return jsonError("File must be under 50 MB");
  const category = (DOC_CATEGORIES as readonly string[]).includes(categoryRaw)
    ? (categoryRaw as DocCategory)
    : "misc";
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const meta = await uploadDriveFile({
      name: file.name,
      mimeType: file.type,
      buffer,
      category,
    });
    const db = await getDb();
    const [row] = await db
      .insert(documents)
      .values({
        name: meta.name || file.name,
        driveFileId: meta.id!,
        thumbnailUrl: meta.thumbnailLink || null,
        webViewLink: meta.webViewLink || null,
        mimeType: meta.mimeType || file.type,
        sizeBytes: meta.size ? Number(meta.size) : file.size,
        category,
        tags: tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      })
      .returning();
    return NextResponse.json(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return jsonError(msg, 400);
  }
}
