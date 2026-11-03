import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("dashboard query returns the same synthetic paid and due records in one round trip", async () => {
  const source = await readFile(new URL("../src/app/api/dashboard/route.ts", import.meta.url), "utf8");
  const query = source.match(/db\.execute\(sql`([\s\S]*?)`\)/)?.[1];
  assert.ok(query, "dashboard SQL must be present");
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE settings (id int, project_name text, budget_total numeric, budget_by_category jsonb, setup_complete boolean, gcal_connected boolean);
      CREATE TABLE contacts (id text, name text);
      CREATE TABLE documents (id text, category text);
      CREATE TABLE expenses (id text, amount numeric, category text, date date, payment_status text, due_date date, notes text, contact_id text, receipt_doc_id text);
      CREATE TABLE expense_documents (expense_id text, document_id text);
      CREATE TABLE tasks (id text, title text, due_date date, status text, goal_label text, priority text, completed_at timestamptz);
      CREATE TABLE site_updates (id text, date date, status text, work_completed text, work_in_progress text, work_planned text, blockers text, created_at timestamptz);
      INSERT INTO settings VALUES (1, 'Synthetic project', 5000, '{}', true, false);
      INSERT INTO contacts VALUES ('c', 'Synthetic contractor');
      INSERT INTO documents VALUES ('d1', 'drawings'), ('d2', 'drawings');
      INSERT INTO expenses VALUES ('a', 1000, 'foundation', '2026-10-01', 'paid', null, null, 'c', null), ('b', 200, 'foundation', '2026-10-02', 'due', null, null, null, null);
      INSERT INTO expense_documents VALUES ('a', 'd1');
      INSERT INTO tasks VALUES ('t', 'Review', '2026-11-01', 'todo', null, 'normal', null);
      INSERT INTO site_updates VALUES ('s', '2026-10-01', 'normal', 'Synthetic work', null, null, null, now());`);
    const result = await db.query<{ settings: { projectName: string }; expense_rows: { paymentStatus: string; amount: number; contactName: string | null; hasReceipt: boolean }[]; task_rows: unknown[]; log_rows: unknown[]; document_categories: string[] }>(query);
    assert.equal(result.rows[0].settings.projectName, "Synthetic project");
    assert.deepEqual(result.rows[0].expense_rows.map((row) => row.paymentStatus).sort(), ["due", "paid"]);
    assert.equal(result.rows[0].expense_rows.find((row) => row.paymentStatus === "paid")?.contactName, "Synthetic contractor");
    assert.equal(result.rows[0].expense_rows.find((row) => row.paymentStatus === "paid")?.hasReceipt, true);
    assert.equal(result.rows[0].task_rows.length, 1);
    assert.equal(result.rows[0].log_rows.length, 1);
    assert.deepEqual(result.rows[0].document_categories, ["drawings"]);
  } finally { await db.close(); }
});
