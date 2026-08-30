import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { canManageListings } from "@/lib/real-estate/helpers";
import { getAgentSupervision } from "@/lib/real-estate/agent-supervision";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  if (!canManageListings(g.session.role)) {
    return NextResponse.json({ error: "Managers only" }, { status: 403 });
  }
  const agents = await getAgentSupervision(params.clientId);
  return NextResponse.json({ agents });
}
