import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { demoGuestHome } from "@/lib/demo/allowlist";
import { DemoAccessDenied } from "@/lib/demo/errors";
import { switchGuestPersona } from "@/lib/demo/guest-session";
import { clearDemoSnapshotCache } from "@/lib/demo/provider";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.demoGuest || !auth.clientId || !auth.sessionId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as { personaKey?: unknown } | null;
  const personaKey = typeof body?.personaKey === "string" ? body.personaKey : "";
  try {
    const next = await switchGuestPersona(auth.sessionId, auth.clientId, personaKey);
    clearDemoSnapshotCache();
    return NextResponse.json({
      ok: true,
      personaKey: next.personaKey,
      role: next.role,
      redirectTo: demoGuestHome(next.role),
    });
  } catch (error) {
    if (error instanceof DemoAccessDenied) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }
}
