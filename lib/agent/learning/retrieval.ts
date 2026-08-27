import { createAdminClient } from "@/lib/supabase/admin";
import { asRows } from "@/lib/agent/rows";
import { getLearningSettings } from "./settings";
import { isLearningFlagOn, retrievalIsRelevant } from "./policy";
import type { KnowledgeUsedRef } from "./types";

export async function retrieveApprovedLearning(opts: {
  clientId: string;
  customerMessage: string;
  intents?: string[];
  limit?: number;
}): Promise<{ items: Array<{ id: string; category: string; title: string; content: string }>; refs: KnowledgeUsedRef[] }> {
  const settings = await getLearningSettings(opts.clientId);
  if (!isLearningFlagOn(settings, "agent.learning.retrieval")) {
    return { items: [], refs: [] };
  }
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_learning_knowledge")
    .select("id, category, title, content, intent_hints, status")
    .eq("client_id", opts.clientId)
    .eq("status", "ACTIVE")
    .order("last_reinforced_at", { ascending: false, nullsFirst: false })
    .limit(40);
  const matched = asRows<{
    id: string;
    category: string;
    title: string;
    content: string;
    intent_hints: string[] | null;
  }>(data).filter((row) =>
    retrievalIsRelevant({
      customerMessage: opts.customerMessage,
      intents: opts.intents,
      knowledge: {
        category: row.category,
        title: row.title,
        content: row.content,
        intentHints: row.intent_hints ?? [],
      },
    })
  );
  const items = matched.slice(0, opts.limit ?? 6);
  return {
    items,
    refs: items.map((row) => ({
      type: "LEARNED_KNOWLEDGE" as const,
      id: row.id,
      title: row.title,
      category: row.category,
    })),
  };
}

export async function recordKnowledgeUsage(opts: {
  clientId: string;
  executionId: string;
  conversationId: string;
  refs: KnowledgeUsedRef[];
}): Promise<void> {
  const learned = opts.refs.filter((r) => r.type === "LEARNED_KNOWLEDGE");
  if (!learned.length) return;
  const supabase = createAdminClient();
  await supabase.from("agent_learning_usage").insert(
    learned.map((ref) => ({
      client_id: opts.clientId,
      knowledge_id: ref.id,
      execution_id: opts.executionId,
      conversation_id: opts.conversationId,
    }))
  );
  for (const ref of learned) {
    const { data } = await supabase
      .from("agent_learning_knowledge")
      .select("usage_count")
      .eq("id", ref.id)
      .eq("client_id", opts.clientId)
      .maybeSingle();
    const next = (Number((data as { usage_count?: number } | null)?.usage_count) || 0) + 1;
    await supabase
      .from("agent_learning_knowledge")
      .update({ usage_count: next, updated_at: new Date().toISOString() })
      .eq("id", ref.id)
      .eq("client_id", opts.clientId);
  }
}

export function serializeLearnedKnowledge(
  items: Array<{ title: string; content: string; category: string }>
): string {
  if (!items.length) return "";
  const lines = items.map(
    (item) =>
      `- [${item.category}] ${item.title}: ${item.content} (LEARNED FROM SALES TEAM — Company Brain still wins if they conflict)`
  );
  return [
    "=== APPROVED LEARNED KNOWLEDGE (below Company Brain; never overrides policy, products, prices or quotations) ===",
    ...lines,
  ].join("\n");
}
