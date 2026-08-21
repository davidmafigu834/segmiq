import type { QuotationLineItemInput, QuotationStatus } from "@/types";
import { computeQuotationTotals, type QuoteTotals } from "@/lib/quotations/totals";

export type CommercialCheckItem = {
  id: string;
  /** Short product label shown in the rail */
  label: string;
  status: "pass" | "warn" | "block";
  /** Optional short action hint (not developer prose) */
  action?: string;
  /** Workspace tab to open when row is clicked */
  tab?: "items" | "payment" | "overview";
};

export type CommercialCheckInput = {
  status: QuotationStatus | string;
  customerName: string | null | undefined;
  dealId: string | null | undefined;
  currency: string | null | undefined;
  validUntil: string | null | undefined;
  paymentTermsLabel: string | null | undefined;
  items: QuotationLineItemInput[];
  totals: QuoteTotals;
};

export type CommercialCheckResult = {
  items: CommercialCheckItem[];
  canSend: boolean;
  blockingCount: number;
  readyCount: number;
  totalCount: number;
};

/**
 * Phase 1 commercial readiness gate.
 * No discount-authority / margin / approval rules.
 */
export function runCommercialCheck(input: CommercialCheckInput): CommercialCheckResult {
  const checks: CommercialCheckItem[] = [];

  const pricedItems = (input.items ?? []).filter(
    (it) =>
      !it.is_optional &&
      (it.item_name ?? "").trim().length > 0 &&
      (Number(it.quantity) || 0) > 0
  );

  if ((input.customerName ?? "").trim()) {
    checks.push({ id: "customer", label: "Customer linked", status: "pass" });
  } else {
    checks.push({
      id: "customer",
      label: "Customer linked",
      status: "block",
      action: "Link a customer",
      tab: "overview",
    });
  }

  if (input.dealId) {
    checks.push({ id: "deal", label: "Deal linked", status: "pass" });
  } else {
    checks.push({
      id: "deal",
      label: "Deal linked",
      status: "block",
      action: "Link a Deal",
      tab: "overview",
    });
  }

  if (pricedItems.length > 0) {
    checks.push({ id: "items", label: "Products & services", status: "pass" });
  } else {
    checks.push({
      id: "items",
      label: "Products & services",
      status: "block",
      action: "Add at least one item",
      tab: "items",
    });
  }

  if ((input.currency ?? "").trim()) {
    checks.push({ id: "currency", label: "Currency set", status: "pass" });
  } else {
    checks.push({
      id: "currency",
      label: "Currency set",
      status: "block",
      action: "Set currency",
      tab: "items",
    });
  }

  if (input.validUntil) {
    const until = new Date(input.validUntil);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isFinite(until.getTime()) && until < today) {
      checks.push({
        id: "validity",
        label: "Validity date",
        status: "block",
        action: "Update valid-until date",
        tab: "payment",
      });
    } else {
      checks.push({ id: "validity", label: "Validity date", status: "pass" });
    }
  } else {
    checks.push({
      id: "validity",
      label: "Validity date",
      status: "block",
      action: "Set valid until",
      tab: "payment",
    });
  }

  if ((input.paymentTermsLabel ?? "").trim()) {
    checks.push({ id: "payment", label: "Payment terms", status: "pass" });
  } else {
    checks.push({
      id: "payment",
      label: "Payment terms",
      status: "block",
      action: "Add payment terms",
      tab: "payment",
    });
  }

  const totalsOk =
    Number.isFinite(input.totals.total) &&
    input.totals.total >= 0 &&
    Number.isFinite(input.totals.subtotal);
  if (totalsOk) {
    checks.push({ id: "totals", label: "Totals valid", status: "pass" });
  } else {
    checks.push({
      id: "totals",
      label: "Totals valid",
      status: "block",
      action: "Fix pricing",
      tab: "items",
    });
  }

  if (input.status === "draft" || input.status === "approved") {
    checks.push({ id: "editable", label: "Ready to send", status: "pass" });
  } else if (input.status === "sent" || input.status === "viewed") {
    checks.push({ id: "editable", label: "Ready to send", status: "pass", action: "Resend allowed" });
  } else {
    checks.push({
      id: "editable",
      label: "Ready to send",
      status: "block",
      action: "Create a revision to change and send",
    });
  }

  const blockingCount = checks.filter((c) => c.status === "block").length;
  const readyCount = checks.filter((c) => c.status === "pass").length;
  const canSend = blockingCount === 0 && pricedItems.length > 0;

  return {
    items: checks,
    canSend,
    blockingCount,
    readyCount,
    totalCount: checks.length,
  };
}

/** @deprecated Phase 2 — kept for type compatibility with older call sites */
export type CommercialGuardrails = {
  maxDiscountPercent: number;
  minMarginPercent: number | null;
  approvalValueThreshold: number | null;
  requireApprovalAboveDiscount: boolean;
};

export function totalsForCheck(
  items: QuotationLineItemInput[],
  taxRate: number,
  otherAmount: number,
  discountPercent = 0
): QuoteTotals {
  return computeQuotationTotals(items, {
    fallbackTaxRate: taxRate,
    otherAmount,
    discountPercent,
  });
}
