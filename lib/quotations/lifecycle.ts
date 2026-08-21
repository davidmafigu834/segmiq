import type { QuotationStatus } from "@/types";

/**
 * Phase 1 quotation lifecycle stages shown in the workspace strip.
 * Approval stages are Phase 2 — not shown here.
 * "Viewed" only highlights when real view tracking exists (caller passes hasViewTracking).
 * Deal Won is never a quotation status.
 */
export const QUOTATION_LIFECYCLE_STAGES = [
  "draft",
  "sent",
  "viewed",
  "accepted",
] as const;

export type QuotationLifecycleStage = (typeof QUOTATION_LIFECYCLE_STAGES)[number];

export const LIFECYCLE_LABELS: Record<QuotationLifecycleStage, string> = {
  draft: "Draft",
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
      return "Draft"; // Phase 2 status — surface as draft in Phase 1 UI
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
    case "pending_approval":
      return "neutral";
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
 * Map current status onto the Phase 1 lifecycle strip.
 * Viewed only appears when hasViewTracking is true; otherwise Sent covers it.
 */
export function resolveLifecycleIndex(
  status: QuotationStatus | string,
  opts?: { hasViewTracking?: boolean }
): { activeIndex: number; terminal?: string; stages: readonly QuotationLifecycleStage[] } {
  if (status === "rejected" || status === "expired" || status === "superseded") {
    return { activeIndex: -1, terminal: status, stages: QUOTATION_LIFECYCLE_STAGES };
  }

  const showViewed = opts?.hasViewTracking === true;
  const stages = showViewed
    ? QUOTATION_LIFECYCLE_STAGES
    : (["draft", "sent", "accepted"] as const);

  let normalized = status as string;
  if (normalized === "pending_approval" || normalized === "approved") {
    normalized = "draft";
  }
  if (normalized === "viewed" && !showViewed) {
    normalized = "sent";
  }

  let idx = (stages as readonly string[]).indexOf(normalized);
  if (idx < 0) idx = 0;
  return { activeIndex: idx, stages };
}

export function isQuotationImmutable(status: string): boolean {
  return status !== "draft" && status !== "pending_approval";
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
