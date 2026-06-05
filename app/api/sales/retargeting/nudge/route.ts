import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-guards";
import { recordRetargetingNudge } from "@/lib/retargeting";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = await requireRoles(["SALESPERSON", "CLIENT_MANAGER"]);
  if (guard.error) return guard.error;
  const { session } = guard;

  const body = await req.json().catch(() => ({}));
  const clientId = body.clientId as string | undefined;
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  if (session!.role === "CLIENT_MANAGER" && session!.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const source =
    session!.role === "CLIENT_MANAGER" ? "client_manager" : "salesperson";

  const result = await recordRetargetingNudge(
    clientId,
    {
      id: session!.userId,
      name: session!.user.name ?? "User",
      role: session!.role,
    },
    source
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 429 });
  }

  return NextResponse.json({ ok: true });
}
