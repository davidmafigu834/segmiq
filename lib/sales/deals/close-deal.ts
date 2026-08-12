/**
 * Deal stage updates and Won / Lost close flows.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { recordWinAnalysis } from "@/lib/win-analysis";
import type { DealRow, DealStage } from "@/types";
import { getDealCommercialValue } from "./commercial-value";
import { isDealActiveStage, isDealClosedStage } from "./display";

export type UpdateDealStageResult =
  | { ok: true; deal: DealRow }
  | { ok: false; error: string; status: number };

async function logDealEvent(opts: {
  leadId: string;
  clientId: string;
  dealId: string;
  actorId: string;
  eventType: string;
  eventData: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  const { data: actor } = await supabase
    .from("users")
    .select("name, role")
    .eq("id", opts.actorId)
    .maybeSingle();
  await supabase.from("lead_events").insert({
    lead_id: opts.leadId,
    client_id: opts.clientId,
    deal_id: opts.dealId,
    actor_id: opts.actorId,
    actor_name: (actor as { name?: string } | null)?.name ?? "Unknown",
    actor_role: (actor as { role?: string } | null)?.role ?? "UNKNOWN",
    event_type: opts.eventType,
    event_data: opts.eventData,
  });
}

export async function updateDealStage(opts: {
  dealId: string;
  actorId: string;
  stage: DealStage;
}): Promise<UpdateDealStageResult> {
  if (isDealClosedStage(opts.stage)) {
    return {
      ok: false,
      error: "Use Mark won or Mark lost to close a deal.",
      status: 400,
    };
  }
  if (!isDealActiveStage(opts.stage)) {
    return { ok: false, error: "Invalid stage.", status: 400 };
  }

  const supabase = createAdminClient();
  const { data: previous } = await supabase
    .from("deals")
    .select("*")
    .eq("id", opts.dealId)
    .maybeSingle();
  if (!previous) return { ok: false, error: "Deal not found.", status: 404 };
  const prev = previous as DealRow;
  if (isDealClosedStage(prev.stage)) {
    return { ok: false, error: "This deal is already closed.", status: 409 };
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("deals")
    .update({
      stage: opts.stage,
      updated_at: now,
      last_meaningful_activity_at: now,
    })
    .eq("id", opts.dealId)
    .select("*")
    .single();

  if (error || !updated) {
    return { ok: false, error: "Could not update deal stage.", status: 500 };
  }

  await logDealEvent({
    leadId: prev.originating_lead_id,
    clientId: prev.client_id,
    dealId: opts.dealId,
    actorId: opts.actorId,
    eventType: "DEAL_STAGE_CHANGED",
    eventData: { from_stage: prev.stage, to_stage: opts.stage },
  });

  return { ok: true, deal: updated as DealRow };
}

export async function closeDealWon(opts: {
  dealId: string;
  actorId: string;
  wonValue: number;
  wonAt?: string | null;
  notes?: string | null;
}): Promise<UpdateDealStageResult> {
  if (!Number.isFinite(opts.wonValue) || opts.wonValue < 0) {
    return { ok: false, error: "Enter a valid final value.", status: 400 };
  }

  const supabase = createAdminClient();
  const { data: previous } = await supabase
    .from("deals")
    .select("*")
    .eq("id", opts.dealId)
    .maybeSingle();
  if (!previous) return { ok: false, error: "Deal not found.", status: 404 };
  const prev = previous as DealRow;
  if (prev.stage === "WON") {
    return { ok: true, deal: prev };
  }

  const wonAt = opts.wonAt ?? new Date().toISOString();
  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("deals")
    .update({
      stage: "WON",
      won_value: Math.round(opts.wonValue * 100) / 100,
      won_at: wonAt,
      value_status: "KNOWN",
      value_basis: "WON_VALUE",
      estimated_value: Math.round(opts.wonValue * 100) / 100,
      updated_at: now,
      last_meaningful_activity_at: now,
      lost_at: null,
      lost_reason: null,
    })
    .eq("id", opts.dealId)
    .select("*")
    .single();

  if (error || !updated) {
    return { ok: false, error: "Could not mark deal won.", status: 500 };
  }

  await supabase
    .from("leads")
    .update({ active_deal_id: null, updated_at: now })
    .eq("id", prev.originating_lead_id);

  await logDealEvent({
    leadId: prev.originating_lead_id,
    clientId: prev.client_id,
    dealId: opts.dealId,
    actorId: opts.actorId,
    eventType: "DEAL_WON",
    eventData: {
      won_value: opts.wonValue,
      notes: opts.notes ?? null,
    },
  });

  // Goals / win analysis still keyed to originating lead
  try {
    await recordWinAnalysis(prev.originating_lead_id);
    await supabase
      .from("win_analysis")
      .update({ deal_id: opts.dealId, deal_value: opts.wonValue })
      .eq("lead_id", prev.originating_lead_id)
      .is("deal_id", null);
  } catch (e) {
    console.error("[closeDealWon] win_analysis", e);
  }

  return { ok: true, deal: updated as DealRow };
}

export async function closeDealLost(opts: {
  dealId: string;
  actorId: string;
  lostReason: string;
  notes?: string | null;
}): Promise<UpdateDealStageResult> {
  const reason = opts.lostReason?.trim();
  if (!reason) {
    return { ok: false, error: "Select a lost reason.", status: 400 };
  }

  const supabase = createAdminClient();
  const { data: previous } = await supabase
    .from("deals")
    .select("*")
    .eq("id", opts.dealId)
    .maybeSingle();
  if (!previous) return { ok: false, error: "Deal not found.", status: 404 };
  const prev = previous as DealRow;
  if (prev.stage === "LOST") {
    return { ok: true, deal: prev };
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("deals")
    .update({
      stage: "LOST",
      lost_at: now,
      lost_reason: reason,
      updated_at: now,
      last_meaningful_activity_at: now,
    })
    .eq("id", opts.dealId)
    .select("*")
    .single();

  if (error || !updated) {
    return { ok: false, error: "Could not mark deal lost.", status: 500 };
  }

  await supabase
    .from("leads")
    .update({ active_deal_id: null, updated_at: now })
    .eq("id", prev.originating_lead_id);

  await logDealEvent({
    leadId: prev.originating_lead_id,
    clientId: prev.client_id,
    dealId: opts.dealId,
    actorId: opts.actorId,
    eventType: "DEAL_LOST",
    eventData: { lost_reason: reason, notes: opts.notes ?? null },
  });

  return { ok: true, deal: updated as DealRow };
}

export async function updateDealFields(opts: {
  dealId: string;
  actorId: string;
  patch: Partial<{
    name: string;
    service_summary: string | null;
    location: string | null;
    buying_timeframe: string | null;
    decision_maker_status: DealRow["decision_maker_status"];
    decision_maker_name: string | null;
    expected_decision_at: string | null;
    customer_budget: number | null;
    sales_estimate: number | null;
    estimated_value: number | null;
    estimated_value_min: number | null;
    estimated_value_max: number | null;
    value_status: DealRow["value_status"];
    value_basis: DealRow["value_basis"];
    next_action_at: string | null;
    next_action_label: string | null;
  }>;
}): Promise<UpdateDealStageResult> {
  const supabase = createAdminClient();
  const { data: previous } = await supabase
    .from("deals")
    .select("*")
    .eq("id", opts.dealId)
    .maybeSingle();
  if (!previous) return { ok: false, error: "Deal not found.", status: 404 };
  const prev = previous as DealRow;
  if (isDealClosedStage(prev.stage)) {
    return { ok: false, error: "This deal is already closed.", status: 409 };
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("deals")
    .update({ ...opts.patch, updated_at: now, last_meaningful_activity_at: now })
    .eq("id", opts.dealId)
    .select("*")
    .single();

  if (error || !updated) {
    return { ok: false, error: "Could not update deal.", status: 500 };
  }

  const valueChanged =
    opts.patch.estimated_value !== undefined ||
    opts.patch.sales_estimate !== undefined ||
    opts.patch.customer_budget !== undefined;

  await logDealEvent({
    leadId: prev.originating_lead_id,
    clientId: prev.client_id,
    dealId: opts.dealId,
    actorId: opts.actorId,
    eventType: valueChanged ? "DEAL_VALUE_CHANGED" : "DEAL_UPDATED",
    eventData: {
      patch: opts.patch,
      previous_value: getDealCommercialValue(prev),
    },
  });

  return { ok: true, deal: updated as DealRow };
}

export async function reassignDealOwner(opts: {
  dealId: string;
  actorId: string;
  ownerId: string;
}): Promise<UpdateDealStageResult> {
  const supabase = createAdminClient();
  const { data: previous } = await supabase
    .from("deals")
    .select("*")
    .eq("id", opts.dealId)
    .maybeSingle();
  if (!previous) return { ok: false, error: "Deal not found.", status: 404 };
  const prev = previous as DealRow;
  if (prev.owner_id === opts.ownerId) {
    return { ok: true, deal: prev };
  }

  const { data: owner } = await supabase
    .from("users")
    .select("id, client_id, role, also_sells, is_active")
    .eq("id", opts.ownerId)
    .maybeSingle();
  if (!owner || (owner.client_id as string) !== prev.client_id) {
    return { ok: false, error: "Owner must belong to this company.", status: 400 };
  }
  if (owner.is_active === false) {
    return { ok: false, error: "That teammate is inactive.", status: 400 };
  }
  const role = owner.role as string;
  const canOwn =
    role === "SALESPERSON" || (role === "CLIENT_MANAGER" && Boolean(owner.also_sells));
  if (!canOwn) {
    return { ok: false, error: "Owner must be a salesperson on this team.", status: 400 };
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("deals")
    .update({
      owner_id: opts.ownerId,
      updated_at: now,
    })
    .eq("id", opts.dealId)
    .select("*")
    .single();

  if (error || !updated) {
    return { ok: false, error: "Could not reassign this Deal.", status: 500 };
  }

  await logDealEvent({
    leadId: prev.originating_lead_id,
    clientId: prev.client_id,
    dealId: opts.dealId,
    actorId: opts.actorId,
    eventType: "DEAL_UPDATED",
    eventData: { owner_from: prev.owner_id, owner_to: opts.ownerId },
  });

  return { ok: true, deal: updated as DealRow };
}
