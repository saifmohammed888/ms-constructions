import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { schema, settings } from "@/lib/schema";

type AppDb = ReturnType<typeof drizzlePg<typeof schema>>;

let cached: AppDb | null = null;
let ready = false;

const DDL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  phone text,
  alt_phone text,
  email text,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  drive_file_id text NOT NULL UNIQUE,
  thumbnail_url text,
  web_view_link text,
  mime_type text,
  size_bytes bigint,
  category text NOT NULL DEFAULT 'misc',
  tags text[] NOT NULL DEFAULT '{}',
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric(12,2) NOT NULL,
  category text NOT NULL,
  date date NOT NULL DEFAULT current_date,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  payment_mode text,
  notes text,
  receipt_doc_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  group_type text NOT NULL DEFAULT 'week',
  goal_label text,
  due_date date,
  status text NOT NULL DEFAULT 'todo',
  gcal_event_id text,
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  calendar_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS settings (
  id int PRIMARY KEY DEFAULT 1,
  project_name text NOT NULL DEFAULT 'My Construction',
  budget_total numeric(14,2),
  budget_by_category jsonb NOT NULL DEFAULT '{}',
  drive_folder_id text,
  google_refresh_token text,
  gcal_connected boolean NOT NULL DEFAULT false,
  last_backup_at timestamptz,
  password_hash text,
  setup_complete boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses (date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses (category);
CREATE INDEX IF NOT EXISTS expenses_contact_idx ON expenses (contact_id);
CREATE INDEX IF NOT EXISTS documents_category_idx ON documents (category);
CREATE INDEX IF NOT EXISTS documents_uploaded_at_idx ON documents (uploaded_at DESC);
`;

export function databaseUrl() {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.ms_DATABASE_URL;
  if (!raw) return "";
  const u = new URL(raw);
  u.searchParams.delete("channel_binding");
  if (!u.searchParams.get("sslmode")) u.searchParams.set("sslmode", "require");
  return u.toString();
}

async function applyDdl(exec: (sql: string) => Promise<unknown>) {
  for (const stmt of DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
    try {
      await exec(stmt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists|extension|duplicate/i.test(msg)) continue;
      throw err;
    }
  }
}

export async function getDb(): Promise<AppDb> {
  if (cached && ready) return cached;

  const url = databaseUrl();
  if (url) {
    const client = postgres(url, {
      max: 1,
      prepare: false,
      ssl: "require",
      idle_timeout: 20,
      connect_timeout: 15,
    });
    cached = drizzlePg(client, { schema });
    await applyDdl((s) => client.unsafe(s));
  } else if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is missing on Vercel");
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
    const { mkdirSync } = await import("fs");
    const path = await import("path");
    const dir = path.join(process.cwd(), "data");
    mkdirSync(dir, { recursive: true });
    const pglite = new PGlite(path.join(dir, "construction"));
    await pglite.waitReady;
    cached = drizzlePglite(pglite, { schema }) as unknown as AppDb;
    await applyDdl((s) => pglite.exec(s));
  }

  const db = cached;
  const existing = await db.select().from(settings).limit(1);
  if (existing.length === 0) {
    await db.insert(settings).values({ id: 1, projectName: "My Construction" });
  }
  ready = true;
  return db;
}

export async function getSettingsRow() {
  const db = await getDb();
  const rows = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return rows[0];
}
