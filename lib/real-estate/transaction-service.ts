import { createAdminClient } from "@/lib/supabase/admin";
import { logReActivity } from "@/lib/lead-events";
import { listingLabel } from "@/lib/real-estate/helpers";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import { formatOfferMoney } from "@/lib/real-estate/offers";
import {
  canTransitionTransaction,
  commissionAmounts,
  defaultMilestonesForType,
  isTransactionActive,
  isTransactionTerminal,
  listingStatusAfterTransactionComplete,
  RE_MILESTONE_LABEL,
  reTransactionStatusLabel,
  type ReMilestoneKey,
  type ReMilestoneStatus,
  type ReTransactionStatus,
  type ReTransactionType,
  type ReTxnAction,
  type ReTxnEventType,
} from "@/lib/real-estate/transactions";
import { seedAfterSalesForTransaction } from "@/lib/real-estate/after-sales-service";

export { assertRealEstateClient };

type Actor = { id: string; name: string; role: string; clientId: string | null };

export type TransactionListTab =
  | "active"
  | "pending_compliance"
  | "in_progress"
  | "completed"
  | "fallen_through"
  | "cancelled"
  | "all";

export type TransactionListRow = {
  id: string;
  listingId: string;
  propertyLabel: string;
  buyerName: string | null;
  contactId: string;
  leadId: string | null;
  offerId: string | null;
  status: ReTransactionStatus;
  statusLabel: string;
  transactionType: ReTransactionType;
  agreedPrice: number;
  agreedPriceLabel: string;
  currency: string;
  agentId: string | null;
  agentName: string | null;
  expectedCompletionDate: string | null;
  milestonesDone: number;
  milestonesTotal: number;
  commissionTotalLabel: string | null;
  updatedAt: string;
};

export type TransactionMilestoneRow = {
  id: string;
  key: ReMilestoneKey;
  label: string;
  status: ReMilestoneStatus;
  dueAt: string | null;
  completedAt: string | null;
  notes: string | null;
  sortOrder: number;
};

export type TransactionEventRow = {
  id: string;
  eventType: ReTxnEventType;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
};

async function appendTxnEvent(opts: {
  transactionId: string;
  clientId: string;
  eventType: ReTxnEventType;
  note?: string | null;
  payload?: Record<string, unknown>;
  createdBy: string | null;
}) {
  const supabase = createAdminClient();
  await supabase.from("real_estate_transaction_events").insert({
    transaction_id: opts.transactionId,
    client_id: opts.clientId,
    event_type: opts.eventType,
    note: opts.note ?? null,
    payload: opts.payload ?? {},
    created_by: opts.createdBy,
  });
}

async function seedMilestones(
  transactionId: string,
  clientId: string,
  type: ReTransactionType
) {
  const supabase = createAdminClient();
  const rows = defaultMilestonesForType(type).map((m) => ({
    transaction_id: transactionId,
    client_id: clientId,
    milestone_key: m.key,
    status: "pending",
    sort_order: m.sort,
  }));
  await supabase.from("real_estate_transaction_milestones").insert(rows);
}

export async function startOrGetTransactionFromOffer(opts: {
  clientId: string;
  offerId: string;
  actor: Actor;
  complianceCaseId?: string | null;
}): Promise<
  | { ok: true; transaction: Record<string, unknown>; created: boolean }
  | { ok: false; error: string; status: number }
> {
  const supabase = createAdminClient();
  if (!(await assertRealEstateClient(opts.clientId))) {
    return { ok: false, error: "Not a real-estate workspace.", status: 404 };
  }

  const { data: existing } = await supabase
    .from("real_estate_transactions")
    .select("*")
    .eq("client_id", opts.clientId)
    .eq("offer_id", opts.offerId)
    .maybeSingle();
  if (existing) {
    if (opts.complianceCaseId && !existing.compliance_case_id) {
      await supabase
        .from("real_estate_transactions")
        .update({ compliance_case_id: opts.complianceCaseId })
        .eq("id", existing.id);
    }
    return { ok: true, transaction: existing, created: false };
  }

  const { data: offer } = await supabase
    .from("real_estate_offers")
    .select("*")
    .eq("id", opts.offerId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!offer) return { ok: false, error: "Offer not found.", status: 404 };
  if (offer.status !== "accepted") {
    return { ok: false, error: "Only accepted offers can start a transaction.", status: 400 };
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("id, transaction_type, agent_id")
    .eq("id", offer.listing_id as string)
    .eq("client_id", opts.clientId)
    .maybeSingle();

  const { data: lead } = offer.lead_id
    ? await supabase
        .from("leads")
        .select("listing_agent_commission_pct, selling_agent_commission_pct")
        .eq("id", offer.lead_id as string)
        .eq("client_id", opts.clientId)
        .maybeSingle()
    : { data: null };

  const txnType = (listing?.transaction_type as ReTransactionType) || "sale";
  const agreed = Number(offer.current_offer_amount);
  const listingPct =
    lead?.listing_agent_commission_pct != null ? Number(lead.listing_agent_commission_pct) : null;
  const sellingPct =
    lead?.selling_agent_commission_pct != null ? Number(lead.selling_agent_commission_pct) : null;
  const amounts = commissionAmounts({
    agreedPrice: agreed,
    listingPct,
    sellingPct,
  });

  const insert = {
    client_id: opts.clientId,
    offer_id: opts.offerId,
    compliance_case_id: opts.complianceCaseId ?? null,
    listing_id: offer.listing_id,
    contact_id: offer.contact_id,
    lead_id: offer.lead_id,
    buyer_agent_id: offer.buyer_agent_id,
    listing_agent_id: offer.listing_agent_id ?? listing?.agent_id ?? null,
    created_by: opts.actor.id,
    transaction_type: txnType,
    status: "pending_compliance" as ReTransactionStatus,
    currency: (offer.currency as string) || "USD",
    agreed_price: agreed,
    listing_agent_commission_pct: listingPct,
    selling_agent_commission_pct: sellingPct,
    listing_agent_commission_amount: amounts.listingAmount,
    selling_agent_commission_amount: amounts.sellingAmount,
  };

  const { data: created, error } = await supabase
    .from("real_estate_transactions")
    .insert(insert)
    .select("*")
    .single();

  if (error || !created) {
    return { ok: false, error: error?.message ?? "Failed to create transaction.", status: 500 };
  }

  await seedMilestones(created.id as string, opts.clientId, txnType);
  await appendTxnEvent({
    transactionId: created.id as string,
    clientId: opts.clientId,
    eventType: "TRANSACTION_CREATED",
    note: "Transaction started from accepted offer",
    createdBy: opts.actor.id,
  });

  if (offer.lead_id) {
    await logReActivity({
      leadId: offer.lead_id as string,
      clientId: opts.clientId,
      actor: { id: opts.actor.id, name: opts.actor.name, role: opts.actor.role },
      summary: "Transaction started",
      kind: "stage_changed",
      extra: { transaction_id: created.id },
    });
  }

  return { ok: true, transaction: created, created: true };
}

export async function listRealEstateTransactions(opts: {
  clientId: string;
  actor: Actor;
  tab?: TransactionListTab;
  q?: string | null;
  agentId?: string | null;
  scopeOwn?: boolean;
}): Promise<{ rows: TransactionListRow[]; counts: Record<string, number> }> {
  const supabase = createAdminClient();
  let query = supabase
    .from("real_estate_transactions")
    .select(
      `
      id, listing_id, contact_id, lead_id, offer_id, status, transaction_type,
      agreed_price, currency, buyer_agent_id, expected_completion_date, updated_at,
      listing_agent_commission_amount, selling_agent_commission_amount,
      listings!inner(address, suburb, external_reference),
      contacts(name)
    `
    )
    .eq("client_id", opts.clientId)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (opts.scopeOwn || opts.actor.role === "SALESPERSON") {
    query = query.eq("buyer_agent_id", opts.actor.id);
  } else if (opts.agentId) {
    query = query.eq("buyer_agent_id", opts.agentId);
  }

  const { data } = await query;
  const ids = (data ?? []).map((r) => r.id as string);
  const agentIds = [
    ...new Set(
      (data ?? [])
        .map((r) => r.buyer_agent_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const userById = new Map<string, string>();
  if (agentIds.length) {
    const { data: users } = await supabase.from("users").select("id, name").in("id", agentIds);
    for (const u of users ?? []) {
      userById.set(u.id as string, (u.name as string) || "Agent");
    }
  }
  const milestoneCounts = new Map<string, { done: number; total: number }>();
  if (ids.length) {
    const { data: ms } = await supabase
      .from("real_estate_transaction_milestones")
      .select("transaction_id, status")
      .in("transaction_id", ids);
    for (const m of ms ?? []) {
      const tid = m.transaction_id as string;
      const cur = milestoneCounts.get(tid) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (m.status === "done" || m.status === "skipped") cur.done += 1;
      milestoneCounts.set(tid, cur);
    }
  }

  const mapped: TransactionListRow[] = (data ?? []).map((r) => {
    const listing = r.listings as { address?: string | null; suburb?: string | null; external_reference?: string | null } | null;
    const contact = r.contacts as { name?: string | null } | null;
    const agentName = r.buyer_agent_id ? userById.get(r.buyer_agent_id as string) ?? null : null;
    const status = r.status as ReTransactionStatus;
    const currency = (r.currency as string) || "USD";
    const agreed = Number(r.agreed_price);
    const listingAmt = r.listing_agent_commission_amount != null ? Number(r.listing_agent_commission_amount) : null;
    const sellingAmt = r.selling_agent_commission_amount != null ? Number(r.selling_agent_commission_amount) : null;
    const total =
      listingAmt != null || sellingAmt != null
        ? (listingAmt ?? 0) + (sellingAmt ?? 0)
        : null;
    const ms = milestoneCounts.get(r.id as string) ?? { done: 0, total: 0 };
    return {
      id: r.id as string,
      listingId: r.listing_id as string,
      propertyLabel: listingLabel(listing ?? {}),
      buyerName: contact?.name ?? null,
      contactId: r.contact_id as string,
      leadId: (r.lead_id as string | null) ?? null,
      offerId: (r.offer_id as string | null) ?? null,
      status,
      statusLabel: reTransactionStatusLabel(status),
      transactionType: r.transaction_type as ReTransactionType,
      agreedPrice: agreed,
      agreedPriceLabel: formatOfferMoney(agreed, currency) ?? "—",
      currency,
      agentId: (r.buyer_agent_id as string | null) ?? null,
      agentName,
      expectedCompletionDate: (r.expected_completion_date as string | null) ?? null,
      milestonesDone: ms.done,
      milestonesTotal: ms.total,
      commissionTotalLabel: total != null ? formatOfferMoney(total, currency) : null,
      updatedAt: r.updated_at as string,
    };
  });

  const q = opts.q?.trim().toLowerCase();
  let filtered = mapped;
  if (q) {
    filtered = mapped.filter(
      (r) =>
        r.propertyLabel.toLowerCase().includes(q) ||
        (r.buyerName ?? "").toLowerCase().includes(q) ||
        (r.agentName ?? "").toLowerCase().includes(q)
    );
  }

  const counts = {
    all: filtered.length,
    active: filtered.filter((r) => isTransactionActive(r.status)).length,
    pending_compliance: filtered.filter((r) => r.status === "pending_compliance").length,
    in_progress: filtered.filter((r) => r.status === "in_progress").length,
    completed: filtered.filter((r) => r.status === "completed").length,
    fallen_through: filtered.filter((r) => r.status === "fallen_through").length,
    cancelled: filtered.filter((r) => r.status === "cancelled").length,
  };

  const tab = opts.tab ?? "active";
  const rows =
    tab === "all"
      ? filtered
      : tab === "active"
        ? filtered.filter((r) => isTransactionActive(r.status))
        : filtered.filter((r) => r.status === tab);

  return { rows, counts };
}

export async function getRealEstateTransactionDetail(opts: {
  clientId: string;
  transactionId: string;
  actor: Actor;
}): Promise<
  | {
      ok: true;
      transaction: Record<string, unknown>;
      milestones: TransactionMilestoneRow[];
      events: TransactionEventRow[];
      listing: Record<string, unknown> | null;
      contact: Record<string, unknown> | null;
    }
  | { ok: false; error: string; status: number }
> {
  const supabase = createAdminClient();
  const { data: txn } = await supabase
    .from("real_estate_transactions")
    .select("*")
    .eq("id", opts.transactionId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!txn) return { ok: false, error: "Transaction not found.", status: 404 };

  if (
    opts.actor.role === "SALESPERSON" &&
    txn.buyer_agent_id &&
    txn.buyer_agent_id !== opts.actor.id
  ) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  const [{ data: milestones }, { data: events }, { data: listing }, { data: contact }] =
    await Promise.all([
      supabase
        .from("real_estate_transaction_milestones")
        .select("*")
        .eq("transaction_id", opts.transactionId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("real_estate_transaction_events")
        .select("id, event_type, note, created_at, created_by, users:created_by(name)")
        .eq("transaction_id", opts.transactionId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("listings")
        .select("id, address, suburb, price, status, transaction_type, external_reference")
        .eq("id", txn.listing_id as string)
        .maybeSingle(),
      supabase
        .from("contacts")
        .select("id, name, phone, email")
        .eq("id", txn.contact_id as string)
        .maybeSingle(),
    ]);

  return {
    ok: true,
    transaction: txn,
    milestones: (milestones ?? []).map((m) => ({
      id: m.id as string,
      key: m.milestone_key as ReMilestoneKey,
      label: RE_MILESTONE_LABEL[m.milestone_key as ReMilestoneKey] ?? String(m.milestone_key),
      status: m.status as ReMilestoneStatus,
      dueAt: (m.due_at as string | null) ?? null,
      completedAt: (m.completed_at as string | null) ?? null,
      notes: (m.notes as string | null) ?? null,
      sortOrder: Number(m.sort_order ?? 0),
    })),
    events: (events ?? []).map((e) => {
      const user = e.users as { name?: string | null } | null;
      return {
        id: e.id as string,
        eventType: e.event_type as ReTxnEventType,
        note: (e.note as string | null) ?? null,
        createdAt: e.created_at as string,
        createdByName: user?.name ?? null,
      };
    }),
    listing: listing ?? null,
    contact: contact ?? null,
  };
}

export async function updateTransactionMilestone(opts: {
  clientId: string;
  transactionId: string;
  milestoneId: string;
  actor: Actor;
  status: ReMilestoneStatus;
  notes?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const supabase = createAdminClient();
  const { data: txn } = await supabase
    .from("real_estate_transactions")
    .select("id, status")
    .eq("id", opts.transactionId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!txn) return { ok: false, error: "Transaction not found.", status: 404 };
  if (isTransactionTerminal(txn.status as ReTransactionStatus)) {
    return { ok: false, error: "Transaction is closed.", status: 400 };
  }

  const patch: Record<string, unknown> = {
    status: opts.status,
    notes: opts.notes ?? null,
  };
  if (opts.status === "done") patch.completed_at = new Date().toISOString();
  if (opts.status === "pending") patch.completed_at = null;

  const { error } = await supabase
    .from("real_estate_transaction_milestones")
    .update(patch)
    .eq("id", opts.milestoneId)
    .eq("transaction_id", opts.transactionId)
    .eq("client_id", opts.clientId);

  if (error) return { ok: false, error: error.message, status: 500 };

  const syncFields: Record<string, unknown> = {};
  const { data: ms } = await supabase
    .from("real_estate_transaction_milestones")
    .select("milestone_key, status, completed_at")
    .eq("id", opts.milestoneId)
    .maybeSingle();

  if (ms?.status === "done") {
    const key = ms.milestone_key as string;
    const at = (ms.completed_at as string) || new Date().toISOString();
    if (key === "agreement_signed") syncFields.agreement_signed_at = at;
    if (key === "deposit_received") syncFields.deposit_received_at = at;
    if (key === "conveyancing_started") syncFields.conveyancing_started_at = at;
    if (key === "inspection_complete") syncFields.inspection_completed_at = at;
    if (key === "keys_handed_over") syncFields.keys_handed_over_at = at;
    if (key === "commission_settled") syncFields.commission_settled_at = at;
  }
  if (Object.keys(syncFields).length) {
    await supabase
      .from("real_estate_transactions")
      .update(syncFields)
      .eq("id", opts.transactionId)
      .eq("client_id", opts.clientId);
  }

  await appendTxnEvent({
    transactionId: opts.transactionId,
    clientId: opts.clientId,
    eventType: "MILESTONE_UPDATED",
    note: `${ms?.milestone_key ?? "milestone"} → ${opts.status}`,
    createdBy: opts.actor.id,
  });

  return { ok: true };
}

export async function mutateRealEstateTransaction(opts: {
  clientId: string;
  transactionId: string;
  actor: Actor;
  action: ReTxnAction;
  depositAmount?: number | null;
  reason?: string | null;
  notes?: string | null;
  listingPct?: number | null;
  sellingPct?: number | null;
  expectedCompletionDate?: string | null;
  complianceApproved?: boolean;
}): Promise<
  | { ok: true; transaction: Record<string, unknown> }
  | { ok: false; error: string; status: number }
> {
  const supabase = createAdminClient();
  const { data: txn } = await supabase
    .from("real_estate_transactions")
    .select("*")
    .eq("id", opts.transactionId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!txn) return { ok: false, error: "Transaction not found.", status: 404 };

  const status = txn.status as ReTransactionStatus;
  const patch: Record<string, unknown> = {};
  let eventType: ReTxnEventType = "NOTE_ADDED";
  let note: string | null = opts.notes ?? null;

  switch (opts.action) {
    case "start_progress": {
      if (!canTransitionTransaction(status, "in_progress")) {
        return { ok: false, error: "Cannot move this transaction to in progress.", status: 400 };
      }
      if (status === "pending_compliance" && !opts.complianceApproved) {
        const { data: cdd } = txn.compliance_case_id
          ? await supabase
              .from("compliance_cases")
              .select("status")
              .eq("id", txn.compliance_case_id as string)
              .maybeSingle()
          : { data: null };
        if (cdd && cdd.status !== "approved") {
          return {
            ok: false,
            error: "Compliance must be approved before transaction progress.",
            status: 400,
          };
        }
      }
      patch.status = "in_progress";
      eventType = "STATUS_CHANGED";
      note = "Moved to in progress";
      break;
    }
    case "complete": {
      if (!canTransitionTransaction(status, "completed")) {
        return { ok: false, error: "Cannot complete this transaction.", status: 400 };
      }
      const now = new Date().toISOString();
      patch.status = "completed";
      patch.completed_at = now;
      eventType = "COMPLETION_RECORDED";
      note = "Transaction completed";

      const listingTarget = listingStatusAfterTransactionComplete(
        txn.transaction_type as ReTransactionType
      );
      await supabase
        .from("listings")
        .update({ status: listingTarget })
        .eq("id", txn.listing_id as string)
        .eq("client_id", opts.clientId);

      if (txn.lead_id) {
        await supabase
          .from("leads")
          .update({ status: "WON" })
          .eq("id", txn.lead_id as string)
          .eq("client_id", opts.clientId);
      }
      break;
    }
    case "fallen_through": {
      if (!canTransitionTransaction(status, "fallen_through")) {
        return { ok: false, error: "Cannot mark fallen through.", status: 400 };
      }
      patch.status = "fallen_through";
      patch.fallen_through_at = new Date().toISOString();
      patch.fallen_through_reason = opts.reason ?? null;
      eventType = "FALLEN_THROUGH";
      note = opts.reason ?? "Fallen through";
      break;
    }
    case "cancel": {
      if (!canTransitionTransaction(status, "cancelled")) {
        return { ok: false, error: "Cannot cancel.", status: 400 };
      }
      patch.status = "cancelled";
      eventType = "CANCELLED";
      note = opts.reason ?? "Cancelled";
      break;
    }
    case "record_deposit": {
      if (opts.depositAmount == null || opts.depositAmount < 0) {
        return { ok: false, error: "Deposit amount required.", status: 400 };
      }
      patch.deposit_amount = opts.depositAmount;
      patch.deposit_received_at = new Date().toISOString();
      eventType = "DEPOSIT_RECORDED";
      note = `Deposit ${opts.depositAmount}`;
      break;
    }
    case "sign_agreement": {
      patch.agreement_signed_at = new Date().toISOString();
      eventType = "AGREEMENT_SIGNED";
      note = "Agreement signed";
      break;
    }
    case "update_commission": {
      const agreed = Number(txn.agreed_price);
      const listingPct = opts.listingPct ?? (txn.listing_agent_commission_pct as number | null);
      const sellingPct = opts.sellingPct ?? (txn.selling_agent_commission_pct as number | null);
      const amounts = commissionAmounts({ agreedPrice: agreed, listingPct, sellingPct });
      patch.listing_agent_commission_pct = listingPct;
      patch.selling_agent_commission_pct = sellingPct;
      patch.listing_agent_commission_amount = amounts.listingAmount;
      patch.selling_agent_commission_amount = amounts.sellingAmount;
      if (opts.notes != null) patch.commission_notes = opts.notes;
      eventType = "COMMISSION_UPDATED";
      note = "Commission updated";
      break;
    }
    case "update_notes": {
      patch.internal_notes = opts.notes ?? null;
      eventType = "NOTE_ADDED";
      break;
    }
    case "set_expected_completion": {
      patch.expected_completion_date = opts.expectedCompletionDate ?? null;
      eventType = "NOTE_ADDED";
      note = opts.expectedCompletionDate
        ? `Expected completion ${opts.expectedCompletionDate}`
        : "Expected completion cleared";
      break;
    }
    default:
      return { ok: false, error: "Unknown action.", status: 400 };
  }

  const { data: updated, error } = await supabase
    .from("real_estate_transactions")
    .update(patch)
    .eq("id", opts.transactionId)
    .eq("client_id", opts.clientId)
    .select("*")
    .single();

  if (error || !updated) {
    return { ok: false, error: error?.message ?? "Update failed.", status: 500 };
  }

  await appendTxnEvent({
    transactionId: opts.transactionId,
    clientId: opts.clientId,
    eventType,
    note,
    createdBy: opts.actor.id,
  });

  if (opts.action === "complete") {
    await seedAfterSalesForTransaction({
      clientId: opts.clientId,
      transaction: updated,
      actor: opts.actor,
    });
  }

  if (txn.lead_id && (opts.action === "complete" || opts.action === "fallen_through")) {
    await logReActivity({
      leadId: txn.lead_id as string,
      clientId: opts.clientId,
      actor: { id: opts.actor.id, name: opts.actor.name, role: opts.actor.role },
      summary: note ?? opts.action,
      kind: "stage_changed",
      extra: { transaction_id: opts.transactionId, action: opts.action },
    });
  }

  return { ok: true, transaction: updated };
}

export async function listAgentTransactionActions(opts: {
  clientId: string;
  userId: string;
}): Promise<
  Array<{ id: string; propertyLabel: string; why: string; status: string; leadId: string | null }>
> {
  const { rows } = await listRealEstateTransactions({
    clientId: opts.clientId,
    actor: { id: opts.userId, name: "", role: "SALESPERSON", clientId: opts.clientId },
    tab: "active",
    scopeOwn: true,
  });
  return rows.slice(0, 12).map((r) => ({
    id: r.id,
    propertyLabel: r.propertyLabel,
    why:
      r.status === "pending_compliance"
        ? "Awaiting compliance before progress"
        : r.milestonesDone < r.milestonesTotal
          ? `${r.milestonesDone}/${r.milestonesTotal} milestones done`
          : "Transaction in progress",
    status: r.status,
    leadId: r.leadId,
  }));
}
