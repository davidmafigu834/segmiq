/**
 * Conversation summary cache + optional LLM enrichment.
 * Deterministic facts first; model may phrase — never invent interest/pricing.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getAgentModelProvider } from "@/lib/agent/provider";
import { isAgentGloballyEnabled } from "@/lib/agent/settings";
import {
  buildSalesContextSummary,
  type ContextSummaryInput,
  type SalesContextSummary,
} from "./context-summary";
import { emitAttentionEvent } from "./observability";

function fingerprintMessages(
  messages: Array<{ direction: string; body: string | null; created_at: string }>
): string {
  const tail = messages.slice(-12);
  return tail
    .map((m) => `${m.created_at}:${m.direction}:${(m.body ?? "").slice(0, 40)}`)
    .join("|");
}

export async function getCachedConversationSummary(opts: {
  clientId: string;
  leadId: string;
}): Promise<(SalesContextSummary & { contentFingerprint: string; generatedAt: string }) | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_conversation_summaries")
    .select("*")
    .eq("client_id", opts.clientId)
    .eq("lead_id", opts.leadId)
    .is("invalidated_at", null)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (/sales_conversation_summaries|does not exist|relation/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return {
    customerNeed: data.customer_need ? String(data.customer_need) : null,
    importantRequirements: Array.isArray(data.important_requirements)
      ? (data.important_requirements as string[])
      : [],
    whatHappened: data.what_happened ? String(data.what_happened) : null,
    customerPosition: data.customer_position ? String(data.customer_position) : null,
    openQuestions: Array.isArray(data.open_questions) ? (data.open_questions as string[]) : [],
    commitment: data.commitment ? String(data.commitment) : null,
    recommendedContext: data.recommended_context ? String(data.recommended_context) : null,
    contentFingerprint: String(data.content_fingerprint),
    generatedAt: String(data.generated_at),
  };
}

export async function invalidateConversationSummary(opts: {
  clientId: string;
  leadId: string;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("sales_conversation_summaries")
    .update({ invalidated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("client_id", opts.clientId)
    .eq("lead_id", opts.leadId)
    .is("invalidated_at", null);
}

async function saveSummary(opts: {
  clientId: string;
  leadId: string;
  dealId?: string | null;
  summary: SalesContextSummary;
  fingerprint: string;
  messageCount: number;
  lastMessageAt: string | null;
  model: string | null;
  rawSummary?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  // Invalidate previous active rows
  await invalidateConversationSummary({ clientId: opts.clientId, leadId: opts.leadId });
  const { error } = await supabase.from("sales_conversation_summaries").insert({
    client_id: opts.clientId,
    lead_id: opts.leadId,
    deal_id: opts.dealId ?? null,
    customer_need: opts.summary.customerNeed,
    important_requirements: opts.summary.importantRequirements,
    what_happened: opts.summary.whatHappened,
    customer_position: opts.summary.customerPosition,
    open_questions: opts.summary.openQuestions,
    commitment: opts.summary.commitment,
    recommended_context: opts.summary.recommendedContext,
    raw_summary: opts.rawSummary ?? null,
    source_message_count: opts.messageCount,
    last_message_at: opts.lastMessageAt,
    content_fingerprint: opts.fingerprint,
    model: opts.model,
    generated_at: new Date().toISOString(),
  });
  if (error && !/sales_conversation_summaries|does not exist|relation/i.test(error.message)) {
    console.error("[sales-attention] save summary failed", error.message);
  }
}

async function phraseSummaryWithLlm(opts: {
  deterministic: SalesContextSummary;
  recentMessages: Array<{ direction: string; body: string | null }>;
}): Promise<SalesContextSummary | null> {
  if (!isAgentGloballyEnabled()) return null;
  try {
    const provider = getAgentModelProvider();
    const evidence = opts.recentMessages
      .slice(-16)
      .map((m) => `${m.direction}: ${(m.body ?? "").slice(0, 200)}`)
      .join("\n");

    const res = await provider.generate({
      system: `You summarize sales WhatsApp context for a salesperson.
Rules:
- Use ONLY facts present in the evidence and deterministic fields.
- Do NOT invent interest level, prices, delivery, warranty, stock, or discounts.
- Prefer short factual phrases.
- Return JSON only with keys: customerNeed, importantRequirements (array), whatHappened, customerPosition, openQuestions (array), commitment, recommendedContext.
- If unknown, use null or [].`,
      messages: [
        {
          role: "user",
          text: `Deterministic fields:\n${JSON.stringify(opts.deterministic)}\n\nRecent messages:\n${evidence}`,
        },
      ],
      maxTokens: 500,
      temperature: 0.1,
    });

    const text = res.text?.trim();
    if (!text) return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as Partial<SalesContextSummary>;
    return {
      customerNeed: parsed.customerNeed ?? opts.deterministic.customerNeed,
      importantRequirements: Array.isArray(parsed.importantRequirements)
        ? parsed.importantRequirements.map(String).slice(0, 12)
        : opts.deterministic.importantRequirements,
      whatHappened: parsed.whatHappened ?? opts.deterministic.whatHappened,
      customerPosition: parsed.customerPosition ?? opts.deterministic.customerPosition,
      openQuestions: Array.isArray(parsed.openQuestions)
        ? parsed.openQuestions.map(String).slice(0, 8)
        : opts.deterministic.openQuestions,
      commitment: parsed.commitment ?? opts.deterministic.commitment,
      recommendedContext: parsed.recommendedContext ?? opts.deterministic.recommendedContext,
    };
  } catch {
    return null;
  }
}

/**
 * Get or build a grounded conversation summary. Uses cache when fingerprint matches.
 */
export async function getOrBuildConversationSummary(opts: {
  clientId: string;
  leadId: string;
  dealId?: string | null;
  salespersonId?: string | null;
  recentMessages: Array<{ direction: string; body: string | null; created_at: string }>;
  context?: ContextSummaryInput;
  useLlm?: boolean;
}): Promise<SalesContextSummary> {
  const fp = fingerprintMessages(opts.recentMessages);
  const cached = await getCachedConversationSummary({
    clientId: opts.clientId,
    leadId: opts.leadId,
  });
  if (cached && cached.contentFingerprint === fp) {
    const { contentFingerprint: _c, generatedAt: _g, ...summary } = cached;
    return summary;
  }

  const deterministic = buildSalesContextSummary({
    ...opts.context,
    recentMessages: opts.recentMessages,
  });

  let summary = deterministic;
  let model: string | null = null;
  if (opts.useLlm !== false && opts.recentMessages.length >= 2) {
    const phrased = await phraseSummaryWithLlm({
      deterministic,
      recentMessages: opts.recentMessages,
    });
    if (phrased) {
      summary = phrased;
      model = "agent-provider";
      await emitAttentionEvent({
        clientId: opts.clientId,
        salespersonId: opts.salespersonId,
        eventType: "sales_attention.enrichment_generated",
        payload: { leadId: opts.leadId, kind: "conversation_summary" },
      });
    }
  }

  const lastAt = opts.recentMessages[opts.recentMessages.length - 1]?.created_at ?? null;
  await saveSummary({
    clientId: opts.clientId,
    leadId: opts.leadId,
    dealId: opts.dealId,
    summary,
    fingerprint: fp,
    messageCount: opts.recentMessages.length,
    lastMessageAt: lastAt,
    model,
  });

  return summary;
}

/** Lazy enrichment for top focus items. */
export async function enrichFocusItem(opts: {
  clientId: string;
  salespersonId: string;
  leadId: string | null;
  dealId?: string | null;
  context?: ContextSummaryInput;
}): Promise<SalesContextSummary | null> {
  if (!opts.leadId) return null;
  const supabase = createAdminClient();
  const { data: messages } = await supabase
    .from("whatsapp_messages")
    .select("direction, body, created_at")
    .eq("lead_id", opts.leadId)
    .eq("client_id", opts.clientId)
    .order("created_at", { ascending: false })
    .limit(40);

  const recent = ((messages ?? []) as Array<{ direction: string; body: string | null; created_at: string }>).reverse();
  if (recent.length === 0) {
    return buildSalesContextSummary(opts.context ?? {});
  }

  return getOrBuildConversationSummary({
    clientId: opts.clientId,
    leadId: opts.leadId,
    dealId: opts.dealId,
    salespersonId: opts.salespersonId,
    recentMessages: recent,
    context: opts.context,
    useLlm: true,
  });
}
