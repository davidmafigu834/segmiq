import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { buyersForListing, matchesForSearch, type BuyerActor } from "@/lib/real-estate/buyer-sales-service";

export const dynamic = "force-dynamic";

function actorFrom(session: { userId: string; role: string; clientId: string | null; user?: { name?: string | null } }): BuyerActor {
  return { id: session.userId, name: session.user?.name ?? "Agent", role: session.role, clientId: session.clientId };
}

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const searchId = url.searchParams.get("searchId");
  const listingId = url.searchParams.get("listingId");
  const actor = actorFrom(g.session);
  if (searchId) {
    const result = await matchesForSearch(params.clientId, searchId, actor);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  }
  if (listingId) {
    const result = await buyersForListing(params.clientId, listingId, actor);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: "Provide searchId or listingId." }, { status: 400 });
}
