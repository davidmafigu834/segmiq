import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { PROPERTY_CATEGORIES, SEARCH_STAGES } from "@/lib/real-estate/buyer-match";
import { getBuyerSearchBundle, updateBuyerSearch, type BuyerActor } from "@/lib/real-estate/buyer-sales-service";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  pipelineStage: z.enum(SEARCH_STAGES).optional(),
  propertyType: z.string().max(100).nullable().optional(),
  propertyCategories: z.array(z.enum(PROPERTY_CATEGORIES)).max(PROPERTY_CATEGORIES.length).optional(),
  locations: z.array(z.string().max(120)).max(12).optional(),
  budgetMin: z.number().nullable().optional(),
  budgetMax: z.number().nullable().optional(),
  bedrooms: z.number().int().nullable().optional(),
  bathrooms: z.number().int().nullable().optional(),
  timeframe: z.string().max(200).nullable().optional(),
  readiness: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  features: z.string().max(2000).nullable().optional(),
  amenities: z.string().max(2000).nullable().optional(),
  leaseMonths: z.number().int().nullable().optional(),
  moveInDate: z.string().nullable().optional(),
  allowAboveBudget: z.boolean().optional(),
  nextActionAt: z.string().nullable().optional(),
  nextActionNote: z.string().max(500).nullable().optional(),
  closureReason: z.string().max(500).nullable().optional(),
  assignedAgentId: z.string().uuid().nullable().optional(),
});

function actorFrom(session: { userId: string; role: string; clientId: string | null; user?: { name?: string | null } }): BuyerActor {
  return { id: session.userId, name: session.user?.name ?? "Agent", role: session.role, clientId: session.clientId };
}

export async function GET(_req: Request, { params }: { params: { clientId: string; searchId: string } }) {
  const g = await requireClientAccessFromRequest(_req, params.clientId);
  if ("error" in g) return g.error;
  const result = await getBuyerSearchBundle(params.clientId, params.searchId, actorFrom(g.session));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

export async function PATCH(req: Request, { params }: { params: { clientId: string; searchId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const result = await updateBuyerSearch({
    clientId: params.clientId,
    searchId: params.searchId,
    actor: actorFrom(g.session),
    patch: parsed.data,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ search: result.search });
}
