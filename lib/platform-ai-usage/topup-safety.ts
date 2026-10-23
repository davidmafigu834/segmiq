export type TopupActivationInput = {
  customerApproved: boolean;
  approvalEvidenceRef: string | null;
  periodOpen: boolean;
  invoiceStatus: string;
  invoiceCurrency: string;
  invoiceAmountUsdCents: number;
  paymentStatus: string;
  paymentCurrency: string;
  paymentAmountUsdCents: number;
  expectedUsdCents: number;
};

export function decideTopupActivation(input: TopupActivationInput): {
  allowed: boolean;
  reason: string;
} {
  if (!input.customerApproved || !input.approvalEvidenceRef?.trim())
    return { allowed: false, reason: "customer_approval_missing" };
  if (!input.periodOpen) return { allowed: false, reason: "period_closed" };
  if (input.invoiceStatus !== "paid")
    return { allowed: false, reason: "invoice_not_paid" };
  if (input.paymentStatus !== "confirmed")
    return { allowed: false, reason: "payment_not_confirmed" };
  if (input.invoiceCurrency !== "USD" || input.paymentCurrency !== "USD")
    return { allowed: false, reason: "currency_mismatch" };
  if (
    input.invoiceAmountUsdCents !== input.expectedUsdCents ||
    input.paymentAmountUsdCents !== input.expectedUsdCents
  )
    return { allowed: false, reason: "amount_mismatch" };
  return { allowed: true, reason: "paid_approval_verified" };
}
