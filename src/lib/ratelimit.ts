import { and, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { loginAttempts } from "@/lib/schema";
import { eq } from "drizzle-orm";

const WINDOW_MS = 15 * 60 * 1000;
const MAX = 5;

export async function tooManyLogins(ip: string) {
  const db = await getDb();
  const since = new Date(Date.now() - WINDOW_MS);
  const rows = await db
    .select()
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ip, ip), gt(loginAttempts.createdAt, since)));
  return rows.length >= MAX;
}

export async function recordFailedLogin(ip: string) {
  const db = await getDb();
  await db.insert(loginAttempts).values({ ip });
}

export async function clearFailedLogins(ip: string) {
  const db = await getDb();
  await db.delete(loginAttempts).where(eq(loginAttempts.ip, ip));
}
