import { createAdminClient } from "@/lib/supabase/admin";
import type { CopilotQueue, CopilotWorkView, EvidenceExcerpt, WorkItemUpsert } from "./types";

export type WorkItemRow = {
  id: string;
  client_id: string;
  lead_id: string;
  deal_id: string | null;
  owner_id: string | null;
  action_type: string;
  queue: CopilotQueue;
  title: string;
  explanation: string;
  evidence_message_ids: string[];
  proposed_payload: Record<string, unknown>;
  payload_hash: string;
  missing_information: string[];
  linked_quotation_id: string | null;
  linked_follow_up: boolean;
  review_status: string;
  execution_status: string;
  fulfilment_status: string;
  waiting_actor: string | null;
  proposed_at: string | null;
  hour_suggested: boolean;
  current_due_at: string | null;
  snooze_until: string | null;
  context_revision: string;
  semantic_key: string;
  priority: "high" | "medium" | "low";
  execution_error: string | null;
  audit: Array<Record<string, unknown>>;
  updated_at: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function rowFromUnknown(value: unknown): WorkItemRow | null {
  const row = asRecord(value);
  if (typeof row.id !== "string" || typeof row.lead_id !== "string") return null;
  return {
    id: row.id,
    client_id: String(row.client_id ?? ""),
    lead_id: row.lead_id,
    deal_id: (row.deal_id as string | null) ?? null,
    owner_id: (row.owner_id as string | null) ?? null,
    action_type: String(row.action_type ?? ""),
    queue: (row.queue as CopilotQueue) ?? "needs_review",
    title: String(row.title ?? ""),
    explanation: String(row.explanation ?? ""),
    evidence_message_ids: Array.isArray(row.evidence_message_ids)
      ? row.evidence_message_ids.map(String)
      : [],
    proposed_payload: asRecord(row.proposed_payload),
    payload_hash: String(row.payload_hash ?? ""),
    missing_information: Array.isArray(row.missing_information) ? row.missing_information.map(String) : [],
    linked_quotation_id: (row.linked_quotation_id as string | null) ?? null,
    linked_follow_up: Boolean(row.linked_follow_up),
    review_status: String(row.review_status ?? "pending"),
    execution_status: String(row.execution_status ?? "none"),
    fulfilment_status: String(row.fulfilment_status ?? "open"),
    waiting_actor: (row.waiting_actor as string | null) ?? null,
    proposed_at: (row.proposed_at as string | null) ?? null,
    hour_suggested: Boolean(row.hour_suggested),
    current_due_at: (row.current_due_at as string | null) ?? null,
    snooze_until: (row.snooze_until as string | null) ?? null,
    context_revision: String(row.context_revision ?? ""),
    semantic_key: String(row.semantic_key ?? ""),
    priority: row.priority === "high" || row.priority === "low" ? row.priority : "medium",
    execution_error: (row.execution_error as string | null) ?? null,
    audit: Array.isArray(row.audit) ? (row.audit as Array<Record<string, unknown>>) : [],
    updated_at: String(row.updated_at ?? ""),
  };
}

export function primaryLabel(actionType: string, executionStatus: string, missing: string[] = []): string {
  if (executionStatus === "failed") return "Retry";
  if (missing.length > 0 && (actionType === "appointment" || actionType === "create_reminder" || actionType === "update_reminder")) {
    return "Change time";
  }
  if (actionType === "quotation_draft") return "Review draft";
  if (actionType === "quotation_missing") return "Add missing details";
  if (actionType === "quotation_choice" || actionType === "listing_shortlist") return "Choose product";
  if (actionType === "contact_later") return "Approve follow-up";
  if (actionType === "customer_checkin") return "Set follow-up";
  if (actionType === "update_reminder" || actionType === "create_reminder") return "Save reminder";
  if (actionType === "appointment") return "Change time";
  if (actionType === "send_quotation") return "Open draft";
  if (actionType === "answer_question") return "Draft reply";
  return "Review";
}

export function toPublicItem(row: WorkItemRow): CopilotWorkView {
  const payload = row.proposed_payload;
  const evidence = Array.isArray(payload.evidence) ? (payload.evidence as EvidenceExcerpt[]) : [];
  return {
    id: row.id,
    leadId: row.lead_id,
    actionType: row.action_type,
    queue: row.queue,
    title: row.title,
    explanation: row.explanation,
    reviewStatus: row.review_status,
    executionStatus: row.execution_status,
    fulfilmentStatus: row.fulfilment_status,
    waitingActor: row.waiting_actor,
    proposedAt: row.proposed_at,
    hourSuggested: row.hour_suggested,
    currentDueAt: row.current_due_at,
    priority: row.priority,
    missing: row.missing_information,
    evidence,
    linkedQuotationId: row.linked_quotation_id,
    linkedFollowUp: row.linked_follow_up,
    executionError: row.execution_error,
    payload,
    semanticKey: row.semantic_key,
    contextRevision: row.context_revision,
    primaryLabel: primaryLabel(row.action_type, row.execution_status, row.missing_information),
    snoozeUntil: row.snooze_until,
  };
}

function itemWrite(item: WorkItemUpsert, scope: { clientId: string; leadId: string; ownerId: string | null; dealId: string | null }) {
  return {
    client_id: scope.clientId,
    lead_id: scope.leadId,
    deal_id: scope.dealId,
    owner_id: scope.ownerId,
    action_type: item.actionType,
    queue: item.queue,
    title: item.title,
    explanation: item.explanation,
    evidence_message_ids: item.evidenceMessageIds,
    proposed_payload: { ...item.payload, evidence: item.evidence },
    payload_hash: item.payloadHash,
    missing_information: item.missing,
    linked_quotation_id: item.linkedQuotationId ?? null,
    linked_follow_up: item.linkedFollowUp,
    review_status: item.reviewStatus ?? "pending",
    execution_status: item.executionStatus ?? "none",
    fulfilment_status: item.fulfilmentStatus ?? "open",
    waiting_actor: item.waitingActor,
    proposed_at: item.proposedAt,
    hour_suggested: item.hourSuggested,
    current_due_at: item.currentDueAt,
    context_revision: item.contextRevision,
    semantic_key: item.semanticKey,
    priority: item.priority,
    execution_error: item.executionError ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function listWorkItems(leadId: string, clientId: string): Promise<WorkItemRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_copilot_work_items")
    .select("*")
    .eq("lead_id", leadId)
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowFromUnknown).filter((row): row is WorkItemRow => Boolean(row));
}

export async function getWorkItem(id: string): Promise<WorkItemRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("sales_copilot_work_items").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return rowFromUnknown(data);
}

export async function saveAnalysis(input: {
  leadId: string;
  clientId: string;
  status: "pending" | "succeeded" | "degraded" | "failed";
  contextRevision: string;
  summary: string;
  facts: unknown;
  lastMessageId: string | null;
  lastMessageAt: string | null;
  error: string | null;
  model: string | null;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("sales_copilot_analyses").upsert({
    lead_id: input.leadId,
    client_id: input.clientId,
    status: input.status,
    context_revision: input.contextRevision,
    summary: input.summary,
    facts: input.facts,
    last_message_id: input.lastMessageId,
    last_message_at: input.lastMessageAt,
    error: input.error,
    model: input.model,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function loadAnalysis(leadId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("sales_copilot_analyses").select("*").eq("lead_id", leadId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as {
    status?: string;
    summary?: string | null;
    context_revision?: string;
    last_message_id?: string | null;
    updated_at?: string;
    error?: string | null;
  } | null;
}

export async function persistReconcile(input: {
  clientId: string;
  leadId: string;
  ownerId: string | null;
  dealId: string | null;
  upserts: WorkItemUpsert[];
  staleIds: string[];
  obsoleteIds: string[];
}) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  for (const item of input.upserts) {
    const write = itemWrite(item, input);
    if (item.id) {
      const { error } = await supabase
        .from("sales_copilot_work_items")
        .update(write)
        .eq("id", item.id)
        .eq("client_id", input.clientId)
        .in("review_status", ["pending", "snoozed"]);
      if (error) throw new Error(error.message);
      continue;
    }
    const { error } = await supabase.from("sales_copilot_work_items").insert(write);
    if (error && /duplicate|unique/i.test(error.message)) {
      await supabase
        .from("sales_copilot_work_items")
        .update(write)
        .eq("client_id", input.clientId)
        .eq("lead_id", input.leadId)
        .eq("semantic_key", item.semanticKey)
        .in("review_status", ["pending", "snoozed"]);
      continue;
    }
    if (error) throw new Error(error.message);
  }
  if (input.staleIds.length) {
    await supabase
      .from("sales_copilot_work_items")
      .update({ review_status: "stale", updated_at: now })
      .in("id", input.staleIds)
      .eq("client_id", input.clientId)
      .eq("execution_status", "none");
  }
  if (input.obsoleteIds.length) {
    await supabase
      .from("sales_copilot_work_items")
      .update({ fulfilment_status: "obsolete", updated_at: now })
      .in("id", input.obsoleteIds)
      .eq("client_id", input.clientId);
  }
}

export async function claimWorkItem(id: string, mode: "approve" | "retry"): Promise<WorkItemRow | null> {
  const supabase = createAdminClient();
  let query = supabase
    .from("sales_copilot_work_items")
    .update({
      review_status: "approved",
      execution_status: "running",
      execution_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("fulfilment_status", "open");
  query =
    mode === "retry"
      ? query.eq("review_status", "approved").eq("execution_status", "failed")
      : query.eq("review_status", "pending").eq("execution_status", "none");
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return rowFromUnknown(data);
}

export async function appendAudit(id: string, entry: Record<string, unknown>, patch: Record<string, unknown>) {
  const current = await getWorkItem(id);
  if (!current) return;
  const supabase = createAdminClient();
  await supabase
    .from("sales_copilot_work_items")
    .update({
      ...patch,
      audit: [...current.audit, entry].slice(-30),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function listOwnerItems(ownerId: string): Promise<WorkItemRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_copilot_work_items")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("fulfilment_status", "open")
    .order("proposed_at", { ascending: true });
  if (error) {
    if (/sales_copilot_work_items|does not exist|relation/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map(rowFromUnknown).filter((row): row is WorkItemRow => Boolean(row));
}
