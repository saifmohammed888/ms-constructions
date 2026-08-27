import { NextResponse } from "next/server";
import { runBackup } from "@/lib/backup";
import { jsonError } from "@/lib/http";

export async function POST() {
  try {
    const result = await runBackup();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Backup failed";
    return jsonError(msg, 400);
  }
}
