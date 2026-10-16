import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { canApproveListings } from "@/lib/real-estate/listings";
import { callAtomic } from "@/lib/real-estate/atomic-rpc";
import { chunk, readAllPages, type PageFetcher } from "@/lib/real-estate/paging";
import {
  canOpenRegisterTransaction,
  registerIssues,
  registerMandateState,
  type RegisterRow,
} from "@/lib/real-estate/listing-register-rules";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ listingIds: z.array(z.string().uuid()).min(1).max(1000) });

type Metrics = {
  interestCount: number;
  searchCount: number;
  viewingCount: number;
  upcomingViewingCount: number;
  offerCount: number;
  activeTransactionId: string | null;
  mandateStatus: string | null;
  mandateExpiry: string | null;
};

type RpcRow = {
  listing_id: string;
  interest_count: number | string;
  search_count: number | string;
  viewing_count: number | string;
  upcoming_viewing_count: number | string;
  offer_count: number | string;
  active_transaction_id: string | null;
  mandate_status: string | null;
  mandate_expiry: string | null;
};

const ACTIVE_OFFER = ["submitted", "countered", "negotiating", "accepted"];
const ACTIVE_TXN = ["draft", "pending_compliance", "in_progress"];
const CEILING = 50_000;

function emptyMetrics(): Metrics {
  return {
    interestCount: 0,
    searchCount: 0,
    viewingCount: 0,
    upcomingViewingCount: 0,
    offerCount: 0,
    activeTransactionId: null,
    mandateStatus: null,
    mandateExpiry: null,
  };
}

async function metricsFallback(
  clientId: string,
  ids: string[]
): Promise<{ metrics: Map<string, Metrics>; incomplete: boolean; error: string | null }> {
  const supabase = createAdminClient();
  const metrics = new Map(ids.map((id) => [id, emptyMetrics()]));
  const searches = new Map<string, Set<string>>();
  const txnCreated = new Map<string, string>();
  const mandatePick = new Map<string, { approved: boolean; created: string }>();
  const now = Date.now();
  let incomplete = false;

  for (const part of chunk(ids, 200)) {
    const page =
      (table: string, columns: string, filter?: { notStatus?: string; statuses?: string[] }): PageFetcher =>
      async (from, to) => {
        let q = supabase.from(table).select(columns).eq("client_id", clientId).in("listing_id", part);
        if (filter?.notStatus) q = q.neq("status", filter.notStatus);
        if (filter?.statuses) q = q.in("status", filter.statuses);
        const { data, error } = await q.order("id", { ascending: true }).range(from, to);
        return { data: (data ?? []) as unknown[], error };
      };
    const opts = { pageSize: 1000, ceiling: CEILING };
    const [interests, viewings, offers, txns, mandates] = await Promise.all([
      readAllPages(page("real_estate_property_interests", "id, listing_id, search_id, interest_state"), opts),
      readAllPages(page("viewings", "id, listing_id, status, scheduled_at", { notStatus: "cancelled" }), opts),
      readAllPages(page("real_estate_offers", "id, listing_id", { statuses: ACTIVE_OFFER }), opts),
      readAllPages(page("real_estate_transactions", "id, listing_id, created_at", { statuses: ACTIVE_TXN }), opts),
      readAllPages(page("real_estate_mandates", "id, listing_id, status, expiry_date, created_at"), opts),
    ]);
    for (const result of [interests, viewings, offers, txns, mandates]) {
      if (result.error) return { metrics, incomplete: true, error: result.error.message ?? "Register counts could not be loaded." };
      if (result.incomplete) incomplete = true;
    }

    for (const row of interests.rows) {
      const m = metrics.get(String(row.listing_id));
      if (!m || row.interest_state === "not_interested") continue;
      m.interestCount += 1;
      if (row.search_id) {
        const set = searches.get(String(row.listing_id)) ?? new Set<string>();
        set.add(String(row.search_id));
        searches.set(String(row.listing_id), set);
      }
    }
    for (const row of viewings.rows) {
      const m = metrics.get(String(row.listing_id));
      if (!m) continue;
      m.viewingCount += 1;
      if (row.status === "scheduled" && row.scheduled_at && Date.parse(String(row.scheduled_at)) >= now) {
        m.upcomingViewingCount += 1;
      }
    }
    for (const row of offers.rows) {
      const m = metrics.get(String(row.listing_id));
      if (m) m.offerCount += 1;
    }
    for (const row of txns.rows) {
      const listingId = String(row.listing_id);
      const m = metrics.get(listingId);
      const created = String(row.created_at ?? "");
      if (!m) continue;
      if (!m.activeTransactionId || created > (txnCreated.get(listingId) ?? "")) {
        m.activeTransactionId = String(row.id);
        txnCreated.set(listingId, created);
      }
    }
    for (const row of mandates.rows) {
      const listingId = String(row.listing_id);
      const m = metrics.get(listingId);
      if (!m) continue;
      const approved = row.status === "approved";
      const created = String(row.created_at ?? "");
      const current = mandatePick.get(listingId);
      const better =
        !current || (approved && !current.approved) || (approved === current.approved && created > current.created);
      if (better) {
        mandatePick.set(listingId, { approved, created });
        m.mandateStatus = String(row.status);
        m.mandateExpiry = (row.expiry_date as string | null) ?? null;
      }
    }
  }
  for (const [listingId, set] of searches) {
    const m = metrics.get(listingId);
    if (m) m.searchCount = set.size;
  }
  return { metrics, incomplete, error: null };
}

async function loadMetrics(clientId: string, ids: string[]) {
  const rpc = await callAtomic<RpcRow[]>("re_listing_register_metrics", {
    p_client_id: clientId,
    p_listing_ids: ids,
  });
  if (rpc.kind === "error") return { metrics: new Map<string, Metrics>(), incomplete: false, error: rpc.error };
  if (rpc.kind === "missing") return metricsFallback(clientId, ids);
  const metrics = new Map<string, Metrics>();
  for (const row of rpc.data ?? []) {
    metrics.set(String(row.listing_id), {
      interestCount: Number(row.interest_count ?? 0),
      searchCount: Number(row.search_count ?? 0),
      viewingCount: Number(row.viewing_count ?? 0),
      upcomingViewingCount: Number(row.upcoming_viewing_count ?? 0),
      offerCount: Number(row.offer_count ?? 0),
      activeTransactionId: row.active_transaction_id,
      mandateStatus: row.mandate_status,
      mandateExpiry: row.mandate_expiry,
    });
  }
  return { metrics, incomplete: false, error: null as string | null };
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Send between 1 and 1000 listing ids." }, { status: 400 });

  const actorId = g.session.userId as string;
  const isManager = canApproveListings(g.session.role);
  const ids = [...new Set(parsed.data.listingIds)];
  const supabase = createAdminClient();

  const listings: Record<string, unknown>[] = [];
  for (const part of chunk(ids, 200)) {
    const { data, error } = await supabase
      .from("listings")
      .select("id, agent_id, status, approval_status, price, photos, mandate_type, mandate_expiry_date, acquisition_opportunity_id")
      .eq("client_id", params.clientId)
      .in("id", part);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    listings.push(...((data ?? []) as Record<string, unknown>[]));
  }
  const ownIds = listings.map((l) => String(l.id));
  if (!ownIds.length) return NextResponse.json({ rows: [], incomplete: false });

  const loaded = await loadMetrics(params.clientId, ownIds);
  if (loaded.error) return NextResponse.json({ error: loaded.error }, { status: 500 });

  const opportunityIds = [...new Set(listings.map((l) => l.acquisition_opportunity_id).filter(Boolean).map(String))];
  const sourcing = new Map<string, string | null>();
  for (const part of chunk(opportunityIds, 200)) {
    const { data } = await supabase
      .from("real_estate_acquisition_opportunities")
      .select("id, sourced_by_agent_id")
      .eq("client_id", params.clientId)
      .in("id", part);
    for (const row of data ?? []) sourcing.set(String(row.id), (row.sourced_by_agent_id as string | null) ?? null);
  }

  const txnIds = [...loaded.metrics.values()].map((m) => m.activeTransactionId).filter((id): id is string => Boolean(id));
  const participantsByTxn = new Map<string, string[]>();
  const listingCollaborators = new Map<string, string[]>();
  if (!isManager) {
    for (const part of chunk(txnIds, 200)) {
      const { data } = await supabase
        .from("real_estate_deal_participants")
        .select("transaction_id, user_id")
        .eq("client_id", params.clientId)
        .in("transaction_id", part)
        .is("ended_at", null);
      for (const row of data ?? []) {
        const key = String(row.transaction_id);
        participantsByTxn.set(key, [...(participantsByTxn.get(key) ?? []), String(row.user_id)]);
      }
    }
    for (const part of chunk(ownIds, 200)) {
      const { data } = await supabase
        .from("real_estate_deal_participants")
        .select("listing_id, user_id")
        .eq("client_id", params.clientId)
        .eq("user_id", actorId)
        .in("listing_id", part)
        .is("ended_at", null);
      for (const row of data ?? []) {
        const key = String(row.listing_id);
        listingCollaborators.set(key, [...(listingCollaborators.get(key) ?? []), String(row.user_id)]);
      }
    }
  }

  const userIds = new Set<string>();
  for (const l of listings) if (l.agent_id) userIds.add(String(l.agent_id));
  for (const id of sourcing.values()) if (id) userIds.add(id);
  const names = new Map<string, string>();
  for (const part of chunk([...userIds], 200)) {
    const { data } = await supabase.from("users").select("id, name").eq("client_id", params.clientId).in("id", part);
    for (const row of data ?? []) names.set(String(row.id), String(row.name ?? ""));
  }

  const rows: RegisterRow[] = listings.map((l) => {
    const id = String(l.id);
    const m = loaded.metrics.get(id) ?? emptyMetrics();
    const listingAgentId = (l.agent_id as string | null) ?? null;
    const sourcingAgentId = l.acquisition_opportunity_id ? sourcing.get(String(l.acquisition_opportunity_id)) ?? null : null;
    const mandate = registerMandateState({
      mandateStatus: m.mandateStatus,
      mandateExpiry: m.mandateExpiry,
      legacyMandateType: (l.mandate_type as string | null) ?? null,
      legacyExpiry: (l.mandate_expiry_date as string | null) ?? null,
    });
    const openTxn =
      Boolean(m.activeTransactionId) &&
      canOpenRegisterTransaction({
        isManager,
        actorId,
        listingAgentId,
        participantIds: participantsByTxn.get(m.activeTransactionId ?? "") ?? [],
      });
    const ownsListing = listingAgentId === actorId || (listingCollaborators.get(id) ?? []).includes(actorId);
    return {
      listingId: id,
      sourcingAgentId,
      sourcingAgentName: sourcingAgentId ? names.get(sourcingAgentId) ?? null : null,
      listingAgentName: listingAgentId ? names.get(listingAgentId) ?? null : null,
      mandate,
      mandateExpiry: m.mandateExpiry ?? ((l.mandate_expiry_date as string | null) ?? null),
      interestCount: m.interestCount,
      searchCount: m.searchCount,
      viewingCount: m.viewingCount,
      upcomingViewingCount: m.upcomingViewingCount,
      offerCount: m.offerCount,
      hasActiveTransaction: Boolean(m.activeTransactionId),
      activeTransactionId: openTxn ? m.activeTransactionId : null,
      issues: registerIssues({
        status: String(l.status ?? ""),
        approvalStatus: (l.approval_status as string | null) ?? null,
        agentId: listingAgentId,
        price: l.price == null ? null : Number(l.price),
        photoCount: Array.isArray(l.photos) ? l.photos.length : 0,
        mandate,
      }),
      canRequestCollaboration: !isManager && !ownsListing && Boolean(listingAgentId),
    };
  });

  return NextResponse.json({ rows, incomplete: loaded.incomplete });
}
