import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tasks } from "@/lib/schema";
import { taskSchema } from "@/lib/zod-schemas";
import { jsonError } from "@/lib/http";
import { applyCalendarSync } from "@/lib/task-sync";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const parsed = taskSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Title is required");
  const db = await getDb();
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const cal = await applyCalendarSync({
    syncCalendar: parsed.data.syncCalendar,
    existingEventId: null,
    title: parsed.data.title,
    dueDate: parsed.data.dueDate ?? null,
    appUrl,
  });
  const [row] = await db
    .insert(tasks)
    .values({
      title: parsed.data.title,
      groupType: parsed.data.groupType ?? (parsed.data.goalLabel ? "goal" : "week"),
      goalLabel: parsed.data.goalLabel || null,
      dueDate: parsed.data.dueDate || null,
      status: parsed.data.status ?? "todo",
      notes: parsed.data.notes || null,
      sortOrder: parsed.data.sortOrder ?? 0,
      gcalEventId: cal.gcalEventId,
      calendarSyncError: cal.calendarSyncError,
    })
    .returning();
  return NextResponse.json(row);
}
