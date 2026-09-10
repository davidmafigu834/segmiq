import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/rbac/require";
import { P } from "@/lib/auth/rbac/permissions";
import { getCompanyTeamMemberOverview } from "@/lib/sales/get-company-team-member-overview";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { memberId: string } }
) {
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
    const data = await getCompanyTeamMemberOverview({
      clientId,
      memberId: params.memberId,
      alsoSells: Boolean(auth.alsoSells),
    });
    if (!data) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[client/team/member]", err);
    return NextResponse.json({ error: "Failed to load team member" }, { status: 500 });
  }
}
