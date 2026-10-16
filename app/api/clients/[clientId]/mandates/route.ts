import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectiveMandateStatus } from "@/lib/real-estate/acquisition-plan";
import {
  listAcquisitionOpportunities,
  mandateHistory,
  renewMandate,
  reviewMandate,
  revokeMandate,
  type AcquisitionActor,
} from "@/lib/real-estate/acquisition-service";
import { chunk, readAllPages, type PageFetcher } from "@/lib/real-estate/paging";

export const dynamic = "force-dynamic";

const MAX_FILTER_IDS = 250;

function actorFrom(session: { userId: string; role: string; clientId: string | null; user?: { name?: string | null } }): AcquisitionActor {
  return { id: session.userId, name: session.user?.name ?? "Agent", role: session.role, clientId: session.clientId };
}

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const actor = actorFrom(g.session);
  const url = new URL(req.url);
  const mandateId = url.searchParams.get("mandateId");
  if (mandateId) {
    const history = await mandateHistory(params.clientId, actor, mandateId);
    if (!history.ok) return NextResponse.json({ error: history.error }, { status: history.status });
    return NextResponse.json(history);
  }

  const supabase = createAdminClient();
  const agent = actor.role === "SALESPERSON";
  let visibleOpportunities: Set<string> | null = null;
  let filter: string | null = null;
  if (agent) {
    const listed = await listAcquisitionOpportunities({ clientId: params.clientId, actor });
    if (!listed.ok) return NextResponse.json({ error: listed.error }, { status: listed.status });
    visibleOpportunities = new Set(listed.opportunities.map((row) => row.id as string));
    const ids = [...visibleOpportunities];
    filter = ids.length && ids.length <= MAX_FILTER_IDS
      ? `opportunity_id.in.(${ids.join(",")}),responsible_agent_id.eq.${actor.id}`
      : ids.length
        ? null
        : `responsible_agent_id.eq.${actor.id}`;
  }

  const fetchPage: PageFetcher = (from, to) => {
    let query = supabase.from("real_estate_mandates").select("*").eq("client_id", params.clientId);
    if (filter) query = query.or(filter);
    return query.order("expiry_date", { ascending: true, nullsFirst: false }).order("id").range(from, to);
  };
  const result = await readAllPages(fetchPage, { pageSize: 500, ceiling: 10000 });
  if (result.error) return NextResponse.json({ error: result.error.message ?? "Could not load mandates." }, { status: 500 });

  let rows = result.rows;
  if (agent && visibleOpportunities) {
    rows = rows.filter(
      (row) => row.responsible_agent_id === actor.id || (row.opportunity_id && visibleOpportunities?.has(row.opportunity_id as string))
    );
  }

  const listingIds = [...new Set(rows.map((row) => row.listing_id as string | null).filter((id): id is string => Boolean(id)))];
  const opportunityIds = [...new Set(rows.map((row) => row.opportunity_id as string | null).filter((id): id is string => Boolean(id)))];
  const listingLabel = new Map<string, string>();
  const opportunityLabel = new Map<string, string>();
  for (const ids of chunk(listingIds, 200)) {
    const { data } = await supabase.from("listings").select("id, address, suburb").eq("client_id", params.clientId).in("id", ids);
    for (const row of data ?? []) listingLabel.set(row.id as string, [row.address, row.suburb].filter(Boolean).join(", ") || "Listing");
  }
  for (const ids of chunk(opportunityIds, 200)) {
    const { data } = await supabase
      .from("real_estate_acquisition_opportunities")
      .select("id, reference_number, address, suburb")
      .eq("client_id", params.clientId)
      .in("id", ids);
    for (const row of data ?? []) {
      opportunityLabel.set(row.id as string, [row.address, row.suburb].filter(Boolean).join(", ") || String(row.reference_number ?? "Acquisition"));
    }
  }

  const mandates = rows.map((row) => ({
    ...row,
    propertyLabel:
      (row.listing_id && listingLabel.get(row.listing_id as string)) ||
      (row.opportunity_id && opportunityLabel.get(row.opportunity_id as string)) ||
      "Property",
    displayStatus: effectiveMandateStatus({
      status: String(row.status),
      expiryDate: (row.expiry_date as string | null) ?? null,
      revocationEffectiveDate: (row.revocation_effective_date as string | null) ?? null,
    }),
  }));
  return NextResponse.json({ mandates, incomplete: result.incomplete, canReview: actor.role === "CLIENT_MANAGER" || actor.role === "SUPER_ADMIN" });
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("review"),
    mandateId: z.string().uuid(),
    decision: z.enum(["approved", "rejected"]),
    note: z.string().max(2000).nullable().optional(),
  }),
  z.object({
    action: z.literal("renew"),
    mandateId: z.string().uuid(),
    startDate: isoDate,
    expiryDate: isoDate,
    mandateType: z.enum(["sole", "joint", "open"]).nullable().optional(),
    terms: z.string().max(5000).nullable().optional(),
    documentId: z.string().uuid().nullable().optional(),
    responsibleAgentId: z.string().uuid().nullable().optional(),
    submit: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("revoke"),
    mandateId: z.string().uuid(),
    reason: z.string().min(3).max(2000),
    effectiveDate: isoDate,
    reference: z.string().max(200).nullable().optional(),
  }),
]);

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const actor = actorFrom(g.session);
  const body = parsed.data;
  const result =
    body.action === "review"
      ? await reviewMandate({ clientId: params.clientId, actor, mandateId: body.mandateId, decision: body.decision, note: body.note })
      : body.action === "renew"
        ? await renewMandate({ clientId: params.clientId, actor, ...body })
        : await revokeMandate({ clientId: params.clientId, actor, ...body });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { status: body.action === "renew" ? 201 : 200 });
}
