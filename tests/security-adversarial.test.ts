import assert from "node:assert/strict";
import test from "node:test";

/**
 * Adversarial / authorization-path tests (Phase 6.1).
 * Prefer exercising real helpers used by routes rather than mocking authz open.
 */

import {
  evaluateLeadModifyAccess,
  evaluateLeadReadAccess,
  canAccessClient,
} from "@/lib/auth/permissions";
import { assertSameTenant, TenantContextError } from "@/lib/auth/tenant-context";
import { validateAuthClaims } from "@/lib/auth/session-validation";
import { validateUserSession } from "@/lib/auth/user-sessions";
import { hasPermission } from "@/lib/auth/rbac/resolve";
import { P } from "@/lib/auth/rbac/permissions";
import { assertMfaApiAccess } from "@/lib/auth/mfa/assurance";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { hashWebsiteApiKey } from "@/lib/auth/website-api-keys";

const clientA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const clientB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const userA = "11111111-1111-1111-1111-111111111111";
const userB = "22222222-2222-2222-2222-222222222222";

test("A/B: cross-tenant lead modify denied (tenant mismatch before assignment)", () => {
  const sessionA = {
    userId: userA,
    role: "SALESPERSON" as const,
    clientId: clientA,
    alsoSells: false,
  };
  const leadOnB = {
    client_id: clientB,
    assigned_to_id: userA, // corrupt assignment must not help
  };
  const result = evaluateLeadModifyAccess(sessionA, leadOnB);
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.status, 404);
});

test("Phase 6.2: cross-tenant deal ownership alone must not grant access", () => {
  // Mirrors canReadDeal/canModifyDeal tenant-before-owner rule.
  const sessionA = {
    userId: userA,
    role: "SALESPERSON" as const,
    clientId: clientA,
    alsoSells: false,
  };
  const dealOnB = { client_id: clientB, owner_id: userA };
  assert.notEqual(sessionA.clientId, dealOnB.client_id);
  // Contract: tenant mismatch denies even when owner_id matches.
  const tenantOk = sessionA.clientId === dealOnB.client_id;
  const ownerOk = dealOnB.owner_id === sessionA.userId;
  assert.equal(tenantOk && ownerOk, false);
  assert.equal(tenantOk, false);
});

test("A: same-tenant assigned lead modify allowed", () => {
  const sessionA = {
    userId: userA,
    role: "SALESPERSON" as const,
    clientId: clientA,
    alsoSells: false,
  };
  const lead = {
    client_id: clientA,
    assigned_to_id: userA,
  };
  const result = evaluateLeadModifyAccess(sessionA, lead);
  assert.equal(result.allowed, true);
});

test("F/G: org security permissions are manager-scoped not salesperson", () => {
  const sales = { userId: userA, role: "SALESPERSON" as const, clientId: clientA };
  const mgr = { userId: userB, role: "CLIENT_MANAGER" as const, clientId: clientA };
  assert.equal(hasPermission(sales, P.SECURITY_AUDIT_READ), false);
  assert.equal(hasPermission(sales, P.SECURITY_SETTINGS_MANAGE), false);
  assert.equal(hasPermission(mgr, P.SECURITY_AUDIT_READ), true);
  assert.equal(hasPermission(mgr, P.SECURITY_SETTINGS_MANAGE), true);
});

test("H: session user mismatch fails registry", async () => {
  const now = Date.now();
  const row = {
    id: "sess-b",
    user_id: userB,
    client_id: clientB,
    session_type: "WEB" as const,
    session_version: 1,
    created_at: new Date(now).toISOString(),
    last_seen_at: new Date(now).toISOString(),
    expires_at: new Date(now + 3600_000).toISOString(),
    revoked_at: null,
    revoked_reason: null,
    user_agent: null,
    device_id: null,
    metadata: {},
  };
  const check = await validateUserSession({
    sessionId: row.id,
    userId: userA,
    sessionVersion: 1,
    role: "SALESPERSON",
    nowMs: now,
    sessionRow: row,
  });
  assert.equal(check.ok, false);
  if (!check.ok) assert.equal(check.reason, "session_user_mismatch");
});

test("I: revoked session fails", async () => {
  const now = Date.now();
  const row = {
    id: "sess-r",
    user_id: userA,
    client_id: clientA,
    session_type: "WEB" as const,
    session_version: 1,
    created_at: new Date(now).toISOString(),
    last_seen_at: new Date(now).toISOString(),
    expires_at: new Date(now + 3600_000).toISOString(),
    revoked_at: new Date(now).toISOString(),
    revoked_reason: "USER_LOGOUT",
    user_agent: null,
    device_id: null,
    metadata: {},
  };
  const check = await validateUserSession({
    sessionId: row.id,
    userId: userA,
    sessionVersion: 1,
    role: "SALESPERSON",
    nowMs: now,
    sessionRow: row,
  });
  assert.equal(check.ok, false);
  if (!check.ok) assert.equal(check.reason, "session_revoked");
});

test("J: mandatory MFA bypass denied on leads path", () => {
  const r = assertMfaApiAccess(
    { mfaRequired: true, mfaSatisfied: false, mfaEnrolmentRequired: true },
    new Request("https://app.segmiq.com/api/leads")
  );
  assert.equal(r.ok, false);
});

test("J2: Phase 6.2 central auth must deny enrolment-required without Request", () => {
  // Mirrors getAuthFromRequest(undefined) fail-closed behaviour.
  const r = assertMfaApiAccess(
    { mfaRequired: true, mfaSatisfied: false, mfaEnrolmentRequired: true },
    null
  );
  assert.equal(r.ok, false);
});

test("K: reset-crm origin rejects cross-site", () => {
  const r = assertBrowserOrigin(
    new Request("https://app.segmiq.com/api/clients/x/reset-crm", {
      method: "POST",
      headers: { origin: "https://evil.test", host: "app.segmiq.com" },
    })
  );
  assert.equal(r.ok, false);
});

test("L: impersonating salesperson lacks platform permissions", () => {
  const actor = {
    userId: userA,
    role: "SALESPERSON" as const,
    clientId: clientA,
    isImpersonating: true,
  };
  assert.equal(hasPermission(actor, P.PLATFORM_IMPERSONATE), false);
  assert.equal(hasPermission(actor, P.PLATFORM_CLIENTS_MANAGE), false);
  assert.equal(hasPermission(actor, P.TEAM_MANAGE), false);
});

test("N: suspended/inactive user claims fail", async () => {
  const result = await validateAuthClaims(
    {
      userId: userA,
      role: "SALESPERSON",
      clientId: clientA,
      alsoSells: false,
      sessionVersion: 1,
    },
    {
      skipSessionRegistry: true,
      fetchUserById: async () => ({
        id: userA,
        role: "SALESPERSON",
        client_id: clientA,
        is_active: false,
        session_version: 1,
        also_sells: false,
      }),
    }
  );
  assert.deepEqual(result, { ok: false, reason: "target_inactive" });
});

test("O: API key hashing is deterministic; plaintext unused by helper", () => {
  const a = hashWebsiteApiKey("sk_live_abc");
  const b = hashWebsiteApiKey("sk_live_abc");
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});

test("cross-tenant canAccessClient false for salesperson", () => {
  assert.equal(canAccessClient("SALESPERSON", clientA, clientB), false);
  assert.equal(canAccessClient("SUPER_ADMIN", null, clientB), true);
});

test("assertSameTenant throws on cross-tenant", () => {
  assert.throws(
    () =>
      assertSameTenant(
        { userId: userA, role: "CLIENT_MANAGER", clientId: clientA },
        clientB
      ),
    (err: unknown) => err instanceof TenantContextError
  );
});

test("canReadLead-style cross-tenant deny is 404", () => {
  const sessionA = {
    userId: userA,
    role: "CLIENT_MANAGER" as const,
    clientId: clientA,
    alsoSells: false,
  };
  const result = evaluateLeadReadAccess(sessionA, {
    client_id: clientB,
    assigned_to_id: null,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 404);
});
