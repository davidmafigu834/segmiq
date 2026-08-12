import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-guards";
import { getCompanyTeamMemberOverview } from "@/lib/sales/get-company-team-member-overview";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { memberId: string } }
) {
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
    const data = await getCompanyTeamMemberOverview({
      clientId,
      memberId: params.memberId,
      alsoSells: Boolean(session!.alsoSells),
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
