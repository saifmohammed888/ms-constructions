import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { todayIso } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { buildInsights, type InsightExpense, type InsightLog, type InsightTask } from "@/lib/dashboard-insights";

export async function GET() {
  const db = await getDb();
  // One query uses a single pooled connection, avoiding simultaneous cold
  // TLS connections and repeated network round trips to the database region.
  const result = await db.execute(sql`
    SELECT
      (SELECT json_build_object('projectName', project_name, 'budgetTotal', budget_total, 'budgetByCategory', budget_by_category, 'setupComplete', setup_complete, 'gcalConnected', gcal_connected) FROM settings WHERE id = 1) AS settings,
      COALESCE((SELECT json_agg(json_build_object(
        'id', e.id, 'amount', e.amount, 'category', e.category, 'date', e.date, 'paymentStatus', e.payment_status, 'dueDate', e.due_date, 'notes', e.notes,
        'contactName', c.name,
        'hasReceipt', (e.receipt_doc_id IS NOT NULL OR EXISTS (SELECT 1 FROM expense_documents ed WHERE ed.expense_id = e.id))
      )) FROM expenses e LEFT JOIN contacts c ON c.id = e.contact_id), '[]'::json) AS expense_rows,
      COALESCE((SELECT json_agg(json_build_object('id', id, 'title', title, 'dueDate', due_date, 'status', status, 'goalLabel', goal_label, 'priority', priority, 'completedAt', completed_at)) FROM tasks), '[]'::json) AS task_rows,
      COALESCE((SELECT json_agg(json_build_object('id', id, 'date', date, 'status', status, 'workCompleted', work_completed, 'workInProgress', work_in_progress, 'workPlanned', work_planned, 'blockers', blockers))
        FROM (SELECT * FROM site_updates ORDER BY date DESC, created_at DESC LIMIT 90) AS recent_logs), '[]'::json) AS log_rows,
      COALESCE((SELECT json_agg(category) FROM (SELECT DISTINCT category FROM documents) AS categories), '[]'::json) AS document_categories
  `);
  type DashboardRow = {
    settings: { projectName: string; budgetTotal: string | number | null; budgetByCategory: Record<string, number> | null; setupComplete: boolean; gcalConnected: boolean } | null;
    expense_rows: InsightExpense[];
    task_rows: InsightTask[];
    log_rows: InsightLog[];
    document_categories: string[];
  };
  const rows = Array.isArray(result) ? result : result.rows;
  const data = rows[0] as unknown as DashboardRow;
  const row = data.settings;
  const today = todayIso();

  const insights = buildInsights({
    today,
    budgetTotal: row?.budgetTotal ? Number(row.budgetTotal) : null,
    budgetByCategory: row?.budgetByCategory ?? {},
    categories: EXPENSE_CATEGORIES,
    expenses: data.expense_rows,
    tasks: data.task_rows,
    logs: data.log_rows,
    documentCategories: data.document_categories,
  });

  return NextResponse.json({
    today,
    projectName: row?.projectName ?? "My Construction",
    setupComplete: row?.setupComplete ?? false,
    gcalConnected: row?.gcalConnected ?? false,
    ...insights,
  });
}
