import type { QuotationLineItemInput, QuotationStatus } from "@/types";
import { computeQuotationTotals, type QuoteTotals } from "@/lib/quotations/totals";
import {
  marginHealthLabel,
  type CommercialGovernance,
} from "@/lib/quotations/governance";
import type { ApprovalEvaluation } from "@/lib/quotations/approval-engine";
import { daysUntil } from "@/lib/quotations/lifecycle";

export type CommercialCheckItem = {
  id: string;
  label: string;
  status: "pass" | "warn" | "block";
  action?: string;
  tab?: "items" | "payment" | "overview";
};

export type CommercialCheckInput = {
  status: QuotationStatus | string;
  approvalStatus?: string | null;
  customerName: string | null | undefined;
  dealId: string | null | undefined;
  currency: string | null | undefined;
  validUntil: string | null | undefined;
  paymentTermsLabel: string | null | undefined;
  items: QuotationLineItemInput[];
  totals: QuoteTotals;
  governance?: CommercialGovernance | null;
  approval?: ApprovalEvaluation | null;
};

export type CommercialCheckResult = {
  items: CommercialCheckItem[];
  canSend: boolean;
  approvalRequired: boolean;
  blockingCount: number;
  warningCount: number;
  readyCount: number;
  totalCount: number;
};

/**
 * Commercial readiness engine. Blocking vs warning is explicit.
 * Approval required is a send blocker until the version is approved.
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

  const invalidLine = pricedItems.find(
    (it) => !(Number(it.unit_price) >= 0) || !(Number(it.quantity) > 0)
  );
  if (invalidLine) {
    checks.push({
      id: "pricing",
      label: "Pricing valid",
      status: "block",
      action: "Fix invalid line items",
      tab: "items",
    });
  } else if (pricedItems.length > 0) {
    checks.push({ id: "pricing", label: "Pricing valid", status: "pass" });
  }

  if ((input.currency ?? "").trim()) {
    checks.push({ id: "currency", label: "Currency valid", status: "pass" });
  } else {
    checks.push({
      id: "currency",
      label: "Currency valid",
      status: "block",
      action: "Set currency",
      tab: "items",
    });
  }

  if (input.validUntil) {
    const days = daysUntil(input.validUntil);
    if (days != null && days < 0) {
      checks.push({
        id: "validity",
        label: "Validity set",
        status: "block",
        action: "Update valid-until date",
        tab: "payment",
      });
    } else if (days != null && days <= 1) {
      checks.push({
        id: "validity",
        label: "Validity set",
        status: "warn",
        action: "Expires tomorrow",
        tab: "payment",
      });
    } else {
      checks.push({ id: "validity", label: "Validity set", status: "pass" });
    }
  } else {
    checks.push({
      id: "validity",
      label: "Validity set",
      status: "block",
      action: "Set valid until",
      tab: "payment",
    });
  }

  if ((input.paymentTermsLabel ?? "").trim()) {
    checks.push({ id: "payment", label: "Payment terms set", status: "pass" });
  } else {
    checks.push({
      id: "payment",
      label: "Payment terms set",
      status: "block",
      action: "Payment terms missing",
      tab: "payment",
    });
  }

  const totalsOk =
    Number.isFinite(input.totals.total) &&
    input.totals.total > 0 &&
    Number.isFinite(input.totals.subtotal);
  if (totalsOk) {
    checks.push({ id: "totals", label: "Total greater than zero", status: "pass" });
  } else {
    checks.push({
      id: "totals",
      label: "Total greater than zero",
      status: "block",
      action: "Fix pricing",
      tab: "items",
    });
  }

  const gov = input.governance;
  const approved = (input.approvalStatus ?? "not_required") === "approved";
  if (gov) {
    if (gov.discountWithinAuthority || approved) {
      checks.push({ id: "discount", label: "Discount within authority", status: "pass" });
    } else {
      checks.push({
        id: "discount",
        label: "Discount within authority",
        status: "block",
        action: "Discount exceeds authority",
        tab: "payment",
      });
    }
    if (gov.marginHealth === "below_policy" && !approved) {
      checks.push({
        id: "margin",
        label: "Margin within company policy",
        status: "block",
        action: "Margin below company policy",
        tab: "items",
      });
    } else if (gov.marginHealth === "near_minimum") {
      checks.push({
        id: "margin",
        label: "Margin healthy",
        status: "warn",
        action: `Margin ${marginHealthLabel(gov.marginHealth)}`,
        tab: "items",
      });
    } else if (gov.marginHealth === "unknown") {
      checks.push({ id: "margin", label: "Margin within company policy", status: "pass" });
    } else {
      checks.push({ id: "margin", label: "Margin healthy", status: "pass" });
    }
  }

  const approvalStatus = input.approvalStatus ?? "not_required";
  const approvalNeeded =
    input.approval?.required === true ||
    approvalStatus === "required" ||
    approvalStatus === "pending" ||
    approvalStatus === "changes_requested" ||
    approvalStatus === "rejected";

  if (approvalStatus === "approved") {
    checks.push({ id: "approval", label: "Required approvals complete", status: "pass" });
  } else if (approvalStatus === "pending") {
    checks.push({
      id: "approval",
      label: "Required approvals complete",
      status: "block",
      action: "Approval pending",
    });
  } else if (approvalStatus === "changes_requested") {
    checks.push({
      id: "approval",
      label: "Required approvals complete",
      status: "block",
      action: "Review requested changes",
    });
  } else if (approvalStatus === "rejected") {
    checks.push({
      id: "approval",
      label: "Required approvals complete",
      status: "block",
      action: "Approval rejected — revise quotation",
    });
  } else if (input.approval?.required) {
    checks.push({
      id: "approval",
      label: "Required approvals complete",
      status: "block",
      action: "Approval required",
    });
  } else {
    checks.push({ id: "approval", label: "Approval not required", status: "pass" });
  }

  const sendable =
    input.status === "draft" ||
    input.status === "approved" ||
    input.status === "pending_approval" ||
    input.status === "sent" ||
    input.status === "viewed";
  if (sendable && input.status !== "expired" && input.status !== "superseded") {
    checks.push({ id: "editable", label: "Current version sendable", status: "pass" });
  } else {
    checks.push({
      id: "editable",
      label: "Current version sendable",
      status: "block",
      action: "Create a revision to change and send",
    });
  }

  const blockingCount = checks.filter((c) => c.status === "block").length;
  const warningCount = checks.filter((c) => c.status === "warn").length;
  const readyCount = checks.filter((c) => c.status === "pass").length;
  const canSend = blockingCount === 0 && pricedItems.length > 0 && input.totals.total > 0;

  return {
    items: checks,
    canSend,
    approvalRequired: approvalNeeded && approvalStatus !== "approved",
    blockingCount,
    warningCount,
    readyCount,
    totalCount: checks.length,
  };
}

/** @deprecated kept for type compatibility with older call sites */
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
