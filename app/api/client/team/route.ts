import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/rbac/require";
import { P } from "@/lib/auth/rbac/permissions";
import { getCompanyTeamPageData } from "@/lib/sales/get-company-team-page-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requirePermission(P.TEAM_MANAGE, req);
  if ("error" in guard) return guard.error;
  const { auth } = guard;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId") || auth.clientId;

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  if (auth.role === "CLIENT_MANAGER" && auth.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await getCompanyTeamPageData({
      clientId,
      actor: {
        userId: auth.userId,
        role: auth.role,
        clientId: auth.clientId,
      },
      alsoSells: Boolean(auth.alsoSells),
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[client/team]", err);
    return NextResponse.json({ error: "Failed to load team" }, { status: 500 });
  }
}
