import { and, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents, expenses, projects, siteUpdates } from "@/lib/schema";
import { formatInr, todayIso } from "@/lib/format";

type AppDb = Awaited<ReturnType<typeof getDb>>;

/** Yesterday in the project's India timezone, independent of server timezone. */
export function previousProjectDate(now = new Date()) {
  const day = new Date(`${todayIso(now)}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

export function automaticLogText(expenseCount: number, documentCount: number) {
  const evidence: string[] = [];
  if (expenseCount) evidence.push(`${expenseCount} expense record${expenseCount === 1 ? "" : "s"}`);
  if (documentCount) evidence.push(`${documentCount} document upload${documentCount === 1 ? "" : "s"}`);
  return evidence.length
    ? `No work update was entered. The app recorded ${evidence.join(" and ")} for this date; review Expenses and Documents for details. Site work and progress are unknown.`
    : "No work update or related expense or document upload was recorded for this date. Site work and progress are unknown.";
}

export function automaticEvidenceNotes(dayExpenses: { amount: string; category: string; paymentStatus: string; notes: string | null }[], dayDocuments: { name: string; category: string }[]) {
  const text = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 140);
  const lines = [
    ...dayExpenses.slice(0, 5).map((expense) => `Expense: ${formatInr(expense.amount, true)} · ${text(expense.category)} · ${text(expense.paymentStatus)}${expense.notes?.trim() ? ` · ${text(expense.notes)}` : ""}`),
    ...dayDocuments.slice(0, 5).map((doc) => `Uploaded: ${text(doc.name)} · ${text(doc.category)}`),
  ];
  if (dayExpenses.length > 5 || dayDocuments.length > 5) lines.push("Additional records are available in Expenses and Documents.");
  return lines.length ? `Automatically collected records (not a report of completed work):\n${lines.join("\n")}` : null;
}

/** Lock the shared project to serialize automatic and manual log creation. */
export async function createAutomaticDailyLog(db: AppDb, date: string) {
  const [project] = await db.select({ id: projects.id }).from(projects).limit(1);
  if (!project) throw new Error("No project configured");
  const start = new Date(`${date}T00:00:00+05:30`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(start.getTime()) || todayIso(start) !== date) throw new Error("Invalid project date");
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM projects WHERE id = ${project.id} FOR UPDATE`);
    const existing = await tx.select({ id: siteUpdates.id }).from(siteUpdates).where(and(eq(siteUpdates.projectId, project.id), eq(siteUpdates.date, date))).limit(1);
    if (existing.length) return { created: false, date };
    const [dayExpenses, dayDocuments] = await Promise.all([
      tx.select({ amount: expenses.amount, category: expenses.category, paymentStatus: expenses.paymentStatus, notes: expenses.notes }).from(expenses).where(and(eq(expenses.date, date), or(eq(expenses.projectId, project.id), isNull(expenses.projectId)))),
      tx.select({ name: documents.name, category: documents.category }).from(documents).where(and(gte(documents.uploadedAt, start), lt(documents.uploadedAt, end), or(eq(documents.projectId, project.id), isNull(documents.projectId)))),
    ]);
    await tx.insert(siteUpdates).values({ projectId: project.id, date, workCompleted: automaticLogText(dayExpenses.length, dayDocuments.length), notes: automaticEvidenceNotes(dayExpenses, dayDocuments), status: "auto_generated" });
    return { created: true, date };
  });
}
