import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { projectTrackers } from "@/lib/schema";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const body = await req.json(); const db = await getDb();
  const [row] = await db.update(projectTrackers).set({ title: body.title, data: body.data, updatedAt: new Date() }).where(eq(projectTrackers.id, id)).returning();
  return row ? NextResponse.json(row) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(); await db.delete(projectTrackers).where(eq(projectTrackers.id, (await params).id)); return NextResponse.json({ ok: true });
}
