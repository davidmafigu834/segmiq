/**
 * Post-create deal information completeness (lightweight, not gamified).
 */

import type { DealRow } from "@/types";
import { getDealCommercialValue } from "./commercial-value";

export type DealCompletenessItem = {
  id: string;
  label: string;
  done: boolean;
};

export type DealCompletenessResult = {
  items: DealCompletenessItem[];
  doneCount: number;
  total: number;
  summaryLabel: string;
  nextSuggestion: { id: string; label: string; cta: string } | null;
};

export function getDealCompleteness(
  deal: DealRow,
  opts?: { latestQuoteTotal?: number | null; hasNextAction?: boolean }
): DealCompletenessResult {
  const value = getDealCommercialValue(deal, { latestQuoteTotal: opts?.latestQuoteTotal });
  const hasNext =
    opts?.hasNextAction === true ||
    (typeof deal.next_action_at === "string" && deal.next_action_at.length > 0);

  const items: DealCompletenessItem[] = [
    {
      id: "need",
      label: "Customer need",
      done: Boolean(deal.service_summary?.trim() || deal.name?.trim()),
    },
    {
      id: "value",
      label: "Value estimate",
      done: value.kind !== "pending",
    },
    {
      id: "decision_maker",
      label: "Decision maker",
      done:
        deal.decision_maker_status === "YES" ||
        Boolean(deal.decision_maker_name?.trim()),
    },
    {
      id: "expected_decision",
      label: "Expected decision date",
      done: Boolean(deal.expected_decision_at),
    },
    {
      id: "next_action",
      label: "Next action",
      done: hasNext,
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const missing = items.filter((i) => !i.done);
  const gap = items.length - doneCount;

  let summaryLabel: string;
  if (gap === 0) summaryLabel = "Deal information looks complete";
  else if (gap === 1) summaryLabel = "1 detail could improve this Deal";
  else summaryLabel = `${gap} details could improve this Deal`;

  const first = missing[0];
  const nextSuggestion = first
    ? {
        id: first.id,
        label: first.label,
        cta:
          first.id === "expected_decision"
            ? "Add expected decision date"
            : first.id === "value"
              ? "Estimate deal value"
              : first.id === "next_action"
                ? "Schedule follow-up"
                : `Add ${first.label.toLowerCase()}`,
      }
    : null;

  return { items, doneCount, total: items.length, summaryLabel, nextSuggestion };
}
