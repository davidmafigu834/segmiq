/**
 * Sales Attention observability events + counters.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type AttentionEventType =
  | "sales_attention.item_created"
  | "sales_attention.item_invalidated"
  | "sales_attention.item_completed"
  | "sales_attention.item_snoozed"
  | "sales_attention.item_dismissed"
  | "sales_attention.candidates_generated"
  | "sales_agent.followup_drafted"
  | "sales_agent.followup_edited"
  | "sales_agent.call_brief_created"
  | "sales_agent.focus_action_executed"
  | "sales_attention.digest_sent"
  | "sales_attention.enrichment_generated"
  | "sales_attention.commitment_extracted";

export async function emitAttentionEvent(opts: {
  clientId: string;
  salespersonId?: string | null;
  attentionItemId?: string | null;
  eventType: AttentionEventType;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("sales_attention_events").insert({
      client_id: opts.clientId,
      salesperson_id: opts.salespersonId ?? null,
      attention_item_id: opts.attentionItemId ?? null,
      event_type: opts.eventType,
      payload: opts.payload ?? {},
    });
    if (error && !/sales_attention_events|does not exist|relation/i.test(error.message)) {
      console.error("[sales-attention] emit event failed", error.message);
    }
  } catch (err) {
    console.error("[sales-attention] emit event failed", err);
  }

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: "sales-attention",
      event: opts.eventType,
      clientId: opts.clientId,
      salespersonId: opts.salespersonId ?? null,
      ...(opts.payload ?? {}),
    })
  );
}

export type AttentionMetricsSnapshot = {
  itemsCreated: number;
  itemsCompleted: number;
  itemsSnoozed: number;
  itemsDismissed: number;
  draftsGenerated: number;
  digestsSent: number;
  commitmentsExtracted: number;
  enrichmentsGenerated: number;
};

export async function getAttentionMetrics(opts: {
  clientId: string;
  sinceIso: string;
  salespersonId?: string | null;
}): Promise<AttentionMetricsSnapshot> {
  const supabase = createAdminClient();
  let q = supabase
    .from("sales_attention_events")
    .select("event_type")
    .eq("client_id", opts.clientId)
    .gte("created_at", opts.sinceIso);
  if (opts.salespersonId) q = q.eq("salesperson_id", opts.salespersonId);

  const { data, error } = await q.limit(5000);
  if (error) {
    if (/sales_attention_events|does not exist|relation/i.test(error.message)) {
      return emptyMetrics();
    }
    throw new Error(error.message);
  }

  const counts = emptyMetrics();
  for (const row of data ?? []) {
    const t = String(row.event_type);
    if (t === "sales_attention.item_created") counts.itemsCreated += 1;
    else if (t === "sales_attention.item_completed") counts.itemsCompleted += 1;
    else if (t === "sales_attention.item_snoozed") counts.itemsSnoozed += 1;
    else if (t === "sales_attention.item_dismissed") counts.itemsDismissed += 1;
    else if (t === "sales_agent.followup_drafted") counts.draftsGenerated += 1;
    else if (t === "sales_attention.digest_sent") counts.digestsSent += 1;
    else if (t === "sales_attention.commitment_extracted") counts.commitmentsExtracted += 1;
    else if (t === "sales_attention.enrichment_generated") counts.enrichmentsGenerated += 1;
  }
  return counts;
}

function emptyMetrics(): AttentionMetricsSnapshot {
  return {
    itemsCreated: 0,
    itemsCompleted: 0,
    itemsSnoozed: 0,
    itemsDismissed: 0,
    draftsGenerated: 0,
    digestsSent: 0,
    commitmentsExtracted: 0,
    enrichmentsGenerated: 0,
  };
}
