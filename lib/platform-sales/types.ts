import type {
  AgenticSku,
  CatalogueSku,
  CrmSku,
} from "@/lib/commercial/catalogue";

export type DiscountScope = "recurring" | "one_time";
export type DiscountInput = {
  kind: "fixed" | "percent";
  value: number;
  scope: DiscountScope;
  reason: string;
};
export type QuoteInput = {
  crmSku: CrmSku;
  seats: number;
  aiSku: AgenticSku | null;
  serviceSkus: Extract<
    CatalogueSku,
    | "onboarding_one_business"
    | "onboarding_two_businesses"
    | "onboarding_three_businesses"
    | "ai_activation_standard"
  >[];
  discount: DiscountInput | null;
  taxRateBasisPoints: number;
  validUntil: string;
  notes?: string | null;
};
export type QuoteLineSnapshot = {
  sku: CatalogueSku;
  name: string;
  unit: string;
  unitPriceUsdCents: number;
  quantity: number;
  subtotalUsdCents: number;
  scope: DiscountScope;
};
export type QuoteSnapshot = {
  catalogueVersion: "2026-10-22";
  currency: "USD";
  pricingSource: "platform_price_catalog";
  lines: QuoteLineSnapshot[];
  discount:
    | (DiscountInput & { amountUsdCents: number; approvedBy: string })
    | null;
  recurringSubtotalUsdCents: number;
  recurringDiscountUsdCents: number;
  recurringTotalUsdCents: number;
  oneTimeSubtotalUsdCents: number;
  oneTimeDiscountUsdCents: number;
  oneTimeTotalUsdCents: number;
  taxRateBasisPoints: number;
  taxUsdCents: number;
  initialDueUsdCents: number;
  allowances: {
    conversations: number | null;
    internalAiActions: number | null;
    agentConfigurations: number | null;
    metered: false;
  };
};
