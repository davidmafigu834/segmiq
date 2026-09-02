/**
 * Grounded follow-up draft templates (Phase 1 — no auto-send).
 * Never invent price, warranty, delivery, stock, or discounts.
 */

import type { SalesAttentionItem } from "./types";
import type { SalesContextSummary } from "./context-summary";

export type FollowupDraft = {
  body: string;
  tone: "professional" | "short" | "warm";
  warnings: string[];
};

export function draftFollowupMessage(opts: {
  item: SalesAttentionItem;
  summary?: SalesContextSummary | null;
  tone?: FollowupDraft["tone"];
}): FollowupDraft {
  const tone = opts.tone ?? "professional";
  const name = (opts.item.customerName || "there").split(/\s+/)[0] || "there";
  const warnings: string[] = [];
  const position = opts.summary?.customerPosition;
  const quote = opts.item.quotationLabel;

  let body: string;
  if (opts.item.type === "CUSTOMER_WAITING") {
    body =
      tone === "short"
        ? `Hi ${name}, thanks for your message — I'll get this sorted and update you shortly.`
        : `Hi ${name}, thanks for your message. I'm looking into this now and will update you as soon as I have a clear answer.`;
    if (/deliver/i.test(position ?? "") || /deliver/i.test(opts.item.whyNow)) {
      warnings.push(
        "Customer asked about delivery — confirm terms from canonical records before promising."
      );
      body = `Hi ${name}, thanks for asking about delivery. Let me confirm the exact terms and get back to you shortly.`;
    }
  } else if (quote) {
    body =
      tone === "short"
        ? `Hi ${name}, following up on ${quote}. Any questions I can help with?`
        : tone === "warm"
          ? `Hi ${name}, just checking in as agreed about ${quote}. Have you had a chance to review it, and is there anything you'd like me to clarify?`
          : `Hi ${name}, following up as agreed regarding ${quote}. Have you had a chance to review it, and is there anything you'd like us to clarify?`;
  } else if (position) {
    body = `Hi ${name}, following up on your note. ${
      tone === "short"
        ? "Happy to help with the next step whenever you're ready."
        : "Happy to clarify anything and agree the next step whenever it suits you."
    }`;
  } else {
    body =
      tone === "short"
        ? `Hi ${name}, following up as agreed. Is now a good time for a quick check-in?`
        : `Hi ${name}, following up as agreed. Have you had a chance to consider this, and is there anything you'd like us to clarify?`;
  }

  return { body, tone, warnings };
}
