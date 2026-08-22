import type {
  DiscountAuthorityRule,
  MarginHealthState,
  MarginVisibility,
  PriceEditPolicy,
  QuotationLineItemInput,
  QuotationSettingsRow,
} from "@/types";
import { computeLine, round2, type QuoteTotals } from "@/lib/quotations/totals";

export type PricingAuthorityState = "within_authority" | "approval_required";

export type CommercialGovernance = {
  effectiveDiscountPercent: number;
  maxDiscountPercent: number | null;
  discountWithinAuthority: boolean;
  marginPercent: number | null;
  marginHealth: MarginHealthState;
  pricingAuthority: PricingAuthorityState;
  hasPriceOverride: boolean;
  hasCustomItem: boolean;
  costComplete: boolean;
};

export function resolveMaxDiscountPercent(
  settings: Partial<QuotationSettingsRow> | null | undefined,
  role: string
): number | null {
  const rules = (settings?.discount_authority ?? []) as DiscountAuthorityRule[];
  const match = rules.find((r) => r.role === role);
  if (match) {
    if (match.max_percent == null) return null; // unrestricted
    return Number(match.max_percent);
  }
  if (role === "SUPER_ADMIN" || role === "CLIENT_MANAGER") {
    return settings?.max_discount_percent != null ? Number(settings.max_discount_percent) : null;
  }
  const fallback = settings?.max_discount_percent;
  return fallback != null ? Number(fallback) : 0;
}

export function marginHealth(
  marginPercent: number | null,
  settings: Partial<QuotationSettingsRow> | null | undefined
): MarginHealthState {
  if (marginPercent == null || !Number.isFinite(marginPercent)) return "unknown";
  const min = settings?.min_margin_percent != null ? Number(settings.min_margin_percent) : null;
  if (min == null) return "healthy";
  const warn =
    settings?.margin_warning_percent != null
      ? Number(settings.margin_warning_percent)
      : round2(min + 3);
  if (marginPercent < min) return "below_policy";
  if (marginPercent < warn) return "near_minimum";
  return "healthy";
}

export function marginHealthLabel(state: MarginHealthState): string {
  switch (state) {
    case "healthy":
      return "Healthy";
    case "near_minimum":
      return "Near minimum";
    case "below_policy":
      return "Below company policy";
    default:
      return "Unknown";
  }
}

export function resolveMarginVisibility(
  settings: Partial<QuotationSettingsRow> | null | undefined,
  isManager: boolean
): MarginVisibility {
  if (isManager) return "full";
  const vis = settings?.margin_visibility;
  if (vis === "none" || vis === "health" || vis === "percent" || vis === "full") return vis;
  if (settings?.salesperson_can_see_cost) return "full";
  if (settings?.salesperson_can_see_margin) return "percent";
  return "none";
}

export function priceEditPolicy(
  settings: Partial<QuotationSettingsRow> | null | undefined
): PriceEditPolicy {
  const p = settings?.price_edit_policy;
  if (p === "standard_only" || p === "discount_allowed" || p === "price_override" || p === "manager_controlled") {
    return p;
  }
  return "discount_allowed";
}

export function salespersonMayEditCatalogPrice(
  policy: PriceEditPolicy,
  isManager: boolean
): boolean {
  if (isManager) return true;
  return policy === "price_override";
}

export function salespersonMayDiscount(
  policy: PriceEditPolicy,
  isManager: boolean
): boolean {
  if (isManager) return true;
  return policy === "discount_allowed" || policy === "price_override";
}

export function lineHasPriceOverride(item: QuotationLineItemInput): boolean {
  if (item.price_override) return true;
  if (!item.catalog_item_id) return false;
  if (item.catalog_unit_price == null) return false;
  return round2(Number(item.unit_price) || 0) !== round2(Number(item.catalog_unit_price) || 0);
}

export function priceDeviationPercent(catalogPrice: number, sellingPrice: number): number {
  const base = Number(catalogPrice) || 0;
  if (base <= 0) return 0;
  return round2(((Number(sellingPrice) - base) / base) * 100);
}

export function evaluateGovernance(opts: {
  items: QuotationLineItemInput[];
  totals: QuoteTotals;
  settings: Partial<QuotationSettingsRow> | null | undefined;
  role: string;
  paymentTermsLabel?: string | null;
  defaultPaymentTerms?: string | null;
}): CommercialGovernance {
  const isManager = opts.role === "CLIENT_MANAGER" || opts.role === "SUPER_ADMIN";
  const maxDiscount = resolveMaxDiscountPercent(opts.settings, opts.role);
  const effectiveDiscount = opts.totals.effectiveDiscountPercent;
  const discountWithinAuthority =
    maxDiscount == null ? true : effectiveDiscount <= maxDiscount + 0.0001;
  const health = marginHealth(opts.totals.marginPercent, opts.settings);
  const hasPriceOverride = opts.items.some(lineHasPriceOverride);
  const hasCustomItem = opts.items.some((it) => !it.catalog_item_id && !it.package_id);
  const costComplete =
    opts.totals.costTotal != null &&
    opts.items.filter((it) => !it.is_optional).every((it) => it.cost_price != null);
  const policy = priceEditPolicy(opts.settings);
  const needsApproval =
    !discountWithinAuthority ||
    health === "below_policy" ||
    (policy === "manager_controlled" && (effectiveDiscount > 0 || hasPriceOverride));

  return {
    effectiveDiscountPercent: effectiveDiscount,
    maxDiscountPercent: maxDiscount,
    discountWithinAuthority,
    marginPercent: opts.totals.marginPercent,
    marginHealth: health,
    pricingAuthority: needsApproval && !isManager ? "approval_required" : discountWithinAuthority && health !== "below_policy" ? "within_authority" : needsApproval ? "approval_required" : "within_authority",
    hasPriceOverride,
    hasCustomItem,
    costComplete,
  };
}

export function stripCostFromUnknown<T>(value: T, canSeeCost: boolean): T {
  if (canSeeCost || value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => stripCostFromUnknown(v, canSeeCost)) as T;
  }
  const obj = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "cost_price" || k === "costTotal" || k === "estimatedCost" || k === "grossProfit") {
      next[k] = null;
      continue;
    }
    next[k] = stripCostFromUnknown(v, canSeeCost);
  }
  return next as T;
}

export function lineGrossProfit(item: QuotationLineItemInput, fallbackTaxRate = 0): number | null {
  const computed = computeLine(item, fallbackTaxRate);
  if (computed.cost == null) return null;
  return round2(computed.total - computed.cost);
}

export function lineMarginPercent(item: QuotationLineItemInput, fallbackTaxRate = 0): number | null {
  const computed = computeLine(item, fallbackTaxRate);
  if (computed.cost == null || computed.total <= 0) return null;
  return round2(((computed.total - computed.cost) / computed.total) * 100);
}
