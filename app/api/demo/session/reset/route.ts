import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { getGuestContext } from "@/lib/demo/context";
import { resetSessionMutations } from "@/lib/demo/session-store";
import { clearDemoSnapshotCache } from "@/lib/demo/provider";

export const dynamic = "force-dynamic";

/** Clears only this visitor's session. It does not reset the shared staff rehearsal log. */
export async function POST(req: Request) {
  const auth = await getAuthFromRequest(req);
  const guest = getGuestContext();
  if (!auth?.demoGuest || !guest || guest.clientId !== auth.clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await resetSessionMutations(guest.sessionId);
  clearDemoSnapshotCache();
  return NextResponse.json({ ok: true });
}
