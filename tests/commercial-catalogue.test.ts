import assert from "node:assert/strict";
import test from "node:test";
import { assertSnapshotMatchesCatalogue, countPaidSeats, createPricingSnapshot, type Catalogue, type CatalogueRow, type CatalogueSku } from "../lib/commercial/catalogue";
import { createPricingPresentation } from "../lib/commercial/presentation";

const values: Array<[CatalogueSku, number, number | null, number | null, number | null, "per_user_month" | "per_business_month" | "one_time"]> = [
  ["crm_starter",1900,null,null,null,"per_user_month"], ["crm_growth",2900,null,null,null,"per_user_month"],
  ["agentic_business",9900,500,100,1,"per_business_month"], ["agentic_scale",24900,2000,500,3,"per_business_month"],
  ["ai_conversations_250",2500,250,null,null,"one_time"], ["onboarding_one_business",15000,null,null,null,"one_time"],
  ["onboarding_two_businesses",25000,null,null,null,"one_time"], ["onboarding_three_businesses",35000,null,null,null,"one_time"],
  ["ai_activation_standard",14900,null,null,null,"one_time"],
];
const catalogue: Catalogue = new Map(values.map(([sku,price,includedConversations,includedAiActions,maxAgentConfigurations,billingUnit]) => [sku, { sku, version:"2026-10-22", name:sku, billingUnit, priceUsdCents:price, includedConversations, includedAiActions, maxAgentConfigurations, effectiveFrom:"2026-10-22", isAvailable:true } satisfies CatalogueRow]));

test("Growth plus Agentic fees use cents and charge AI once per organisation", () => {
  assert.equal(createPricingSnapshot(catalogue,{crmSku:"crm_growth",aiSku:"agentic_business",purchasedSeats:3}).recurringMonthlyUsdCents,18600);
  assert.equal(createPricingSnapshot(catalogue,{crmSku:"crm_growth",aiSku:"agentic_scale",purchasedSeats:3}).recurringMonthlyUsdCents,33600);
});
test("a human counts once and SUPER_ADMIN counts zero", () => {
  assert.equal(countPaidSeats([{userId:"one",active:true,role:"CLIENT_MANAGER"},{userId:"one",active:true,role:"SALESPERSON"},{userId:"admin",active:true,role:"SUPER_ADMIN"},{userId:"off",active:false,role:"SALESPERSON"}]),1);
});
test("Agentic AI requires Growth and malformed snapshots fail closed", () => {
  assert.throws(() => createPricingSnapshot(catalogue,{crmSku:"crm_starter",aiSku:"agentic_business",purchasedSeats:1}),/requires the Growth/);
  const snapshot=createPricingSnapshot(catalogue,{crmSku:"crm_growth",purchasedSeats:1});
  assert.throws(() => assertSnapshotMatchesCatalogue({...snapshot,recurringMonthlyUsdCents:0},catalogue),/does not match/);
});
test("public and admin presentation can share one canonical model", () => {
  const model=createPricingPresentation(catalogue);
  assert.deepEqual(model.packages.map((p)=>[p.seatPriceUsdCents,p.organisationFeeUsdCents]),[[1900,0],[2900,0],[2900,9900],[2900,24900]]);
});
