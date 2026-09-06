import { createAdminClient } from "@/lib/supabase/admin";
import {
  AFTER_SALES_KIND_LABEL,
  AFTER_SALES_OUTCOME_LABEL,
  AFTER_SALES_STATUS_LABEL,
  DEFAULT_AFTER_SALES_ON_COMPLETE,
  addDaysIso,
  type AfterSalesKind,
  type AfterSalesOutcome,
  type AfterSalesStatus,
} from "@/lib/real-estate/after-sales";
import { listingLabel } from "@/lib/real-estate/helpers";

type Actor = { id: string; name: string; role: string; clientId: string | null };

export type AfterSalesListRow = {
  id: string;
  kind: AfterSalesKind;
  kindLabel: string;
  status: AfterSalesStatus;
  statusLabel: string;
  contactName: string | null;
  propertyLabel: string | null;
  agentName: string | null;
  dueAt: string | null;
  outcome: AfterSalesOutcome | null;
  outcomeLabel: string | null;
  satisfactionScore: number | null;
  futureNeedsNotes: string | null;
  transactionId: string | null;
  leadId: string | null;
  overdue: boolean;
};

async function appendEvent(opts: {
  afterSalesId: string;
  clientId: string;
  eventType: string;
  note?: string | null;
  createdBy: string | null;
}) {
  const supabase = createAdminClient();
  await supabase.from("real_estate_after_sales_events").insert({
    after_sales_id: opts.afterSalesId,
    client_id: opts.clientId,
    event_type: opts.eventType,
    note: opts.note ?? null,
    created_by: opts.createdBy,
  });
}

export async function seedAfterSalesForTransaction(opts: {
  clientId: string;
  transaction: Record<string, unknown>;
  actor: Actor;
}): Promise<void> {
  const supabase = createAdminClient();
  const txnId = opts.transaction.id as string;
  const { count } = await supabase
    .from("real_estate_after_sales")
    .select("id", { count: "exact", head: true })
    .eq("client_id", opts.clientId)
    .eq("transaction_id", txnId);
  if ((count ?? 0) > 0) return;

  const now = new Date();
  const rows = DEFAULT_AFTER_SALES_ON_COMPLETE.map((item) => ({
    client_id: opts.clientId,
    transaction_id: txnId,
    contact_id: opts.transaction.contact_id,
    listing_id: opts.transaction.listing_id,
    lead_id: opts.transaction.lead_id ?? null,
    agent_id: opts.transaction.buyer_agent_id ?? opts.actor.id,
    kind: item.kind,
    status: "check_in_due" as AfterSalesStatus,
    due_at: addDaysIso(now, item.daysUntilDue),
    created_by: opts.actor.id,
  }));

  const { data: created } = await supabase.from("real_estate_after_sales").insert(rows).select("id");
  for (const row of created ?? []) {
    await appendEvent({
      afterSalesId: row.id as string,
      clientId: opts.clientId,
      eventType: "CASE_CREATED",
      note: "Auto-created on transaction completion",
      createdBy: opts.actor.id,
    });
  }
}

export async function listAfterSalesCases(opts: {
  clientId: string;
  status?: AfterSalesStatus | "active" | "all";
  agentId?: string | null;
  scopeOwn?: boolean;
  actorId?: string;
}): Promise<{ rows: AfterSalesListRow[]; dueCount: number }> {
  const supabase = createAdminClient();
  let query = supabase
    .from("real_estate_after_sales")
    .select(
      `
      id, kind, status, due_at, outcome, satisfaction_score, future_needs_notes,
      transaction_id, lead_id, contact_id, listing_id, agent_id,
      contacts(name),
      listings(address, suburb, external_reference),
      users:agent_id(name)
    `
    )
    .eq("client_id", opts.clientId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(400);

  if (opts.scopeOwn && opts.actorId) {
    query = query.eq("agent_id", opts.actorId);
  } else if (opts.agentId) {
    query = query.eq("agent_id", opts.agentId);
  }

  const { data } = await query;
  const now = Date.now();
  const rows: AfterSalesListRow[] = (data ?? []).map((r) => {
    type ListingJoin = {
      address?: string | null;
      suburb?: string | null;
      external_reference?: string | null;
    };
    const contactRaw = r.contacts as { name?: string | null } | { name?: string | null }[] | null;
    const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw;
    const listingRaw = r.listings as ListingJoin | ListingJoin[] | null;
    const listing = Array.isArray(listingRaw) ? listingRaw[0] ?? null : listingRaw;
    const agentRaw = r.users as { name?: string | null } | { name?: string | null }[] | null;
    const agent = Array.isArray(agentRaw) ? agentRaw[0] ?? null : agentRaw;
    const status = r.status as AfterSalesStatus;
    const dueAt = (r.due_at as string | null) ?? null;
    const overdue =
      Boolean(dueAt) &&
      new Date(dueAt!).getTime() < now &&
      status !== "completed" &&
      status !== "declined" &&
      status !== "no_response";
    const outcome = (r.outcome as AfterSalesOutcome | null) ?? null;
    return {
      id: r.id as string,
      kind: r.kind as AfterSalesKind,
      kindLabel: AFTER_SALES_KIND_LABEL[r.kind as AfterSalesKind] ?? String(r.kind),
      status,
      statusLabel: AFTER_SALES_STATUS_LABEL[status] ?? status,
      contactName: contact?.name ?? null,
      propertyLabel: listing ? listingLabel(listing) : null,
      agentName: agent?.name ?? null,
      dueAt,
      outcome,
      outcomeLabel: outcome ? AFTER_SALES_OUTCOME_LABEL[outcome] : null,
      satisfactionScore: r.satisfaction_score != null ? Number(r.satisfaction_score) : null,
      futureNeedsNotes: (r.future_needs_notes as string | null) ?? null,
      transactionId: (r.transaction_id as string | null) ?? null,
      leadId: (r.lead_id as string | null) ?? null,
      overdue,
    };
  });

  const filter = opts.status ?? "active";
  const filtered =
    filter === "all"
      ? rows
      : filter === "active"
        ? rows.filter((r) =>
            ["not_started", "check_in_due", "in_progress"].includes(r.status)
          )
        : rows.filter((r) => r.status === filter);

  return {
    rows: filtered,
    dueCount: rows.filter((r) => r.overdue || r.status === "check_in_due").length,
  };
}

export async function mutateAfterSalesCase(opts: {
  clientId: string;
  caseId: string;
  actor: Actor;
  status?: AfterSalesStatus;
  outcome?: AfterSalesOutcome | null;
  satisfactionScore?: number | null;
  futureNeedsNotes?: string | null;
  notes?: string | null;
  dueAt?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("real_estate_after_sales")
    .select("*")
    .eq("id", opts.caseId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Case not found.", status: 404 };

  const patch: Record<string, unknown> = {};
  if (opts.status != null) {
    patch.status = opts.status;
    if (["completed", "declined", "no_response"].includes(opts.status)) {
      patch.completed_at = new Date().toISOString();
    }
  }
  if (opts.outcome !== undefined) patch.outcome = opts.outcome;
  if (opts.satisfactionScore !== undefined) patch.satisfaction_score = opts.satisfactionScore;
  if (opts.futureNeedsNotes !== undefined) patch.future_needs_notes = opts.futureNeedsNotes;
  if (opts.notes !== undefined) patch.notes = opts.notes;
  if (opts.dueAt !== undefined) patch.due_at = opts.dueAt;

  const { error } = await supabase
    .from("real_estate_after_sales")
    .update(patch)
    .eq("id", opts.caseId)
    .eq("client_id", opts.clientId);
  if (error) return { ok: false, error: error.message, status: 500 };

  if (opts.status != null) {
    await appendEvent({
      afterSalesId: opts.caseId,
      clientId: opts.clientId,
      eventType: "STATUS_CHANGED",
      note: `Status → ${opts.status}`,
      createdBy: opts.actor.id,
    });
  }
  if (opts.outcome != null) {
    await appendEvent({
      afterSalesId: opts.caseId,
      clientId: opts.clientId,
      eventType: "OUTCOME_RECORDED",
      note: opts.outcome,
      createdBy: opts.actor.id,
    });
  }
  if (opts.notes) {
    await appendEvent({
      afterSalesId: opts.caseId,
      clientId: opts.clientId,
      eventType: "NOTE_ADDED",
      note: opts.notes,
      createdBy: opts.actor.id,
    });
  }

  // Persist future needs onto contact buyer prefs notes when recorded
  if (opts.futureNeedsNotes && row.contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, notes")
      .eq("id", row.contact_id as string)
      .maybeSingle();
    if (contact) {
      const prev = (contact.notes as string | null)?.trim() || "";
      const stamped = `[Future needs ${new Date().toISOString().slice(0, 10)}] ${opts.futureNeedsNotes}`;
      const nextNotes = prev ? `${prev}\n${stamped}` : stamped;
      await supabase.from("contacts").update({ notes: nextNotes }).eq("id", contact.id);
    }
  }

  return { ok: true };
}
