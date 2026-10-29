import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, lte, or } from "drizzle-orm";
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
  // Keep expenses, their link records, and receipt metadata in one database
  // round-trip. On a hosted Postgres pool this avoids serial network latency.
  const rows = await db
    .select({ expense: expenses, linkedDocumentId: expenseDocuments.documentId, document: documents })
    .from(expenses)
    .leftJoin(expenseDocuments, eq(expenseDocuments.expenseId, expenses.id))
    .leftJoin(
      documents,
      or(eq(documents.id, expenseDocuments.documentId), eq(documents.id, expenses.receiptDocId)),
    )
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(expenses.date), desc(expenses.createdAt));
  const itemsById = new Map<string, {
    item: typeof expenses.$inferSelect;
    receiptDocIds: Set<string>;
    receiptDocuments: Map<string, typeof documents.$inferSelect>;
  }>();
  for (const row of rows) {
    let entry = itemsById.get(row.expense.id);
    if (!entry) {
      entry = {
        item: row.expense,
        receiptDocIds: new Set(row.expense.receiptDocId ? [row.expense.receiptDocId] : []),
        receiptDocuments: new Map(),
      };
      itemsById.set(row.expense.id, entry);
    }
    if (row.linkedDocumentId) entry.receiptDocIds.add(row.linkedDocumentId);
    if (row.document) entry.receiptDocuments.set(row.document.id, row.document);
  }
  const items = [...itemsById.values()].map(({ item, receiptDocIds, receiptDocuments }) => ({
    ...item,
    receiptDocIds: [...receiptDocIds],
    receiptDocuments: [...receiptDocuments.values()],
  }));
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
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
