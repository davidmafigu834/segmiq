import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  allocateTermPayments,
  assertPortalDto,
  customerWarrantyLabel,
  otpDecision,
  otpSendAllowed,
  portalMoney,
  portalTimeline,
  resolvePortalStage,
  warrantyForPortal,
} from "../lib/portal/rules";

const now = new Date("2026-10-04T12:00:00.000Z");

test("otp rejects expiry, reuse, lockout, mismatch, and replay windows", () => {
  const base = { now, expiresAt: new Date(now.getTime() + 60_000), consumedAt: null, attempts: 0, codeMatches: true };
  assert.equal(otpDecision(base).ok, true);
  assert.equal(otpDecision({ ...base, expiresAt: new Date(now.getTime() - 1) }).ok, false);
  assert.equal(otpDecision({ ...base, consumedAt: now.toISOString() }).ok, false);
  assert.equal(otpDecision({ ...base, attempts: 5 }).ok, false);
  assert.equal(otpDecision({ ...base, codeMatches: false }).ok, false);
  assert.equal(otpSendAllowed(4), true);
  assert.equal(otpSendAllowed(5), false);
});

test("customer stage stays truthful and timeline only includes real equipment work", () => {
  assert.equal(resolvePortalStage({ projectStatus: "QUALITY_CHECK", installationStatus: null, commissioningStatus: null, handoverStatus: null }), "TESTING");
  assert.equal(resolvePortalStage({ projectStatus: "COMPLETED", installationStatus: "COMPLETED", commissioningStatus: "COMPLETED", handoverStatus: "COMPLETED" }), "COMPLETED");
  assert.equal(resolvePortalStage({ projectStatus: "ON_HOLD", installationStatus: null, commissioningStatus: null, handoverStatus: null }), "ON_HOLD");
  const timeline = portalTimeline({
    confirmed: true,
    assessmentCompleted: false,
    showDeposit: true,
    depositReceived: false,
    equipmentRequired: false,
    equipmentPrepared: false,
    installationScheduled: false,
    installationStarted: false,
    commissioningCompleted: false,
    handoverCompleted: false,
    projectCompleted: false,
  });
  assert.equal(timeline.some((step) => step.key === "equipment"), false);
  assert.equal(timeline.find((step) => step.key === "assessment")?.state, "current");
});

test("only confirmed money counts and pending cannot settle a term", () => {
  const money = portalMoney([3480], 5800);
  assert.deepEqual(money, { paid: 3480, outstanding: 2320, projectValue: 5800 });
  const terms = allocateTermPayments([
    { id: "deposit", label: "60% deposit", amount: 3480 },
    { id: "completion", label: "40% completion", amount: 2320 },
  ], money.paid);
  assert.equal(terms[0].state, "Paid");
  assert.equal(terms[1].state, "Pending");
});

test("warranty labels hide voided and missing start, and do not invent expiry", () => {
  assert.equal(customerWarrantyLabel("VOIDED"), null);
  assert.equal(customerWarrantyLabel("NOT_STARTED"), null);
  assert.equal(customerWarrantyLabel("ACTIVE"), "Active");
  const row = warrantyForPortal({ starts_at: "2026-10-01", expires_at: null, voided_at: null }, now);
  assert.equal(row?.expiresAt, null);
  assert.equal(row?.label, "Active");
});

test("portal payloads cannot carry internal notes, cost, or margin", () => {
  const safe = {
    handover: { customerNotes: "Welcome home" },
    financials: { paid: 3480 },
    commissioning: { summary: "System commissioned successfully" },
  };
  assert.deepEqual(assertPortalDto(safe), []);
  assert.ok(assertPortalDto({ handover: { notes: "internal" } }).length > 0);
  assert.ok(assertPortalDto({ cost: 10, margin: 2 }).length > 0);
});

test("portal schema scopes identity and keeps documents internal by default", () => {
  const sql = readFileSync("supabase/migrations/20261004140000_customer_portal.sql", "utf8");
  assert.match(sql, /contact_id = p_contact_id/);
  assert.match(sql, /DEFAULT 'INTERNAL'/);
  assert.match(sql, /CUSTOMER_PORTAL/);
  assert.match(sql, /code_hash/);
  assert.match(sql, /revoked_at/);
  assert.doesNotMatch(sql, /otp_code text/);
});
