import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/schema";
import { downloadDriveFile } from "@/lib/google";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  const [existing] = await db.select().from(documents).where(eq(documents.id, id));
  if (!existing) return jsonError("Not found", 404);
  try {
    const file = await downloadDriveFile(existing.driveFileId);
    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.mimeType || existing.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(existing.name)}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not open file";
    return jsonError(msg, 400);
  }
}
