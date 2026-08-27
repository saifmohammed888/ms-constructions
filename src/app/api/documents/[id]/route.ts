import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/schema";
import { documentPatchSchema } from "@/lib/zod-schemas";
import { jsonError } from "@/lib/http";
import { trashDriveFile, refreshThumbnail, resolveCategoryFolder } from "@/lib/google";
import { getDrive } from "@/lib/google";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = documentPatchSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Check the document");
  const db = await getDb();
  const [existing] = await db.select().from(documents).where(eq(documents.id, id));
  if (!existing) return jsonError("Not found", 404);

  if (parsed.data.category && parsed.data.category !== existing.category) {
    try {
      const drive = await getDrive();
      const folder = await resolveCategoryFolder(parsed.data.category);
      if (drive) {
        await drive.files.update({
          fileId: existing.driveFileId,
          addParents: folder,
          fields: "id",
        });
      }
    } catch {
      /* metadata still updates */
    }
  }

  const [row] = await db.update(documents).set(parsed.data).where(eq(documents.id, id)).returning();
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  const [existing] = await db.select().from(documents).where(eq(documents.id, id));
  if (existing) await trashDriveFile(existing.driveFileId);
  await db.delete(documents).where(eq(documents.id, id));
  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  const [existing] = await db.select().from(documents).where(eq(documents.id, id));
  if (!existing) return jsonError("Not found", 404);
  if (!existing.thumbnailUrl) {
    const meta = await refreshThumbnail(existing.driveFileId);
    if (meta?.thumbnailLink) {
      const [row] = await db
        .update(documents)
        .set({ thumbnailUrl: meta.thumbnailLink, webViewLink: meta.webViewLink || existing.webViewLink })
        .where(eq(documents.id, id))
        .returning();
      return NextResponse.json(row);
    }
  }
  return NextResponse.json(existing);
}
