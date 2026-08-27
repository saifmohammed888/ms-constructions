import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/schema";
import { refreshThumbnail } from "@/lib/google";
import { jsonError } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  const [existing] = await db.select().from(documents).where(eq(documents.id, id));
  if (!existing) return jsonError("Not found", 404);
  const meta = await refreshThumbnail(existing.driveFileId);
  const [row] = await db
    .update(documents)
    .set({
      thumbnailUrl: meta?.thumbnailLink || existing.thumbnailUrl,
      webViewLink: meta?.webViewLink || existing.webViewLink,
    })
    .where(eq(documents.id, id))
    .returning();
  return NextResponse.json(row);
}
