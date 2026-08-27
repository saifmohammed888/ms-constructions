/**
 * Restore structured data from a Drive backup JSON (backup.json inside the zip).
 * Usage: DATABASE_URL=... npx tsx scripts/restore.ts ./backup.json
 */
import { readFileSync } from "fs";
import postgres from "postgres";

async function main() {
  const file = process.argv[2];
  const url = process.env.DATABASE_URL;
  if (!file || !url) {
    console.error("Usage: DATABASE_URL=... npm run restore -- ./backup.json");
    process.exit(1);
  }
  const payload = JSON.parse(readFileSync(file, "utf8")) as {
    contacts: Record<string, unknown>[];
    expenses: Record<string, unknown>[];
    tasks: Record<string, unknown>[];
    documents: Record<string, unknown>[];
    settings: Record<string, unknown>[];
  };
  const sql = postgres(url, { max: 1 });
  await sql`delete from expenses`;
  await sql`delete from tasks`;
  await sql`delete from documents`;
  await sql`delete from contacts`;
  for (const row of payload.contacts ?? []) {
    await sql`insert into contacts ${sql(row as never)}`;
  }
  for (const row of payload.documents ?? []) {
    await sql`insert into documents ${sql(row as never)}`;
  }
  for (const row of payload.expenses ?? []) {
    await sql`insert into expenses ${sql(row as never)}`;
  }
  for (const row of payload.tasks ?? []) {
    await sql`insert into tasks ${sql(row as never)}`;
  }
  console.log("Restore finished. Re-check settings in the app UI.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
