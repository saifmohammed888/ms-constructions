import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb, getSettingsRow } from "@/lib/db";
import { getSession } from "@/lib/session";
import { contacts, expenses, tasks } from "@/lib/schema";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const [settings, taskRows, expenseRows, contactRows] = await Promise.all([
    getSettingsRow(),
    db.select().from(tasks).orderBy(desc(tasks.createdAt)),
    db.select().from(expenses).orderBy(desc(expenses.date), desc(expenses.createdAt)),
    db.select().from(contacts).orderBy(desc(contacts.updatedAt)),
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    project: {
      name: settings?.projectName ?? "My Construction",
      budget: settings?.budgetTotal ? Number(settings.budgetTotal) : null,
    },
    work: taskRows.map((task) => Object.fromEntries(Object.entries(task).filter(([key]) => key !== "gcalEventId" && key !== "calendarSyncError"))),
    money: expenseRows.map((expense) => ({ ...expense, amount: Number(expense.amount) })),
    people: contactRows,
  });
}
