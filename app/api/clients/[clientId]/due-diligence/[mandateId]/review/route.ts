import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { dueDiligenceEnabled } from "@/lib/real-estate/due-diligence/flag";
import { reviewSchema } from "@/lib/real-estate/due-diligence/schema";
import { reviewMandate, type DueDiligenceActor } from "@/lib/real-estate/due-diligence/service";

export const dynamic = "force-dynamic";

function actorFrom(session: { userId: string; role: string; user?: { name?: string | null } }): DueDiligenceActor {
  return { id: session.userId, role: session.role, name: session.user?.name ?? "Agent" };
}

export async function POST(req: Request, { params }: { params: { clientId: string; mandateId: string } }) {
  if (!dueDiligenceEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard && guard.error) return guard.error;
  const parsed = reviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the review." }, { status: 400 });
  }
  const result = await reviewMandate({
    clientId: params.clientId,
    mandateId: params.mandateId,
    actor: actorFrom(guard.session),
    command: parsed.data,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
