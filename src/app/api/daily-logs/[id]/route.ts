import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { documents, siteUpdateDocuments, siteUpdates } from "@/lib/schema";
import { jsonError } from "@/lib/http";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  date: z.string().min(1).optional(),
  workCompleted: z.string().min(1).optional(),
  workInProgress: z.string().optional().nullable(),
  workPlanned: z.string().optional().nullable(),
  blockers: z.string().optional().nullable(),
  materialsReceived: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  documentIds: z.array(z.string()).optional(),
});

async function logWithDocuments(row: typeof siteUpdates.$inferSelect) {
  const db = await getDb();
  const links = await db
    .select({ document: documents })
    .from(siteUpdateDocuments)
    .innerJoin(documents, eq(siteUpdateDocuments.documentId, documents.id))
    .where(eq(siteUpdateDocuments.siteUpdateId, row.id));
  return { ...row, documents: links.map((link) => link.document) };
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Check the daily log");
  const db = await getDb();
  const [existing] = await db.select().from(siteUpdates).where(eq(siteUpdates.id, id));
  if (!existing) return jsonError("Not found", 404);
  const { documentIds, ...body } = parsed.data;
  const patch = {
    ...body,
    workInProgress: body.workInProgress || null,
    workPlanned: body.workPlanned || null,
    blockers: body.blockers || null,
    materialsReceived: body.materialsReceived || null,
    notes: body.notes || null,
    status: body.status || "normal",
  };
  const [row] = await db.update(siteUpdates).set(patch).where(eq(siteUpdates.id, id)).returning();
  if (documentIds) {
    await db.delete(siteUpdateDocuments).where(eq(siteUpdateDocuments.siteUpdateId, id));
    const uniqueIds = [...new Set(documentIds)];
    if (uniqueIds.length) {
      await db.insert(siteUpdateDocuments).values(uniqueIds.map((documentId) => ({ siteUpdateId: id, documentId }))).onConflictDoNothing();
    }
  }
  return NextResponse.json(await logWithDocuments(row));
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = await getDb();
  await db.delete(siteUpdates).where(eq(siteUpdates.id, id));
  return NextResponse.json({ ok: true });
}
