import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { documents, projects, siteUpdateDocuments, siteUpdates } from "@/lib/schema";
import { jsonError } from "@/lib/http";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const logSchema = z.object({
  date: z.string().min(1),
  workCompleted: z.string().min(1),
  workInProgress: z.string().optional().nullable(),
  workPlanned: z.string().optional().nullable(),
  blockers: z.string().optional().nullable(),
  materialsReceived: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  documentIds: z.array(z.string()).optional(),
});

async function defaultProjectId() {
  const db = await getDb();
  const [project] = await db.select({ id: projects.id }).from(projects).limit(1);
  return project?.id || "";
}

async function logsWithDocuments(rows: (typeof siteUpdates.$inferSelect)[]) {
  const db = await getDb();
  const ids = rows.map((row) => row.id);
  const links = rows.length
    ? await db
        .select({
          siteUpdateId: siteUpdateDocuments.siteUpdateId,
          document: documents,
        })
        .from(siteUpdateDocuments)
        .innerJoin(documents, eq(siteUpdateDocuments.documentId, documents.id))
        .where(inArray(siteUpdateDocuments.siteUpdateId, ids))
    : [];
  return rows.map((row) => ({
    ...row,
    documents: links.filter((link) => link.siteUpdateId === row.id).map((link) => link.document),
  }));
}

export async function GET(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const filters = [];
  if (from) filters.push(gte(siteUpdates.date, from));
  if (to) filters.push(lte(siteUpdates.date, to));
  const rows = await db
    .select()
    .from(siteUpdates)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(siteUpdates.date), desc(siteUpdates.createdAt));
  return NextResponse.json(await logsWithDocuments(rows));
}

export async function POST(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = logSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Date and work completed are required");
  const projectId = await defaultProjectId();
  if (!projectId) return jsonError("No project configured", 400);
  const db = await getDb();
  const [row] = await db
    .insert(siteUpdates)
    .values({
      projectId,
      date: parsed.data.date,
      workCompleted: parsed.data.workCompleted,
      workInProgress: parsed.data.workInProgress || null,
      workPlanned: parsed.data.workPlanned || null,
      blockers: parsed.data.blockers || null,
      materialsReceived: parsed.data.materialsReceived || null,
      notes: parsed.data.notes || null,
      status: parsed.data.status || "normal",
    })
    .returning();
  const documentIds = [...new Set(parsed.data.documentIds ?? [])];
  if (documentIds.length) {
    await db.insert(siteUpdateDocuments).values(documentIds.map((documentId) => ({ siteUpdateId: row.id, documentId }))).onConflictDoNothing();
  }
  const [withDocs] = await logsWithDocuments([row]);
  return NextResponse.json(withDocs, { status: 201 });
}
