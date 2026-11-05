import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { sellerIntakeEnabled } from "@/lib/real-estate/seller-intake/flag";
import { createIntakeTemplate, listIntakeTemplates, type IntakeActor } from "@/lib/real-estate/seller-intake/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["open", "sole"]),
  title: z.string().min(3).max(180),
  clauses: z.array(z.string().max(4000)).max(40),
  exclusivityMinimumMonths: z.number().int().positive().max(60).nullable().optional(),
  exclusivityContinuesUntilVaried: z.boolean().optional(),
  organisationName: z.string().min(2).max(180).optional(),
}).strict();

function actorFrom(session: { userId: string; role: string; clientId: string | null; user?: { name?: string | null } }): IntakeActor {
  return { id: session.userId, name: session.user?.name ?? "Agent", role: session.role, clientId: session.clientId };
}

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  if (!sellerIntakeEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const result = await listIntakeTemplates(params.clientId, actorFrom(g.session));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ templates: result.templates });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  if (!sellerIntakeEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const result = await createIntakeTemplate({ clientId: params.clientId, actor: actorFrom(g.session), ...parsed.data });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ template: result.template }, { status: 201 });
}
