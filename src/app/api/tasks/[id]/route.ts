import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tasks } from "@/lib/schema";
import { taskSchema } from "@/lib/zod-schemas";
import { jsonError } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = taskSchema.partial().safeParse(await req.json());
  if (!parsed.success) return jsonError("Check the task");
  const db = await getDb();
  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!existing) return jsonError("Not found", 404);

  const patch: Record<string, unknown> = { ...parsed.data };
  delete patch.syncCalendar;
  if (parsed.data.status === "done" && existing.status !== "done") patch.completedAt = new Date();
  if (parsed.data.status === "todo") patch.completedAt = null;

  const [row] = await db.update(tasks).set(patch).where(eq(tasks.id, id)).returning();
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  await db.delete(tasks).where(eq(tasks.id, id));
  return NextResponse.json({ ok: true });
}
