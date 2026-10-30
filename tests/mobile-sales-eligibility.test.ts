import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateMobileSalesEligibility,
  type MobileSalesCandidate,
} from "../lib/mobile/sales-app/eligibility";
import { MOBILE_API_ERROR_STATUS, mobileApiError } from "../lib/mobile/sales-app/errors";

const base: MobileSalesCandidate = {
  userId: "user-1",
  role: "SALESPERSON",
  alsoSells: false,
  clientId: "org-a",
  isActive: true,
};

test("active salesperson in an active organisation is eligible", () => {
  assert.deepEqual(evaluateMobileSalesEligibility(base, "active"), { ok: true });
});

test("selling manager is eligible; non-selling manager is refused", () => {
  assert.deepEqual(
    evaluateMobileSalesEligibility({ ...base, role: "CLIENT_MANAGER", alsoSells: true }, "active"),
    { ok: true }
  );
  const refused = evaluateMobileSalesEligibility({ ...base, role: "CLIENT_MANAGER", alsoSells: false }, "active");
  assert.equal(refused.ok, false);
  if (!refused.ok) {
    assert.equal(refused.code, "INSUFFICIENT_ROLE");
    assert.equal(refused.error, "Segmiq Sales is for salesperson and selling manager accounts only.");
  }
});

test("platform admins and unknown roles are refused", () => {
  for (const role of ["SUPER_ADMIN", "AGENCY_ADMIN", "VIEWER", null]) {
    const result = evaluateMobileSalesEligibility({ ...base, role, alsoSells: true }, "active");
    assert.equal(result.ok, false, `role ${String(role)}`);
    if (!result.ok) assert.equal(result.code, "INSUFFICIENT_ROLE");
  }
});

test("disabled user is refused before role is considered", () => {
  const result = evaluateMobileSalesEligibility({ ...base, isActive: false }, "active");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "ACCOUNT_DISABLED");
});

test("user without an organisation is refused", () => {
  const result = evaluateMobileSalesEligibility({ ...base, clientId: null }, null);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "NO_ORGANISATION");
});

test("inactive, archived, security-suspended or missing organisation is refused", () => {
  for (const state of ["inactive", "security_suspended", "missing", null] as const) {
    const result = evaluateMobileSalesEligibility(base, state);
    assert.equal(result.ok, false, `state ${String(state)}`);
    if (!result.ok) assert.equal(result.code, "ORGANISATION_SUSPENDED");
  }
});

test("mobile error envelope keeps legacy `error` and adds stable `code`", async () => {
  const res = mobileApiError("INSUFFICIENT_ROLE", { error: "legacy text" });
  assert.equal(res.status, 403);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.error, "legacy text");
  assert.equal(body.code, "INSUFFICIENT_ROLE");
  assert.equal(typeof body.message, "string");

  assert.equal(MOBILE_API_ERROR_STATUS.SUBSCRIPTION_SUSPENDED, 402);
  assert.equal(MOBILE_API_ERROR_STATUS.SESSION_REVOKED, 401);
  assert.equal(MOBILE_API_ERROR_STATUS.SERVICE_UNAVAILABLE, 503);
});
