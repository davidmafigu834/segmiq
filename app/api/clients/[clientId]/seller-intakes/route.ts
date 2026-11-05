import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { sellerIntakeEnabled } from "@/lib/real-estate/seller-intake/flag";
import { createSellerIntake, listSellerIntakes, type IntakeActor } from "@/lib/real-estate/seller-intake/service";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  templateId: z.string().uuid(),
  opportunityId: z.string().uuid().nullable().optional(),
  contactId: z.string().uuid().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
}).strict();

function actorFrom(session: { userId: string; role: string; clientId: string | null; user?: { name?: string | null } }): IntakeActor {
  return { id: session.userId, name: session.user?.name ?? "Agent", role: session.role, clientId: session.clientId };
}

function hidden() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  if (!sellerIntakeEnabled()) return hidden();
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const result = await listSellerIntakes({
    clientId: params.clientId,
    actor: actorFrom(g.session),
    opportunityId: url.searchParams.get("opportunityId"),
    contactId: url.searchParams.get("contactId"),
    leadId: url.searchParams.get("leadId"),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ requests: result.requests });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  if (!sellerIntakeEnabled()) return hidden();
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const result = await createSellerIntake({ clientId: params.clientId, actor: actorFrom(g.session), ...parsed.data });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    request: result.request,
    link: `${origin}/seller-form/${result.token}`,
    expiresAt: result.expiresAt,
    delivery: "Copy or share this link. SegmiQ does not send it.",
  }, { status: 201 });
}
