import bcrypt from "bcryptjs";
import { getSettingsRow } from "@/lib/db";

export async function verifyPassword(password: string) {
  const envHash = process.env.APP_PASSWORD_HASH;
  const row = await getSettingsRow();
  const hash = envHash || row?.passwordHash;
  if (!hash) return { ok: false as const, needsSetup: true as const };
  const ok = await bcrypt.compare(password, hash);
  return { ok, needsSetup: false as const };
}

export async function passwordConfigured() {
  const row = await getSettingsRow();
  return Boolean(process.env.APP_PASSWORD_HASH || row?.passwordHash);
}
