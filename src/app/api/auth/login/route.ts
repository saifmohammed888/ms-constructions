import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/zod-schemas";
import { verifyPassword, passwordConfigured } from "@/lib/password";
import { createSession } from "@/lib/session";
import { tooManyLogins, recordFailedLogin, clearFailedLogins } from "@/lib/ratelimit";
import { clientIp, jsonError } from "@/lib/http";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (await tooManyLogins(ip)) {
    return jsonError("Too many attempts. Try again in 15 minutes.", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request");
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return jsonError("Wrong password", 401);

  const configured = await passwordConfigured();
  if (!configured) {
    if (parsed.data.password.length < 6) return jsonError("Use at least 6 characters");
    const hash = await bcrypt.hash(parsed.data.password, 10);
    const db = await getDb();
    await db.update(settings).set({ passwordHash: hash }).where(eq(settings.id, 1));
    await createSession();
    return NextResponse.json({ ok: true, setup: true });
  }

  const result = await verifyPassword(parsed.data.password);
  if (!result.ok) {
    await recordFailedLogin(ip);
    return jsonError("Wrong password", 401);
  }
  await clearFailedLogins(ip);
  await createSession();
  return NextResponse.json({ ok: true });
}
