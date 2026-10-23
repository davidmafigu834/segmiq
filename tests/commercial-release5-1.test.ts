import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkCommercialWrite } from "../lib/commercial-launch/control";
import { shouldApplyPlanChangeImmediately } from "../lib/commercial/plan-change";
import { decideCommercialActivation } from "../lib/platform-sales/activation";
import { assertSameOrigin } from "../lib/platform-sales/http";
import { AI_ALLOWANCES, calculateQuota } from "../lib/platform-ai-usage/quota";
import { reconcileSyntheticShadowUsage } from "../lib/platform-ai-usage/shadow-reconciliation";
import { decideTopupActivation } from "../lib/platform-ai-usage/topup-safety";

describe("Release 5.1 migration-safe plan changes", () => {
  const now = new Date("2026-10-23T12:00:00.000Z");

  it("applies a current amendment but schedules a renewal change", () => {
    assert.equal(
      shouldApplyPlanChangeImmediately({
        chargeHandling: "waive",
        effectiveAt: now,
        now,
      }),
      true,
    );
    assert.equal(
      shouldApplyPlanChangeImmediately({
        chargeHandling: "at_renewal",
        effectiveAt: now,
        now,
      }),
      false,
    );
    assert.equal(
      shouldApplyPlanChangeImmediately({
        chargeHandling: "prorate",
        effectiveAt: new Date("2026-11-01T00:00:00.000Z"),
        now,
      }),
      false,
    );
  });
});

describe("Release 5.1 fail-closed controls", () => {
  it("blocks a write when release-control storage is unavailable", async () => {
    assert.deepEqual(
      await checkCommercialWrite(
        { clientId: "client-1", environmentKillSwitchOpen: true },
        async () => null,
      ),
      { allowed: false, reason: "release_control_unavailable" },
    );
    assert.deepEqual(
      await checkCommercialWrite(
        { clientId: "client-1", environmentKillSwitchOpen: true },
        async () => {
          throw new Error("database unavailable");
        },
      ),
      { allowed: false, reason: "release_control_unavailable" },
    );
  });

  it("requires an exact same-origin header for privileged writes", () => {
    assert.doesNotThrow(() =>
      assertSameOrigin(
        new Request("https://app.segmiq.com/api/admin/commercial", {
          method: "POST",
          headers: { origin: "https://app.segmiq.com" },
        }),
      ),
    );
    assert.throws(
      () =>
        assertSameOrigin(
          new Request("https://app.segmiq.com/api/admin/commercial", {
            method: "POST",
          }),
        ),
      /Missing Origin/,
    );
    assert.throws(
      () =>
        assertSameOrigin(
          new Request("https://app.segmiq.com/api/admin/commercial", {
            method: "POST",
            headers: { origin: "https://evil.example" },
          }),
        ),
      /Cross-origin/,
    );
  });
});

describe("Release 5.1 synthetic AI shadow reconciliation", () => {
  const periods = [
    {
      id: "october",
      start: "2026-10-01T00:00:00.000Z",
      end: "2026-11-01T00:00:00.000Z",
    },
    {
      id: "november",
      start: "2026-11-01T00:00:00.000Z",
      end: "2026-12-01T00:00:00.000Z",
    },
  ];

  it("deduplicates ten webhook deliveries and opens one conversation", () => {
    const repeated = Array.from({ length: 10 }, () => ({
      eventKey: "provider-message-1",
      type: "customer_conversation" as const,
      occurredAt: "2026-10-23T10:00:00.000Z",
      subjectKey: "customer-1",
      channel: "whatsapp",
      successful: true,
    }));
    const result = reconcileSyntheticShadowUsage({ periods, events: repeated });
    assert.equal(result.unitsByPeriod.october, 1);
    assert.equal(
      result.rows.filter((row) => row.outcome === "duplicate").length,
      9,
    );
  });

  it("excludes failures and tests, reuses the half-open window, and bills the boundary", () => {
    const result = reconcileSyntheticShadowUsage({
      periods,
      events: [
        {
          eventKey: "failed",
          type: "customer_conversation",
          occurredAt: "2026-10-30T10:00:00.000Z",
          subjectKey: "customer-1",
          channel: "whatsapp",
          successful: false,
        },
        {
          eventKey: "test",
          type: "customer_conversation",
          occurredAt: "2026-10-30T10:01:00.000Z",
          subjectKey: "customer-1",
          channel: "whatsapp",
          successful: true,
          testMode: true,
        },
        {
          eventKey: "open",
          type: "customer_conversation",
          occurredAt: "2026-10-31T12:00:00.000Z",
          subjectKey: "customer-1",
          channel: "whatsapp",
          successful: true,
        },
        {
          eventKey: "cross-renewal",
          type: "customer_conversation",
          occurredAt: "2026-11-01T08:00:00.000Z",
          subjectKey: "customer-1",
          channel: "whatsapp",
          successful: true,
        },
        {
          eventKey: "exact-boundary",
          type: "customer_conversation",
          occurredAt: "2026-11-01T12:00:00.000Z",
          subjectKey: "customer-1",
          channel: "whatsapp",
          successful: true,
        },
      ],
    });
    assert.equal(result.rows[0]?.outcome, "excluded_failed");
    assert.equal(result.rows[1]?.outcome, "excluded_test");
    assert.equal(result.rows[3]?.outcome, "window_reused");
    assert.equal(result.rows[3]?.periodId, "october");
    assert.equal(result.unitsByPeriod.october, 1);
    assert.equal(result.unitsByPeriod.november, 1);
  });

  it("counts only successful autonomous allowlisted internal actions", () => {
    const result = reconcileSyntheticShadowUsage({
      periods,
      events: [
        {
          eventKey: "auto",
          type: "internal_ai_action",
          occurredAt: "2026-10-23T10:00:00.000Z",
          toolName: "deal_create",
          status: "EXECUTED",
        },
        {
          eventKey: "human",
          type: "internal_ai_action",
          occurredAt: "2026-10-23T10:01:00.000Z",
          toolName: "deal_create",
          status: "EXECUTED",
          humanApproved: true,
        },
        {
          eventKey: "retry-failed",
          type: "internal_ai_action",
          occurredAt: "2026-10-23T10:02:00.000Z",
          toolName: "deal_create",
          status: "FAILED",
        },
      ],
    });
    assert.equal(result.unitsByPeriod.october, 1);
    assert.deepEqual(
      result.rows.map((row) => row.units),
      [1, 0, 0],
    );
  });

  it("resets quotas by period and preserves Business/Scale allowances", () => {
    assert.deepEqual(AI_ALLOWANCES.agentic_business, {
      conversations: 500,
      actions: 100,
    });
    assert.deepEqual(AI_ALLOWANCES.agentic_scale, {
      conversations: 2000,
      actions: 500,
    });
    assert.equal(calculateQuota(500, 500).available, 0);
    assert.equal(calculateQuota(500, 0).available, 500);
    assert.equal(calculateQuota(500, 500, 250).available, 250);
  });
});

describe("Release 5.1 contract and top-up safety", () => {
  const paid = {
    customerApproved: true,
    approvalEvidenceRef: "consent:v1",
    periodOpen: true,
    invoiceStatus: "paid",
    invoiceCurrency: "USD",
    invoiceAmountUsdCents: 2500,
    paymentStatus: "confirmed",
    paymentCurrency: "USD",
    paymentAmountUsdCents: 2500,
    expectedUsdCents: 2500,
  };

  it("does not treat quotation acceptance as a signed contract", () => {
    assert.deepEqual(
      decideCommercialActivation({
        legacyCustomer: false,
        gateEnabled: true,
        agreementStatus: "accepted_offer",
        agreementPdfSha256: null,
        billingReady: true,
      }),
      { allowed: false, reason: "agreement_not_executed" },
    );
  });

  it("activates a top-up only after exact approval, invoice and payment evidence", () => {
    assert.deepEqual(decideTopupActivation(paid), {
      allowed: true,
      reason: "paid_approval_verified",
    });
    assert.equal(
      decideTopupActivation({ ...paid, paymentStatus: "pending" }).allowed,
      false,
    );
    assert.equal(
      decideTopupActivation({ ...paid, invoiceAmountUsdCents: 5000 }).allowed,
      false,
    );
    assert.equal(
      decideTopupActivation({ ...paid, periodOpen: false }).allowed,
      false,
    );
  });
});
