/**
 * Call brief — grounded prep for a salesperson call/meeting.
 * No unsupported sales psychology claims.
 */

import { buildSalesContextSummary, type ContextSummaryInput } from "./context-summary";
import type { SalesAttentionItem } from "./types";

export type CallBrief = {
  customerName: string;
  whyCalling: string;
  customerPosition: string | null;
  lastObjection: string | null;
  previouslyExplained: string | null;
  openIssue: string | null;
  goalForCall: string;
  suggestedOpening: string | null;
  dealHref: string | null;
  whatsappHref: string | null;
};

export function buildCallBrief(opts: {
  item: SalesAttentionItem;
  context?: ContextSummaryInput;
}): CallBrief {
  const summary = buildSalesContextSummary({
    ...opts.context,
    projectType: opts.context?.projectType ?? opts.item.projectType,
    dealStage: opts.context?.dealStage ?? opts.item.dealStage,
    quoteLabel: opts.context?.quoteLabel ?? opts.item.quotationLabel,
    whyNow: opts.item.whyNow,
    nextActionLabel: opts.item.suggestedActionSummary,
  });

  const customerName = opts.item.customerName || opts.item.title || "Customer";
  const whyCalling =
    opts.item.quotationLabel
      ? `Follow-up on ${opts.item.quotationLabel}.`
      : opts.item.whyNow || opts.item.suggestedActionSummary;

  return {
    customerName,
    whyCalling,
    customerPosition: summary.customerPosition,
    lastObjection: null,
    previouslyExplained: summary.whatHappened,
    openIssue: summary.openQuestions[0] ?? null,
    goalForCall:
      opts.item.suggestedActionSummary ||
      "Understand the remaining blocker and agree the next step.",
    suggestedOpening: buildSuggestedOpening(customerName, opts.item),
    dealHref: opts.item.dealId ? `/sales/deals/${opts.item.dealId}` : null,
    whatsappHref: opts.item.leadId
      ? `/sales/whatsapp?lead=${opts.item.leadId}`
      : null,
  };
}

function buildSuggestedOpening(name: string, item: SalesAttentionItem): string {
  const first = name.split(/\s+/)[0] || name;
  if (item.quotationLabel) {
    return `Hi ${first}, following up on ${item.quotationLabel}. Have you had a chance to review it, and is there anything you'd like us to clarify?`;
  }
  if (item.type === "CUSTOMER_WAITING") {
    return `Hi ${first}, thanks for your message — I wanted to get back to you on that.`;
  }
  return `Hi ${first}, following up as agreed. Is now a good time for a quick check-in?`;
}
