import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { readDemoSessionCookie } from "@/lib/demo/cookie";
import { isGuestAccessEnabled } from "@/lib/demo/deployment";
import { DemoAccessDenied } from "@/lib/demo/errors";
import { createDemoInvitation } from "@/lib/demo/guest-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireSuperAdmin();
  if ("error" in admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { loadDemoAdminDirectory } = await import("@/lib/demo/admin-directory");
  const directory = await loadDemoAdminDirectory();
  return NextResponse.json(directory, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!isGuestAccessEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const admin = await requireSuperAdmin();
  if ("error" in admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (readDemoSessionCookie(req.headers.get("cookie"))) {
    return NextResponse.json({ error: "Conflicting sessions" }, { status: 409 });
  }
  const body = (await req.json().catch(() => null)) as { clientId?: unknown; lifetimeMs?: unknown } | null;
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const lifetimeMs = typeof body?.lifetimeMs === "number" ? body.lifetimeMs : null;
  if (!clientId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const created = await createDemoInvitation({
      clientId,
      createdBy: admin.session.userId,
      lifetimeMs,
    });
    const url = new URL(`/demo/${created.token}`, req.url);
    return NextResponse.json(
      {
        invitationId: created.invitationId,
        expiresAt: created.expiresAt,
        url: url.toString(),
      },
      { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }
    );
  } catch (error) {
    if (error instanceof DemoAccessDenied) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }
}
