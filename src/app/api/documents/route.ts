import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/schema";
import { jsonError } from "@/lib/http";
import { uploadDriveFile } from "@/lib/google";
import { DOC_CATEGORIES, type DocCategory } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const db = await getDb();
  const category = req.nextUrl.searchParams.get("category");
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const filters = [];
  if (category) filters.push(eq(documents.category, category));
  if (q) {
    filters.push(
      or(like(documents.name, `%${q}%`), sql`cast(${documents.tags} as text) like ${"%" + q + "%"}`)!,
    );
  }
  const rows = await db
    .select({
      doc: documents,
      // Distinct links: expenses (as receipts or attachments) and work logs.
      linkCount: sql<number>`(SELECT count(*)::int FROM (SELECT expense_id AS ref FROM expense_documents WHERE document_id = ${documents.id} UNION SELECT id FROM expenses WHERE receipt_doc_id = ${documents.id} UNION ALL SELECT site_update_id FROM site_update_documents WHERE document_id = ${documents.id}) links)`,
      hasPreview: sql<boolean>`EXISTS (SELECT 1 FROM document_thumbnails t WHERE t.document_id = ${documents.id})`,
    })
    .from(documents)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(documents.uploadedAt));
  return NextResponse.json(rows.map(({ doc, linkCount, hasPreview }) => ({ ...doc, linkCount: Number(linkCount), hasPreview: Boolean(hasPreview) })));
}

export async function POST() {
  return jsonError("Use /api/documents/upload", 405);
}
