import bcrypt from "bcryptjs";
import { getSettingsRow } from "@/lib/db";

const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const BS = String.fromCharCode(92);

// Next.js expands $VAR inside .env files, so a bcrypt hash must be stored with
// escaped dollar signs (\$2a\$12\$...). Editing tools and dashboards often lose
// that backslash, which silently mangles the hash and makes every login fail,
// so undo stray escaping before use. bcrypt hashes never contain a backslash.
function envPasswordHash() {
  const raw = process.env.APP_PASSWORD_HASH?.trim();
  if (!raw) return "";
  const cleaned = raw.split(BS).join("");
  // A malformed value must not lock the app out: ignore it and fall back to the
  // database hash (or to first-run setup) instead of rejecting every attempt.
  return BCRYPT_HASH.test(cleaned) ? cleaned : "";
}

export async function verifyPassword(password: string) {
  const envHash = envPasswordHash();
  // The env hash is authoritative and needs no database round-trip.
  if (envHash) {
    try {
      return { ok: await bcrypt.compare(password, envHash), needsSetup: false as const };
    } catch {
      return { ok: false as const, needsSetup: false as const };
    }
  }
  const row = await getSettingsRow();
  const hash = row?.passwordHash;
  if (!hash) return { ok: false as const, needsSetup: true as const };
  try {
    const ok = await bcrypt.compare(password, hash);
    return { ok, needsSetup: false as const };
  } catch {
    return { ok: false as const, needsSetup: false as const };
  }
}

export async function passwordConfigured() {
  if (envPasswordHash()) return true;
  const row = await getSettingsRow();
  return Boolean(row?.passwordHash);
}
