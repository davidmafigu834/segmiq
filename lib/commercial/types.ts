export type ProductItemType = "PRODUCT" | "SERVICE";
export type ProductStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type PackageStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type PackagePricingMode = "SUM_OF_ITEMS" | "FIXED_PRICE";
export type PackagePresentationMode = "SHOW_COMPONENTS" | "SHOW_PACKAGE_SUMMARY";
export type VariantMode = "FIXED_VARIANT" | "CUSTOMER_SELECTION" | "QUOTE_TIME_SELECTION";
export type InventoryStockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "NOT_TRACKED";
export type PackageAvailabilityStatus =
  | "READY"
  | "LIMITED"
  | "UNAVAILABLE"
  | "SELECTION_REQUIRED"
  | "NOT_TRACKED"
  | "NEEDS_REVIEW";
export type InventoryProviderKind = "SEGMIQ" | "EXTERNAL";
export type AgentDisclosure = "EXACT" | "GENERAL" | "HIDDEN";
export type CommercialSearchType = "PRODUCT" | "SERVICE" | "PACKAGE";
export type QuoteSourceType = "PRODUCT" | "SERVICE" | "PACKAGE" | "CUSTOM";

export type CommercialSearchResult = {
  type: CommercialSearchType;
  id: string;
  name: string;
  sku?: string | null;
  brand?: string | null;
  category?: string | null;
  price?: number | null;
  currency?: string | null;
  availability?: InventoryStockStatus | PackageAvailabilityStatus | null;
  availableQty?: number | null;
  image?: string | null;
  status: string;
  itemCount?: number;
  serviceCount?: number;
  hasVariants?: boolean;
};

export const COST_FIELD_NAMES = new Set([
  "cost_price",
  "costPrice",
  "cost_currency",
  "costCurrency",
  "cost_price_override",
  "costPriceOverride",
  "costTotal",
  "estimatedCost",
  "estimated_cost",
  "grossProfit",
  "margin",
  "marginPercent",
  "margin_percent",
  "componentCost",
  "component_cost",
]);
