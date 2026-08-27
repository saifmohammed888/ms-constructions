import { NextRequest, NextResponse } from "next/server";
import { appBaseUrl, googleAuthUrl, googleConfigured } from "@/lib/google";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return jsonError("Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on Vercel first.", 400);
  }
  const base = appBaseUrl(req);
  return NextResponse.redirect(googleAuthUrl(base));
}
