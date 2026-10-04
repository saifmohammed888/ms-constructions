import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents, expenseDocuments, expenses } from "@/lib/schema";
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
  const ids = rows.map((row) => row.id);
  const links = ids.length ? await db.select().from(expenseDocuments).where(inArray(expenseDocuments.expenseId, ids)) : [];
  const documentIds = [...new Set([...links.map((link) => link.documentId), ...rows.flatMap((row) => row.receiptDocId ? [row.receiptDocId] : [])])];
  const docs = documentIds.length ? await db.select().from(documents).where(inArray(documents.id, documentIds)) : [];
  const items = rows.map((row) => { const linked = links.filter((link) => link.expenseId === row.id).map((link) => link.documentId); const allIds = [...new Set([...linked, ...(row.receiptDocId ? [row.receiptDocId] : [])])]; return { ...row, receiptDocIds: allIds, receiptDocuments: docs.filter((doc) => allIds.includes(doc.id)) }; });
  return NextResponse.json({ items, total });
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
      paymentStatus: parsed.data.paymentStatus ?? "paid",
      dueDate: parsed.data.dueDate || null,
      notes: parsed.data.notes || null,
      receiptDocId: parsed.data.receiptDocId || parsed.data.receiptDocIds?.[0] || null,
    })
    .returning();
  const ids = parsed.data.receiptDocIds?.length ? parsed.data.receiptDocIds : parsed.data.receiptDocId ? [parsed.data.receiptDocId] : [];
  if (ids.length) await db.insert(expenseDocuments).values(ids.map((documentId) => ({ expenseId: row.id, documentId }))).onConflictDoNothing();
  return NextResponse.json(row);
}
