import type { QuotationStatus } from "@/types";

/** Canonical quotation lifecycle stages (Deal Won is NOT included). */
export const QUOTATION_LIFECYCLE_STAGES = [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "viewed",
  "accepted",
] as const;

export type QuotationLifecycleStage = (typeof QUOTATION_LIFECYCLE_STAGES)[number];

export const LIFECYCLE_LABELS: Record<QuotationLifecycleStage, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
};

/** Terminal / alternate statuses that replace the strip highlight. */
export const QUOTATION_TERMINAL_STATUSES = ["rejected", "expired", "superseded"] as const;

export function quotationStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "pending_approval":
      return "Pending approval";
    case "approved":
      return "Approved";
    case "sent":
      return "Sent";
    case "viewed":
      return "Viewed";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Declined";
    case "expired":
      return "Expired";
    case "superseded":
      return "Superseded";
    default:
      return status;
  }
}

export function quotationStatusTone(
  status: string
): "neutral" | "amber" | "lime" | "blue" | "green" | "red" | "muted" {
  switch (status) {
    case "draft":
      return "neutral";
    case "pending_approval":
      return "amber";
    case "approved":
      return "lime";
    case "sent":
      return "blue";
    case "viewed":
      return "blue";
    case "accepted":
      return "green";
    case "rejected":
      return "red";
    case "expired":
      return "amber";
    case "superseded":
      return "muted";
    default:
      return "neutral";
  }
}

/**
 * Map current status onto the lifecycle strip.
 * Viewed only highlights when real viewed_at / status=viewed exists.
 */
export function resolveLifecycleIndex(
  status: QuotationStatus | string,
  opts?: { hasViewTracking?: boolean }
): { activeIndex: number; terminal?: string } {
  if (status === "rejected" || status === "expired" || status === "superseded") {
    return { activeIndex: -1, terminal: status };
  }
  const order = QUOTATION_LIFECYCLE_STAGES as readonly string[];
  let idx = order.indexOf(status);
  if (status === "viewed" && opts?.hasViewTracking === false) {
    idx = order.indexOf("sent");
  }
  if (idx < 0) idx = 0;
  return { activeIndex: idx };
}

export function isQuotationImmutable(status: string): boolean {
  return !["draft", "pending_approval"].includes(status);
}

export function isQuotationEditable(status: string): boolean {
  return status === "draft";
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const until = new Date(dateStr);
  if (!Number.isFinite(until.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  until.setHours(0, 0, 0, 0);
  return Math.round((until.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
