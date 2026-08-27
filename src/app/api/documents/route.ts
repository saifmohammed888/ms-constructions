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
    .select()
    .from(documents)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(documents.uploadedAt));
  return NextResponse.json(rows);
}

export async function POST() {
  return jsonError("Use /api/documents/upload", 405);
}
