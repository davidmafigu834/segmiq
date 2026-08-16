export type SubscriptionStatus = "active" | "past_due" | "suspended" | "cancelled";
export type InvoiceStatus = "draft" | "sent" | "overdue" | "paid" | "void";

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  past_due: "Past due",
  suspended: "Suspended",
  cancelled: "Cancelled",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Open",
  overdue: "Past due",
  paid: "Paid",
  void: "Void",
};

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

export function subscriptionStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return SUBSCRIPTION_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function invoiceStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return INVOICE_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function subscriptionStatusTone(status: string | null | undefined): StatusTone {
  if (status === "active") return "success";
  if (status === "past_due") return "warning";
  if (status === "suspended") return "danger";
  return "neutral";
}

export function invoiceStatusTone(status: string | null | undefined): StatusTone {
  if (status === "paid") return "success";
  if (status === "sent") return "info";
  if (status === "overdue") return "warning";
  if (status === "void") return "neutral";
  return "neutral";
}

export function billingCycleLabel(cycle: string | null | undefined): string {
  if (cycle === "annual") return "Annual";
  if (cycle === "monthly") return "Monthly";
  return cycle?.trim() || "—";
}

export function billedCadenceLabel(cycle: string | null | undefined): string {
  if (cycle === "annual") return "Billed annually";
  if (cycle === "monthly") return "Billed monthly";
  return "—";
}

/** UI-only usage bar messaging. Enforcement stays on the backend. */
export function usageBarTone(pct: number | null): "brand" | "warning" | "danger" {
  if (pct == null) return "brand";
  if (pct >= 95) return "danger";
  if (pct >= 80) return "warning";
  return "brand";
}

export function usagePercent(used: number, limit: number | null): number | null {
  if (limit == null || limit <= 0) return null;
  return Math.round((used / limit) * 1000) / 10;
}
