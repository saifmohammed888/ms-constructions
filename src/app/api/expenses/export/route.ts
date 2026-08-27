import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contacts, expenses } from "@/lib/schema";
import { EXPENSE_CATEGORY_LABELS, PAYMENT_MODE_LABELS } from "@/lib/constants";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(expenses).orderBy(desc(expenses.date));
  const people = await db.select().from(contacts);
  const names = Object.fromEntries(people.map((c) => [c.id, c.name]));
  const header = ["Date", "Amount", "Category", "Payee", "Payment mode", "Notes"];
  const lines = rows.map((r) =>
    [
      r.date,
      r.amount,
      EXPENSE_CATEGORY_LABELS[r.category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? r.category,
      r.contactId ? names[r.contactId] ?? "" : "",
      r.paymentMode
        ? PAYMENT_MODE_LABELS[r.paymentMode as keyof typeof PAYMENT_MODE_LABELS]
        : "",
      (r.notes ?? "").replace(/"/g, '""'),
    ]
      .map((v) => `"${v}"`)
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=expenses.csv",
    },
  });
}
