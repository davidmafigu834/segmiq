/**
 * Central commercial value resolver for Deals.
 * Single source for Pipeline, Goals, Reports, Deal Workspace.
 */

import type { DealRow, DealValueBasis, DealValueStatus, QuotationRow } from "@/types";
import { formatDealValueBasis } from "./display";

export type DealCommercialValue =
  | {
      kind: "amount";
      amount: number;
      basis: DealValueBasis;
      label: string;
      display: string;
    }
  | {
      kind: "range";
      min: number;
      max: number;
      basis: DealValueBasis;
      label: string;
      display: string;
    }
  | {
      kind: "pending";
      amount: null;
      basis: null;
      label: string;
      display: string;
    };

function positive(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(Number(n)) || Number(n) <= 0) return null;
  return Math.round(Number(n) * 100) / 100;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Latest non-draft quote total for a deal (caller may pass prefiltered quotes). */
export function latestQuoteTotal(
  quotes: Pick<QuotationRow, "total" | "status" | "sent_at" | "created_at" | "updated_at">[]
): number | null {
  const open = quotes.filter((q) => q.status !== "draft" && q.status !== "expired");
  const pool = open.length > 0 ? open : quotes.filter((q) => q.status !== "expired");
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((a, b) => {
    const aT = Date.parse(a.sent_at || a.updated_at || a.created_at);
    const bT = Date.parse(b.sent_at || b.updated_at || b.created_at);
    return bT - aT;
  });
  return positive(sorted[0]?.total ?? null);
}

/**
 * Resolve commercial value for display and aggregation.
 * Priority when not explicitly pending:
 * 1. Won value (closed won)
 * 2. Latest quote (if linked quotes provided / value_basis LATEST_QUOTE)
 * 3. Sales estimate / estimated_value
 * 4. Customer budget / range
 * 5. Pending
 */
export function getDealCommercialValue(
  deal: Pick<
    DealRow,
    | "stage"
    | "value_status"
    | "value_basis"
    | "estimated_value"
    | "estimated_value_min"
    | "estimated_value_max"
    | "customer_budget"
    | "sales_estimate"
    | "won_value"
  >,
  opts?: { latestQuoteTotal?: number | null }
): DealCommercialValue {
  const pendingLabel = "Value not estimated yet";

  if (deal.stage === "WON") {
    const won = positive(deal.won_value) ?? positive(deal.estimated_value);
    if (won != null) {
      return {
        kind: "amount",
        amount: won,
        basis: "WON_VALUE",
        label: formatDealValueBasis("WON_VALUE") ?? "Won value",
        display: formatMoney(won),
      };
    }
  }

  if (deal.value_status === "PENDING_ESTIMATE") {
    // Still prefer latest quote if present for commercial truth
    const quote = positive(opts?.latestQuoteTotal ?? null);
    if (quote != null) {
      return {
        kind: "amount",
        amount: quote,
        basis: "LATEST_QUOTE",
        label: formatDealValueBasis("LATEST_QUOTE") ?? "Latest quote",
        display: formatMoney(quote),
      };
    }
    return {
      kind: "pending",
      amount: null,
      basis: null,
      label: pendingLabel,
      display: pendingLabel,
    };
  }

  if (deal.value_status === "RANGE") {
    const min = positive(deal.estimated_value_min);
    const max = positive(deal.estimated_value_max);
    if (min != null && max != null) {
      const basis: DealValueBasis =
        deal.value_basis === "CUSTOMER_BUDGET" ? "CUSTOMER_BUDGET" : "SALES_ESTIMATE";
      return {
        kind: "range",
        min,
        max,
        basis,
        label: formatDealValueBasis(basis) ?? "Estimated range",
        display: `${formatMoney(min)}–${formatMoney(max)}`,
      };
    }
  }

  const quote = positive(opts?.latestQuoteTotal ?? null);
  if (deal.value_basis === "LATEST_QUOTE" && quote != null) {
    return {
      kind: "amount",
      amount: quote,
      basis: "LATEST_QUOTE",
      label: formatDealValueBasis("LATEST_QUOTE") ?? "Latest quote",
      display: formatMoney(quote),
    };
  }

  if (quote != null && deal.value_basis == null) {
    return {
      kind: "amount",
      amount: quote,
      basis: "LATEST_QUOTE",
      label: formatDealValueBasis("LATEST_QUOTE") ?? "Latest quote",
      display: formatMoney(quote),
    };
  }

  const sales = positive(deal.sales_estimate) ?? positive(deal.estimated_value);
  if (sales != null && deal.value_basis !== "CUSTOMER_BUDGET") {
    return {
      kind: "amount",
      amount: sales,
      basis: "SALES_ESTIMATE",
      label: formatDealValueBasis("SALES_ESTIMATE") ?? "Sales estimate",
      display: formatMoney(sales),
    };
  }

  const budget = positive(deal.customer_budget);
  if (budget != null) {
    return {
      kind: "amount",
      amount: budget,
      basis: "CUSTOMER_BUDGET",
      label: formatDealValueBasis("CUSTOMER_BUDGET") ?? "Customer budget",
      display: formatMoney(budget),
    };
  }

  if (sales != null) {
    return {
      kind: "amount",
      amount: sales,
      basis: "SALES_ESTIMATE",
      label: formatDealValueBasis("SALES_ESTIMATE") ?? "Sales estimate",
      display: formatMoney(sales),
    };
  }

  if (quote != null) {
    return {
      kind: "amount",
      amount: quote,
      basis: "LATEST_QUOTE",
      label: formatDealValueBasis("LATEST_QUOTE") ?? "Latest quote",
      display: formatMoney(quote),
    };
  }

  return {
    kind: "pending",
    amount: null,
    basis: null,
    label: pendingLabel,
    display: pendingLabel,
  };
}

/** Numeric amount for aggregation — excludes pending/unknown (never treat as $0). */
export function getDealNumericValueForCoverage(
  deal: Parameters<typeof getDealCommercialValue>[0],
  opts?: { latestQuoteTotal?: number | null }
): number | null {
  const v = getDealCommercialValue(deal, opts);
  if (v.kind === "amount") return v.amount;
  if (v.kind === "range") return (v.min + v.max) / 2;
  return null;
}

export function inferValueStatus(input: {
  estimatedValue?: number | null;
  min?: number | null;
  max?: number | null;
  pending?: boolean;
}): DealValueStatus {
  if (input.pending) return "PENDING_ESTIMATE";
  if (positive(input.min) != null && positive(input.max) != null) return "RANGE";
  if (positive(input.estimatedValue) != null) return "KNOWN";
  return "PENDING_ESTIMATE";
}
