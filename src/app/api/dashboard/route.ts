import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { lastNMonths, todayIso } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { summarizeExpenses } from "@/lib/expense-summary";

export async function GET() {
  const db = await getDb();
  // One query uses a single pooled connection, avoiding simultaneous cold
  // TLS connections and repeated network round trips to the database region.
  const result = await db.execute(sql`
    SELECT
      (SELECT json_build_object('projectName', project_name, 'budgetTotal', budget_total, 'budgetByCategory', budget_by_category, 'setupComplete', setup_complete, 'gcalConnected', gcal_connected) FROM settings WHERE id = 1) AS settings,
      COALESCE((SELECT json_agg(json_build_object('id', id, 'amount', amount, 'category', category, 'date', date, 'paymentStatus', payment_status, 'dueDate', due_date, 'notes', notes)) FROM expenses), '[]'::json) AS expense_rows,
      COALESCE((SELECT json_agg(json_build_object('id', id, 'title', title, 'dueDate', due_date, 'status', status, 'goalLabel', goal_label)) FROM tasks), '[]'::json) AS task_rows,
      COALESCE((SELECT json_agg(category) FROM (SELECT DISTINCT category FROM documents) AS categories), '[]'::json) AS document_categories
  `);
  type DashboardRow = {
    settings: { projectName: string; budgetTotal: string | number | null; budgetByCategory: Record<string, number>; setupComplete: boolean; gcalConnected: boolean } | null;
    expense_rows: { id: string; amount: string | number; category: string; date: string; paymentStatus: string; dueDate: string | null; notes: string | null }[];
    task_rows: { id: string; title: string; dueDate: string | null; status: string; goalLabel: string | null }[];
    document_categories: string[];
  };
  const rows = Array.isArray(result) ? result : result.rows;
  const data = rows[0] as unknown as DashboardRow;
  const row = data.settings;
  const expenseRows = data.expense_rows;
  const taskRows = data.task_rows;

  const months = lastNMonths(6);
  const totals = summarizeExpenses(expenseRows, EXPENSE_CATEGORIES, months);
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
  const presentCategories = new Set(data.document_categories);
  const missingDocuments = ["drawings", "approvals", "contracts"].filter((category) => !presentCategories.has(category));
  const currentStage = taskRows.find((task) => task.status !== "done" && task.goalLabel)?.goalLabel ?? "Planning & coordination";

  return NextResponse.json({
    projectName: row?.projectName ?? "My Construction",
    budgetTotal: row?.budgetTotal ? Number(row.budgetTotal) : null,
    budgetByCategory: row?.budgetByCategory ?? {},
    totalSpent: totals.paid,
    totalDue: totals.due,
    unclassifiedTotal: totals.unclassified,
    recordedTotal: totals.recordedTotal,
    byCategory: totals.byCategory,
    monthly: totals.monthly,
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
