import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { schema } from "../src/lib/schema";
import { automaticLogText, createAutomaticDailyLog, previousProjectDate } from "../src/lib/auto-daily-log";
import type { getDb } from "../src/lib/db";

test("previous date follows India time across midnight and month boundaries", () => {
  assert.equal(previousProjectDate(new Date("2026-10-31T18:29:00Z")), "2026-10-30");
  assert.equal(previousProjectDate(new Date("2026-10-31T18:30:00Z")), "2026-10-31");
  assert.equal(previousProjectDate(new Date("2026-12-31T20:00:00Z")), "2026-12-31");
});

test("automatic summaries do not claim that work happened or stopped", () => {
  assert.match(automaticLogText(0, 0), /Site work and progress are unknown/);
  assert.match(automaticLogText(2, 1), /2 expense records and 1 document upload/);
});

test("synthetic database: create once, respect manual logs and count only the day", async () => {
  const engine = new PGlite();
  try {
    await engine.exec(`CREATE TABLE projects (id uuid PRIMARY KEY, name text, stage text, location text, created_at timestamptz DEFAULT now());
      CREATE TABLE site_updates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL, date date NOT NULL, work_completed text NOT NULL, work_in_progress text, work_planned text, worker_count int, materials_received text, blockers text, floor_area text, status text NOT NULL DEFAULT 'normal', notes text, created_at timestamptz DEFAULT now());
      CREATE TABLE expenses (id uuid PRIMARY KEY, project_id uuid, date date, amount numeric, category text, payment_status text, notes text);
      CREATE TABLE documents (id uuid PRIMARY KEY, project_id uuid, uploaded_at timestamptz, name text, category text);
      INSERT INTO projects(id,name) VALUES ('00000000-0000-4000-8000-000000000001','Synthetic');
      INSERT INTO expenses VALUES ('00000000-0000-4000-8000-000000000002',null,'2026-10-31',4500,'foundation','paid','Synthetic equipment');
      INSERT INTO documents VALUES ('00000000-0000-4000-8000-000000000003',null,'2026-10-31 10:00:00+00','Synthetic photo.jpg','photos');
      INSERT INTO site_updates(project_id,date,work_completed) VALUES ('00000000-0000-4000-8000-000000000001','2026-10-30','Manual work');`);
    const db = drizzle(engine, { schema }) as unknown as Awaited<ReturnType<typeof getDb>>;
    assert.deepEqual(await createAutomaticDailyLog(db, "2026-10-30"), { created: false, date: "2026-10-30" });
    assert.deepEqual(await createAutomaticDailyLog(db, "2026-10-31"), { created: true, date: "2026-10-31" });
    assert.deepEqual(await createAutomaticDailyLog(db, "2026-10-31"), { created: false, date: "2026-10-31" });
    const rows = await engine.query<{ work_completed: string; status: string; notes: string }>("SELECT work_completed,status,notes FROM site_updates WHERE date = '2026-10-31'");
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].status, "auto_generated");
    assert.match(rows.rows[0].work_completed, /1 expense record and 1 document upload/);
    assert.match(rows.rows[0].notes, /Synthetic equipment/);
    assert.match(rows.rows[0].notes, /Synthetic photo.jpg/);
    assert.deepEqual(await createAutomaticDailyLog(db, "2026-11-01"), { created: true, date: "2026-11-01" });
    const empty = await engine.query<{ work_completed: string }>("SELECT work_completed FROM site_updates WHERE date = '2026-11-01'");
    assert.match(empty.rows[0].work_completed, /No work update or related expense or document upload was recorded/);
  } finally { await engine.close(); }
});
