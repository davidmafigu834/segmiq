import assert from "node:assert/strict";
import test from "node:test";
import { calculatePlatformQuote } from "../lib/platform-sales/pricing";
import {
  createRecipientToken,
  hashRecipientToken,
} from "../lib/platform-sales/tokens";
import { decideCommercialActivation } from "../lib/platform-sales/activation";
import type {
  Catalogue,
  CatalogueRow,
  CatalogueSku,
} from "../lib/commercial/catalogue";
const raw: Array<
  [
    CatalogueSku,
    number,
    "per_user_month" | "per_business_month" | "one_time",
    number | null,
    number | null,
    number | null,
  ]
> = [
  ["crm_starter", 1900, "per_user_month", null, null, null],
  ["crm_growth", 2900, "per_user_month", null, null, null],
  ["agentic_business", 9900, "per_business_month", 500, 100, 1],
  ["agentic_scale", 24900, "per_business_month", 2000, 500, 3],
  ["ai_conversations_250", 2500, "one_time", 250, null, null],
  ["onboarding_one_business", 15000, "one_time", null, null, null],
  ["onboarding_two_businesses", 25000, "one_time", null, null, null],
  ["onboarding_three_businesses", 35000, "one_time", null, null, null],
  ["ai_activation_standard", 14900, "one_time", null, null, null],
];
const catalogue: Catalogue = new Map(
  raw.map(
    ([
      sku,
      priceUsdCents,
      billingUnit,
      includedConversations,
      includedAiActions,
      maxAgentConfigurations,
    ]) => [
      sku,
      {
        sku,
        version: "2026-10-22",
        name: sku,
        billingUnit,
        priceUsdCents,
        includedConversations,
        includedAiActions,
        maxAgentConfigurations,
        effectiveFrom: "2026-10-22",
        isAvailable: true,
      } satisfies CatalogueRow,
    ],
  ),
);
test("Growth and Agentic fees calculate once per company", () => {
  const business = calculatePlatformQuote(
    catalogue,
    {
      crmSku: "crm_growth",
      seats: 3,
      aiSku: "agentic_business",
      serviceSkus: [],
      discount: null,
      taxRateBasisPoints: 0,
      validUntil: "2026-11-30",
    },
    "admin",
  );
  assert.equal(business.recurringTotalUsdCents, 18600);
  const scale = calculatePlatformQuote(
    catalogue,
    {
      crmSku: "crm_growth",
      seats: 3,
      aiSku: "agentic_scale",
      serviceSkus: [],
      discount: null,
      taxRateBasisPoints: 0,
      validUntil: "2026-11-30",
    },
    "admin",
  );
  assert.equal(scale.recurringTotalUsdCents, 33600);
});
test("selected setup produces the illustrative 485 dollar initial due", () => {
  const q = calculatePlatformQuote(
    catalogue,
    {
      crmSku: "crm_growth",
      seats: 3,
      aiSku: "agentic_business",
      serviceSkus: ["onboarding_one_business", "ai_activation_standard"],
      discount: null,
      taxRateBasisPoints: 0,
      validUntil: "2026-11-30",
    },
    "admin",
  );
  assert.equal(q.initialDueUsdCents, 48500);
});
test("one conversation top-up is a 25 dollar one-time line, not recurring", () => {
  const q = calculatePlatformQuote(
    catalogue,
    {
      crmSku: "crm_growth",
      seats: 3,
      aiSku: "agentic_business",
      serviceSkus: ["ai_conversations_250"],
      discount: null,
      taxRateBasisPoints: 0,
      validUntil: "2026-11-30",
    },
    "admin",
  );
  assert.equal(q.recurringTotalUsdCents, 18600);
  assert.equal(q.oneTimeTotalUsdCents, 2500);
  assert.equal(q.initialDueUsdCents, 21100);
});
test("discount scope is isolated and cannot create a negative total", () => {
  const q = calculatePlatformQuote(
    catalogue,
    {
      crmSku: "crm_growth",
      seats: 1,
      aiSku: null,
      serviceSkus: ["onboarding_one_business"],
      discount: {
        kind: "fixed",
        value: 5000,
        scope: "one_time",
        reason: "Approved launch credit",
      },
      taxRateBasisPoints: 0,
      validUntil: "2026-11-30",
    },
    "admin",
  );
  assert.equal(q.recurringTotalUsdCents, 2900);
  assert.equal(q.oneTimeTotalUsdCents, 10000);
  assert.throws(
    () =>
      calculatePlatformQuote(
        catalogue,
        {
          crmSku: "crm_growth",
          seats: 1,
          aiSku: null,
          serviceSkus: [],
          discount: {
            kind: "fixed",
            value: 3000,
            scope: "recurring",
            reason: "Invalid over-discount",
          },
          taxRateBasisPoints: 0,
          validUntil: "2026-11-30",
        },
        "admin",
      ),
    /negative total/,
  );
});
test("recipient tokens are random and stored only as hashes", () => {
  const a = createRecipientToken(),
    b = createRecipientToken();
  assert.notEqual(a.raw, b.raw);
  assert.equal(a.hash, hashRecipientToken(a.raw));
  assert.equal(a.hash.length, 64);
  assert.notEqual(a.raw, a.hash);
});
test("new activation fails closed while legacy access remains exempt", () => {
  assert.deepEqual(
    decideCommercialActivation({
      legacyCustomer: true,
      gateEnabled: false,
      agreementStatus: null,
      agreementPdfSha256: null,
      billingReady: false,
    }),
    { allowed: true, reason: "legacy_exempt" },
  );
  assert.deepEqual(
    decideCommercialActivation({
      legacyCustomer: false,
      gateEnabled: true,
      agreementStatus: "executed",
      agreementPdfSha256: null,
      billingReady: true,
    }),
    { allowed: false, reason: "document_not_sealed" },
  );
  assert.equal(
    decideCommercialActivation({
      legacyCustomer: false,
      gateEnabled: true,
      agreementStatus: "executed",
      agreementPdfSha256: "abc",
      billingReady: true,
    }).allowed,
    true,
  );
});
