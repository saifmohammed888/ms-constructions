import { NextRequest, NextResponse } from "next/server";
import { runBackup } from "@/lib/backup";
import { jsonError } from "@/lib/http";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  const alt = req.headers.get("x-cron-secret");
  if (!secret || (token !== secret && alt !== secret)) {
    return jsonError("Unauthorized", 401);
  }
  try {
    const result = await runBackup();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Backup failed";
    return jsonError(msg, 400);
  }
}
