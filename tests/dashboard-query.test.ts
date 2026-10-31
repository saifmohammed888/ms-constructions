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
      CREATE TABLE expenses (id text, amount numeric, category text, date date, payment_status text, due_date date, notes text);
      CREATE TABLE tasks (id text, title text, due_date date, status text, goal_label text);
      CREATE TABLE documents (category text);
      INSERT INTO settings VALUES (1, 'Synthetic project', 5000, '{}', true, false);
      INSERT INTO expenses VALUES ('a', 1000, 'foundation', '2026-10-01', 'paid', null, null), ('b', 200, 'foundation', '2026-10-02', 'due', null, null);
      INSERT INTO tasks VALUES ('t', 'Review', '2026-11-01', 'todo', null);
      INSERT INTO documents VALUES ('drawings'), ('drawings');`);
    const result = await db.query<{ settings: { projectName: string }; expense_rows: { paymentStatus: string; amount: number }[]; task_rows: unknown[]; document_categories: string[] }>(query);
    assert.equal(result.rows[0].settings.projectName, "Synthetic project");
    assert.deepEqual(result.rows[0].expense_rows.map((row) => row.paymentStatus).sort(), ["due", "paid"]);
    assert.equal(result.rows[0].task_rows.length, 1);
    assert.deepEqual(result.rows[0].document_categories, ["drawings"]);
  } finally { await db.close(); }
});
