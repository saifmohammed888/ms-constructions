import { NextResponse } from "next/server";
import { getDb, getSettingsRow } from "@/lib/db";
import { documents, expenses, tasks } from "@/lib/schema";
import { lastNMonths, todayIso } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/constants";

export async function GET() {
  const db = await getDb();
  // These reads do not depend on each other. Running them concurrently avoids
  // paying the Neon round-trip latency four times in sequence.
  const [row, expenseRows, taskRows, documentCategories] = await Promise.all([
    getSettingsRow(),
    db
      .select({
        id: expenses.id,
        amount: expenses.amount,
        category: expenses.category,
        date: expenses.date,
        paymentStatus: expenses.paymentStatus,
        dueDate: expenses.dueDate,
        notes: expenses.notes,
      })
      .from(expenses),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        status: tasks.status,
        goalLabel: tasks.goalLabel,
      })
      .from(tasks),
    db.select({ category: documents.category }).from(documents),
  ]);

  const totalsByCategory = new Map<string, number>(EXPENSE_CATEGORIES.map((category) => [category, 0]));
  let totalSpent = 0;
  for (const expense of expenseRows) {
    const amount = Number(expense.amount);
    totalSpent += amount;
    totalsByCategory.set(expense.category, (totalsByCategory.get(expense.category) ?? 0) + amount);
  }
  const byCategory = EXPENSE_CATEGORIES.map((category) => ({ category, amount: totalsByCategory.get(category) ?? 0 }));
  const months = lastNMonths(6);
  const totalsByMonth = new Map(months.map((month) => [month, 0]));
  for (const expense of expenseRows) {
    const month = expense.date.slice(0, 7);
    if (totalsByMonth.has(month)) totalsByMonth.set(month, (totalsByMonth.get(month) ?? 0) + Number(expense.amount));
  }
  const monthly = months.map((month) => ({ month, amount: totalsByMonth.get(month) ?? 0 }));
  const today = todayIso();
  const weekAhead = new Date(`${today}T00:00:00+05:30`);
  weekAhead.setDate(weekAhead.getDate() + 7);
  const weekIso = weekAhead.toISOString().slice(0, 10);
  const overdue = taskRows.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today);
  const upcoming = taskRows.filter(
    (t) => t.status !== "done" && t.dueDate && t.dueDate >= today && t.dueDate <= weekIso,
  );
  const thisWeek = [...overdue, ...upcoming].slice(0, 5);
  const recent = [...expenseRows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 3);
  const duePayments = expenseRows.filter((e) => e.paymentStatus === "due").sort((a, b) => (a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1).slice(0, 5);
  const presentCategories = new Set(documentCategories.map((document) => document.category));
  const missingDocuments = ["drawings", "approvals", "contracts"].filter((category) => !presentCategories.has(category));
  const currentStage = taskRows.find((task) => task.status !== "done" && task.goalLabel)?.goalLabel ?? "Planning & coordination";

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
    missingDocuments,
    currentStage,
    setupComplete: row?.setupComplete ?? false,
    gcalConnected: row?.gcalConnected ?? false,
  });
}
