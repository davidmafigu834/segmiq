"use client";

import Link from "next/link";
import { evaluateDealNextBestAction } from "@/lib/sales/attention/next-best-action";
import type { DealRow } from "@/types";

/**
 * Compact Next Best Action on Deal page.
 * Deal Stage ≠ Next Best Action — this never mutates stage.
 */
export function DealNextBestActionPanel({
  deal,
  awaitingReplyMinutes,
  openQuote,
}: {
  deal: Pick<
    DealRow,
    | "id"
    | "stage"
    | "next_action_at"
    | "next_action_label"
    | "expected_decision_at"
    | "last_meaningful_activity_at"
    | "updated_at"
    | "value_status"
    | "originating_lead_id"
  >;
  awaitingReplyMinutes?: number | null;
  openQuote?: {
    id: string;
    status: string;
    sentAt?: string | null;
    validUntil?: string | null;
    approvalStatus?: string | null;
    customerResponded?: boolean;
  } | null;
}) {
  const nba = evaluateDealNextBestAction({
    deal,
    awaitingReplyMinutes,
    openQuote,
  });

  if (nba.actionType === "NO_ACTION_REQUIRED") return null;

  return (
    <section
      aria-label="Next best action"
      className="rounded-[12px] border border-sales-border bg-sales-surface p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
        Next best action
      </p>
      <p className="mt-1.5 text-[15px] font-semibold text-sales-text-primary">{nba.title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-sales-text-secondary">{nba.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {nba.actionType === "REPLY_TO_CUSTOMER" || nba.actionType === "FOLLOW_UP" ? (
          <Link
            href={`/sales/command?view=focus&prompt=${encodeURIComponent("Draft a follow-up message for this customer.")}`}
            className="rounded-[8px] bg-sales-brand px-3 py-2 text-[12px] font-semibold text-sales-brand-fg"
          >
            Draft message
          </Link>
        ) : null}
        {nba.actionType === "REVISE_QUOTATION" && nba.sourceQuotationId ? (
          <Link
            href={`/sales/quotes/${nba.sourceQuotationId}`}
            className="rounded-[8px] bg-sales-brand px-3 py-2 text-[12px] font-semibold text-sales-brand-fg"
          >
            Revise quotation
          </Link>
        ) : null}
        {nba.leadId ? (
          <Link
            href={`/sales/whatsapp?lead=${nba.leadId}`}
            className="rounded-[8px] border border-sales-border px-3 py-2 text-[12px] font-medium text-sales-text-secondary"
          >
            Open WhatsApp
          </Link>
        ) : null}
      </div>
    </section>
  );
}
