import assert from "node:assert/strict";
import test from "node:test";
import { isGraceActive, resolveBillingAccess, validateGracePeriod } from "../lib/commercial/grace";
import { createPricingSnapshot, type Catalogue, type CatalogueRow } from "../lib/commercial/catalogue";
import { previewPlanChange, validateConsent } from "../lib/commercial/plan-change";

const rows: CatalogueRow[]=[
  {sku:"crm_starter",version:"2026-10-22",name:"Starter",billingUnit:"per_user_month",priceUsdCents:1900,includedConversations:null,includedAiActions:null,maxAgentConfigurations:null,effectiveFrom:"2026-10-22",isAvailable:true},
  {sku:"crm_growth",version:"2026-10-22",name:"Growth",billingUnit:"per_user_month",priceUsdCents:2900,includedConversations:null,includedAiActions:null,maxAgentConfigurations:null,effectiveFrom:"2026-10-22",isAvailable:true},
  {sku:"agentic_business",version:"2026-10-22",name:"Business",billingUnit:"per_business_month",priceUsdCents:9900,includedConversations:500,includedAiActions:100,maxAgentConfigurations:1,effectiveFrom:"2026-10-22",isAvailable:true},
];
const catalogue: Catalogue=new Map(rows.map((r)=>[r.sku,r]));

test("charge-bearing amendment requires external consent evidence",()=>{
  const current=createPricingSnapshot(catalogue,{crmSku:"crm_starter",purchasedSeats:3});
  const preview=previewPlanChange(catalogue,{current,crmSku:"crm_growth",aiSku:"agentic_business",purchasedSeats:3,billingCycle:"monthly",effectiveAt:new Date("2026-11-01T00:00:00Z"),chargeHandling:"at_renewal"});
  assert.equal(preview.proposed.recurringMonthlyUsdCents,18600); assert.equal(preview.consentRequired,true);
  assert.throws(()=>validateConsent(preview,""),/consent evidence/); assert.doesNotThrow(()=>validateConsent(preview,"signed-amendment-42"));
});
test("grace uses a half-open UTC window and expires without cron",()=>{
  const startsAt=new Date("2026-10-01T00:00:00Z"), endsAt=new Date("2026-10-08T00:00:00Z");
  validateGracePeriod({startsAt,endsAt,reason:"Payment processing delay"});
  assert.equal(isGraceActive({now:new Date("2026-10-07T23:59:59Z"),startsAt,endsAt}),true);
  assert.equal(isGraceActive({now:endsAt,startsAt,endsAt}),false);
  assert.equal(resolveBillingAccess({now:endsAt,subscriptionStatus:"past_due",overdueEnforcementAt:new Date("2026-10-02T00:00:00Z"),grace:{startsAt,endsAt}}),"block");
});
test("31 days is rejected and a security suspension is never bypassed",()=>{
  assert.throws(()=>validateGracePeriod({startsAt:new Date("2026-10-01T00:00:00Z"),endsAt:new Date("2026-11-01T00:00:01Z")}),/cannot exceed/);
  assert.equal(resolveBillingAccess({now:new Date("2026-10-03T00:00:00Z"),subscriptionStatus:"active",securitySuspended:true,overdueEnforcementAt:new Date("2026-10-02T00:00:00Z"),grace:{startsAt:new Date("2026-10-01T00:00:00Z"),endsAt:new Date("2026-10-08T00:00:00Z")}}),"block");
});
