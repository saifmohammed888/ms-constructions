import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, getSettingsRow } from "@/lib/db";
import { settings } from "@/lib/schema";
import { settingsSchema } from "@/lib/zod-schemas";
import { jsonError } from "@/lib/http";
import { googleConfigured } from "@/lib/google";

export async function GET() {
  const row = await getSettingsRow();
  if (!row) return jsonError("Missing settings", 500);
  return NextResponse.json({
    projectName: row.projectName,
    budgetTotal: row.budgetTotal ? Number(row.budgetTotal) : null,
    budgetByCategory: row.budgetByCategory ?? {},
    gcalConnected: row.gcalConnected,
    driveConnected: Boolean(row.driveFolderId),
    lastBackupAt: row.lastBackupAt,
    setupComplete: row.setupComplete,
    googleConfigured: googleConfigured(),
    hasEnvPassword: Boolean(process.env.APP_PASSWORD_HASH),
  });
}

export async function PATCH(req: NextRequest) {
  const parsed = settingsSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Check settings");
  const db = await getDb();
  const patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.budgetTotal != null) patch.budgetTotal = String(parsed.data.budgetTotal);
  if (parsed.data.password) {
    patch.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    delete patch.password;
  }
  const [row] = await db.update(settings).set(patch).where(eq(settings.id, 1)).returning();
  return NextResponse.json({
    projectName: row.projectName,
    budgetTotal: row.budgetTotal ? Number(row.budgetTotal) : null,
    budgetByCategory: row.budgetByCategory,
    gcalConnected: row.gcalConnected,
    driveConnected: Boolean(row.driveFolderId),
    lastBackupAt: row.lastBackupAt,
    setupComplete: row.setupComplete,
    googleConfigured: googleConfigured(),
    hasEnvPassword: Boolean(process.env.APP_PASSWORD_HASH),
  });
}
