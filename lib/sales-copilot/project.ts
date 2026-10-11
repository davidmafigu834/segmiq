import { createAdminClient } from "@/lib/supabase/admin";
import type { SalesTaskItem, SalesTaskPriority } from "@/lib/sales/tasks/types";
import { withoutMeetingDuplicateReminders } from "./dedupe";
import { presentCopilotWork, primaryLabel } from "./present";
import { listOwnerItems, type WorkItemRow } from "./store";

function taskType(actionType: string): SalesTaskItem["type"] {
  if (actionType.includes("quotation") || actionType === "send_quotation") return "quote_review";
  if (actionType === "answer_question") return "whatsapp";
  if (actionType.includes("reminder") || actionType === "contact_later" || actionType === "customer_checkin") {
    return "follow_up";
  }
  return "follow_up";
}

function visible(row: WorkItemRow, now: Date): boolean {
  if (row.fulfilment_status !== "open") return false;
  if (row.snooze_until && new Date(row.snooze_until).getTime() > now.getTime()) return false;
  if (row.review_status === "dismissed" || row.review_status === "stale") return false;
  if (row.proposed_payload.onDemand === true && row.review_status === "pending") return false;
  if (row.review_status === "pending" || row.review_status === "snoozed") return true;
  if (row.execution_status === "failed") return true;
  if (row.review_status === "approved" && row.execution_status === "succeeded" && row.fulfilment_status === "open") return true;
  if (row.action_type === "send_quotation" || row.action_type === "quotation_draft") return row.review_status !== "dismissed";
  return false;
}

function evidenceOf(payload: Record<string, unknown>): Array<{ id: string; at: string; speaker: string; text: string }> {
  if (!Array.isArray(payload.evidence)) return [];
  return payload.evidence.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.text !== "string" || !row.text.trim()) return [];
    return [{
      id: String(row.id ?? ""),
      at: String(row.at ?? ""),
      speaker: String(row.speaker ?? ""),
      text: row.text,
    }];
  });
}

export function copilotRowToTask(row: WorkItemRow, now: Date, relatedName: string, phone: string | null = null): SalesTaskItem {
  const view = presentCopilotWork(
    {
      actionType: row.action_type,
      title: row.title,
      explanation: row.explanation,
      queue: row.queue,
      reviewStatus: row.review_status,
      executionStatus: row.execution_status,
      fulfilmentStatus: row.fulfilment_status,
      waitingActor: row.waiting_actor,
      proposedAt: row.proposed_at,
      currentDueAt: row.current_due_at,
      linkedFollowUp: row.linked_follow_up,
      missing: row.missing_information,
      payload: row.proposed_payload,
      semanticKey: row.semantic_key,
      executionError: row.execution_error,
      linkedQuotationId: row.linked_quotation_id,
    },
    now
  );
  const priority = (row.priority || "medium") as SalesTaskPriority;
  const stateLabel = view.listState === "needs_review" ? "Needs review" : view.listState === "waiting" ? "Waiting" : "To do";
  return {
    id: row.id,
    leadId: row.lead_id,
    title: view.title,
    type: taskType(row.action_type),
    typeLabel: stateLabel,
    relatedName,
    relatedSecondary: null,
    phone,
    source: "WHATSAPP_INBOUND",
    dueAt: view.deadlineAt,
    deadlineAt: view.deadlineAt,
    schedule: view.schedule,
    priority,
    status: view.schedule.overdue ? "overdue" : "pending",
    completed: false,
    completedAt: null,
    createdById: null,
    createdByName: "Sales Copilot",
    assignedToId: row.owner_id ?? "",
    isWhatsAppCapable: true,
    leadHref: `/sales/inbox?lead=${row.lead_id}`,
    whatsappHref: `/sales/inbox?lead=${row.lead_id}`,
    score: null,
    notes: row.explanation,
    copilot: {
      workItemId: row.id,
      queue: row.queue,
      listState: view.listState,
      actionType: row.action_type,
      explanation: row.explanation,
      reviewStatus: row.review_status,
      executionStatus: row.execution_status,
      fulfilmentStatus: row.fulfilment_status,
      waitingActor: row.waiting_actor,
      hourSuggested: row.hour_suggested,
      currentDueAt: row.current_due_at,
      proposedAt: row.proposed_at,
      linkedQuotationId: row.linked_quotation_id,
      missing: row.missing_information,
      evidenceMessageIds: row.evidence_message_ids,
      evidence: evidenceOf(row.proposed_payload),
      payload: row.proposed_payload,
      executionError: row.execution_error,
      primaryLabel: primaryLabel(row.action_type, row.execution_status, row.missing_information),
      actionLabel: view.actionLabel,
      primaryAction: view.primaryAction,
    },
  };
}

export async function loadCopilotTasksForOwner(ownerId: string, now: Date): Promise<{
  tasks: SalesTaskItem[];
  suppressFollowUpLeadIds: Set<string>;
  notesByLead: Map<string, string>;
}> {
  const rows = await listOwnerItems(ownerId);
  const leadIds = Array.from(new Set(rows.map((row) => row.lead_id)));
  const names = new Map<string, string>();
  const phones = new Map<string, string>();
  if (leadIds.length) {
    const supabase = createAdminClient();
    const { data } = await supabase.from("leads").select("id, name, phone").in("id", leadIds);
    for (const lead of data ?? []) {
      const row = lead as { id?: string; name?: string | null; phone?: string | null };
      if (row.id) names.set(row.id, row.name?.trim() || "Customer");
      if (row.id && row.phone) phones.set(row.id, row.phone);
    }
  }
  const tasks: SalesTaskItem[] = [];
  const suppressFollowUpLeadIds = new Set<string>();
  const notesByLead = new Map<string, string>();
  const visibleRows = withoutMeetingDuplicateReminders(
    rows.filter((row) => visible(row, now)).map((row) => ({
      ...row,
      semanticKey: row.semantic_key,
      actionType: row.action_type,
      evidenceMessageIds: row.evidence_message_ids,
    }))
  );
  for (const row of visibleRows) {
    if (row.linked_follow_up && row.review_status === "approved" && row.execution_status === "succeeded") {
      suppressFollowUpLeadIds.add(row.lead_id);
      notesByLead.set(row.lead_id, row.explanation);
    }
    tasks.push(copilotRowToTask(row, now, names.get(row.lead_id) || "Customer", phones.get(row.lead_id) ?? null));
  }
  return { tasks, suppressFollowUpLeadIds, notesByLead };
}
