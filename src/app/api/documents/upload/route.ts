import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/schema";
import { jsonError } from "@/lib/http";
import { uploadDriveFile } from "@/lib/google";
import { DOC_CATEGORIES, type DocCategory } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { extensionOf, friendlyFileName, resolveMimeType, uploadProblem, uploadStamp } from "@/lib/upload-rules";
import { HEIC_TYPES, heicToJpeg } from "@/lib/heic";
import { makeThumbnail, saveThumbnail } from "@/lib/thumbnails";

export const runtime = "nodejs";
// Phone photos can be several MB; allow a generous body while still capping it.
export const maxDuration = 60;

/** Keeps the Drive name readable: no path separators, no control characters. */
function cleanName(raw: string, mimeType: string) {
  const base = (raw || "").trim().replace(/[\\/:*?"<>|\r\n]+/g, "-");
  if (!base) return `upload-${Date.now()}.${mimeType.split("/")[1]?.split("+")[0] ?? "file"}`;
  if (!extensionOf(base)) {
    const mimeExt = mimeType.split("/")[1]?.split("+")[0];
    if (mimeExt) return `${base}.${mimeExt}`;
  }
  return base;
}

/** Errors that mean the saved Google connection needs to be set up again. */
const RECONNECT_PATTERN = /invalid_grant|not connected|refresh token|unauthorized_client/i;

export async function POST(req: NextRequest) {
  if (!(await getSession())) return jsonError("Unauthorized", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Could not read the upload. Try the photo again.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Choose a file.");

  const problem = uploadProblem(file);
  if (problem) return jsonError(problem, 413);

  const categoryRaw = String(form.get("category") || "misc");
  const category = (DOC_CATEGORIES as readonly string[]).includes(categoryRaw) ? (categoryRaw as DocCategory) : "misc";
  const tags = String(form.get("tags") || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 50);
  let name = cleanName(file.name, file.type);
  let mimeType = resolveMimeType(file.type, name);
  let buffer: Buffer<ArrayBufferLike> = Buffer.from(await file.arrayBuffer());

  // iPhone photos are HEIC, which most browsers cannot show. Store a JPEG instead.
  if (HEIC_TYPES.has(mimeType) || /\.(heic|heif)$/i.test(name)) {
    try {
      buffer = await heicToJpeg(buffer);
    } catch (err) {
      console.error("HEIC conversion failed", err);
      return jsonError("This HEIC photo could not be converted. Try a JPEG or PNG copy.", 422);
    }
    mimeType = "image/jpeg";
    name = name.replace(/\.(heic|heif)$/i, ".jpg");
  }
  name = friendlyFileName(name, category, uploadStamp());

  try {
    const meta = await uploadDriveFile({ name, mimeType, buffer, category });
    if (!meta.id) return jsonError("Google Drive did not confirm the upload. Try again.", 502);
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
        tags,
      })
      .returning();
    // A missing preview must never fail the upload: the full file still works.
    if (mimeType.startsWith("image/")) {
      try {
        await saveThumbnail(db, row.id, await makeThumbnail(buffer));
      } catch (err) {
        console.error("Thumbnail failed for", row.id, err);
      }
    }
    return NextResponse.json(row, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    // The raw Google error stays in the server log; the user gets a clear next step.
    const raw = err instanceof Error ? err.message : "Upload failed";
    console.error("Document upload failed:", raw);
    if (RECONNECT_PATTERN.test(raw)) {
      return jsonError("Google Drive needs to be reconnected. Open Settings, tap Reconnect Google, then upload again.", 409);
    }
    return jsonError("The upload did not finish. Check your connection and try again.", 502);
  }
}
