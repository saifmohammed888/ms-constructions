import { NextResponse } from "next/server";
import { googleAuthUrl, googleConfigured } from "@/lib/google";
import { jsonError } from "@/lib/http";

export async function GET() {
  if (!googleConfigured()) {
    return jsonError("Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on Vercel first.", 400);
  }
  return NextResponse.redirect(googleAuthUrl());
}
