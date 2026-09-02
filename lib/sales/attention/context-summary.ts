/**
 * SalesContextSummaryService — grounded, compact context for Focus / drafts.
 * Deterministic structure; LLM may phrase fields later. Never invent interest.
 */

export type SalesContextSummary = {
  customerNeed: string | null;
  importantRequirements: string[];
  whatHappened: string | null;
  customerPosition: string | null;
  openQuestions: string[];
  commitment: string | null;
  recommendedContext: string | null;
};

export type ContextSummaryInput = {
  recentMessages?: Array<{ direction: string; body: string | null; created_at: string }>;
  dealStage?: string | null;
  projectType?: string | null;
  quoteLabel?: string | null;
  quoteStatus?: string | null;
  quoteSentAt?: string | null;
  nextActionLabel?: string | null;
  whyNow?: string | null;
  lastCustomerMessage?: string | null;
};

/**
 * Build a factual summary from available structured facts + recent messages.
 * Prefer short evidence over speculation.
 */
export function buildSalesContextSummary(input: ContextSummaryInput): SalesContextSummary {
  const importantRequirements: string[] = [];
  const openQuestions: string[] = [];

  const customerNeed = input.projectType?.trim() || null;

  let whatHappened: string | null = null;
  if (input.quoteLabel && input.quoteSentAt) {
    const sent = new Date(input.quoteSentAt);
    const label = Number.isFinite(sent.getTime())
      ? sent.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : null;
    whatHappened = label
      ? `Quotation ${input.quoteLabel} was sent ${label}.`
      : `Quotation ${input.quoteLabel} was sent.`;
  } else if (input.dealStage) {
    whatHappened = `Deal is in ${String(input.dealStage).replace(/_/g, " ").toLowerCase()}.`;
  }

  let customerPosition: string | null = null;
  const lastInbound = [...(input.recentMessages ?? [])]
    .filter((m) => m.direction === "inbound" && m.body?.trim())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (lastInbound?.body) {
    const snippet = lastInbound.body.trim();
    customerPosition =
      snippet.length > 180 ? `${snippet.slice(0, 177)}…` : snippet;
  } else if (input.lastCustomerMessage) {
    customerPosition = input.lastCustomerMessage;
  }

  const commitment = input.nextActionLabel?.trim() || input.whyNow || null;

  if (!customerPosition && !whatHappened && !customerNeed) {
    return {
      customerNeed: null,
      importantRequirements,
      whatHappened: null,
      customerPosition: null,
      openQuestions,
      commitment,
      recommendedContext: "Conversation summary unavailable.",
    };
  }

  return {
    customerNeed,
    importantRequirements,
    whatHappened,
    customerPosition,
    openQuestions,
    commitment,
    recommendedContext: null,
  };
}
