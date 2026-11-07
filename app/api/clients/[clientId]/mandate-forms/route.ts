import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { sellerIntakeEnabled } from "@/lib/real-estate/seller-intake/flag";
import { listMandateForms, type IntakeActor } from "@/lib/real-estate/seller-intake/service";

export const dynamic = "force-dynamic";

function actorFrom(session: { userId: string; role: string; clientId: string | null; user?: { name?: string | null } }): IntakeActor {
  return { id: session.userId, name: session.user?.name ?? "Agent", role: session.role, clientId: session.clientId };
}

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  if (!sellerIntakeEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const result = await listMandateForms({ clientId: params.clientId, actor: actorFrom(g.session) });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ forms: result.forms });
}
