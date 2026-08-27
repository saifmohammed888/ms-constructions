import { NextRequest, NextResponse } from "next/server";
import { appBaseUrl, exchangeCode, saveRefreshToken } from "@/lib/google";
import { getSettingsRow } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const origin = appBaseUrl(req);
  if (!code) {
    return NextResponse.redirect(`${origin}/settings?google=denied`);
  }
  try {
    const refresh = await exchangeCode(code, origin);
    const row = await getSettingsRow();
    await saveRefreshToken(refresh, row?.projectName || "My Construction");
    return NextResponse.redirect(`${origin}/settings?google=ok`);
  } catch {
    return NextResponse.redirect(`${origin}/settings?google=error`);
  }
}
