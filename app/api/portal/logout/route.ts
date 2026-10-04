import { NextResponse } from "next/server";
import { portalOriginOk } from "@/lib/portal/auth";
import { logoutPortal } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!portalOriginOk(req)) return NextResponse.json({ error: "Unauthorised." }, { status: 403 });
  await logoutPortal();
  return NextResponse.json({ ok: true });
}
