import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { expenses } from "@/lib/schema";
import { expenseSchema } from "@/lib/zod-schemas";
import { jsonError } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = expenseSchema.partial().safeParse(await req.json());
  if (!parsed.success) return jsonError("Check the expense");
  const db = await getDb();
  const patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.amount != null) patch.amount = String(parsed.data.amount);
  const [row] = await db.update(expenses).set(patch).where(eq(expenses.id, id)).returning();
  if (!row) return jsonError("Not found", 404);
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  await db.delete(expenses).where(eq(expenses.id, id));
  return NextResponse.json({ ok: true });
}
