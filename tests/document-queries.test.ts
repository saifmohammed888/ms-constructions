import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { desc, sql } from "drizzle-orm";
import { documents } from "../src/lib/schema";
import { DUPLICATE, HAS_PREVIEW, LINK_COUNT, LINKED, STAGE_PATTERN, documentWhere } from "../src/lib/document-queries";

async function seeded() {
  const engine = new PGlite();
  await engine.exec(`
    CREATE TABLE documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, name text NOT NULL, drive_file_id text NOT NULL UNIQUE, thumbnail_url text, web_view_link text, mime_type text, size_bytes bigint, category text NOT NULL DEFAULT 'misc', tags text[] NOT NULL DEFAULT '{}', uploaded_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE expenses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), receipt_doc_id uuid);
    CREATE TABLE expense_documents (expense_id uuid, document_id uuid);
    CREATE TABLE site_updates (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE site_update_documents (site_update_id uuid, document_id uuid);
    CREATE TABLE document_thumbnails (document_id uuid PRIMARY KEY, mime_type text, data bytea);
    INSERT INTO documents (id, name, drive_file_id, mime_type, size_bytes, category, tags, uploaded_at) VALUES
      ('00000000-0000-4000-8000-000000000001', '2026-11-04_1147_Material_Steel_Delivery_01.jpg', 'd1', 'image/jpeg', 1000, 'photos', '{}', '2026-11-04T10:00:00Z'),
      ('00000000-0000-4000-8000-000000000002', 'IMG_1184.jpeg', 'd2', 'image/jpeg', 1000, 'photos', '{plinth}', '2026-11-05T10:00:00Z'),
      ('00000000-0000-4000-8000-000000000003', 'IMG_1184.jpeg', 'd3', 'image/jpeg', 1000, 'photos', '{}', '2026-11-06T10:00:00Z'),
      ('00000000-0000-4000-8000-000000000004', 'PhonePe_Transaction_Statement.pdf', 'd4', 'application/pdf', 5000, 'statements', '{}', '2026-11-07T10:00:00Z');
    INSERT INTO expenses (id, receipt_doc_id) VALUES ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000002');
    INSERT INTO expense_documents VALUES ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-000000000004');
    INSERT INTO expense_documents VALUES ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-000000000004');
    INSERT INTO document_thumbnails VALUES ('00000000-0000-4000-8000-000000000001', 'image/webp', '\\x00');
  `);
  return { engine, db: drizzle(engine) };
}

async function page(db: ReturnType<typeof drizzle>, filter: Parameters<typeof documentWhere>[0]) {
  return db.select({ id: documents.id, name: documents.name, linked: LINK_COUNT, preview: HAS_PREVIEW, dup: sql<boolean>`${DUPLICATE}` })
    .from(documents).where(documentWhere(filter)).orderBy(desc(documents.uploadedAt));
}

test("filters return the right files", async () => {
  const { engine, db } = await seeded();
  try {
    assert.equal((await page(db, { filter: "all" })).length, 4);
    const unlinked = await page(db, { filter: "unlinked" });
    assert.deepEqual(unlinked.map((r) => r.name).sort(), ["2026-11-04_1147_Material_Steel_Delivery_01.jpg", "IMG_1184.jpeg"].sort());
    assert.equal((await page(db, { filter: "untagged" })).length, 3);
    const dups = await page(db, { filter: "duplicates" });
    assert.equal(dups.length, 2);
    assert.ok(dups.every((r) => r.dup));
    assert.equal((await page(db, { filter: "stage", stage: "Material" })).length, 1);
    assert.equal((await page(db, { filter: "stage", stage: "Material'; DROP TABLE documents; --" })).length, 0);
  } finally {
    await engine.close();
  }
});

test("link counts and previews are accurate", async () => {
  const { engine, db } = await seeded();
  try {
    const rows = await page(db, { filter: "all" });
    const statement = rows.find((r) => r.name.startsWith("PhonePe"))!;
    assert.equal(Number(statement.linked), 2);
    assert.equal(Boolean(statement.preview), false);
    const steel = rows.find((r) => r.name.startsWith("2026-11-04"))!;
    assert.equal(Boolean(steel.preview), true);
    assert.equal(Number(rows.find((r) => r.name === "IMG_1184.jpeg" && Number(r.linked) === 1)?.linked), 1);
  } finally {
    await engine.close();
  }
});

test("stage pattern extracts the stage from library names", async () => {
  const { engine } = await seeded();
  try {
    const result = await engine.query<{ stage: string | null }>(`SELECT substring(name FROM '${STAGE_PATTERN.replace(/'/g, "''")}') AS stage FROM documents WHERE name LIKE '2026%'`);
    assert.deepEqual(result.rows.map((r) => r.stage), ["Material"]);
  } finally {
    await engine.close();
  }
});

test("filter chip counts match the list", async () => {
  const { engine, db } = await seeded();
  try {
    const [counts] = await db.select({
      total: sql<number>`count(*)::int`,
      unlinked: sql<number>`count(*) FILTER (WHERE NOT ${LINKED})::int`,
      untagged: sql<number>`count(*) FILTER (WHERE cardinality(${documents.tags}) = 0)::int`,
      duplicates: sql<number>`count(*) FILTER (WHERE ${DUPLICATE})::int`,
    }).from(documents);
    assert.deepEqual(counts, { total: 4, unlinked: 2, untagged: 3, duplicates: 2 });
  } finally {
    await engine.close();
  }
});

test("filter chip counts match the list", async () => {
  const { engine, db } = await seeded();
  try {
    const [counts] = await db.select({
      total: sql<number>`count(*)::int`,
      unlinked: sql<number>`count(*) FILTER (WHERE NOT ${LINKED})::int`,
      untagged: sql<number>`count(*) FILTER (WHERE cardinality(${documents.tags}) = 0)::int`,
      duplicates: sql<number>`count(*) FILTER (WHERE ${DUPLICATE})::int`,
    }).from(documents);
    assert.deepEqual(counts, { total: 4, unlinked: 2, untagged: 3, duplicates: 2 });
  } finally {
    await engine.close();
  }
});
