/**
 * Quotation display formatters for the salesperson Quotes workspace.
 */

import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isPast,
  parseISO,
} from "date-fns";
import type { QuotationStatus } from "@/types";
import { formatMoney } from "@/lib/quotations/totals";

export type QuoteStatusTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple";

export const QUOTE_STATUS_LABEL: Record<QuotationStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  rejected: "Declined",
  expired: "Expired",
  superseded: "Superseded",
};

export function formatQuoteStatus(status: QuotationStatus | null | undefined): string {
  if (!status) return "—";
  return QUOTE_STATUS_LABEL[status] ?? status;
}

export function getQuoteStatusTone(status: QuotationStatus): QuoteStatusTone {
  switch (status) {
    case "draft":
      return "neutral";
    case "pending_approval":
      return "warning";
    case "approved":
      return "brand";
    case "sent":
      return "info";
    case "viewed":
      return "purple";
    case "accepted":
      return "success";
    case "rejected":
      return "danger";
    case "expired":
      return "warning";
    case "superseded":
      return "neutral";
    default:
      return "neutral";
  }
}

export function formatQuoteNumber(
  quoteNumber: string | null | undefined,
  revisionNumber?: number
): string {
  if (!quoteNumber?.trim()) return "No number";
  const base = quoteNumber.trim();
  // Revision suffix is for display in lists when helpful; workspace shows Version separately.
  if (revisionNumber != null && revisionNumber > 1) return `${base} · v${revisionNumber}`;
  return base;
}

/** Identity for headers — never use status as the title. */
export function formatQuoteIdentity(
  quoteNumber: string | null | undefined
): string {
  if (!quoteNumber?.trim()) return "Quotation";
  return quoteNumber.trim();
}

export function formatQuoteAmount(
  total: number | null | undefined,
  currency: string,
  opts?: { draftUnset?: boolean }
): string {
  if (total == null || !Number.isFinite(total)) return "—";
  if (opts?.draftUnset && total === 0) return "—";
  return formatMoney(total, currency || "USD");
}

export function formatQuoteDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy");
}

export function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export type ValidityDisplay = {
  primary: string;
  secondary: string | null;
  tone: "muted" | "warning" | "danger" | "ok";
};

export function formatQuoteValidity(
  validUntil: string | null | undefined,
  opts?: { now?: Date; status?: QuotationStatus }
): ValidityDisplay {
  if (!validUntil) {
    return { primary: "No expiry", secondary: null, tone: "muted" };
  }
  const d = parseISO(validUntil);
  if (Number.isNaN(d.getTime())) {
    return { primary: "—", secondary: null, tone: "muted" };
  }
  const now = opts?.now ?? new Date();
  const days = differenceInCalendarDays(d, now);
  const primary = format(d, "MMM d, yyyy");

  if (opts?.status === "expired" || days < 0 || isPast(d)) {
    const agoDays = Math.abs(days);
    return {
      primary,
      secondary:
        agoDays === 0
          ? "Expired today"
          : `Expired ${agoDays} day${agoDays === 1 ? "" : "s"} ago`,
      tone: "danger",
    };
  }
  if (days <= 3) {
    return {
      primary,
      secondary: days === 0 ? "Expires today" : `Expires in ${days} day${days === 1 ? "" : "s"}`,
      tone: "warning",
    };
  }
  return {
    primary,
    secondary: `in ${days} days`,
    tone: "ok",
  };
}

/** Refine sent/viewed → expired when valid_until has passed. */
export function effectiveQuoteStatus(
  status: QuotationStatus,
  validUntil: string | null | undefined,
  now = new Date()
): QuotationStatus {
  if ((status === "sent" || status === "viewed") && validUntil) {
    const d = parseISO(validUntil);
    if (!Number.isNaN(d.getTime()) && d.getTime() < now.getTime()) {
      return "expired";
    }
  }
  return status;
}

export function isPendingStatus(status: QuotationStatus): boolean {
  return status === "sent" || status === "viewed";
}

export function quoteMatchesSearch(
  row: {
    quoteNumber: string | null;
    customerName: string | null;
    customerPhone: string | null;
    customerSecondary: string | null;
    projectType: string | null;
  },
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.quoteNumber,
    row.customerName,
    row.customerPhone,
    row.customerSecondary,
    row.projectType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}
