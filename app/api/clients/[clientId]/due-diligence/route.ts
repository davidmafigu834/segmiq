import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { dueDiligenceEnabled } from "@/lib/real-estate/due-diligence/flag";
import { mandateDraftSchema } from "@/lib/real-estate/due-diligence/schema";
import { createMandate, listMandates, type DueDiligenceActor } from "@/lib/real-estate/due-diligence/service";

export const dynamic = "force-dynamic";

function hidden() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

function actorFrom(session: { userId: string; role: string; user?: { name?: string | null } }): DueDiligenceActor {
  return { id: session.userId, role: session.role, name: session.user?.name ?? "Agent" };
}

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  if (!dueDiligenceEnabled()) return hidden();
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard && guard.error) return guard.error;
  const result = await listMandates({ clientId: params.clientId, actor: actorFrom(guard.session) });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ mandates: result.mandates });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  if (!dueDiligenceEnabled()) return hidden();
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard && guard.error) return guard.error;
  const parsed = mandateDraftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Check the seller and property details.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const result = await createMandate({ clientId: params.clientId, actor: actorFrom(guard.session), draft: parsed.data });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ mandate: result.mandate }, { status: 201 });
}
