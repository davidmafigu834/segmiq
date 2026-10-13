import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { credentialsConflict } from "@/lib/demo/allowlist";
import { readDemoSessionCookie } from "@/lib/demo/cookie";
import {
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_TTL_MS,
  demoSessionCookieOptions,
  isGuestAccessEnabled,
} from "@/lib/demo/deployment";
import { redeemInvitation } from "@/lib/demo/guest-session";
import { hashToken } from "@/lib/demo/tokens";

export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const headers = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  };
  if (!isGuestAccessEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  }
  const session = await getServerSession(authOptions);
  const demoCookie = readDemoSessionCookie(req.headers.get("cookie"));
  if (credentialsConflict(Boolean(session?.userId), Boolean(demoCookie)) || session?.userId) {
    return NextResponse.json(
      { error: "Sign out of SegmiQ before opening a demonstration link." },
      { status: 409, headers }
    );
  }

  const ipHash = await hashToken(clientIp(req));
  const redeemed = await redeemInvitation({ token: params.token, ipHash });
  if (!redeemed.ok) {
    return NextResponse.json({ error: "Not found" }, { status: redeemed.status, headers });
  }

  const response = NextResponse.redirect(new URL(redeemed.redirectTo, req.url), { headers });
  response.cookies.set(DEMO_SESSION_COOKIE, redeemed.secret, demoSessionCookieOptions(Math.floor(DEMO_SESSION_TTL_MS / 1000)));
  return response;
}
