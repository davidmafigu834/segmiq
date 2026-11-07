import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { issueViewingLink, revokeJourneyLink } from "@/lib/real-estate/workflow/journey-links";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if (guard.error) return guard.error;
  const body = await req.json().catch(() => ({})) as { listingId?: string; slots?: string[]; buyerSearchId?: string | null; templateKey?: string; linkId?: string; action?: string };
  const actor = { userId: guard.session.userId, role: guard.session.role, clientId: guard.session.clientId, name: guard.session.user?.name ?? null };
  if (body.action === "revoke" && body.linkId) {
    const result = await revokeJourneyLink({ clientId: params.clientId, actor, linkId: body.linkId });
    return NextResponse.json(result.ok ? result : { error: result.error }, { status: result.ok ? 200 : result.status });
  }
  if (!body.listingId) return NextResponse.json({ error: "Choose a property." }, { status: 400 });
  const result = await issueViewingLink({
    clientId: params.clientId,
    actor,
    listingId: body.listingId,
    slots: body.slots ?? [],
    buyerSearchId: body.buyerSearchId,
    templateKey: body.templateKey || "synthetic-viewing-acknowledgement",
  });
  return NextResponse.json(result.ok ? result : { error: result.error }, { status: result.ok ? 201 : result.status });
}
