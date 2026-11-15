import { NextRequest, NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/schema";
import { jsonError } from "@/lib/http";
import { DOCUMENT_FILTERS, DUPLICATE, HAS_PREVIEW, LINK_COUNT, documentWhere, type DocumentFilter } from "@/lib/document-queries";

export const runtime = "nodejs";

const MAX_PAGE = 200;
const DEFAULT_PAGE = 60;

/**
 * Without `limit`, returns every matching document as a plain list (used by
 * the pickers). With `limit` and `offset`, returns one page and the total.
 */
export async function GET(req: NextRequest) {
  const db = await getDb();
  const sp = req.nextUrl.searchParams;
  const rawFilter = sp.get("filter") ?? "all";
  const filter = (DOCUMENT_FILTERS as readonly string[]).includes(rawFilter) ? (rawFilter as DocumentFilter) : "all";
  const where = documentWhere({ category: sp.get("category"), q: sp.get("q")?.trim(), filter, stage: sp.get("stage") });

  const shape = (rows: { doc: typeof documents.$inferSelect; linkCount: number; hasPreview: boolean; isDuplicate: boolean }[]) =>
    rows.map(({ doc, linkCount, hasPreview, isDuplicate }) => ({ ...doc, linkCount: Number(linkCount), hasPreview: Boolean(hasPreview), isDuplicate: Boolean(isDuplicate) }));
  const columns = {
    doc: documents,
    linkCount: LINK_COUNT,
    hasPreview: HAS_PREVIEW,
    isDuplicate: sql<boolean>`${DUPLICATE}`,
  };

  if (!sp.has("limit")) {
    const rows = await db.select(columns).from(documents).where(where).orderBy(desc(documents.uploadedAt));
    return NextResponse.json(shape(rows));
  }

  const limit = Math.min(Math.max(Number(sp.get("limit")) || DEFAULT_PAGE, 1), MAX_PAGE);
  const offset = Math.max(Math.floor(Number(sp.get("offset")) || 0), 0);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(documents).where(where);
  const rows = await db.select(columns).from(documents).where(where).orderBy(desc(documents.uploadedAt), desc(documents.id)).limit(limit).offset(offset);
  return NextResponse.json({ items: shape(rows), total: Number(total), offset, limit }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  return jsonError("Use /api/documents/upload", 405);
}
