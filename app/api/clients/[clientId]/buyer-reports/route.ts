import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { buyerDailyPriorities, buyerDemandReport, buyerOperationsReport, type BuyerActor } from "@/lib/real-estate/buyer-sales-service";

export const dynamic = "force-dynamic";

function actorFrom(session: { userId: string; role: string; clientId: string | null; user?: { name?: string | null } }): BuyerActor {
  return { id: session.userId, name: session.user?.name ?? "Agent", role: session.role, clientId: session.clientId };
}

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const actor = actorFrom(g.session);
  const url = new URL(req.url);
  const kind = url.searchParams.get("report");
  if (kind === "demand") {
    const result = await buyerDemandReport(params.clientId, actor);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  }
  if (kind === "operations") {
    const result = await buyerOperationsReport(params.clientId, actor);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  }
  const result = await buyerDailyPriorities(params.clientId, actor);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
