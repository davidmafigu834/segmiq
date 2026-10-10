import { createAdminClient } from "@/lib/supabase/admin";
import type { SalesTaskItem, SalesTaskPriority } from "@/lib/sales/tasks/types";
import { isTaskOverdue } from "@/lib/sales/tasks/format";
import { listOwnerItems, primaryLabel, type WorkItemRow } from "./store";

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
  if (row.review_status === "approved" && row.execution_status === "succeeded" && row.linked_follow_up) return true;
  if (row.action_type === "send_quotation" || row.action_type === "quotation_draft") return row.review_status !== "dismissed";
  return false;
}

export function copilotRowToTask(row: WorkItemRow, now: Date, relatedName: string): SalesTaskItem {
  const due = row.proposed_at ?? row.updated_at ?? now.toISOString();
  const overdue = row.proposed_at ? isTaskOverdue(row.proposed_at, now) : false;
  const priority = (row.priority || "medium") as SalesTaskPriority;
  return {
    id: row.id,
    leadId: row.lead_id,
    title: row.title,
    type: taskType(row.action_type),
    typeLabel: row.queue === "needs_review" ? "Needs review" : row.queue === "waiting" ? "Waiting" : "To do",
    relatedName,
    relatedSecondary: row.waiting_actor ? `Waiting on ${row.waiting_actor}` : "Sales Copilot",
    phone: null,
    source: "WHATSAPP_INBOUND",
    dueAt: due,
    priority,
    status: overdue && row.review_status !== "pending" ? "overdue" : "pending",
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
      primaryLabel: primaryLabel(row.action_type, row.execution_status, row.missing_information),
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
  if (leadIds.length) {
    const supabase = createAdminClient();
    const { data } = await supabase.from("leads").select("id, name").in("id", leadIds);
    for (const lead of data ?? []) {
      const row = lead as { id?: string; name?: string | null };
      if (row.id) names.set(row.id, row.name?.trim() || "Customer");
    }
  }
  const tasks: SalesTaskItem[] = [];
  const suppressFollowUpLeadIds = new Set<string>();
  const notesByLead = new Map<string, string>();
  for (const row of rows) {
    if (!visible(row, now)) continue;
    if (row.linked_follow_up && row.review_status === "approved" && row.execution_status === "succeeded") {
      suppressFollowUpLeadIds.add(row.lead_id);
      notesByLead.set(row.lead_id, row.explanation);
    }
    tasks.push(copilotRowToTask(row, now, names.get(row.lead_id) || "Customer"));
  }
  return { tasks, suppressFollowUpLeadIds, notesByLead };
}
