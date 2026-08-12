import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-guards";
import { getCompanyTeamPageData } from "@/lib/sales/get-company-team-page-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireRoles(["CLIENT_MANAGER", "SUPER_ADMIN"]);
  if (guard.error) return guard.error;
  const { session } = guard;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId") || session!.clientId;

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  if (session!.role === "CLIENT_MANAGER" && session!.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await getCompanyTeamPageData({
      clientId,
      actor: {
        userId: session!.userId,
        role: session!.role,
        clientId: session!.clientId,
      },
      alsoSells: Boolean(session!.alsoSells),
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[client/team]", err);
    return NextResponse.json({ error: "Failed to load team" }, { status: 500 });
  }
}
