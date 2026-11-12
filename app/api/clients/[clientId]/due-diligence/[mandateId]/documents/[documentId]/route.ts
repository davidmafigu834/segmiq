import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { dueDiligenceEnabled } from "@/lib/real-estate/due-diligence/flag";
import { signDocument, type DueDiligenceActor } from "@/lib/real-estate/due-diligence/service";

export const dynamic = "force-dynamic";

function actorFrom(session: { userId: string; role: string; user?: { name?: string | null } }): DueDiligenceActor {
  return { id: session.userId, role: session.role, name: session.user?.name ?? "Agent" };
}

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; mandateId: string; documentId: string } }
) {
  if (!dueDiligenceEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard && guard.error) return guard.error;
  const result = await signDocument({
    clientId: params.clientId,
    mandateId: params.mandateId,
    documentId: params.documentId,
    actor: actorFrom(guard.session),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ url: result.url });
}
