import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { expenses } from "@/lib/schema";
import { expenseSchema } from "@/lib/zod-schemas";
import { jsonError } from "@/lib/http";

export async function GET(req: NextRequest) {
  const db = await getDb();
  const category = req.nextUrl.searchParams.get("category");
  const month = req.nextUrl.searchParams.get("month");
  const contactId = req.nextUrl.searchParams.get("contact_id");
  const filters = [];
  if (category) filters.push(eq(expenses.category, category));
  if (contactId) filters.push(eq(expenses.contactId, contactId));
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    filters.push(gte(expenses.date, `${month}-01`));
    filters.push(lte(expenses.date, `${month}-31`));
  }
  const rows = await db
    .select()
    .from(expenses)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(expenses.date), desc(expenses.createdAt));
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  return NextResponse.json({ items: rows, total });
}

export async function POST(req: NextRequest) {
  const parsed = expenseSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Amount and category are required");
  const db = await getDb();
  const [row] = await db
    .insert(expenses)
    .values({
      amount: String(parsed.data.amount),
      category: parsed.data.category,
      date: parsed.data.date,
      contactId: parsed.data.contactId || null,
      paymentMode: parsed.data.paymentMode || null,
      notes: parsed.data.notes || null,
      receiptDocId: parsed.data.receiptDocId || null,
    })
    .returning();
  return NextResponse.json(row);
}
