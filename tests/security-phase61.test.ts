import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateMfaAssurance,
  isMfaRestrictedAllowlistedPath,
  assertMfaApiAccess,
} from "@/lib/auth/mfa/assurance";
import {
  parseOrgSecurityPolicy,
  orgMfaRequiredForRole,
} from "@/lib/auth/org-security-policy";
import { hashWebsiteApiKey, verifyWebsiteApiKey } from "@/lib/auth/website-api-keys";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { hasPermission } from "@/lib/auth/rbac/resolve";
import { P } from "@/lib/auth/rbac/permissions";

test("MFA allowlist permits enrolment endpoints only", () => {
  assert.equal(isMfaRestrictedAllowlistedPath("/api/auth/mfa"), true);
  assert.equal(isMfaRestrictedAllowlistedPath("/api/auth/mfa/login"), true);
  assert.equal(isMfaRestrictedAllowlistedPath("/api/auth/session/logout"), true);
  assert.equal(isMfaRestrictedAllowlistedPath("/api/leads"), false);
  assert.equal(isMfaRestrictedAllowlistedPath("/api/client/dashboard"), false);
});

test("assertMfaApiAccess denies CRM when enrolment required", () => {
  const denied = assertMfaApiAccess(
    { mfaRequired: true, mfaSatisfied: false, mfaEnrolmentRequired: true },
    new Request("https://app.segmiq.com/api/leads")
  );
  assert.equal(denied.ok, false);

  const allowed = assertMfaApiAccess(
    { mfaRequired: true, mfaSatisfied: false, mfaEnrolmentRequired: true },
    new Request("https://app.segmiq.com/api/auth/mfa")
  );
  assert.equal(allowed.ok, true);

  const ok = assertMfaApiAccess(
    { mfaRequired: false, mfaSatisfied: true, mfaEnrolmentRequired: false },
    new Request("https://app.segmiq.com/api/leads")
  );
  assert.equal(ok.ok, true);
});

test("Phase 6.2: MFA enrolment gate denies representative CRM/API surfaces", () => {
  const restricted = {
    mfaRequired: true,
    mfaSatisfied: false,
    mfaEnrolmentRequired: true,
  };
  for (const path of [
    "/api/leads",
    "/api/leads/stale",
    "/api/deals",
    "/api/search",
    "/api/documents",
    "/api/agent/settings",
    "/api/company/whatsapp/status",
    "/api/clients/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/documents",
    "/api/reports/company/export",
  ]) {
    const r = assertMfaApiAccess(restricted, new Request(`https://app.segmiq.com${path}`));
    assert.equal(r.ok, false, path);
  }
  // Cookie-only / no Request must fail closed (getAuthFromRequest without req).
  assert.equal(assertMfaApiAccess(restricted, null).ok, false);
});

test("org MFA managers policy excludes salesperson", () => {
  const p = parseOrgSecurityPolicy({ mfaRequirement: "managers" });
  assert.equal(orgMfaRequiredForRole(p, "CLIENT_MANAGER"), true);
  assert.equal(orgMfaRequiredForRole(p, "SALESPERSON"), false);
});

test("website API key hash-only verify (no plaintext path in helper)", () => {
  const raw = "sk_live_phase61_test_abcdef";
  const hash = hashWebsiteApiKey(raw);
  assert.equal(verifyWebsiteApiKey(raw, hash), true);
  assert.equal(verifyWebsiteApiKey("wrong", hash), false);
});

test("reset-crm permission is platform-only", () => {
  const sa = { userId: "a", role: "SUPER_ADMIN" as const, clientId: null };
  const mgr = { userId: "m", role: "CLIENT_MANAGER" as const, clientId: "c1" };
  assert.equal(hasPermission(sa, P.PLATFORM_CLIENTS_MANAGE), true);
  assert.equal(hasPermission(mgr, P.PLATFORM_CLIENTS_MANAGE), false);
});

test("origin check still rejects cross-site", () => {
  const bad = assertBrowserOrigin(
    new Request("https://app.segmiq.com/api/x", {
      headers: { origin: "https://evil.example", host: "app.segmiq.com" },
    })
  );
  assert.equal(bad.ok, false);
});

test("evaluateMfaAssurance is exported callable", () => {
  assert.equal(typeof evaluateMfaAssurance, "function");
});
