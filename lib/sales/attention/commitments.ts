/**
 * Structured customer / salesperson commitments.
 * Prefer canonical lead.follow_up_date when a Task-like follow-up is needed.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { hookCustomerCommitment } from "@/lib/agent/proactive/hooks";
import { emitAttentionEvent } from "./observability";

export type CommitmentCommittedBy = "CUSTOMER" | "SALESPERSON";

export type SalesCommitment = {
  id: string;
  clientId: string;
  leadId: string | null;
  dealId: string | null;
  salespersonId: string | null;
  committedBy: CommitmentCommittedBy;
  commitmentType: string;
  description: string;
  dueAt: string | null;
  status: "OPEN" | "COMPLETED" | "CANCELLED" | "SUPERSEDED";
  sourceMessageId: string | null;
  sourceMessageExcerpt: string | null;
  fingerprint: string;
};

function commitmentFingerprint(opts: {
  clientId: string;
  leadId: string | null;
  committedBy: CommitmentCommittedBy;
  dueAt: string | null;
  description: string;
}): string {
  const due = opts.dueAt?.slice(0, 10) ?? "none";
  const desc = opts.description.trim().toLowerCase().slice(0, 80);
  return `${opts.clientId}:${opts.leadId ?? "nolead"}:${opts.committedBy}:${due}:${desc}`;
}

export async function upsertCommitment(opts: {
  clientId: string;
  leadId: string | null;
  dealId?: string | null;
  salespersonId?: string | null;
  customerId?: string | null;
  conversationId?: string | null;
  committedBy: CommitmentCommittedBy;
  commitmentType?: string;
  description: string;
  dueAt: string | null;
  sourceMessageId?: string | null;
  sourceMessageExcerpt?: string | null;
  /** When true, also set leads.follow_up_date + proactive evaluation. */
  syncLeadFollowUp?: boolean;
}): Promise<SalesCommitment | null> {
  const supabase = createAdminClient();
  const fingerprint = commitmentFingerprint({
    clientId: opts.clientId,
    leadId: opts.leadId,
    committedBy: opts.committedBy,
    dueAt: opts.dueAt,
    description: opts.description,
  });

  const row = {
    client_id: opts.clientId,
    lead_id: opts.leadId,
    deal_id: opts.dealId ?? null,
    salesperson_id: opts.salespersonId ?? null,
    customer_id: opts.customerId ?? null,
    conversation_id: opts.conversationId ?? opts.leadId,
    committed_by: opts.committedBy,
    commitment_type: opts.commitmentType ?? "FOLLOW_UP",
    description: opts.description.trim(),
    due_at: opts.dueAt,
    status: "OPEN",
    source_message_id: opts.sourceMessageId ?? null,
    source_message_excerpt: opts.sourceMessageExcerpt?.slice(0, 280) ?? null,
    linked_task_follow_up_date: opts.dueAt ? opts.dueAt.slice(0, 10) : null,
    fingerprint,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("sales_customer_commitments")
    .upsert(row, { onConflict: "client_id,fingerprint" })
    .select("*")
    .maybeSingle();

  if (error) {
    if (/sales_customer_commitments|does not exist|relation/i.test(error.message)) {
      return null;
    }
    throw new Error(error.message);
  }

  await emitAttentionEvent({
    clientId: opts.clientId,
    salespersonId: opts.salespersonId,
    eventType: "sales_attention.commitment_extracted",
    payload: {
      committedBy: opts.committedBy,
      dueAt: opts.dueAt,
      leadId: opts.leadId,
    },
  });

  if (opts.syncLeadFollowUp && opts.leadId && opts.dueAt) {
    const dueDate = opts.dueAt.slice(0, 10);
    await supabase
      .from("leads")
      .update({
        follow_up_date: dueDate,
        follow_up_source:
          opts.committedBy === "CUSTOMER" ? "CUSTOMER_COMMITMENT" : "HUMAN_CREATED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.leadId)
      .eq("client_id", opts.clientId);

    if (opts.committedBy === "CUSTOMER") {
      await hookCustomerCommitment({
        clientId: opts.clientId,
        leadId: opts.leadId,
        dealId: opts.dealId ?? null,
        dueDate,
        note: opts.description,
        actorType: "CUSTOMER",
      });
    }
  }

  if (!data) return null;
  return mapCommitment(data as Record<string, unknown>);
}

export async function listOpenCommitments(opts: {
  clientId: string;
  salespersonId?: string | null;
  dueBefore?: string;
  leadId?: string | null;
}): Promise<SalesCommitment[]> {
  const supabase = createAdminClient();
  let q = supabase
    .from("sales_customer_commitments")
    .select("*")
    .eq("client_id", opts.clientId)
    .eq("status", "OPEN");
  if (opts.salespersonId) q = q.eq("salesperson_id", opts.salespersonId);
  if (opts.leadId) q = q.eq("lead_id", opts.leadId);
  if (opts.dueBefore) q = q.lte("due_at", opts.dueBefore);

  const { data, error } = await q.order("due_at", { ascending: true }).limit(200);
  if (error) {
    if (/sales_customer_commitments|does not exist|relation/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => mapCommitment(r as Record<string, unknown>));
}

export async function completeCommitment(opts: {
  clientId: string;
  commitmentId: string;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("sales_customer_commitments")
    .update({
      status: "COMPLETED",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.commitmentId)
    .eq("client_id", opts.clientId);
}

function mapCommitment(row: Record<string, unknown>): SalesCommitment {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    leadId: row.lead_id ? String(row.lead_id) : null,
    dealId: row.deal_id ? String(row.deal_id) : null,
    salespersonId: row.salesperson_id ? String(row.salesperson_id) : null,
    committedBy: row.committed_by as CommitmentCommittedBy,
    commitmentType: String(row.commitment_type ?? "FOLLOW_UP"),
    description: String(row.description ?? ""),
    dueAt: row.due_at ? String(row.due_at) : null,
    status: row.status as SalesCommitment["status"],
    sourceMessageId: row.source_message_id ? String(row.source_message_id) : null,
    sourceMessageExcerpt: row.source_message_excerpt ? String(row.source_message_excerpt) : null,
    fingerprint: String(row.fingerprint),
  };
}
