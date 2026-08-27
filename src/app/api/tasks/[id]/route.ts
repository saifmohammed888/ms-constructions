import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tasks } from "@/lib/schema";
import { taskSchema } from "@/lib/zod-schemas";
import { jsonError } from "@/lib/http";
import { applyCalendarSync } from "@/lib/task-sync";
import { deleteCalendarEvent } from "@/lib/google";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = taskSchema.partial().safeParse(await req.json());
  if (!parsed.success) return jsonError("Check the task");
  const db = await getDb();
  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!existing) return jsonError("Not found", 404);

  const title = parsed.data.title ?? existing.title;
  const dueDate = parsed.data.dueDate !== undefined ? parsed.data.dueDate : existing.dueDate;
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const cal = await applyCalendarSync({
    syncCalendar: parsed.data.syncCalendar,
    existingEventId: existing.gcalEventId,
    title,
    dueDate: dueDate ?? null,
    appUrl,
  });

  const patch: Record<string, unknown> = { ...parsed.data };
  delete patch.syncCalendar;
  if (parsed.data.status === "done" && existing.status !== "done") patch.completedAt = new Date();
  if (parsed.data.status === "todo") patch.completedAt = null;
  patch.gcalEventId = cal.gcalEventId;
  patch.calendarSyncError = cal.calendarSyncError;

  const [row] = await db.update(tasks).set(patch).where(eq(tasks.id, id)).returning();
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (existing?.gcalEventId) {
    try {
      await deleteCalendarEvent(existing.gcalEventId);
    } catch {
      /* keep delete */
    }
  }
  await db.delete(tasks).where(eq(tasks.id, id));
  return NextResponse.json({ ok: true });
}
