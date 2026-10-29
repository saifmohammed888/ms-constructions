import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/schema";
import { jsonError } from "@/lib/http";
import { uploadDriveFile } from "@/lib/google";
import { DOC_CATEGORIES, type DocCategory } from "@/lib/constants";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
// Phone photos can be several MB; allow a generous body while still capping it.
export const maxDuration = 60;

const MAX_BYTES = 50 * 1024 * 1024;

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
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function cleanName(raw: string, mimeType: string) {
  const base = (raw || "").trim().replace(/[\\/:*?"<>|\r\n]+/g, "-");
  const ext = /\.([a-z0-9]+)$/i.exec(base)?.[1]?.toLowerCase() ?? "";
  if (!base) {
    const mimeExt = mimeType.split("/")[1]?.split("+")[0] ?? "file";
    return `upload-${Date.now()}.${mimeExt}`;
  }
  if (!ext) {
    const mimeExt = mimeType.split("/")[1]?.split("+")[0];
    if (mimeExt) return `${base}.${mimeExt}`;
  }
  return base;
}

/** Mobile cameras sometimes omit or blank the MIME type; fall back to the extension. */
function resolveMimeType(file: File, name: string) {
  const declared = (file.type || "").toLowerCase().trim();
  if (declared && !declared.startsWith("application/octet-stream")) return declared;
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "";
  return EXTENSION_MIME[ext] ?? declared ?? "application/octet-stream";
}

export async function POST(req: NextRequest) {
  if (!(await getSession())) return jsonError("Unauthorized", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Could not read the upload. Try the photo again.");
  }

  const file = form.get("file");
  const categoryRaw = String(form.get("category") || "misc");
  const tagsRaw = String(form.get("tags") || "");
  if (!(file instanceof File)) return jsonError("Choose a file");
  if (file.size === 0) return jsonError("That file looks empty. Try taking the photo again.");
  if (file.size > MAX_BYTES) return jsonError("File must be under 50 MB");

  const category = (DOC_CATEGORIES as readonly string[]).includes(categoryRaw)
    ? (categoryRaw as DocCategory)
    : "misc";
  const name = cleanName(file.name, file.type);
  const mimeType = resolveMimeType(file, name);
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const meta = await uploadDriveFile({ name, mimeType, buffer, category });
    if (!meta.id) return jsonError("Upload failed: Drive did not return a file id");
    const db = await getDb();
    const [row] = await db
      .insert(documents)
      .values({
        name: meta.name || name,
        driveFileId: meta.id,
        thumbnailUrl: meta.thumbnailLink || null,
        webViewLink: meta.webViewLink || null,
        mimeType: meta.mimeType || mimeType,
        sizeBytes: meta.size ? Number(meta.size) : file.size,
        category,
        tags: tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      })
      .returning();
    return NextResponse.json(row, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Document upload failed", err);
    const msg = err instanceof Error ? err.message : "Upload failed";
    return jsonError(msg.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]"), 400);
  }
}
