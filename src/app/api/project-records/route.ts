/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { approvals, decisions, drawingRevisions, materials, projects, siteUpdates, snags } from "@/lib/schema";
import { jsonError } from "@/lib/http";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const types = ["site-updates", "materials", "snags", "decisions", "approvals", "drawing-revisions"] as const;
type RecordType = (typeof types)[number];
const typeSchema = z.enum(types);

function table(type: RecordType) {
  return { "site-updates": siteUpdates, materials, snags, decisions, approvals, "drawing-revisions": drawingRevisions }[type];
}

function payload(type: RecordType, input: Record<string, unknown>, projectId: string) {
  if (type === "site-updates") return { projectId, date: input.date, workCompleted: input.workCompleted, workInProgress: input.workInProgress ?? null, workPlanned: input.workPlanned ?? null, workerCount: input.workerCount ?? null, materialsReceived: input.materialsReceived ?? null, blockers: input.blockers ?? null, floorArea: input.floorArea ?? null, status: input.status ?? "normal", notes: input.notes ?? null };
  if (type === "materials") return { projectId, material: input.material, requiredQuantity: input.requiredQuantity ?? null, receivedQuantity: input.receivedQuantity ?? null, unit: input.unit ?? null, supplierId: input.supplierId ?? null, rate: input.rate ?? null, total: input.total ?? null, deliveryDate: input.deliveryDate ?? null, storageLocation: input.storageLocation ?? null, floorArea: input.floorArea ?? null, notes: input.notes ?? null };
  if (type === "snags") return { projectId, issue: input.issue, location: input.location ?? null, responsibleId: input.responsibleId ?? null, priority: input.priority ?? "normal", dueDate: input.dueDate ?? null, status: input.status ?? "open", resolutionNotes: input.resolutionNotes ?? null };
  if (type === "decisions") return { projectId, title: input.title, description: input.description ?? null, date: input.date, responsibleId: input.responsibleId ?? null, status: input.status ?? "open", costImpact: input.costImpact ?? null, designImpact: input.designImpact ?? null };
  if (type === "approvals") return { projectId, approvalType: input.approvalType, authority: input.authority ?? null, applicationNumber: input.applicationNumber ?? null, submissionDate: input.submissionDate ?? null, approvalDate: input.approvalDate ?? null, expiryDate: input.expiryDate ?? null, status: input.status ?? "not_checked", requiredDocuments: input.requiredDocuments ?? [], nocStatus: input.nocStatus ?? null, notes: input.notes ?? null };
  return { projectId, drawingType: input.drawingType, floorArea: input.floorArea ?? null, revisionNumber: input.revisionNumber, revisionDate: input.revisionDate ?? null, preparedBy: input.preparedBy ?? null, status: input.status ?? "draft", documentId: input.documentId ?? null, isCurrent: input.isCurrent ?? false };
}

export async function GET(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = typeSchema.safeParse(req.nextUrl.searchParams.get("type"));
  if (!parsed.success) return jsonError(`type must be one of: ${types.join(", ")}`, 400);
  const db = await getDb();
  const projectId = req.nextUrl.searchParams.get("projectId");
  const selected = table(parsed.data) as any;
  const sortColumn = parsed.data === "drawing-revisions" ? selected.revisionDate : selected.createdAt;
  const rows = await (db as any).select().from(selected).where(projectId ? eq(selected.projectId, projectId) : undefined).orderBy(desc(sortColumn)) as unknown[];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedType = typeSchema.safeParse(req.nextUrl.searchParams.get("type"));
  if (!parsedType.success) return jsonError(`type must be one of: ${types.join(", ")}`, 400);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON");
  const db = await getDb();
  const projectId = String(body.projectId || (await db.select({ id: projects.id }).from(projects).limit(1))[0]?.id || "");
  if (!projectId) return jsonError("No project configured", 400);
  const data = payload(parsedType.data, body, projectId);
  const [row] = await (db as any).insert(table(parsedType.data) as any).values(data).returning();
  return NextResponse.json(row, { status: 201 });
}
