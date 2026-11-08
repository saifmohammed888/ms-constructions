import pg from "pg";

const { Pool } = pg;

// Keep Postgres DATE values as YYYY-MM-DD strings. Parsing them as local
// midnight Dates can shift the construction date when serialized to UTC.
pg.types.setTypeParser(1082, (value) => value);

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_AGENT;
if (!connectionString) throw new Error("DATABASE_URL is required");

export const pool = new Pool({
  connectionString,
  max: 5,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
  ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
    ? undefined
    : { rejectUnauthorized: false },
});

export async function query<T extends pg.QueryResultRow>(text: string, values: unknown[] = []) {
  return pool.query<T>(text, values);
}
