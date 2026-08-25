import { createAdminClient } from "@/lib/supabase/admin";
import { isRoundRobinEligibleUserId } from "@/lib/auth/sales-capabilities";
import { logFollowUpSet, logLeadReassigned } from "@/lib/lead-events";
import { notifyBulkReassignment } from "@/lib/notifications";
import { background } from "@/lib/background";
import {
  actorCanApproveTargets,
  awaitingApproverLabel,
  targetsFromUnknownRules,
} from "@/lib/quotations/approver-authority";
import { logQuotationEvent } from "@/lib/quotations/events";
import { notifyQuotationAlert } from "@/lib/quotations/notify";
import { updateConversationAgentState } from "@/lib/agent/conversation-state";
import { cancelJobs, getJob } from "@/lib/agent/proactive/jobs";
import { REASON_CODE_LABELS } from "@/lib/agent/proactive/types";
import { asRow, asRows } from "@/lib/agent/rows";
import { closeDealLost, closeDealWon, updateDealStage } from "@/lib/sales/deals/close-deal";
import type { DealStage } from "@/types";
import type { ManagerActor } from "./types";

export type ActionOutcome = {
  ok: boolean;
  message: string;
  changed: number;
  skipped: number;
  failed: number;
  details?: Array<{ id: string; ok: boolean; reason?: string }>;
  code?: string;
};

export async function reassignLeadsAction(opts: {
  actor: ManagerActor;
  leadIds: string[];
  toUserId: string;
}): Promise<ActionOutcome> {
  const supabase = createAdminClient();
  const eligible = await isRoundRobinEligibleUserId(supabase, opts.actor.clientId, opts.toUserId);
  if (!eligible) {
    return { ok: false, message: "That person is not an active salesperson for this company.", changed: 0, skipped: 0, failed: 0, code: "INVALID_ASSIGNEE" };
  }
  const { data: assignee } = await supabase.from("users").select("name").eq("id", opts.toUserId).maybeSingle();
  const toName = (assignee as { name?: string } | null)?.name || "Salesperson";
  const { data: actorUser } = await supabase.from("users").select("name").eq("id", opts.actor.userId).maybeSingle();
  const actorName = (actorUser as { name?: string } | null)?.name || opts.actor.name;

  const { data: leads } = await supabase
    .from("leads")
    .select("id, assigned_to_id, client_id")
    .in("id", opts.leadIds)
    .eq("client_id", opts.actor.clientId);
  const rows = asRows<{ id: string; assigned_to_id: string | null }>(leads);
  let changed = 0;
  let skipped = 0;
  let failed = 0;
  const details: ActionOutcome["details"] = [];
  const nowIso = new Date().toISOString();

  for (const leadId of opts.leadIds) {
    const row = rows.find((r) => r.id === leadId);
    if (!row) {
      failed += 1;
      details.push({ id: leadId, ok: false, reason: "Lead not found in this company." });
      continue;
    }
    if (row.assigned_to_id === opts.toUserId) {
      skipped += 1;
      details.push({ id: leadId, ok: true, reason: "Already assigned" });
      continue;
    }
    const prev = row.assigned_to_id;
    const { error } = await supabase
      .from("leads")
      .update({ assigned_to_id: opts.toUserId, updated_at: nowIso })
      .eq("id", leadId)
      .eq("client_id", opts.actor.clientId);
    if (error) {
      failed += 1;
      details.push({ id: leadId, ok: false, reason: error.message });
      continue;
    }
    changed += 1;
    details.push({ id: leadId, ok: true });
    background("managerLogReassign", async () => {
      let fromName = "Unassigned";
      if (prev) {
        const { data: u } = await supabase.from("users").select("name").eq("id", prev).maybeSingle();
        if (u) fromName = (u as { name: string }).name;
      }
      await logLeadReassigned({
        leadId,
        clientId: opts.actor.clientId,
        actor: { id: opts.actor.userId, name: actorName, role: opts.actor.role },
        fromId: prev,
        fromName,
        toId: opts.toUserId,
        toName,
        handoverNotes: "Reassigned from Command Center",
      });
    });
  }

  if (changed > 0) {
    background("managerNotifyReassign", async () => {
      await notifyBulkReassignment({
        clientId: opts.actor.clientId,
        leadIds: details.filter((d) => d.ok && d.reason !== "Already assigned").map((d) => d.id),
        actorId: opts.actor.userId,
      });
    });
  }

  return {
    ok: failed === 0,
    message:
      failed > 0
        ? `Partially completed. ${changed} of ${opts.leadIds.length} Leads reassigned to ${toName}.`
        : `Done. ${changed} Lead${changed === 1 ? "" : "s"} reassigned to ${toName}.`,
    changed,
    skipped,
    failed,
    details,
  };
}

export async function createFollowUpsAction(opts: {
  actor: ManagerActor;
  leadIds: string[];
  dueDate: string;
  title?: string;
}): Promise<ActionOutcome> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  let changed = 0;
  let failed = 0;
  const details: ActionOutcome["details"] = [];
  for (const leadId of opts.leadIds) {
    const { data: lead, error } = await supabase
      .from("leads")
      .update({
        follow_up_date: opts.dueDate,
        follow_up_source: "HUMAN_CREATED",
        updated_at: nowIso,
      })
      .eq("id", leadId)
      .eq("client_id", opts.actor.clientId)
      .select("id")
      .maybeSingle();
    if (error || !lead) {
      failed += 1;
      details.push({ id: leadId, ok: false, reason: error?.message || "Not found" });
      continue;
    }
    changed += 1;
    details.push({ id: leadId, ok: true });
    await logFollowUpSet({
      leadId,
      clientId: opts.actor.clientId,
      actor: { id: opts.actor.userId, name: opts.actor.name, role: opts.actor.role },
      followUpDate: opts.dueDate,
      notes: opts.title ?? "Follow-up created from Command Center",
    });
  }
  return {
    ok: failed === 0,
    message:
      failed > 0
        ? `Partially completed. ${changed} of ${opts.leadIds.length} follow-ups created for ${opts.dueDate}.`
        : `Done. ${changed} follow-up${changed === 1 ? "" : "s"} created for ${opts.dueDate}.`,
    changed,
    skipped: 0,
    failed,
    details,
  };
}

export async function decideQuotationAction(opts: {
  actor: ManagerActor;
  quotationId: string;
  decision: "approve" | "reject" | "request_changes";
  note?: string | null;
}): Promise<ActionOutcome> {
  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotations")
    .select(
      "id, client_id, status, deal_id, approval_status, prepared_by_id, quote_number, lead_id, superseded_by_id, updated_at"
    )
    .eq("id", opts.quotationId)
    .eq("client_id", opts.actor.clientId)
    .maybeSingle();
  const q = asRow<{
    id: string;
    status: string;
    deal_id: string | null;
    approval_status: string | null;
    prepared_by_id: string | null;
    quote_number: string | null;
    lead_id: string;
    superseded_by_id: string | null;
  }>(quote);
  if (!q) return { ok: false, message: "Quotation not found.", changed: 0, skipped: 0, failed: 1, code: "NOT_FOUND" };
  if (q.superseded_by_id) {
    return {
      ok: false,
      message: "This quotation can no longer be approved because a newer version exists.",
      changed: 0,
      skipped: 0,
      failed: 1,
      code: "QUOTE_SUPERSEDED",
    };
  }
  if (q.approval_status !== "pending" && q.status !== "pending_approval") {
    return {
      ok: false,
      message:
        q.approval_status === "approved"
          ? "This quotation has already been approved."
          : "Quotation is not pending approval.",
      changed: 0,
      skipped: 0,
      failed: 1,
      code: "QUOTE_NOT_PENDING",
    };
  }

  const { data: pendingRequests } = await supabase
    .from("quotation_approval_requests")
    .select("id, triggered_rules")
    .eq("quotation_id", opts.quotationId)
    .eq("status", "pending");
  const requestIds = (pendingRequests ?? []).map((row) => row.id as string);
  let targets = (pendingRequests ?? []).flatMap((row) => targetsFromUnknownRules(row.triggered_rules));
  if (requestIds.length > 0) {
    const { data: steps } = await supabase
      .from("quotation_approval_steps")
      .select("approver_role, approver_user_id, status")
      .in("request_id", requestIds)
      .eq("status", "pending");
    if (steps && steps.length > 0) {
      targets = steps.map((step) => ({
        approverRole: (step.approver_role as string | null) ?? null,
        approverUserId: (step.approver_user_id as string | null) ?? null,
      }));
    }
  }
  if (!actorCanApproveTargets({ id: opts.actor.userId, role: opts.actor.role }, targets)) {
    return {
      ok: false,
      message: awaitingApproverLabel(targets),
      changed: 0,
      skipped: 0,
      failed: 1,
      code: "PERMISSION_DENIED",
    };
  }

  const nowIso = new Date().toISOString();
  const note = opts.note?.trim() || null;
  const quoteLabel = q.quote_number || "quotation";

  if (opts.decision === "approve") {
    await supabase
      .from("quotations")
      .update({
        status: "draft",
        approval_status: "approved",
        approved_at: nowIso,
        approved_by_id: opts.actor.userId,
        approval_note: note,
        updated_at: nowIso,
      })
      .eq("id", opts.quotationId)
      .eq("client_id", opts.actor.clientId);
    await supabase
      .from("quotation_approval_requests")
      .update({
        status: "approved",
        decided_by_id: opts.actor.userId,
        decided_at: nowIso,
        decision_note: note,
      })
      .eq("quotation_id", opts.quotationId)
      .eq("status", "pending");
    await logQuotationEvent(supabase, {
      quotationId: opts.quotationId,
      clientId: opts.actor.clientId,
      leadId: q.lead_id,
      dealId: q.deal_id,
      actor: { id: opts.actor.userId, name: opts.actor.name },
      eventType: "APPROVED",
      eventData: { note, source: "manager_agent" },
    });
    if (q.prepared_by_id) {
      await notifyQuotationAlert({
        userId: q.prepared_by_id,
        leadId: q.lead_id,
        quotationId: opts.quotationId,
        message: `${quoteLabel} was approved. You can send it now.`,
      });
    }
    return { ok: true, message: `Approved. ${quoteLabel} can now continue through the quotation workflow.`, changed: 1, skipped: 0, failed: 0 };
  }

  if (opts.decision === "request_changes") {
    await supabase
      .from("quotations")
      .update({
        status: "draft",
        approval_status: "changes_requested",
        approval_note: note,
        updated_at: nowIso,
      })
      .eq("id", opts.quotationId)
      .eq("client_id", opts.actor.clientId);
    await supabase
      .from("quotation_approval_requests")
      .update({
        status: "changes_requested",
        decided_by_id: opts.actor.userId,
        decided_at: nowIso,
        decision_note: note,
      })
      .eq("quotation_id", opts.quotationId)
      .eq("status", "pending");
    await logQuotationEvent(supabase, {
      quotationId: opts.quotationId,
      clientId: opts.actor.clientId,
      leadId: q.lead_id,
      dealId: q.deal_id,
      actor: { id: opts.actor.userId, name: opts.actor.name },
      eventType: "CHANGES_REQUESTED",
      eventData: { note, source: "manager_agent" },
    });
    if (q.prepared_by_id) {
      await notifyQuotationAlert({
        userId: q.prepared_by_id,
        leadId: q.lead_id,
        quotationId: opts.quotationId,
        message: `Changes requested on ${quoteLabel}${note ? `: ${note}` : ""}`,
      });
    }
    return { ok: true, message: `Requested changes on ${quoteLabel}.`, changed: 1, skipped: 0, failed: 0 };
  }

  await supabase
    .from("quotations")
    .update({
      status: "draft",
      approval_status: "rejected",
      approval_note: note,
      updated_at: nowIso,
    })
    .eq("id", opts.quotationId)
    .eq("client_id", opts.actor.clientId);
  await supabase
    .from("quotation_approval_requests")
    .update({
      status: "rejected",
      decided_by_id: opts.actor.userId,
      decided_at: nowIso,
      decision_note: note,
    })
    .eq("quotation_id", opts.quotationId)
    .eq("status", "pending");
  await logQuotationEvent(supabase, {
    quotationId: opts.quotationId,
    clientId: opts.actor.clientId,
    leadId: q.lead_id,
    dealId: q.deal_id,
    actor: { id: opts.actor.userId, name: opts.actor.name },
    eventType: "REJECTED",
    eventData: { note, source: "manager_agent" },
  });
  return { ok: true, message: `${quoteLabel} was rejected.`, changed: 1, skipped: 0, failed: 0 };
}

export async function pauseOrResumeAgent(opts: {
  actor: ManagerActor;
  leadId: string;
  action: "pause" | "resume" | "takeover";
}): Promise<ActionOutcome> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", opts.leadId)
    .eq("client_id", opts.actor.clientId)
    .maybeSingle();
  if (!lead) return { ok: false, message: "Conversation not found.", changed: 0, skipped: 0, failed: 1, code: "NOT_FOUND" };
  if (opts.action === "pause") {
    await updateConversationAgentState(opts.actor.clientId, opts.leadId, {
      status: "PAUSED",
      pauseReason: "Paused from Command Center",
      pausedById: opts.actor.userId,
    });
    return { ok: true, message: "Agent paused on this conversation.", changed: 1, skipped: 0, failed: 0 };
  }
  if (opts.action === "takeover") {
    await updateConversationAgentState(opts.actor.clientId, opts.leadId, {
      status: "HUMAN_HANDLING",
      humanTakeover: true,
    });
    return { ok: true, message: "You have taken over this conversation.", changed: 1, skipped: 0, failed: 0 };
  }
  await updateConversationAgentState(opts.actor.clientId, opts.leadId, {
    status: "IDLE",
    humanTakeover: false,
    pauseReason: null,
    pausedUntil: null,
    pausedById: null,
  });
  return { ok: true, message: "Agent can handle this conversation again. Missed actions will be re-evaluated, not dumped.", changed: 1, skipped: 0, failed: 0 };
}

export async function cancelProactiveAction(opts: {
  actor: ManagerActor;
  jobId: string;
  reason?: string;
}): Promise<ActionOutcome> {
  const job = await getJob(opts.jobId, opts.actor.clientId);
  if (!job) return { ok: false, message: "Scheduled action not found.", changed: 0, skipped: 0, failed: 1, code: "NOT_FOUND" };
  const n = await cancelJobs({
    clientId: opts.actor.clientId,
    reason: opts.reason || "Cancelled from Command Center",
    leadId: job.leadId ?? undefined,
    quotationId: job.quotationId ?? undefined,
    cancelledById: opts.actor.userId,
  });
  const label = job.reasonCode
    ? REASON_CODE_LABELS[job.reasonCode as keyof typeof REASON_CODE_LABELS] || job.triggerType
    : job.triggerType;
  return {
    ok: n > 0,
    message: n > 0 ? `Cancelled: ${label}.` : "Nothing was scheduled to cancel.",
    changed: n,
    skipped: 0,
    failed: n > 0 ? 0 : 1,
  };
}

export async function updateDealStageAction(opts: {
  actor: ManagerActor;
  dealId: string;
  stage: DealStage;
}): Promise<ActionOutcome> {
  const result = await updateDealStage({ dealId: opts.dealId, actorId: opts.actor.userId, stage: opts.stage });
  if (!result.ok) return { ok: false, message: result.error, changed: 0, skipped: 0, failed: 1 };
  return { ok: true, message: `Deal moved to the requested stage.`, changed: 1, skipped: 0, failed: 0 };
}

export async function closeDealAction(opts: {
  actor: ManagerActor;
  dealId: string;
  outcome: "WON" | "LOST";
  wonValue?: number;
  lostReason?: string;
}): Promise<ActionOutcome> {
  if (opts.outcome === "WON") {
    const result = await closeDealWon({
      dealId: opts.dealId,
      actorId: opts.actor.userId,
      wonValue: opts.wonValue ?? 0,
    });
    if (!result.ok) return { ok: false, message: result.error, changed: 0, skipped: 0, failed: 1 };
    return { ok: true, message: "Deal marked Won.", changed: 1, skipped: 0, failed: 0 };
  }
  const reason = opts.lostReason?.trim();
  if (!reason) {
    return { ok: false, message: "A lost reason is required. Do not use a generic Other.", changed: 0, skipped: 0, failed: 1, code: "LOST_REASON_REQUIRED" };
  }
  const result = await closeDealLost({
    dealId: opts.dealId,
    actorId: opts.actor.userId,
    lostReason: reason,
  });
  if (!result.ok) return { ok: false, message: result.error, changed: 0, skipped: 0, failed: 1 };
  return { ok: true, message: "Deal marked Lost.", changed: 1, skipped: 0, failed: 0 };
}

export async function previewReassign(opts: {
  actor: ManagerActor;
  fromUserId: string;
  toUserId: string;
  openOnly?: boolean;
}) {
  const supabase = createAdminClient();
  let q = supabase
    .from("leads")
    .select("id, name, status, score")
    .eq("client_id", opts.actor.clientId)
    .eq("assigned_to_id", opts.fromUserId);
  if (opts.openOnly !== false) {
    q = q.in("status", ["NEW", "CONTACTED", "QUALIFIED"]);
  }
  const { data } = await q.limit(200);
  const rows = asRows<{ id: string; name: string | null; status: string; score: number | null }>(data);
  return {
    leadIds: rows.map((r) => r.id),
    records: rows.map((r) => ({ id: r.id, label: r.name || r.id })),
    hot: rows.filter((r) => (r.score ?? 0) >= 70).length,
    count: rows.length,
  };
}

export async function quotationPreview(actor: ManagerActor, quotationId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("quotations")
    .select(
      "id, quote_number, total, discount_percent, customer_name, prepared_by_id, approval_status, status, superseded_by_id, revision_number, approval_required_reasons, updated_at, lead_id"
    )
    .eq("id", quotationId)
    .eq("client_id", actor.clientId)
    .maybeSingle();
  return asRow<Record<string, unknown>>(data);
}
