import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import {
  listComplianceCases,
  loadComplianceActor,
  startOrGetComplianceCase,
  type ComplianceListTab,
} from "@/lib/real-estate/compliance-service";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  contact_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable().optional(),
  offer_id: z.string().uuid().nullable().optional(),
  listing_id: z.string().uuid().nullable().optional(),
  entity_type: z.enum(["individual", "corporate"]).optional(),
});

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }

  const url = new URL(req.url);
  const tab = (url.searchParams.get("tab") ?? "attention") as ComplianceListTab;
  const actor = await loadComplianceActor(session);
  const result = await listComplianceCases({
    clientId: params.clientId,
    actor,
    tab: ["attention", "under_review", "edd", "approved", "restricted", "all"].includes(tab)
      ? tab
      : "attention",
    q: url.searchParams.get("q"),
    agentId: url.searchParams.get("agent_id"),
    reviewerId: url.searchParams.get("reviewer_id"),
    risk: url.searchParams.get("risk"),
    entityType: url.searchParams.get("entity_type"),
    status: url.searchParams.get("status"),
    offerId: url.searchParams.get("offer_id"),
    leadId: url.searchParams.get("lead_id"),
    scopeOwn: session.role === "SALESPERSON",
  });
  return NextResponse.json(result);
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const actor = await loadComplianceActor(session);
  const result = await startOrGetComplianceCase({
    clientId: params.clientId,
    actor,
    contactId: parsed.data.contact_id,
    leadId: parsed.data.lead_id,
    offerId: parsed.data.offer_id,
    listingId: parsed.data.listing_id,
    entityType: parsed.data.entity_type,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ case: result.case, created: result.created });
}
