import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import {
  buyerSearchMetrics,
  createBuyerSearch,
  listBuyerSearches,
  type BuyerActor,
} from "@/lib/real-estate/buyer-sales-service";
import { PROPERTY_CATEGORIES } from "@/lib/real-estate/buyer-match";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  contactId: z.string().uuid().nullable().optional(),
  name: z.string().max(200).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  confirmNewContact: z.boolean().optional(),
  intent: z.enum(["purchase", "rental"]),
  propertyType: z.string().max(100).nullable().optional(),
  propertyCategories: z.array(z.enum(PROPERTY_CATEGORIES)).max(PROPERTY_CATEGORIES.length).optional(),
  locations: z.array(z.string().max(120)).max(12).optional(),
  budgetMin: z.number().nullable().optional(),
  budgetMax: z.number().nullable().optional(),
  currency: z.string().max(3).optional(),
  bedrooms: z.number().int().nullable().optional(),
  bathrooms: z.number().int().nullable().optional(),
  landSize: z.string().max(80).nullable().optional(),
  buildingSize: z.string().max(80).nullable().optional(),
  features: z.string().max(2000).nullable().optional(),
  amenities: z.string().max(2000).nullable().optional(),
  timeframe: z.string().max(200).nullable().optional(),
  readiness: z.string().max(200).nullable().optional(),
  leaseMonths: z.number().int().nullable().optional(),
  moveInDate: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  nextActionAt: z.string().nullable().optional(),
  nextActionNote: z.string().max(500).nullable().optional(),
  allowAboveBudget: z.boolean().optional(),
  leadId: z.string().uuid().nullable().optional(),
});

function actorFrom(session: { userId: string; role: string; clientId: string | null; user?: { name?: string | null } }): BuyerActor {
  return { id: session.userId, name: session.user?.name ?? "Agent", role: session.role, clientId: session.clientId };
}

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  if (url.searchParams.get("metrics") === "1") {
    const metrics = await buyerSearchMetrics(params.clientId, actorFrom(g.session));
    if (!metrics.ok) return NextResponse.json({ error: metrics.error }, { status: metrics.status });
    return NextResponse.json(metrics);
  }
  const result = await listBuyerSearches({
    clientId: params.clientId,
    actor: actorFrom(g.session),
    q: url.searchParams.get("q"),
    intent: url.searchParams.get("intent"),
    stage: url.searchParams.get("stage"),
    status: url.searchParams.get("status"),
    agentId: url.searchParams.get("agentId"),
    location: url.searchParams.get("location"),
    propertyType: url.searchParams.get("propertyType"),
    followUp: url.searchParams.get("followUp"),
    contactId: url.searchParams.get("contactId"),
    page: Number(url.searchParams.get("page") ?? "1"),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const result = await createBuyerSearch({ clientId: params.clientId, actor: actorFrom(g.session), ...parsed.data });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, duplicates: "duplicates" in result ? result.duplicates : undefined },
      { status: result.status }
    );
  }
  return NextResponse.json({ search: result.search }, { status: 201 });
}
