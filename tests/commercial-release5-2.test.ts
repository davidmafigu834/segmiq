import assert from "node:assert/strict";
import test from "node:test";
import {
  type Catalogue,
  type CatalogueRow,
} from "../lib/commercial/catalogue";
import {
  assertMigrationEffectiveNow,
  buildMigrationCandidate,
} from "../lib/commercial/migration";

const rows: CatalogueRow[] = [
  { sku: "crm_starter", version: "2026-10-22", name: "Starter", billingUnit: "per_user_month", priceUsdCents: 1900, includedConversations: null, includedAiActions: null, maxAgentConfigurations: null, effectiveFrom: "2026-10-22", isAvailable: true },
  { sku: "crm_growth", version: "2026-10-22", name: "Growth", billingUnit: "per_user_month", priceUsdCents: 2900, includedConversations: null, includedAiActions: null, maxAgentConfigurations: null, effectiveFrom: "2026-10-22", isAvailable: true },
  { sku: "agentic_business", version: "2026-10-22", name: "Business", billingUnit: "per_business_month", priceUsdCents: 9900, includedConversations: 500, includedAiActions: 100, maxAgentConfigurations: 1, effectiveFrom: "2026-10-22", isAvailable: true },
  { sku: "agentic_scale", version: "2026-10-22", name: "Scale", billingUnit: "per_business_month", priceUsdCents: 24900, includedConversations: 2000, includedAiActions: 500, maxAgentConfigurations: 3, effectiveFrom: "2026-10-22", isAvailable: true },
];
const catalogue: Catalogue = new Map(rows.map((row) => [row.sku, row]));

test("legacy candidate uses official seat pricing and keeps Agentic AI off", () => {
  const candidate = buildMigrationCandidate(catalogue, {
    clientId: "client-1", clientName: "Synthetic Co", subscriptionId: "sub-1",
    legacyPlan: "growth", amount: 120, currency: "USD", billingCycle: "monthly",
    status: "active", currentPeriodEnd: "2026-11-01T00:00:00.000Z", activeUsers: 4,
  }, new Date("2026-10-23T00:00:00.000Z"));
  assert.equal(candidate.currentMonthlyUsdCents, 12000);
  assert.equal(candidate.proposed.crmSku, "crm_growth");
  assert.equal(candidate.proposed.purchasedSeats, 4);
  assert.equal(candidate.proposed.aiSku, null);
  assert.equal(candidate.proposed.recurringMonthlyUsdCents, 11600);
  assert.equal(candidate.proposedEffectiveAt, "2026-11-01T00:00:00.000Z");
  assert.equal(candidate.contractRequirement, "SIGNED_AMENDMENT_REQUIRED");
});

test("annual legacy amount is presented as a monthly equivalent", () => {
  const candidate = buildMigrationCandidate(catalogue, {
    clientId: "client-2", clientName: "Annual Co", subscriptionId: "sub-2",
    legacyPlan: "starter", amount: 228, currency: "USD", billingCycle: "annual",
    status: "active", currentPeriodEnd: null, activeUsers: 0,
  }, new Date("2026-10-23T00:00:00.000Z"));
  assert.equal(candidate.currentMonthlyUsdCents, 1900);
  assert.equal(candidate.proposed.purchasedSeats, 1);
  assert.equal(candidate.proposed.recurringMonthlyUsdCents, 1900);
});

test("migration confirmation rejects backdating and premature activation", () => {
  const now = new Date("2026-10-23T12:00:00.000Z");
  assert.throws(
    () => assertMigrationEffectiveNow(new Date("2026-10-23T11:54:59.000Z"), now),
    /cannot be backdated/,
  );
  assert.throws(
    () => assertMigrationEffectiveNow(new Date("2026-10-23T12:05:01.000Z"), now),
    /effective time arrives/,
  );
  assert.doesNotThrow(() =>
    assertMigrationEffectiveNow(new Date("2026-10-23T12:02:00.000Z"), now),
  );
});
