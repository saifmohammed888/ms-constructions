import { and, eq, like, or, sql, type SQL } from "drizzle-orm";
import { documents } from "@/lib/schema";

// Subqueries must name the outer table. Drizzle would otherwise write a bare
// "id" or "name", which resolves to the subquery's own table and gives wrong counts.
const outer = (column: string) => sql.raw(`"documents"."${column}"`);
const DOC_ID = outer("id");
const DOC_NAME = outer("name");
const DOC_SIZE = outer("size_bytes");

export const DOCUMENT_FILTERS = ["all", "unlinked", "untagged", "duplicates", "stage"] as const;
export type DocumentFilter = (typeof DOCUMENT_FILTERS)[number];

/** Expenses, work logs and receipt links that point at a document. */
const LINKED = sql`(EXISTS (SELECT 1 FROM expense_documents ed WHERE ed.document_id = ${DOC_ID}) OR EXISTS (SELECT 1 FROM expenses e WHERE e.receipt_doc_id = ${DOC_ID}) OR EXISTS (SELECT 1 FROM site_update_documents sd WHERE sd.document_id = ${DOC_ID}))`;

const DUPLICATE = sql<boolean>`EXISTS (SELECT 1 FROM documents o WHERE lower(o.name) = lower(${DOC_NAME}) AND o.size_bytes IS NOT DISTINCT FROM ${DOC_SIZE} AND o.id <> ${DOC_ID})`;

export const LINK_COUNT = sql<number>`(SELECT count(*)::int FROM (SELECT expense_id AS ref FROM expense_documents WHERE document_id = ${DOC_ID} UNION SELECT id FROM expenses WHERE receipt_doc_id = ${DOC_ID} UNION ALL SELECT site_update_id FROM site_update_documents WHERE document_id = ${DOC_ID}) links)`;

export const HAS_PREVIEW = sql<boolean>`EXISTS (SELECT 1 FROM document_thumbnails t WHERE t.document_id = ${DOC_ID})`;

/** Library names look like 2026-11-04_1147_Material_Steel.jpg; the third part is the stage. */
export const STAGE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}_\\d{4}_([A-Za-z][A-Za-z-]*)_";

export function documentWhere({ category, q, filter, stage }: { category?: string | null; q?: string | null; filter?: string | null; stage?: string | null }) {
  const parts: SQL[] = [];
  if (category) parts.push(eq(documents.category, category));
  if (q) parts.push(or(like(documents.name, `%${q}%`), sql`cast(${documents.tags} as text) like ${"%" + q + "%"}`)!);
  switch (filter) {
    case "unlinked":
      parts.push(sql`NOT ${LINKED}`);
      break;
    case "untagged":
      parts.push(sql`cardinality(${documents.tags}) = 0`);
      break;
    case "duplicates":
      parts.push(DUPLICATE);
      break;
    case "stage":
      // An unrecognised stage matches nothing, rather than silently showing everything.
      parts.push(stage && /^[A-Za-z][A-Za-z-]{0,39}$/.test(stage) ? sql`${DOC_NAME} ~ ${"^\\d{4}-\\d{2}-\\d{2}_\\d{4}_" + stage + "_"}` : sql`false`);
      break;
  }
  return parts.length ? and(...parts) : undefined;
}

export { DUPLICATE, LINKED };
