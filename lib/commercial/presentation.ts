import { CATALOGUE_FEATURES, CONVERSATION_DEFINITION, formatUsd, requireCatalogueRow, type Catalogue } from "@/lib/commercial/catalogue";

export type PricingPackage = {
  id: string; name: string; label: string; description: string;
  seatPriceUsdCents: number; organisationFeeUsdCents: number; features: string[];
};
export type PricingPresentation = {
  version: string; effectiveFrom: string; packages: PricingPackage[];
  topUpPriceUsdCents: number; topUpConversations: number; conversationDefinition: string;
};

export function createPricingPresentation(catalogue: Catalogue): PricingPresentation {
  const starter = requireCatalogueRow(catalogue, "crm_starter");
  const growth = requireCatalogueRow(catalogue, "crm_growth");
  const business = requireCatalogueRow(catalogue, "agentic_business");
  const scale = requireCatalogueRow(catalogue, "agentic_scale");
  const topUp = requireCatalogueRow(catalogue, "ai_conversations_250");
  const aiFeatures = (row: typeof business) => [
    `${(row.includedConversations ?? 0).toLocaleString()} customer AI conversations`,
    `${(row.includedAiActions ?? 0).toLocaleString()} internal AI actions`,
    `Up to ${row.maxAgentConfigurations ?? 0} autonomous agent configuration${row.maxAgentConfigurations === 1 ? "" : "s"}`,
    "External channel/provider charges are separate",
  ];
  return {
    version: starter.version,
    effectiveFrom: starter.effectiveFrom,
    packages: [
      { id: starter.sku, name: "Starter", label: "CRM", description: "Essential CRM tools for small teams.", seatPriceUsdCents: starter.priceUsdCents, organisationFeeUsdCents: 0, features: [...CATALOGUE_FEATURES.crm_starter] },
      { id: growth.sku, name: "Growth", label: "CRM", description: "Advanced CRM and Sales Copilot for growing teams.", seatPriceUsdCents: growth.priceUsdCents, organisationFeeUsdCents: 0, features: [...CATALOGUE_FEATURES.crm_growth] },
      { id: business.sku, name: "Agentic Business", label: "CRM + Agentic AI", description: "Growth CRM plus customer-facing autonomous AI for one focused operation.", seatPriceUsdCents: growth.priceUsdCents, organisationFeeUsdCents: business.priceUsdCents, features: aiFeatures(business) },
      { id: scale.sku, name: "Agentic Scale", label: "CRM + Agentic AI", description: "Growth CRM with higher autonomous AI capacity.", seatPriceUsdCents: growth.priceUsdCents, organisationFeeUsdCents: scale.priceUsdCents, features: aiFeatures(scale) },
    ],
    topUpPriceUsdCents: topUp.priceUsdCents,
    topUpConversations: topUp.includedConversations ?? 0,
    conversationDefinition: CONVERSATION_DEFINITION,
  };
}

export { formatUsd };
