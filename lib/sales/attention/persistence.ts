/**
 * Persist / reconcile SalesAttentionItem projections.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { SalesAttentionItem } from "./types";
import { emitAttentionEvent } from "./observability";

export type AttentionRow = {
  id: string;
  client_id: string;
  salesperson_id: string;
  fingerprint: string;
  attention_type: string;
  priority_class: string;
  title: string;
  reason_code: string;
  reason_summary: string;
  suggested_action_type: string | null;
  suggested_action_summary: string | null;
  state: string;
  due_at: string | null;
  snoozed_until: string | null;
  lead_id: string | null;
  deal_id: string | null;
  quotation_id: string | null;
  commitment_id: string | null;
  internal_score: number;
  enrichment: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  first_detected_at: string;
  last_evaluated_at: string;
};

function itemToRow(item: SalesAttentionItem): Record<string, unknown> {
  return {
    client_id: item.companyId,
    salesperson_id: item.salespersonId,
    fingerprint: item.fingerprint,
    attention_type: item.type,
    priority_class: item.priorityClass,
    title: item.title,
    reason_code: String(item.reasonCode),
    reason_summary: item.reasonSummary,
    suggested_action_type: item.suggestedActionType,
    suggested_action_summary: item.suggestedActionSummary,
    state: item.state,
    due_at: item.dueAt,
    snoozed_until: item.snoozedUntil,
    lead_id: item.leadId,
    deal_id: item.dealId,
    conversation_id: item.conversationId,
    quotation_id: item.quotationId,
    commitment_id: typeof item.metadata.commitmentId === "string" ? item.metadata.commitmentId : null,
    internal_score: item.internalScore,
    enrichment: item.metadata.enrichment ?? {},
    metadata: item.metadata,
    last_evaluated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Upsert open candidates; invalidate projections whose fingerprints disappeared.
 */
export async function reconcileAttentionProjections(opts: {
  clientId: string;
  salespersonId: string;
  items: SalesAttentionItem[];
}): Promise<{ upserted: number; invalidated: number }> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const fingerprints = new Set(opts.items.map((i) => i.fingerprint));

  let upserted = 0;
  for (const item of opts.items) {
    const row = itemToRow({ ...item, state: "OPEN" });
    const { data: existing } = await supabase
      .from("sales_attention_items")
      .select("id, state, snoozed_until")
      .eq("client_id", opts.clientId)
      .eq("salesperson_id", opts.salespersonId)
      .eq("fingerprint", item.fingerprint)
      .maybeSingle();

    if (existing?.state === "SNOOZED" && existing.snoozed_until) {
      if (Date.parse(String(existing.snoozed_until)) > Date.now()) {
        continue; // respect snooze
      }
    }
    if (existing?.state === "DISMISSED" || existing?.state === "COMPLETED") {
      // Keep dismissed/completed unless fingerprint state version forces reopen —
      // for daily reconcile we skip reopening same fingerprint same day.
      continue;
    }

    const { error } = await supabase.from("sales_attention_items").upsert(
      {
        ...row,
        first_detected_at: existing ? undefined : now,
        state: "OPEN",
      },
      { onConflict: "client_id,salesperson_id,fingerprint" }
    );
    if (!error) {
      upserted += 1;
      if (!existing) {
        await emitAttentionEvent({
          clientId: opts.clientId,
          salespersonId: opts.salespersonId,
          eventType: "sales_attention.item_created",
          payload: {
            fingerprint: item.fingerprint,
            type: item.type,
            priorityClass: item.priorityClass,
          },
        });
      }
    }
  }

  const { data: openRows } = await supabase
    .from("sales_attention_items")
    .select("id, fingerprint")
    .eq("client_id", opts.clientId)
    .eq("salesperson_id", opts.salespersonId)
    .eq("state", "OPEN");

  let invalidated = 0;
  for (const row of openRows ?? []) {
    if (!fingerprints.has(String(row.fingerprint))) {
      await supabase
        .from("sales_attention_items")
        .update({ state: "INVALIDATED", last_evaluated_at: now, updated_at: now })
        .eq("id", row.id);
      invalidated += 1;
      await emitAttentionEvent({
        clientId: opts.clientId,
        salespersonId: opts.salespersonId,
        attentionItemId: String(row.id),
        eventType: "sales_attention.item_invalidated",
        payload: { fingerprint: row.fingerprint },
      });
    }
  }

  return { upserted, invalidated };
}

export async function loadOpenAttentionProjections(opts: {
  clientId: string;
  salespersonId: string;
}): Promise<AttentionRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_attention_items")
    .select("*")
    .eq("client_id", opts.clientId)
    .eq("salesperson_id", opts.salespersonId)
    .in("state", ["OPEN", "SNOOZED"])
    .order("internal_score", { ascending: false })
    .limit(100);

  if (error) {
    if (/sales_attention_items|does not exist|relation/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as AttentionRow[];
}

export async function updateAttentionProjectionState(opts: {
  clientId: string;
  salespersonId: string;
  fingerprint: string;
  state: "OPEN" | "SNOOZED" | "COMPLETED" | "DISMISSED" | "INVALIDATED";
  snoozedUntil?: string | null;
  dismissReason?: string | null;
}): Promise<string | null> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    state: opts.state,
    updated_at: now,
    last_evaluated_at: now,
  };
  if (opts.state === "SNOOZED") patch.snoozed_until = opts.snoozedUntil ?? null;
  if (opts.state === "COMPLETED") patch.completed_at = now;
  if (opts.state === "DISMISSED") {
    patch.dismissed_at = now;
    patch.dismiss_reason = opts.dismissReason ?? null;
  }

  const { data, error } = await supabase
    .from("sales_attention_items")
    .update(patch)
    .eq("client_id", opts.clientId)
    .eq("salesperson_id", opts.salespersonId)
    .eq("fingerprint", opts.fingerprint)
    .select("id")
    .maybeSingle();

  if (error) {
    if (/sales_attention_items|does not exist|relation/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  return data?.id ? String(data.id) : null;
}

export async function saveAttentionEnrichment(opts: {
  fingerprint: string;
  clientId: string;
  salespersonId: string;
  enrichment: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("sales_attention_items")
    .update({
      enrichment: opts.enrichment,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", opts.clientId)
    .eq("salesperson_id", opts.salespersonId)
    .eq("fingerprint", opts.fingerprint);
  if (error && !/sales_attention_items|does not exist|relation/i.test(error.message)) {
    throw new Error(error.message);
  }
}
