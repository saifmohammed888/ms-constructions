import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contacts, expenses } from "@/lib/schema";
import { contactSchema } from "@/lib/zod-schemas";
import { jsonError } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  const [row] = await db.select().from(contacts).where(eq(contacts.id, id));
  if (!row) return jsonError("Not found", 404);
  const paid = await db.select().from(expenses).where(eq(expenses.contactId, id)).orderBy(desc(expenses.date));
  const total = paid.reduce((s, e) => s + Number(e.amount), 0);
  return NextResponse.json({ ...row, expenses: paid, totalPaid: total });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = contactSchema.partial().safeParse(await req.json());
  if (!parsed.success) return jsonError("Check the contact details");
  const db = await getDb();
  const [row] = await db
    .update(contacts)
    .set({ ...parsed.data, email: parsed.data.email || null, updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning();
  if (!row) return jsonError("Not found", 404);
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  await db.delete(contacts).where(eq(contacts.id, id));
  return NextResponse.json({ ok: true });
}
