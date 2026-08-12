import { createAdminClient } from "@/lib/supabase/admin";
import { notifyDealWon } from "@/lib/notifications";
import { getManagerPrefs } from "@/lib/notification-prefs";
import { logCallLogged, logFollowUpSet, logStatusChanged } from "@/lib/lead-events";
import { recordWinAnalysis } from "@/lib/win-analysis";
import { persistLeadScore } from "@/lib/lead-scoring";
import {
  deriveLegacyOutcome,
  followUpDateFromCallbackAt,
  LOW_BUDGET_SIGNAL_REASONS,
  type CallResult,
  type ReachOutcome,
} from "@/lib/call-log-constants";
import type { LeadRow, LeadStatus } from "@/types";
import { appendInterestedListingIds } from "@/lib/real-estate/helpers";

export type SaveCallLogInput = {
  leadId: string;
  actorUserId: string;
  actor: { id: string; name: string; role: string };
  reachOutcome: ReachOutcome;
  result?: CallResult | null;
  reason?: string | null;
  callbackAt?: string | null;
  assetsRequested?: string[] | null;
  notes?: string | null;
  channel?: "call" | "whatsapp";
  isConvertLaterPick?: boolean;
  convertLaterNote?: string | null;
  dealValue?: number | null;
  listingId?: string | null;
  addListingId?: string | null;
};

export type SaveCallLogResult = {
  lead: LeadRow;
  legacyOutcome: string;
  noAnswerCount: number;
};

/** Next status after a two-step log; null = no change (e.g. no_answer). */
export function resolveNextStatus(
  currentStatus: string,
  reachOutcome: ReachOutcome,
  result: CallResult | null | undefined
): LeadStatus | null {
  // Call attempts without contact must not mark Contacted
  if (reachOutcome === "no_answer") return null;
  if (reachOutcome === "call_back") return null;

  if (reachOutcome === "reached") {
    if (result === "not_qualified") return "NOT_QUALIFIED";
    if (result === "qualified") return "QUALIFIED";
    // Won/Lost belong on Deals — do not close the Lead as WON/LOST
    if (result === "won" || result === "lost") return null;
    // qualifying / follow_up / default: first real contact
    if (currentStatus === "NEW") return "CONTACTED";
    if (result === "qualifying" && currentStatus === "CONTACTED") return null;
    return null;
  }

  return null;
}

export async function countNoAnswerAttempts(leadId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .or("reach_outcome.eq.no_answer,outcome.eq.NO_ANSWER");

  if (error) {
    console.error("[call-log-save] no-answer count failed:", error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Shared save path for two-step call logs. Used by POST /api/leads/[id]/log-call.
 * quick-log can adopt this in a fast-follow.
 */
export async function saveCallLog(input: SaveCallLogInput): Promise<SaveCallLogResult> {
  const supabase = createAdminClient();
  const {
    leadId,
    actorUserId,
    actor,
    reachOutcome,
    result,
    reason,
    callbackAt,
    assetsRequested,
    notes,
    channel,
    isConvertLaterPick,
    convertLaterNote,
    dealValue,
    listingId,
    addListingId,
  } = input;

  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) throw new Error("Lead not found");

  const legacyOutcome = deriveLegacyOutcome(reachOutcome, result);
  const trimmedReason = reason?.trim() || null;
  const trimmedNotes = notes?.trim() || null;

  let followUpDateStr: string | null = null;
  if (callbackAt) {
    const cb = new Date(callbackAt);
    if (!Number.isNaN(cb.getTime())) {
      followUpDateStr = followUpDateFromCallbackAt(cb);
    }
  }

  await supabase.from("call_logs").insert({
    lead_id: leadId,
    user_id: actorUserId,
    outcome: legacyOutcome,
    reach_outcome: reachOutcome,
    result: result ?? null,
    reason: trimmedReason,
    callback_at: callbackAt ?? null,
    assets_requested: assetsRequested?.length ? assetsRequested : null,
    notes: trimmedNotes,
    follow_up_date: followUpDateStr,
  });

  await logCallLogged({
    leadId,
    clientId: lead.client_id as string,
    actor,
    outcome: legacyOutcome,
    notes: trimmedNotes,
    followUpDate: followUpDateStr,
    channel: channel === "whatsapp" ? "whatsapp" : "call",
  });

  const previousStatus = lead.status as string;
  const nextStatus = resolveNextStatus(previousStatus, reachOutcome, result);

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (nextStatus) updates.status = nextStatus;

  if (callbackAt && followUpDateStr) {
    updates.follow_up_date = followUpDateStr;
  }

  if (reachOutcome === "reached" && result === "lost" && trimmedReason) {
    updates.lost_reason = trimmedReason;
    updates.follow_up_date = null;
  }

  if (reachOutcome === "reached" && result === "not_qualified" && trimmedReason) {
    updates.not_qualified_reason = trimmedReason;
    updates.follow_up_date = null;
  }

  if (reachOutcome === "reached" && result === "won" && dealValue != null) {
    updates.deal_value = dealValue;
  }

  const effectiveListingId = addListingId || listingId || null;
  if (effectiveListingId) {
    updates.linked_listing_id = effectiveListingId;
  }

  if (isConvertLaterPick) {
    updates.is_convert_later_pick = true;
    if (convertLaterNote?.trim()) {
      updates.convert_later_note = convertLaterNote.trim();
    }
  }

  if (
    reachOutcome === "reached" &&
    result === "follow_up" &&
    trimmedReason &&
    (LOW_BUDGET_SIGNAL_REASONS as readonly string[]).includes(trimmedReason)
  ) {
    const existingFormData =
      (lead.form_data as Record<string, unknown> | null) ?? {};
    updates.form_data = {
      ...existingFormData,
      budget_signal: "low",
      budget_signal_at: new Date().toISOString(),
      budget_signal_reason: trimmedReason,
    };
  }

  const { data: updated } = await supabase
    .from("leads")
    .update(updates)
    .eq("id", leadId)
    .select("*")
    .single();

  if (!updated) throw new Error("Failed to update lead");

  if (effectiveListingId) {
    const contactId = (updated.contact_id as string | null) ?? (lead.contact_id as string | null);
    if (contactId) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("interested_listing_ids")
        .eq("id", contactId)
        .maybeSingle();
      if (contact) {
        const next = appendInterestedListingIds(contact.interested_listing_ids, effectiveListingId);
        await supabase
          .from("contacts")
          .update({ interested_listing_ids: next, updated_at: new Date().toISOString() })
          .eq("id", contactId);
      }
    }
  }

  if (nextStatus && nextStatus !== previousStatus) {
    await logStatusChanged({
      leadId,
      clientId: lead.client_id as string,
      actor,
      fromStatus: previousStatus,
      toStatus: nextStatus,
    });

    if (nextStatus === "WON") {
      await recordWinAnalysis(leadId);
    }
  }

  if (callbackAt && followUpDateStr) {
    const prevFollowUp = (lead.follow_up_date as string | null) ?? null;
    if (followUpDateStr !== prevFollowUp) {
      await logFollowUpSet({
        leadId,
        clientId: lead.client_id as string,
        actor,
        followUpDate: followUpDateStr,
        notes: trimmedNotes,
      });
    }
  }

  if (reachOutcome === "reached" && result === "won") {
    const { data: actorRow } = await supabase
      .from("users")
      .select("id, name, email, phone")
      .eq("id", actorUserId)
      .maybeSingle();

    const { data: managers } = await supabase
      .from("users")
      .select("id, name, email, phone, notification_prefs")
      .eq("client_id", updated.client_id as string)
      .eq("role", "CLIENT_MANAGER")
      .eq("is_active", true);

    const { data: clientRow } = await supabase
      .from("clients")
      .select("name, twilio_whatsapp_override")
      .eq("id", updated.client_id as string)
      .maybeSingle();

    const spLite = {
      id: actorUserId,
      name: (actorRow?.name as string) || "Rep",
      phone: (actorRow?.phone as string | null) ?? null,
      email: (actorRow?.email as string | null) ?? null,
    };

    for (const mgr of managers ?? []) {
      void notifyDealWon(
        updated as LeadRow,
        spLite,
        {
          id: mgr.id as string,
          name: mgr.name as string,
          phone: (mgr.phone as string | null) ?? null,
          email: (mgr.email as string | null) ?? null,
        },
        (clientRow?.twilio_whatsapp_override as string | null) ?? null,
        (clientRow?.name as string) ?? "Client",
        getManagerPrefs((mgr as { notification_prefs?: unknown }).notification_prefs)
      );
    }
  }

  await persistLeadScore(leadId);

  const { data: rescored } = await supabase.from("leads").select("*").eq("id", leadId).single();
  const noAnswerCount = await countNoAnswerAttempts(leadId);

  void import("@/lib/sales/intelligence/daily-plan-service").then(({ reconcileLeadActionStates }) =>
    reconcileLeadActionStates({
      clientId: lead.client_id as string,
      salespersonId: actorUserId,
      leadId,
    })
  );

  return {
    lead: (rescored ?? updated) as LeadRow,
    legacyOutcome,
    noAnswerCount,
  };
}
