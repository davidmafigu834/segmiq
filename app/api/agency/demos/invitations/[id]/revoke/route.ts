import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { isGuestAccessEnabled } from "@/lib/demo/deployment";
import { revokeDemoInvitation } from "@/lib/demo/guest-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isGuestAccessEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const admin = await requireSuperAdmin();
  if ("error" in admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await revokeDemoInvitation(params.id);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
