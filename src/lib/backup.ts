import JSZip from "jszip";
import { getDb, getSettingsRow } from "@/lib/db";
import { contacts, documents, expenses, settings, tasks } from "@/lib/schema";
import { uploadBackupZip } from "@/lib/google";
import { eq } from "drizzle-orm";
import { todayIso } from "@/lib/format";

function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

export async function runBackup() {
  const db = await getDb();
  const [c, e, t, d, s] = await Promise.all([
    db.select().from(contacts),
    db.select().from(expenses),
    db.select().from(tasks),
    db.select().from(documents),
    db.select().from(settings),
  ]);
  const safeSettings = s.map(({ googleRefreshToken: _g, passwordHash: _p, ...rest }) => rest);
  const payload = {
    exportedAt: new Date().toISOString(),
    contacts: c,
    expenses: e,
    tasks: t,
    documents: d,
    settings: safeSettings,
  };
  const zip = new JSZip();
  zip.file("backup.json", JSON.stringify(payload, null, 2));
  zip.file("contacts.csv", csv(c as unknown as Record<string, unknown>[]));
  zip.file("expenses.csv", csv(e as unknown as Record<string, unknown>[]));
  zip.file("tasks.csv", csv(t as unknown as Record<string, unknown>[]));
  zip.file("documents.csv", csv(d as unknown as Record<string, unknown>[]));
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  const name = `backup-${todayIso()}.zip`;
  await uploadBackupZip(name, buf);
  await db.update(settings).set({ lastBackupAt: new Date() }).where(eq(settings.id, 1));
  const row = await getSettingsRow();
  return { filename: name, lastBackupAt: row?.lastBackupAt };
}
