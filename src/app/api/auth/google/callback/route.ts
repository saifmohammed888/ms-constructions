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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Google connect failed";
    console.error("google callback", msg);
    const url = new URL(`${origin}/settings`);
    url.searchParams.set("google", "error");
    url.searchParams.set("reason", msg.slice(0, 180));
    return NextResponse.redirect(url);
  }
}
