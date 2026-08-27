import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, saveRefreshToken } from "@/lib/google";
import { getSettingsRow } from "@/lib/db";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const origin = process.env.APP_URL || req.nextUrl.origin;
  if (!code) {
    return NextResponse.redirect(`${origin}/settings?google=denied`);
  }
  try {
    const refresh = await exchangeCode(code);
    const row = await getSettingsRow();
    await saveRefreshToken(refresh, row?.projectName || "My Construction");
    return NextResponse.redirect(`${origin}/settings?google=ok`);
  } catch {
    return NextResponse.redirect(`${origin}/settings?google=error`);
  }
}
