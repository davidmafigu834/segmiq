import type { ClientBillingData } from "@/lib/billing/client-billing-data";

export type SoloBillingAlert = {
  message: string;
  urgent: boolean;
};

const UNPAID = ["sent", "overdue"];

/** Banner copy for solo dashboard when billing needs attention. */
export function deriveSoloBillingAlert(data: ClientBillingData): SoloBillingAlert | null {
  const status = data.subscription?.status ?? null;
  const hasPayable = data.invoices.some(
    (i) => UNPAID.includes(i.status) && !i.hasPendingPayment
  );
  const pendingReview = data.invoices.some((i) => i.hasPendingPayment);

  if (status === "suspended") {
    return {
      urgent: true,
      message: "Your account is paused until the outstanding balance is settled.",
    };
  }

  if (status === "past_due" || hasPayable) {
    return {
      urgent: status === "past_due",
      message: pendingReview
        ? "Payment proof submitted — awaiting agency confirmation."
        : "You have an invoice awaiting payment.",
    };
  }

  if (pendingReview) {
    return {
      urgent: false,
      message: "Payment proof submitted — awaiting agency confirmation.",
    };
  }

  return null;
}
