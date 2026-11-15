import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { assertUuid, route } from "@/lib/http";
import { loadThumbnail } from "@/lib/thumbnails";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Small preview image for the grid. The full file stays at /api/documents/:id/file. */
export const GET = route(async (_req: NextRequest, ctx: Ctx) => {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  assertUuid(id);
  const thumb = await loadThumbnail(await getDb(), id);
  if (!thumb) return NextResponse.json({ error: "No preview yet" }, { status: 404 });
  return new NextResponse(new Uint8Array(thumb.data), {
    headers: {
      "Content-Type": thumb.mime,
      "Content-Length": String(thumb.data.byteLength),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
