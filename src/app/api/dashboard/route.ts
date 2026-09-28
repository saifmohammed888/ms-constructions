import { NextResponse } from "next/server";
import { desc, eq, gte, sql } from "drizzle-orm";
import { getDb, getSettingsRow } from "@/lib/db";
import { documents, expenses, tasks } from "@/lib/schema";
import { lastNMonths, todayIso } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/constants";

export async function GET() {
  const db = await getDb();
  const row = await getSettingsRow();
  const all = await db.select().from(expenses);
  const totalSpent = all.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = EXPENSE_CATEGORIES.map((c) => ({
    category: c,
    amount: all.filter((e) => e.category === c).reduce((s, e) => s + Number(e.amount), 0),
  }));
  const months = lastNMonths(6);
  const monthly = months.map((m) => ({
    month: m,
    amount: all.filter((e) => e.date.startsWith(m)).reduce((s, e) => s + Number(e.amount), 0),
  }));
  const today = todayIso();
  const weekAhead = new Date(`${today}T00:00:00+05:30`);
  weekAhead.setDate(weekAhead.getDate() + 7);
  const weekIso = weekAhead.toISOString().slice(0, 10);
  const allTasks = await db.select().from(tasks).orderBy(desc(tasks.dueDate));
  const overdue = allTasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today);
  const upcoming = allTasks.filter(
    (t) => t.status !== "done" && t.dueDate && t.dueDate >= today && t.dueDate <= weekIso,
  );
  const thisWeek = [...overdue, ...upcoming].slice(0, 5);
  const recent = [...all].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 3);
  const duePayments = all.filter((e) => e.paymentStatus === "due").sort((a, b) => (a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1).slice(0, 5);
  const photoRows = await db.select({ id: documents.id, name: documents.name, mimeType: documents.mimeType, uploadedAt: documents.uploadedAt }).from(documents).where(eq(documents.category, "photos")).orderBy(desc(documents.uploadedAt)).limit(12);
  const recentPhotos = photoRows.filter((photo) => photo.mimeType?.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(photo.name)).slice(0, 5);
  const documentCategories = await db.select({ category: documents.category }).from(documents);
  const presentCategories = new Set(documentCategories.map((document) => document.category));
  const missingDocuments = ["drawings", "approvals", "contracts"].filter((category) => !presentCategories.has(category));
  const currentStage = allTasks.find((task) => task.status !== "done" && task.goalLabel)?.goalLabel ?? "Planning & coordination";

  return NextResponse.json({
    projectName: row?.projectName ?? "My Construction",
    budgetTotal: row?.budgetTotal ? Number(row.budgetTotal) : null,
    budgetByCategory: row?.budgetByCategory ?? {},
    totalSpent,
    byCategory,
    monthly,
    thisWeek,
    overdueCount: overdue.length,
    recent,
    duePayments,
    recentPhotos,
    missingDocuments,
    currentStage,
    setupComplete: row?.setupComplete ?? false,
    gcalConnected: row?.gcalConnected ?? false,
  });
}
