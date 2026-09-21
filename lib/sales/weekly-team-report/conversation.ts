export const CONVERSATION_PATTERN_DEFS = [
  {
    id: "pricing",
    label: "Pricing concerns",
    keywords: ["price", "pricing", "expensive", "too much", "cost", "discount", "cheaper"],
  },
  {
    id: "financing",
    label: "Financing / payment plans",
    keywords: ["payment plan", "finance", "financing", "installment", "instalment", "deposit", "credit"],
  },
  {
    id: "delivery",
    label: "Installation / delivery timing",
    keywords: ["delivery", "install", "installation", "timeline", "how long", "when can", "lead time"],
  },
  {
    id: "competitor",
    label: "Competitor mentions",
    keywords: ["competitor", "other company", "another quote", "elsewhere", "other supplier"],
  },
  {
    id: "complaint",
    label: "Complaints",
    keywords: ["unhappy", "complaint", "disappointed", "not happy", "frustrated", "poor service"],
  },
  {
    id: "quote_clarity",
    label: "Unclear quotation issues",
    keywords: ["don't understand", "dont understand", "confused", "what does this include", "unclear quote"],
  },
  {
    id: "product",
    label: "Requested products / services",
    keywords: ["looking for", "need a", "want a", "quote for", "interested in"],
  },
] as const;

export type ConversationHit = {
  id: string;
  label: string;
  count: number;
  sampleIds: string[];
};

export function classifyConversationText(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const def of CONVERSATION_PATTERN_DEFS) {
    if (def.keywords.some((kw) => lower.includes(kw))) hits.push(def.id);
  }
  return hits;
}

export function aggregateConversationPatterns(
  messages: Array<{ id: string; body: string | null }>
): ConversationHit[] {
  const counts = new Map<string, { count: number; sampleIds: string[] }>();
  for (const def of CONVERSATION_PATTERN_DEFS) {
    counts.set(def.id, { count: 0, sampleIds: [] });
  }
  for (const msg of messages) {
    if (!msg.body) continue;
    const ids = classifyConversationText(msg.body);
    for (const id of ids) {
      const bucket = counts.get(id);
      if (!bucket) continue;
      bucket.count += 1;
      if (bucket.sampleIds.length < 12) bucket.sampleIds.push(msg.id);
    }
  }
  return CONVERSATION_PATTERN_DEFS.map((def) => {
    const bucket = counts.get(def.id)!;
    return { id: def.id, label: def.label, count: bucket.count, sampleIds: bucket.sampleIds };
  }).filter((row) => row.count > 0);
}
