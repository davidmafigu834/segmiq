import assert from "node:assert/strict";
import test from "node:test";
import {
  parseOrgSecurityPolicy,
  orgMfaRequiredForRole,
  idleTtlMsFromOrgPolicy,
  absoluteTtlMsFromOrgPolicy,
  DEFAULT_ORG_SECURITY_POLICY,
} from "@/lib/auth/org-security-policy";
import {
  hashWebsiteApiKey,
  verifyWebsiteApiKey,
  websiteApiKeyPrefix,
  looksLikeHashedWebsiteKey,
} from "@/lib/auth/website-api-keys";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { hasPermission } from "@/lib/auth/rbac/resolve";
import { P } from "@/lib/auth/rbac/permissions";
import { securityHeaderList } from "@/lib/security/browser-headers";

test("org policy: defaults and clamps", () => {
  const p = parseOrgSecurityPolicy({
    mfaRequirement: "all",
    idleTtlHours: 99,
    absoluteTtlHours: 2,
    allowDataExports: false,
  });
  assert.equal(p.mfaRequirement, "all");
  assert.equal(p.idleTtlHours, 24);
  assert.equal(p.absoluteTtlHours, 8);
  assert.equal(p.allowDataExports, false);
  assert.deepEqual(parseOrgSecurityPolicy(null).mfaRequirement, DEFAULT_ORG_SECURITY_POLICY.mfaRequirement);
});

test("org MFA requirement by role + grace", () => {
  const base = parseOrgSecurityPolicy({ mfaRequirement: "managers" });
  assert.equal(orgMfaRequiredForRole(base, "CLIENT_MANAGER"), true);
  assert.equal(orgMfaRequiredForRole(base, "SALESPERSON"), false);
  assert.equal(orgMfaRequiredForRole(parseOrgSecurityPolicy({ mfaRequirement: "all" }), "SALESPERSON"), true);
  assert.equal(orgMfaRequiredForRole(base, "SUPER_ADMIN"), false);
  const grace = parseOrgSecurityPolicy({
    mfaRequirement: "all",
    mfaGraceUntil: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(orgMfaRequiredForRole(grace, "SALESPERSON"), false);
});

test("org TTL helpers fall back", () => {
  assert.equal(idleTtlMsFromOrgPolicy(null, 1000), 1000);
  assert.equal(idleTtlMsFromOrgPolicy(parseOrgSecurityPolicy({ idleTtlHours: 2 }), 1000), 2 * 3600_000);
  assert.equal(absoluteTtlMsFromOrgPolicy(parseOrgSecurityPolicy({ absoluteTtlHours: 10 }), 1000), 10 * 3600_000);
});

test("website API key hash verify", () => {
  const raw = "sk_live_test_key_abcdef123456";
  const hash = hashWebsiteApiKey(raw);
  assert.equal(looksLikeHashedWebsiteKey(hash), true);
  assert.equal(verifyWebsiteApiKey(raw, hash), true);
  assert.equal(verifyWebsiteApiKey(raw + "x", hash), false);
  assert.ok(websiteApiKeyPrefix(raw).startsWith("sk_live"));
});

test("origin check rejects cross-site", () => {
  const bad = assertBrowserOrigin(
    new Request("https://app.segmiq.com/api/x", {
      headers: { origin: "https://evil.example", host: "app.segmiq.com" },
    })
  );
  assert.equal(bad.ok, false);

  const good = assertBrowserOrigin(
    new Request("https://app.segmiq.com/api/x", {
      headers: { origin: "https://app.segmiq.com", host: "app.segmiq.com" },
    })
  );
  assert.equal(good.ok, true);

  const bearer = assertBrowserOrigin(
    new Request("https://app.segmiq.com/api/x", {
      headers: { authorization: "Bearer tok" },
    })
  );
  assert.equal(bearer.ok, true);
});

test("manager has org security permissions; salesperson does not", () => {
  const mgr = { userId: "u1", role: "CLIENT_MANAGER" as const, clientId: "c1" };
  const sales = { userId: "u2", role: "SALESPERSON" as const, clientId: "c1" };
  assert.equal(hasPermission(mgr, P.SECURITY_SETTINGS_MANAGE), true);
  assert.equal(hasPermission(mgr, P.SECURITY_AUDIT_READ), true);
  assert.equal(hasPermission(sales, P.SECURITY_SETTINGS_MANAGE), false);
  assert.equal(hasPermission(sales, P.SECURITY_AUDIT_READ), false);
});

test("browser security headers include CSP and Permissions-Policy", () => {
  const prev = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const headers = securityHeaderList();
    const keys = new Set(headers.map((h) => h.key));
    assert.ok(keys.has("Content-Security-Policy-Report-Only") || keys.has("Content-Security-Policy"));
    assert.ok(keys.has("Permissions-Policy"));
    assert.ok(keys.has("Strict-Transport-Security"));
    assert.ok(keys.has("X-Content-Type-Options"));
  } finally {
    process.env.NODE_ENV = prev;
  }
});
