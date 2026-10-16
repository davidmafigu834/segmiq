import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { ACQUISITION_SOURCES } from "@/lib/real-estate/acquisition-plan";
import { PROPERTY_CATEGORIES } from "@/lib/real-estate/buyer-match";
import { createAcquisitionOpportunity, listAcquisitionOpportunities, type AcquisitionActor } from "@/lib/real-estate/acquisition-service";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  contactId: z.string().uuid().nullable().optional(),
  ownerName: z.string().max(200).nullable().optional(),
  ownerPhone: z.string().max(50).nullable().optional(),
  suburb: z.string().max(200).nullable().optional(),
  city: z.string().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  locationNotes: z.string().max(1000).nullable().optional(),
  intent: z.enum(["sale", "rent", "unknown"]).optional(),
  source: z.enum(ACQUISITION_SOURCES).optional(),
  referralDetails: z.string().max(1000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  nextActionAt: z.string().nullable().optional(),
  propertyType: z.string().max(100).nullable().optional(),
  propertyCategory: z.enum(PROPERTY_CATEGORIES).nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  confirmNewContact: z.boolean().optional(),
});

function actorFrom(session: { userId: string; role: string; clientId: string | null; user?: { name?: string | null } }): AcquisitionActor {
  return { id: session.userId, name: session.user?.name ?? "Agent", role: session.role, clientId: session.clientId };
}

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const result = await listAcquisitionOpportunities({
    clientId: params.clientId,
    actor: actorFrom(g.session),
    q: url.searchParams.get("q"),
    stage: url.searchParams.get("stage"),
    intent: url.searchParams.get("intent"),
    source: url.searchParams.get("source"),
    agentId: url.searchParams.get("agentId"),
    overdue: url.searchParams.get("overdue") === "1",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ opportunities: result.opportunities });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const result = await createAcquisitionOpportunity({
    clientId: params.clientId,
    actor: actorFrom(g.session),
    ...parsed.data,
    idempotencyKey: req.headers.get("Idempotency-Key"),
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, duplicates: "duplicates" in result ? result.duplicates : undefined },
      { status: result.status }
    );
  }
  return NextResponse.json({ opportunity: result.opportunity }, { status: 201 });
}
