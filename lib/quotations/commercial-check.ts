import type { QuotationLineItemInput, QuotationStatus } from "@/types";
import { computeQuotationTotals, type QuoteTotals } from "@/lib/quotations/totals";

export type CommercialCheckItem = {
  id: string;
  label: string;
  status: "pass" | "warn" | "block";
  message?: string;
};

export type CommercialGuardrails = {
  maxDiscountPercent: number;
  minMarginPercent: number | null;
  approvalValueThreshold: number | null;
  requireApprovalAboveDiscount: boolean;
};

export type CommercialCheckInput = {
  status: QuotationStatus | string;
  customerName: string | null | undefined;
  dealId: string | null | undefined;
  requireDeal?: boolean;
  currency: string | null | undefined;
  validUntil: string | null | undefined;
  paymentTermsLabel: string | null | undefined;
  items: QuotationLineItemInput[];
  totals: QuoteTotals;
  approvalStatus: string | null | undefined;
  guardrails: CommercialGuardrails;
};

export type CommercialCheckResult = {
  items: CommercialCheckItem[];
  canSend: boolean;
  approvalRequired: boolean;
  approvalReasons: string[];
};

export function runCommercialCheck(input: CommercialCheckInput): CommercialCheckResult {
  const checks: CommercialCheckItem[] = [];
  const approvalReasons: string[] = [];

  const pricedItems = (input.items ?? []).filter(
    (it) => !(it.is_optional) && (it.item_name ?? "").trim() && (Number(it.unit_price) || 0) * (Number(it.quantity) || 0) !== 0
  );
  const anyItems = (input.items ?? []).filter(
    (it) => !(it.is_optional) && (it.item_name ?? "").trim().length > 0
  );

  if ((input.customerName ?? "").trim()) {
    checks.push({ id: "customer", label: "Customer linked", status: "pass" });
  } else {
    checks.push({
      id: "customer",
      label: "Customer linked",
      status: "block",
      message: "Add a customer name before sending",
    });
  }

  if (input.requireDeal) {
    if (input.dealId) {
      checks.push({ id: "deal", label: "Deal linked", status: "pass" });
    } else {
      checks.push({
        id: "deal",
        label: "Deal linked",
        status: "warn",
        message: "Link a Deal when available",
      });
    }
  }

  if (anyItems.length > 0) {
    checks.push({ id: "items", label: "Pricing valid", status: "pass" });
  } else {
    checks.push({
      id: "items",
      label: "Pricing valid",
      status: "block",
      message: "Add at least one product or service",
    });
  }

  if ((input.currency ?? "").trim()) {
    checks.push({ id: "currency", label: "Currency set", status: "pass" });
  } else {
    checks.push({ id: "currency", label: "Currency set", status: "block" });
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
        message: "Valid until date is in the past",
      });
    } else {
      checks.push({ id: "validity", label: "Validity date", status: "pass" });
    }
  } else {
    checks.push({
      id: "validity",
      label: "Validity date",
      status: "warn",
      message: "Set a valid until date",
    });
  }

  if ((input.paymentTermsLabel ?? "").trim()) {
    checks.push({ id: "payment", label: "Payment terms set", status: "pass" });
  } else {
    checks.push({
      id: "payment",
      label: "Payment terms set",
      status: "warn",
      message: "Add payment terms",
    });
  }

  const maxDisc = Number(input.guardrails.maxDiscountPercent) || 0;
  const effDisc = input.totals.effectiveDiscountPercent;
  if (effDisc > maxDisc + 0.001) {
    checks.push({
      id: "discount",
      label: "Discount within authority",
      status: "warn",
      message: `Discount ${effDisc}% exceeds max ${maxDisc}%`,
    });
    if (input.guardrails.requireApprovalAboveDiscount) {
      approvalReasons.push(`Discount ${effDisc}% exceeds authority (max ${maxDisc}%)`);
    }
  } else {
    checks.push({
      id: "discount",
      label: "Discount within authority",
      status: "pass",
      message: maxDisc > 0 ? `Within limit (Max ${maxDisc}%)` : undefined,
    });
  }

  const minMargin = input.guardrails.minMarginPercent;
  if (
    minMargin != null &&
    input.totals.marginPercent != null &&
    input.totals.marginPercent < minMargin
  ) {
    checks.push({
      id: "margin",
      label: "Margin policy",
      status: "warn",
      message: `Margin ${input.totals.marginPercent}% below minimum ${minMargin}%`,
    });
    approvalReasons.push(`Margin below company minimum (${minMargin}%)`);
  }

  const threshold = input.guardrails.approvalValueThreshold;
  if (threshold != null && input.totals.total >= threshold) {
    approvalReasons.push(`Quotation total exceeds approval threshold (${threshold})`);
  }

  const approvalStatus = input.approvalStatus ?? "not_required";
  const approvalRequired = approvalReasons.length > 0 || approvalStatus === "pending";

  if (approvalRequired) {
    if (approvalStatus === "approved") {
      checks.push({ id: "approval", label: "Approval", status: "pass", message: "Approved" });
    } else if (approvalStatus === "pending") {
      checks.push({
        id: "approval",
        label: "Approval",
        status: "block",
        message: "Pending approval",
      });
    } else {
      checks.push({
        id: "approval",
        label: "Approval",
        status: "block",
        message: "Approval required",
      });
    }
  } else {
    checks.push({ id: "approval", label: "Approval", status: "pass", message: "Not required" });
  }

  const hasBlock = checks.some((c) => c.status === "block");
  const canSend =
    !hasBlock &&
    pricedItems.length + anyItems.length > 0 &&
    (approvalStatus === "approved" || approvalStatus === "not_required" || !approvalRequired);

  return {
    items: checks,
    canSend: Boolean(canSend && anyItems.length > 0 && !checks.some((c) => c.id === "customer" && c.status === "block")),
    approvalRequired: approvalReasons.length > 0 && approvalStatus !== "approved",
    approvalReasons,
  };
}

export function marginLabel(
  marginPercent: number | null,
  minMargin: number | null
): { text: string; tone: "healthy" | "near" | "below" | "unknown" } {
  if (marginPercent == null) return { text: "Unavailable", tone: "unknown" };
  if (minMargin != null && marginPercent < minMargin) {
    return { text: "Below policy", tone: "below" };
  }
  if (minMargin != null && marginPercent < minMargin + 5) {
    return { text: "Near minimum", tone: "near" };
  }
  return { text: "Healthy", tone: "healthy" };
}

/** Recompute totals helper for check callers that only have raw items. */
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
