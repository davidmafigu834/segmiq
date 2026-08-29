import { createAdminClient } from "@/lib/supabase/admin";
import { logReActivity } from "@/lib/lead-events";
import { listingLabel } from "@/lib/real-estate/helpers";
import { operationalComplianceLabel, type ComplianceStatus } from "@/lib/real-estate/compliance";
import {
  applyOfferMutation,
  canCreateOfferForAssignment,
  canViewOfferCommission,
  canWriteOffer,
  deriveOfferAttention,
  effectiveOfferStatus,
  formatOfferMoney,
  isOfferActiveStatus,
  isValidOfferCurrency,
  listingAllowsOffer,
  listingStatusAfterAccept,
  nextActionForOffer,
  pickLeadOfferSnapshot,
  rankOfferAttention,
  relativeTimeLabel,
  RE_OFFER_EVENT_LABEL,
  reOfferStatusLabel,
  type OfferAttentionReason,
  type OfferSnapshot,
  type ReOfferAction,
  type ReOfferEventType,
  type ReOfferStatus,
} from "@/lib/real-estate/offers";

export type OfferListTab = "active" | "accepted" | "rejected" | "withdrawn" | "expired" | "all";

export type OfferListRow = {
  id: string;
  listingId: string;
  propertyLabel: string;
  listingPrice: number | null;
  listingPriceLabel: string | null;
  listingStatus: string;
  buyerName: string | null;
  contactId: string;
  leadId: string | null;
  currentAmount: number;
  originalAmount: number;
  currentAmountLabel: string;
  currency: string;
  status: ReOfferStatus;
  statusLabel: string;
  agentId: string | null;
  agentName: string | null;
  lastActivityAt: string;
  lastActivityLabel: string;
  lastEventLabel: string | null;
  nextActionLabel: string;
  expiryDate: string | null;
  complianceStatus: string | null;
  complianceLabel: string | null;
};

export type OfferEventRow = {
  id: string;
  eventType: ReOfferEventType;
  label: string;
  amount: number | null;
  amountLabel: string | null;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
};

type Actor = { id: string; name: string; role: string; clientId: string | null };

export async function assertRealEstateClient(clientId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("clients")
    .select("business_type")
    .eq("id", clientId)
    .maybeSingle();
  return data?.business_type === "real_estate";
}

function snapshotFromRow(row: Record<string, unknown>): OfferSnapshot {
  return {
    status: row.status as ReOfferStatus,
    original_offer_amount: Number(row.original_offer_amount),
    current_offer_amount: Number(row.current_offer_amount),
    conditions: (row.conditions as string | null) ?? null,
    expiry_date: (row.expiry_date as string | null) ?? null,
    internal_notes: (row.internal_notes as string | null) ?? null,
    submitted_at: (row.submitted_at as string | null) ?? null,
    accepted_at: (row.accepted_at as string | null) ?? null,
    rejected_at: (row.rejected_at as string | null) ?? null,
    withdrawn_at: (row.withdrawn_at as string | null) ?? null,
    rejected_reason: (row.rejected_reason as string | null) ?? null,
    withdrawn_reason: (row.withdrawn_reason as string | null) ?? null,
    updated_at: row.updated_at as string,
  };
}

async function appendEvent(opts: {
  offerId: string;
  clientId: string;
  eventType: ReOfferEventType;
  amount: number | null;
  note: string | null;
  createdBy: string | null;
}) {
  const supabase = createAdminClient();
  await supabase.from("real_estate_offer_events").insert({
    offer_id: opts.offerId,
    client_id: opts.clientId,
    event_type: opts.eventType,
    amount: opts.amount,
    note: opts.note,
    created_by: opts.createdBy,
  });
}

async function syncLeadOfferSnapshot(leadId: string, clientId: string) {
  const supabase = createAdminClient();
  const { data: offers } = await supabase
    .from("real_estate_offers")
    .select("status, current_offer_amount, listing_id, updated_at")
    .eq("client_id", clientId)
    .eq("lead_id", leadId);

  const pick = pickLeadOfferSnapshot(
    (offers ?? []).map((o) => ({
      status: o.status as ReOfferStatus,
      current_offer_amount: Number(o.current_offer_amount),
      listing_id: o.listing_id as string,
      updated_at: o.updated_at as string,
    }))
  );

  const { data: lead } = await supabase
    .from("leads")
    .select("id, linked_listing_id")
    .eq("id", leadId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!lead) return;

  const patch: Record<string, unknown> = {};
  if (pick) {
    patch.offer_status = pick.offer_status;
    patch.offer_amount = pick.offer_amount;
    if (!lead.linked_listing_id) patch.linked_listing_id = pick.listing_id;
  }
  if (Object.keys(patch).length === 0) return;
  await supabase.from("leads").update(patch).eq("id", leadId).eq("client_id", clientId);
}

const RE_KIND_FOR_EVENT: Partial<Record<ReOfferEventType, Parameters<typeof logReActivity>[0]["kind"]>> = {
  OFFER_CREATED: "offer_created",
  OFFER_SUBMITTED: "offer_submitted",
  SELLER_COUNTER: "offer_countered",
  BUYER_REVISED: "offer_revised",
  OFFER_ACCEPTED: "offer_accepted",
  OFFER_REJECTED: "offer_rejected",
  OFFER_WITHDRAWN: "offer_withdrawn",
};

async function logInquiryOfferActivity(opts: {
  leadId: string | null;
  clientId: string;
  actor: Actor;
  eventType: ReOfferEventType;
  amount: number | null;
  currency: string;
  extra?: Record<string, unknown>;
}) {
  if (!opts.leadId) return;
  const kind = RE_KIND_FOR_EVENT[opts.eventType];
  if (!kind) return;
  const money = formatOfferMoney(opts.amount, opts.currency);
  await logReActivity({
    leadId: opts.leadId,
    clientId: opts.clientId,
    actor: { id: opts.actor.id, name: opts.actor.name, role: opts.actor.role },
    summary: money ? `${kind.replace(/_/g, " ")} · ${money}` : kind.replace(/_/g, " "),
    kind,
    extra: { offer_amount: opts.amount, currency: opts.currency, ...(opts.extra ?? {}) },
  });
}

export async function createRealEstateOffer(opts: {
  clientId: string;
  actor: Actor;
  listingId: string;
  contactId: string;
  leadId?: string | null;
  amount: number;
  currency?: string;
  conditions?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  submit?: boolean;
}): Promise<{ ok: true; offer: Record<string, unknown> } | { ok: false; error: string; status: number }> {
  if (!Number.isFinite(opts.amount) || opts.amount <= 0) {
    return { ok: false, error: "Offer amount must be greater than 0.", status: 400 };
  }
  const currency = (opts.currency || "USD").toUpperCase();
  if (!isValidOfferCurrency(currency)) {
    return { ok: false, error: "Currency must be a 3-letter code.", status: 400 };
  }

  const supabase = createAdminClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("id, client_id, status, agent_id, address, suburb, price")
    .eq("id", opts.listingId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!listing) return { ok: false, error: "Listing not found.", status: 404 };
  if (!listingAllowsOffer(listing.status as string)) {
    return { ok: false, error: "This listing is not open to offers.", status: 409 };
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, client_id, name")
    .eq("id", opts.contactId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!contact) return { ok: false, error: "Contact not found.", status: 404 };

  let assignedToId: string | null = null;
  let leadId: string | null = opts.leadId ?? null;
  if (leadId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id, client_id, assigned_to_id, contact_id")
      .eq("id", leadId)
      .eq("client_id", opts.clientId)
      .maybeSingle();
    if (!lead) return { ok: false, error: "Inquiry not found.", status: 404 };
    assignedToId = (lead.assigned_to_id as string | null) ?? null;
    if (lead.contact_id && lead.contact_id !== opts.contactId) {
      return { ok: false, error: "Buyer does not match this inquiry.", status: 400 };
    }
  }

  if (
    !canCreateOfferForAssignment({
      role: opts.actor.role,
      userId: opts.actor.id,
      userClientId: opts.actor.clientId,
      clientId: opts.clientId,
      assignedToId,
    })
  ) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  const buyerAgentId =
    assignedToId || (opts.actor.role === "SALESPERSON" ? opts.actor.id : assignedToId);
  const now = new Date();
  const status: ReOfferStatus = opts.submit ? "submitted" : "draft";

  const { data: offer, error } = await supabase
    .from("real_estate_offers")
    .insert({
      client_id: opts.clientId,
      listing_id: opts.listingId,
      contact_id: opts.contactId,
      lead_id: leadId,
      buyer_agent_id: buyerAgentId,
      listing_agent_id: (listing.agent_id as string | null) ?? null,
      created_by: opts.actor.id,
      currency,
      original_offer_amount: opts.amount,
      current_offer_amount: opts.amount,
      status,
      conditions: opts.conditions?.trim() || null,
      expiry_date: opts.expiryDate || null,
      internal_notes: opts.notes?.trim() || null,
      submitted_at: opts.submit ? now.toISOString() : null,
    })
    .select("*")
    .maybeSingle();

  if (error || !offer) {
    return { ok: false, error: error?.message ?? "Could not create offer.", status: 500 };
  }

  await appendEvent({
    offerId: offer.id as string,
    clientId: opts.clientId,
    eventType: "OFFER_CREATED",
    amount: opts.amount,
    note: opts.notes?.trim() || null,
    createdBy: opts.actor.id,
  });
  await logInquiryOfferActivity({
    leadId,
    clientId: opts.clientId,
    actor: opts.actor,
    eventType: "OFFER_CREATED",
    amount: opts.amount,
    currency,
  });

  if (opts.submit) {
    await appendEvent({
      offerId: offer.id as string,
      clientId: opts.clientId,
      eventType: "OFFER_SUBMITTED",
      amount: opts.amount,
      note: null,
      createdBy: opts.actor.id,
    });
    await logInquiryOfferActivity({
      leadId,
      clientId: opts.clientId,
      actor: opts.actor,
      eventType: "OFFER_SUBMITTED",
      amount: opts.amount,
      currency,
    });
    if (leadId) await syncLeadOfferSnapshot(leadId, opts.clientId);
  }

  return { ok: true, offer };
}

export async function mutateRealEstateOffer(opts: {
  clientId: string;
  offerId: string;
  actor: Actor;
  action: ReOfferAction;
  amount?: number | null;
  note?: string | null;
  conditions?: string | null;
  expiryDate?: string | null;
  reason?: string | null;
  expectedUpdatedAt?: string | null;
}): Promise<
  | { ok: true; offer: Record<string, unknown>; notifyAvailable: boolean; siblingActiveCount: number }
  | { ok: false; error: string; status: number }
> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("real_estate_offers")
    .select("*")
    .eq("id", opts.offerId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Offer not found.", status: 404 };

  if (
    !canWriteOffer({
      role: opts.actor.role,
      userId: opts.actor.id,
      userClientId: opts.actor.clientId,
      offerClientId: opts.clientId,
      buyerAgentId: (row.buyer_agent_id as string | null) ?? null,
    })
  ) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  if (opts.expectedUpdatedAt && String(row.updated_at) !== opts.expectedUpdatedAt) {
    return {
      ok: false,
      error: "This offer was updated by someone else. Refresh and try again.",
      status: 409,
    };
  }

  const result = applyOfferMutation(snapshotFromRow(row), opts.action, {
    amount: opts.amount,
    note: opts.note,
    conditions: opts.conditions,
    expiry_date: opts.expiryDate,
    reason: opts.reason,
  });
  if (!result.ok) return result;

  const next = result.next;
  const { data: updatedRows, error } = await supabase
    .from("real_estate_offers")
    .update({
      status: next.status,
      original_offer_amount: next.original_offer_amount,
      current_offer_amount: next.current_offer_amount,
      conditions: next.conditions,
      expiry_date: next.expiry_date,
      internal_notes: next.internal_notes,
      submitted_at: next.submitted_at,
      accepted_at: next.accepted_at,
      rejected_at: next.rejected_at,
      withdrawn_at: next.withdrawn_at,
      rejected_reason: next.rejected_reason,
      withdrawn_reason: next.withdrawn_reason,
    })
    .eq("id", opts.offerId)
    .eq("client_id", opts.clientId)
    .eq("updated_at", row.updated_at as string)
    .select("*");

  if (error) return { ok: false, error: error.message, status: 500 };
  const updated = updatedRows?.[0];
  if (!updated) {
    return {
      ok: false,
      error: "This offer was updated by someone else. Refresh and try again.",
      status: 409,
    };
  }

  if (result.event) {
    await appendEvent({
      offerId: opts.offerId,
      clientId: opts.clientId,
      eventType: result.event.event_type,
      amount: result.event.amount,
      note: result.event.note,
      createdBy: opts.actor.id,
    });

    const currency = (updated.currency as string) || "USD";
    await logInquiryOfferActivity({
      leadId: (updated.lead_id as string | null) ?? null,
      clientId: opts.clientId,
      actor: opts.actor,
      eventType: result.event.event_type,
      amount: result.event.amount,
      currency,
    });
  }

  if (result.syncLead && updated.lead_id) {
    await syncLeadOfferSnapshot(updated.lead_id as string, opts.clientId);
  }

  if (result.listingToUnderOffer) {
    const { data: listing } = await supabase
      .from("listings")
      .select("id, status, client_id")
      .eq("id", updated.listing_id as string)
      .eq("client_id", opts.clientId)
      .maybeSingle();
    const nextStatus = listingStatusAfterAccept(listing?.status as string | undefined);
    if (listing && nextStatus) {
      await supabase
        .from("listings")
        .update({ status: nextStatus })
        .eq("id", listing.id as string)
        .eq("client_id", opts.clientId);
    }
  }

  const { count } = await supabase
    .from("real_estate_offers")
    .select("id", { count: "exact", head: true })
    .eq("client_id", opts.clientId)
    .eq("listing_id", updated.listing_id as string)
    .neq("id", opts.offerId)
    .in("status", ["draft", "submitted", "countered", "negotiating"]);

  const notifyAvailable = Boolean(
    result.event &&
      ["OFFER_SUBMITTED", "SELLER_COUNTER", "OFFER_ACCEPTED", "OFFER_REJECTED"].includes(
        result.event.event_type
      )
  );

  return {
    ok: true,
    offer: updated,
    notifyAvailable,
    siblingActiveCount: count ?? 0,
  };
}

export async function listRealEstateOffers(opts: {
  clientId: string;
  actor: Actor;
  tab?: OfferListTab;
  listingId?: string | null;
  contactId?: string | null;
  leadId?: string | null;
  agentId?: string | null;
  q?: string | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  from?: string | null;
  to?: string | null;
  scopeOwn?: boolean;
}): Promise<{
  offers: OfferListRow[];
  summary: {
    active: number;
    awaitingSeller: number;
    negotiating: number;
    acceptedThisMonth: number;
    accepted: number;
  };
  agents: Array<{ id: string; name: string }>;
  byAgent: Array<{ id: string; name: string; count: number }>;
  multiOfferListings: Array<{ listingId: string; propertyLabel: string; count: number }>;
}> {
  const supabase = createAdminClient();
  const scopeOwn = opts.scopeOwn || opts.actor.role === "SALESPERSON";

  let q = supabase.from("real_estate_offers").select("*").eq("client_id", opts.clientId);
  if (scopeOwn) q = q.eq("buyer_agent_id", opts.actor.id);
  if (opts.listingId) q = q.eq("listing_id", opts.listingId);
  if (opts.contactId) q = q.eq("contact_id", opts.contactId);
  if (opts.leadId) q = q.eq("lead_id", opts.leadId);
  if (opts.agentId) q = q.eq("buyer_agent_id", opts.agentId);
  if (opts.minAmount != null) q = q.gte("current_offer_amount", opts.minAmount);
  if (opts.maxAmount != null) q = q.lte("current_offer_amount", opts.maxAmount);
  if (opts.from) q = q.gte("created_at", opts.from);
  if (opts.to) q = q.lte("created_at", opts.to);

  const { data: rows } = await q.order("updated_at", { ascending: false }).limit(500);
  const all = rows ?? [];

  const listingIds = [...new Set(all.map((r) => r.listing_id as string))];
  const contactIds = [...new Set(all.map((r) => r.contact_id as string))];
  const agentIds = [...new Set(all.map((r) => r.buyer_agent_id as string | null).filter(Boolean))] as string[];
  const offerIds = all.map((r) => r.id as string);

  const [{ data: listings }, { data: contacts }, { data: users }, { data: lastEvents }, { data: complianceRows }] =
    await Promise.all([
    listingIds.length
      ? supabase
          .from("listings")
          .select("id, address, suburb, price, status")
          .eq("client_id", opts.clientId)
          .in("id", listingIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    contactIds.length
      ? supabase.from("contacts").select("id, name").eq("client_id", opts.clientId).in("id", contactIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    agentIds.length
      ? supabase.from("users").select("id, name").in("id", agentIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    offerIds.length
      ? supabase
          .from("real_estate_offer_events")
          .select("offer_id, event_type, created_at")
          .eq("client_id", opts.clientId)
          .in("offer_id", offerIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    offerIds.length
      ? supabase
          .from("compliance_cases")
          .select("offer_id, status")
          .eq("client_id", opts.clientId)
          .in("offer_id", offerIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const listingById = new Map((listings ?? []).map((l) => [l.id as string, l]));
  const contactById = new Map((contacts ?? []).map((c) => [c.id as string, c]));
  const userById = new Map((users ?? []).map((u) => [u.id as string, u]));
  const lastEventByOffer = new Map<string, { event_type: string; created_at: string }>();
  for (const ev of lastEvents ?? []) {
    const id = ev.offer_id as string;
    if (!lastEventByOffer.has(id)) {
      lastEventByOffer.set(id, { event_type: ev.event_type as string, created_at: ev.created_at as string });
    }
  }
  const complianceByOffer = new Map<string, string>();
  for (const c of complianceRows ?? []) {
    if (c.offer_id) complianceByOffer.set(c.offer_id as string, c.status as string);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const mapped: OfferListRow[] = all.map((row) => {
    const listing = listingById.get(row.listing_id as string);
    const contact = contactById.get(row.contact_id as string);
    const agent = row.buyer_agent_id ? userById.get(row.buyer_agent_id as string) : null;
    const status = effectiveOfferStatus(row.status as ReOfferStatus, row.expiry_date as string | null, now);
    const last = lastEventByOffer.get(row.id as string);
    const currency = (row.currency as string) || "USD";
    return {
      id: row.id as string,
      listingId: row.listing_id as string,
      propertyLabel: listing ? listingLabel(listing) : "Property",
      listingPrice: listing?.price != null ? Number(listing.price) : null,
      listingPriceLabel: listing?.price != null ? formatOfferMoney(Number(listing.price), currency) : null,
      listingStatus: (listing?.status as string) ?? "",
      buyerName: (contact?.name as string | null) ?? null,
      contactId: row.contact_id as string,
      leadId: (row.lead_id as string | null) ?? null,
      currentAmount: Number(row.current_offer_amount),
      originalAmount: Number(row.original_offer_amount),
      currentAmountLabel: formatOfferMoney(Number(row.current_offer_amount), currency) ?? "—",
      currency,
      status,
      statusLabel: reOfferStatusLabel(status),
      agentId: (row.buyer_agent_id as string | null) ?? null,
      agentName: (agent?.name as string | null) ?? null,
      lastActivityAt: last?.created_at ?? (row.updated_at as string),
      lastActivityLabel: relativeTimeLabel(last?.created_at ?? (row.updated_at as string), now),
      lastEventLabel: last?.event_type
        ? String(last.event_type).replace(/_/g, " ").toLowerCase()
        : null,
      nextActionLabel: nextActionForOffer(status).label,
      expiryDate: (row.expiry_date as string | null) ?? null,
      complianceStatus: complianceByOffer.get(row.id as string) ?? null,
      complianceLabel: operationalComplianceLabel(
        (complianceByOffer.get(row.id as string) as ComplianceStatus | undefined) ?? null
      ),
    };
  });

  const qstr = (opts.q ?? "").trim().toLowerCase();
  const searched = qstr
    ? mapped.filter(
        (r) =>
          r.propertyLabel.toLowerCase().includes(qstr) ||
          (r.buyerName ?? "").toLowerCase().includes(qstr) ||
          (r.agentName ?? "").toLowerCase().includes(qstr)
      )
    : mapped;

  const tab = opts.tab ?? "active";
  const filtered = searched.filter((r) => {
    if (tab === "all") return true;
    if (tab === "active") return isOfferActiveStatus(r.status);
    return r.status === tab;
  });

  const summary = {
    active: mapped.filter((r) => ["submitted", "countered", "negotiating"].includes(r.status)).length,
    awaitingSeller: mapped.filter((r) => r.status === "submitted").length,
    negotiating: mapped.filter((r) => r.status === "countered" || r.status === "negotiating").length,
    acceptedThisMonth: all.filter((r) => {
      const at = r.accepted_at as string | null;
      return at && new Date(at) >= monthStart && (r.status as string) === "accepted";
    }).length,
    accepted: mapped.filter((r) => r.status === "accepted").length,
  };

  const agentCounts = new Map<string, { id: string; name: string; count: number }>();
  for (const r of mapped) {
    if (!r.agentId) continue;
    const cur = agentCounts.get(r.agentId) ?? { id: r.agentId, name: r.agentName ?? "Agent", count: 0 };
    cur.count += 1;
    agentCounts.set(r.agentId, cur);
  }

  const listingCounts = new Map<string, { listingId: string; propertyLabel: string; count: number }>();
  for (const r of mapped.filter((o) => isOfferActiveStatus(o.status))) {
    const cur = listingCounts.get(r.listingId) ?? {
      listingId: r.listingId,
      propertyLabel: r.propertyLabel,
      count: 0,
    };
    cur.count += 1;
    listingCounts.set(r.listingId, cur);
  }

  return {
    offers: filtered,
    summary,
    agents: [...agentCounts.values()].map((a) => ({ id: a.id, name: a.name })),
    byAgent: [...agentCounts.values()].sort((a, b) => b.count - a.count),
    multiOfferListings: [...listingCounts.values()].filter((l) => l.count > 1),
  };
}

export async function getRealEstateOfferDetail(opts: {
  clientId: string;
  offerId: string;
  actor: Actor;
}): Promise<
  | {
      ok: true;
      offer: Record<string, unknown>;
      events: OfferEventRow[];
      listing: Record<string, unknown> | null;
      contact: Record<string, unknown> | null;
      siblingActive: OfferListRow[];
      commission: { listingPct: number | null; sellingPct: number | null } | null;
    }
  | { ok: false; error: string; status: number }
> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("real_estate_offers")
    .select("*")
    .eq("id", opts.offerId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Offer not found.", status: 404 };

  if (opts.actor.role === "SALESPERSON" && row.buyer_agent_id !== opts.actor.id) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  const [{ data: listing }, { data: contact }, { data: events }, { data: users }] = await Promise.all([
    supabase
      .from("listings")
      .select("id, address, suburb, price, status, agent_id, transaction_type")
      .eq("id", row.listing_id as string)
      .eq("client_id", opts.clientId)
      .maybeSingle(),
    supabase
      .from("contacts")
      .select("id, name, phone, email")
      .eq("id", row.contact_id as string)
      .eq("client_id", opts.clientId)
      .maybeSingle(),
    supabase
      .from("real_estate_offer_events")
      .select("*")
      .eq("offer_id", opts.offerId)
      .eq("client_id", opts.clientId)
      .order("created_at", { ascending: true }),
    supabase
      .from("users")
      .select("id, name")
      .in(
        "id",
        [row.buyer_agent_id, row.listing_agent_id, row.created_by].filter(Boolean) as string[]
      ),
  ]);

  const userById = new Map((users ?? []).map((u) => [u.id as string, u.name as string | null]));
  const currency = (row.currency as string) || "USD";

  const eventRows: OfferEventRow[] = (events ?? []).map((ev) => ({
    id: ev.id as string,
    eventType: ev.event_type as ReOfferEventType,
    label: RE_OFFER_EVENT_LABEL[ev.event_type as ReOfferEventType] ?? String(ev.event_type),
    amount: ev.amount != null ? Number(ev.amount) : null,
    amountLabel: ev.amount != null ? formatOfferMoney(Number(ev.amount), currency) : null,
    note: (ev.note as string | null) ?? null,
    createdAt: ev.created_at as string,
    createdByName: ev.created_by ? userById.get(ev.created_by as string) ?? null : null,
  }));

  const siblings = await listRealEstateOffers({
    clientId: opts.clientId,
    actor: { ...opts.actor, role: "CLIENT_MANAGER" },
    listingId: row.listing_id as string,
    tab: "active",
    scopeOwn: false,
  });

  let commission: { listingPct: number | null; sellingPct: number | null } | null = null;
  if (canViewOfferCommission(opts.actor.role) && row.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("listing_agent_commission_pct, selling_agent_commission_pct")
      .eq("id", row.lead_id as string)
      .eq("client_id", opts.clientId)
      .maybeSingle();
    if (lead) {
      commission = {
        listingPct: lead.listing_agent_commission_pct != null ? Number(lead.listing_agent_commission_pct) : null,
        sellingPct: lead.selling_agent_commission_pct != null ? Number(lead.selling_agent_commission_pct) : null,
      };
    }
  }

  return {
    ok: true,
    offer: {
      ...row,
      status: effectiveOfferStatus(row.status as ReOfferStatus, row.expiry_date as string | null),
      buyer_agent_name: row.buyer_agent_id ? userById.get(row.buyer_agent_id as string) ?? null : null,
      listing_agent_name: row.listing_agent_id ? userById.get(row.listing_agent_id as string) ?? null : null,
    },
    events: eventRows,
    listing: listing ?? null,
    contact: contact ?? null,
    siblingActive: siblings.offers.filter((o) => o.id !== opts.offerId),
    commission,
  };
}

export function offerAttentionItems(
  offers: OfferListRow[]
): Array<OfferListRow & { reason: OfferAttentionReason; why: string }> {
  const now = new Date();
  const items: Array<OfferListRow & { reason: OfferAttentionReason; why: string }> = [];
  for (const o of offers) {
    const att = deriveOfferAttention(
      { status: o.status, updatedAt: o.lastActivityAt, expiryDate: o.expiryDate },
      now
    );
    if (att) items.push({ ...o, ...att });
  }
  return rankOfferAttention(items);
}
