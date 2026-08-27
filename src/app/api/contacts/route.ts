import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, like, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contacts } from "@/lib/schema";
import { contactSchema } from "@/lib/zod-schemas";
import { jsonError } from "@/lib/http";

export async function GET(req: NextRequest) {
  const db = await getDb();
  const role = req.nextUrl.searchParams.get("role");
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const filters = [];
  if (role) filters.push(eq(contacts.role, role));
  if (q) {
    filters.push(
      or(like(contacts.name, `%${q}%`), like(contacts.phone, `%${q}%`), like(contacts.email, `%${q}%`))!,
    );
  }
  const rows = await db
    .select()
    .from(contacts)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(contacts.updatedAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const parsed = contactSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Check the contact details");
  const db = await getDb();
  const [row] = await db
    .insert(contacts)
    .values({
      name: parsed.data.name,
      role: parsed.data.role,
      phone: parsed.data.phone || null,
      altPhone: parsed.data.altPhone || null,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
      tags: parsed.data.tags ?? [],
    })
    .returning();
  return NextResponse.json(row);
}

export async function PATCH() {
  return jsonError("Missing id", 405);
}
