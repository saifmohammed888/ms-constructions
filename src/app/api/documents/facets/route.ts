import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/schema";
import { DUPLICATE, HAS_PREVIEW, LINKED, STAGE_PATTERN } from "@/lib/document-queries";
import { route } from "@/lib/http";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/** Counts for the filter chips. These cover the whole library, not one page. */
export const GET = route(async () => {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const [counts] = await db.select({
    total: sql<number>`count(*)::int`,
    unlinked: sql<number>`count(*) FILTER (WHERE NOT ${LINKED})::int`,
    untagged: sql<number>`count(*) FILTER (WHERE cardinality(${documents.tags}) = 0)::int`,
    duplicates: sql<number>`count(*) FILTER (WHERE ${DUPLICATE})::int`,
    withoutPreview: sql<number>`count(*) FILTER (WHERE NOT ${HAS_PREVIEW} AND (${documents.mimeType} LIKE 'image/%' OR ${documents.name} ~* '[.](jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?)$'))::int`,
  }).from(documents);
  const stages = await db.execute(sql`
    SELECT substring(name FROM ${STAGE_PATTERN}) AS stage, count(*)::int AS count
    FROM documents
    WHERE name ~ ${STAGE_PATTERN}
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 8
  `);
  const rows = (Array.isArray(stages) ? stages : (stages as { rows?: unknown[] }).rows ?? []) as { stage: string; count: number }[];
  return NextResponse.json({ ...counts, stages: rows.map((row) => ({ stage: row.stage, count: Number(row.count) })) }, { headers: { "Cache-Control": "no-store" } });
});
