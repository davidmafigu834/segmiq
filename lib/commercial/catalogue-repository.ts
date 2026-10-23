import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { REQUIRED_CATALOGUE_SKUS, SEGMIQ_CATALOGUE_VERSION, type BillingUnit, type Catalogue, type CatalogueRow, type CatalogueSku } from "@/lib/commercial/catalogue";

type DbCatalogueRow = { sku: string; version: string; name: string; billing_unit: string; price_usd_cents: number; included_conversations: number | null; included_ai_actions: number | null; max_agent_configurations: number | null; effective_from: string; is_available: boolean };

export async function loadCanonicalCatalogue(options: { forNewOffer?: boolean; now?: Date } = {}): Promise<Catalogue> {
  const { data, error } = await createAdminClient().from("platform_price_catalog")
    .select("sku, version, name, billing_unit, price_usd_cents, included_conversations, included_ai_actions, max_agent_configurations, effective_from, is_available")
    .eq("version", SEGMIQ_CATALOGUE_VERSION);
  if (error) throw new Error(`Canonical catalogue unavailable: ${error.message}`);
  const nowDate = (options.now ?? new Date()).toISOString().slice(0, 10);
  const map = new Map<CatalogueSku, CatalogueRow>();
  for (const raw of (data ?? []) as DbCatalogueRow[]) {
    if (!isCatalogueSku(raw.sku)) throw new Error(`Unknown SKU in canonical catalogue: ${raw.sku}`);
    if (!isBillingUnit(raw.billing_unit)) throw new Error(`Unknown billing unit for ${raw.sku}`);
    if (options.forNewOffer && (!raw.is_available || raw.effective_from > nowDate)) throw new Error(`Catalogue SKU is not available for new offers: ${raw.sku}`);
    map.set(raw.sku, { sku: raw.sku, version: SEGMIQ_CATALOGUE_VERSION, name: raw.name, billingUnit: raw.billing_unit,
      priceUsdCents: raw.price_usd_cents, includedConversations: raw.included_conversations,
      includedAiActions: raw.included_ai_actions, maxAgentConfigurations: raw.max_agent_configurations,
      effectiveFrom: raw.effective_from, isAvailable: raw.is_available });
  }
  for (const sku of REQUIRED_CATALOGUE_SKUS) if (!map.has(sku)) throw new Error(`Canonical catalogue is incomplete: ${sku}`);
  return map;
}
function isCatalogueSku(value: string): value is CatalogueSku { return (REQUIRED_CATALOGUE_SKUS as readonly string[]).includes(value); }
function isBillingUnit(value: string): value is BillingUnit { return value === "per_user_month" || value === "per_business_month" || value === "one_time"; }
