import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createAutomaticDailyLog, previousProjectDate } from "@/lib/auto-daily-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await createAutomaticDailyLog(await getDb(), previousProjectDate());
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Automatic daily log failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Could not create automatic work log" }, { status: 500 });
  }
}
