import type {
  ApprovalTriggerType,
  QuotationApprovalPolicyRow,
  QuotationLineItemInput,
  QuotationSettingsRow,
} from "@/types";
import { round2, type QuoteTotals } from "@/lib/quotations/totals";
import { evaluateGovernance, lineHasPriceOverride, marginHealth } from "@/lib/quotations/governance";

export type TriggeredApprovalRule = {
  policyId: string | null;
  name: string;
  triggerType: ApprovalTriggerType | string;
  reason: string;
  sequenceGroup: number;
  approverRole: string | null;
  approverUserId: string | null;
};

export type ApprovalEvaluation = {
  required: boolean;
  rules: TriggeredApprovalRule[];
  reasons: string[];
};

function compareNumeric(left: number, operator: string, right: number): boolean {
  switch (operator) {
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    default:
      return left > right;
  }
}

function policyTriggered(
  policy: QuotationApprovalPolicyRow,
  ctx: {
    items: QuotationLineItemInput[];
    totals: QuoteTotals;
    settings: Partial<QuotationSettingsRow> | null | undefined;
    paymentTermsLabel: string | null | undefined;
    defaultPaymentTerms: string | null | undefined;
  }
): boolean {
  const threshold = policy.threshold_numeric != null ? Number(policy.threshold_numeric) : 0;
  const op = policy.operator || "gt";
  switch (policy.trigger_type) {
    case "discount":
      return compareNumeric(ctx.totals.effectiveDiscountPercent, op, threshold);
    case "margin": {
      if (ctx.totals.marginPercent == null) return false;
      return compareNumeric(ctx.totals.marginPercent, op, threshold);
    }
    case "quotation_value":
      return compareNumeric(ctx.totals.total, op, threshold);
    case "payment_terms": {
      const current = (ctx.paymentTermsLabel ?? "").trim();
      const standard = (ctx.defaultPaymentTerms ?? policy.threshold_text ?? "").trim();
      if (op === "not_standard") return Boolean(current) && current.toLowerCase() !== standard.toLowerCase();
      return Boolean(current) && standard.length > 0 && current.toLowerCase() !== standard.toLowerCase();
    }
    case "price_override":
      return ctx.items.some(lineHasPriceOverride);
    case "special_product":
      return ctx.items.some((it) => it.catalog_item_id && (it as { requires_approval?: boolean }).requires_approval);
    case "custom_item":
      return ctx.items.some((it) => !it.catalog_item_id && !it.package_id && !it.is_optional);
    default:
      return false;
  }
}

function fallbackRules(ctx: {
  items: QuotationLineItemInput[];
  totals: QuoteTotals;
  settings: Partial<QuotationSettingsRow> | null | undefined;
  role: string;
  paymentTermsLabel: string | null | undefined;
}): TriggeredApprovalRule[] {
  const gov = evaluateGovernance({
    items: ctx.items,
    totals: ctx.totals,
    settings: ctx.settings,
    role: ctx.role,
    paymentTermsLabel: ctx.paymentTermsLabel,
    defaultPaymentTerms: ctx.settings?.default_payment_terms,
  });
  const rules: TriggeredApprovalRule[] = [];
  if (!gov.discountWithinAuthority) {
    rules.push({
      policyId: null,
      name: "Discount authority",
      triggerType: "discount",
      reason: `Effective discount ${gov.effectiveDiscountPercent}% exceeds authority${
        gov.maxDiscountPercent != null ? ` of ${gov.maxDiscountPercent}%` : ""
      }`,
      sequenceGroup: 1,
      approverRole: "CLIENT_MANAGER",
      approverUserId: null,
    });
  }
  if (gov.marginHealth === "below_policy" && ctx.settings?.min_margin_percent != null) {
    rules.push({
      policyId: null,
      name: "Margin policy",
      triggerType: "margin",
      reason: `Margin ${gov.marginPercent ?? "—"}% is below company minimum of ${ctx.settings.min_margin_percent}%`,
      sequenceGroup: 1,
      approverRole: "CLIENT_MANAGER",
      approverUserId: null,
    });
  }
  const valueThreshold = ctx.settings?.approval_value_threshold;
  if (valueThreshold != null && ctx.totals.total > Number(valueThreshold)) {
    rules.push({
      policyId: null,
      name: "Quotation value",
      triggerType: "quotation_value",
      reason: `Quotation total exceeds ${round2(Number(valueThreshold))}`,
      sequenceGroup: 1,
      approverRole: "CLIENT_MANAGER",
      approverUserId: null,
    });
  }
  if (ctx.settings?.require_approval_for_custom_items && gov.hasCustomItem) {
    rules.push({
      policyId: null,
      name: "Custom item",
      triggerType: "custom_item",
      reason: "Custom line items require approval",
      sequenceGroup: 1,
      approverRole: "CLIENT_MANAGER",
      approverUserId: null,
    });
  }
  if (ctx.settings?.price_edit_policy === "manager_controlled" && (gov.hasPriceOverride || gov.effectiveDiscountPercent > 0)) {
    rules.push({
      policyId: null,
      name: "Manager-controlled pricing",
      triggerType: "price_override",
      reason: "Pricing deviations require manager approval",
      sequenceGroup: 1,
      approverRole: "CLIENT_MANAGER",
      approverUserId: null,
    });
  }
  return rules;
}

export function evaluateApprovalRequirement(opts: {
  items: QuotationLineItemInput[];
  totals: QuoteTotals;
  settings: Partial<QuotationSettingsRow> | null | undefined;
  policies: QuotationApprovalPolicyRow[];
  role: string;
  paymentTermsLabel?: string | null;
}): ApprovalEvaluation {
  const active = (opts.policies ?? []).filter((p) => p.is_active);
  const ctx = {
    items: opts.items,
    totals: opts.totals,
    settings: opts.settings,
    paymentTermsLabel: opts.paymentTermsLabel,
    defaultPaymentTerms: opts.settings?.default_payment_terms,
  };
  const isManager = opts.role === "CLIENT_MANAGER" || opts.role === "SUPER_ADMIN";
  const fromPolicies: TriggeredApprovalRule[] = active
    .filter((p) => policyTriggered(p, ctx))
    .sort((a, b) => a.priority - b.priority || a.sequence_group - b.sequence_group)
    .map((p) => ({
      policyId: p.id,
      name: p.name,
      triggerType: p.trigger_type,
      reason: describePolicy(p, opts.totals),
      sequenceGroup: p.sequence_group || 1,
      approverRole: p.approver_role,
      approverUserId: p.approver_user_id,
    }));

  const rules =
    fromPolicies.length > 0
      ? fromPolicies
      : isManager
        ? []
        : fallbackRules({
            items: opts.items,
            totals: opts.totals,
            settings: opts.settings,
            role: opts.role,
            paymentTermsLabel: opts.paymentTermsLabel,
          });

  const stillRequired = rules.filter((r) => {
    if (!isManager) return true;
    if (r.approverUserId && r.approverUserId.length > 0) return true;
    if (r.approverRole && r.approverRole !== "CLIENT_MANAGER" && r.approverRole !== "SUPER_ADMIN") {
      return true;
    }
    return false;
  });

  return {
    required: stillRequired.length > 0,
    rules,
    reasons: stillRequired.map((r) => r.reason),
  };
}

function describePolicy(policy: QuotationApprovalPolicyRow, totals: QuoteTotals): string {
  const n = policy.threshold_numeric;
  switch (policy.trigger_type) {
    case "discount":
      return `Discount ${totals.effectiveDiscountPercent}% ${policy.operator} ${n ?? ""}`.trim();
    case "margin":
      return `Margin ${totals.marginPercent ?? "—"}% ${policy.operator} ${n ?? ""}`.trim();
    case "quotation_value":
      return `Quotation value ${totals.total} ${policy.operator} ${n ?? ""}`.trim();
    case "payment_terms":
      return "Payment terms differ from company standard";
    case "price_override":
      return "Catalogue price was overridden";
    case "special_product":
      return "A product on this quotation requires approval";
    case "custom_item":
      return "Custom items require approval";
    default:
      return policy.name;
  }
}

export function buildCommercialSnapshot(opts: {
  quoteNumber: string | null;
  revisionNumber: number;
  totals: QuoteTotals;
  currency: string;
  paymentTermsLabel: string | null | undefined;
  validUntil: string | null | undefined;
  fingerprint: string;
  governance: ReturnType<typeof evaluateGovernance>;
  items: QuotationLineItemInput[];
}): Record<string, unknown> {
  return {
    quoteNumber: opts.quoteNumber,
    revisionNumber: opts.revisionNumber,
    total: opts.totals.total,
    subtotal: opts.totals.subtotal,
    discountTotal: opts.totals.discountTotal,
    effectiveDiscountPercent: opts.totals.effectiveDiscountPercent,
    taxAmount: opts.totals.taxAmount,
    costTotal: opts.totals.costTotal,
    marginPercent: opts.totals.marginPercent,
    marginHealth: opts.governance.marginHealth,
    currency: opts.currency,
    paymentTermsLabel: opts.paymentTermsLabel ?? null,
    validUntil: opts.validUntil ?? null,
    fingerprint: opts.fingerprint,
    itemCount: opts.items.filter((it) => !it.is_optional).length,
    optionalCount: opts.items.filter((it) => it.is_optional).length,
    capturedAt: new Date().toISOString(),
  };
}

export function marginHealthFromTotals(
  totals: QuoteTotals,
  settings: Partial<QuotationSettingsRow> | null | undefined
) {
  return marginHealth(totals.marginPercent, settings);
}
