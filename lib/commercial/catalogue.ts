export const SEGMIQ_CATALOGUE_VERSION = "2026-10-22" as const;

export const REQUIRED_CATALOGUE_SKUS = [
  "crm_starter", "crm_growth", "agentic_business", "agentic_scale",
  "ai_conversations_250", "onboarding_one_business", "onboarding_two_businesses",
  "onboarding_three_businesses", "ai_activation_standard",
] as const;

export type CatalogueSku = (typeof REQUIRED_CATALOGUE_SKUS)[number];
export type CrmSku = "crm_starter" | "crm_growth";
export type AgenticSku = "agentic_business" | "agentic_scale";
export type BillingPeriod = "monthly" | "annual";
export type BillingUnit = "per_user_month" | "per_business_month" | "one_time";
export type CatalogueRow = {
  sku: CatalogueSku; version: typeof SEGMIQ_CATALOGUE_VERSION; name: string;
  billingUnit: BillingUnit; priceUsdCents: number; includedConversations: number | null;
  includedAiActions: number | null; maxAgentConfigurations: number | null;
  effectiveFrom: string; isAvailable: boolean;
};

/** Verified feature copy. Prices and allowances still come from platform_price_catalog. */
export const CATALOGUE_FEATURES: Record<CrmSku, readonly string[]> = {
  crm_starter: ["CRM workspace", "Sales pipeline", "Customer records", "Core reporting"],
  crm_growth: ["Everything in Starter", "Advanced automation", "Sales Copilot", "Priority workflows"],
};
export const CONVERSATION_DEFINITION =
  "A customer interaction with the AI agent during a 24-hour window. Further AI interaction after that window starts a new billable conversation.";
export type Catalogue = ReadonlyMap<CatalogueSku, CatalogueRow>;

export type PricingSnapshot = {
  catalogueVersion: typeof SEGMIQ_CATALOGUE_VERSION; currency: "USD"; crmSku: CrmSku;
  aiSku: AgenticSku | null; purchasedSeats: number; seatUnitPriceUsdCents: number;
  crmMonthlyUsdCents: number; aiMonthlyUsdCents: number; recurringMonthlyUsdCents: number;
  billingCycle: BillingPeriod; recurringCycleUsdCents: number;
};

export function createPricingSnapshot(catalogue: Catalogue, input: {
  crmSku: CrmSku; aiSku?: AgenticSku | null; purchasedSeats: number; billingCycle?: BillingPeriod;
}): PricingSnapshot {
  if (!Number.isSafeInteger(input.purchasedSeats) || input.purchasedSeats < 1) throw new Error("Purchased seats must be a positive whole number");
  if (input.aiSku && input.crmSku !== "crm_growth") throw new Error("Agentic AI requires the Growth CRM plan");
  const crm = requireCatalogueRow(catalogue, input.crmSku);
  const ai = input.aiSku ? requireCatalogueRow(catalogue, input.aiSku) : null;
  const crmMonthlyUsdCents = safeCentsMultiply(crm.priceUsdCents, input.purchasedSeats);
  const aiMonthlyUsdCents = ai?.priceUsdCents ?? 0;
  const recurringMonthlyUsdCents = safeCentsAdd(crmMonthlyUsdCents, aiMonthlyUsdCents);
  const billingCycle = input.billingCycle ?? "monthly";
  return {
    catalogueVersion: SEGMIQ_CATALOGUE_VERSION, currency: "USD", crmSku: input.crmSku,
    aiSku: input.aiSku ?? null, purchasedSeats: input.purchasedSeats,
    seatUnitPriceUsdCents: crm.priceUsdCents, crmMonthlyUsdCents, aiMonthlyUsdCents,
    recurringMonthlyUsdCents, billingCycle,
    recurringCycleUsdCents: safeCentsMultiply(recurringMonthlyUsdCents, billingCycle === "annual" ? 12 : 1),
  };
}

export function requireCatalogueRow(catalogue: Catalogue, sku: CatalogueSku): CatalogueRow {
  const row = catalogue.get(sku);
  if (!row || row.version !== SEGMIQ_CATALOGUE_VERSION) throw new Error(`Missing canonical catalogue row: ${sku}`);
  if (!Number.isSafeInteger(row.priceUsdCents) || row.priceUsdCents < 0) throw new Error(`Malformed price for ${sku}`);
  return row;
}

export function assertSnapshotMatchesCatalogue(snapshot: PricingSnapshot, catalogue: Catalogue): void {
  const expected = createPricingSnapshot(catalogue, {
    crmSku: snapshot.crmSku, aiSku: snapshot.aiSku, purchasedSeats: snapshot.purchasedSeats, billingCycle: snapshot.billingCycle,
  });
  if (JSON.stringify(expected) !== JSON.stringify(snapshot)) throw new Error("Agreed price snapshot does not match its catalogue version");
}

export function countPaidSeats(people: readonly { userId: string; active: boolean; role: string }[]): number {
  return new Set(people.filter((person) => person.active && person.role !== "SUPER_ADMIN").map((person) => person.userId)).size;
}

export function formatUsd(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error("Money must use integer cents");
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function safeCentsMultiply(cents: number, quantity: number): number {
  const value = cents * quantity;
  if (!Number.isSafeInteger(value)) throw new Error("Money calculation exceeded the safe integer range");
  return value;
}
function safeCentsAdd(left: number, right: number): number {
  const value = left + right;
  if (!Number.isSafeInteger(value)) throw new Error("Money calculation exceeded the safe integer range");
  return value;
}
