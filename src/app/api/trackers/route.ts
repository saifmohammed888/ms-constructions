import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { projectTrackers } from "@/lib/schema";

const allowed = new Set(["decisions", "learnings", "savings", "quotations"]);

export async function GET(req: NextRequest) {
  const tracker = req.nextUrl.searchParams.get("tracker") ?? "";
  if (!allowed.has(tracker)) return NextResponse.json({ error: "Invalid tracker" }, { status: 400 });
  const db = await getDb();
  return NextResponse.json(await db.select().from(projectTrackers).where(eq(projectTrackers.tracker, tracker)).orderBy(desc(projectTrackers.createdAt)));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!allowed.has(body.tracker) || !String(body.title ?? "").trim()) return NextResponse.json({ error: "Tracker and title are required" }, { status: 400 });
  const db = await getDb();
  const [row] = await db.insert(projectTrackers).values({ tracker: body.tracker, title: String(body.title).trim(), data: body.data ?? {} }).returning();
  return NextResponse.json(row);
}
