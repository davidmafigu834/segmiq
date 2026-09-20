/**
 * Phase 7 — Super Admin client-data privacy & privileged access.
 *
 * These tests pin the authorisation rules that keep a SegmiQ platform
 * administrator out of a customer's business data unless they hold an explicit,
 * scoped, time-limited Support Access grant. They are pure unit tests: the
 * decision layer takes the grant as an argument, so no database is required.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  BREAK_GLASS_MAX_DURATION_MINUTES,
  SUPPORT_ACCESS_MAX_DURATION_MINUTES,
  SUPPORT_ACCESS_MIN_REASON_LENGTH,
  canSelfApprove,
  effectiveGrantStatus,
  evaluateSupportAccess,
  formatRemaining,
  grantRemainingMs,
  maxDurationMinutes,
  resolveApprovalMode,
  validateSupportAccessRequest,
  type SupportAccessGrant,
} from "@/lib/security/support-access/policy";
import {
  ALL_SUPPORT_ACCESS_SCOPES,
  parseSupportAccessScopes,
  type SupportAccessScope,
} from "@/lib/security/support-access/scopes";
import {
  describeContent,
  maskEmail,
  maskPersonName,
  maskPhone,
  maskedContactRef,
  resourceRef,
  stripCustomerContent,
} from "@/lib/security/support-access/masking";
import {
  CLIENT_DATA_PERMISSIONS,
  P,
  isClientDataPermission,
} from "@/lib/auth/rbac/permissions";
import {
  permissionsForSuperAdmin,
  permissionsForSupportAccess,
} from "@/lib/auth/rbac/role-profiles";
import { hasPermission } from "@/lib/auth/rbac/resolve";
import {
  canDownloadDocument,
  canViewDocument,
  hasDocumentPermission,
} from "@/lib/documents/permissions";
import { scopeAuditEvent } from "@/lib/security/support-access/audit";
import { CLIENT_DATA_ACCESS_EVENTS, supportAccessEventLabel } from "@/lib/security/support-access/audit";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const OTHER_ADMIN = "22222222-2222-4222-8222-222222222222";
const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = Date.parse("2026-09-19T14:30:00.000Z");

function grant(overrides: Partial<SupportAccessGrant> = {}): SupportAccessGrant {
  return {
    id: "grant-1",
    reference: "SA-2026-0001",
    adminUserId: ADMIN,
    clientId: ORG_A,
    status: "ACTIVE",
    accessKind: "SUPPORT",
    approvalMode: "SELF_APPROVAL",
    scopes: ["LEADS"],
    reason: "Investigating duplicated lead records reported by the customer",
    ticketReference: "SUP-4821",
    durationMinutes: 30,
    requestedAt: new Date(NOW - 60_000).toISOString(),
    approvedAt: new Date(NOW - 60_000).toISOString(),
    approvedByUserId: ADMIN,
    startedAt: new Date(NOW - 60_000).toISOString(),
    expiresAt: new Date(NOW + 29 * 60_000).toISOString(),
    revokedAt: null,
    revokedReason: null,
    deniedAt: null,
    denialReason: null,
    ...overrides,
  };
}

function evaluate(
  scope: SupportAccessScope,
  g: SupportAccessGrant | null,
  opts: { adminUserId?: string; clientId?: string; nowMs?: number } = {}
) {
  return evaluateSupportAccess({
    grant: g,
    adminUserId: opts.adminUserId ?? ADMIN,
    clientId: opts.clientId ?? ORG_A,
    scope,
    nowMs: opts.nowMs ?? NOW,
  });
}

// Test 1 — no grant means no tenant leads, whatever the role.
test("phase7: super admin without support access cannot read tenant leads", () => {
  const decision = evaluate("LEADS", null);
  assert.equal(decision.ok, false);
  assert.equal(decision.ok === false && decision.code, "SUPPORT_ACCESS_REQUIRED");
  assert.equal(decision.ok === false && decision.status, 403);
});

// Test 2 — conversations are equally closed by default.
test("phase7: super admin without support access cannot read conversations", () => {
  const decision = evaluate("CONVERSATIONS", null);
  assert.equal(decision.ok, false);
  assert.equal(decision.ok === false && decision.status, 403);
});

// Test 3 — documents are closed by default, enforced in the documents module too.
test("phase7: super admin without support access holds no document permissions", () => {
  const actor = { userId: ADMIN, role: "SUPER_ADMIN", clientId: null };
  assert.equal(hasDocumentPermission(actor, "documents.view"), false);
  assert.equal(hasDocumentPermission(actor, "documents.download"), false);
  assert.equal(
    canDownloadDocument(
      actor,
      { client_id: ORG_A, owner_user_id: null, uploaded_by: null },
      null
    ),
    false
  );
});

// Test 4 — platform administration itself is untouched.
test("phase7: super admin keeps platform operational permissions", () => {
  const actor = { userId: ADMIN, role: "SUPER_ADMIN" as const, clientId: null };
  assert.equal(hasPermission(actor, P.PLATFORM_CLIENTS_READ), true);
  assert.equal(hasPermission(actor, P.PLATFORM_INTEGRATIONS_DIAGNOSE), true);
  assert.equal(hasPermission(actor, P.SUPPORT_ACCESS_REQUEST), true);
  assert.equal(hasPermission(actor, P.SECURITY_AUDIT_READ), true);
});

// Test 5 — the happy path: correct admin, correct org, correct scope.
test("phase7: active LEADS grant permits lead access for the granted organisation", () => {
  const decision = evaluate("LEADS", grant());
  assert.equal(decision.ok, true);
  assert.ok(decision.ok && decision.expiresInMs > 0);
});

// Test 6 — scopes are not interchangeable.
test("phase7: a LEADS grant does not unlock conversations, documents or quotations", () => {
  const g = grant({ scopes: ["LEADS"] });
  for (const scope of ["CONVERSATIONS", "DOCUMENTS", "QUOTATIONS"] as const) {
    const decision = evaluate(scope, g);
    assert.equal(decision.ok, false, `${scope} must not be permitted`);
    assert.equal(decision.ok === false && decision.code, "SUPPORT_ACCESS_SCOPE_MISSING");
  }
});

// Test 7 — a grant is bound to exactly one organisation.
test("phase7: a grant for organisation A does not cover organisation B", () => {
  const decision = evaluate("LEADS", grant({ clientId: ORG_A }), { clientId: ORG_B });
  assert.equal(decision.ok, false);
  assert.equal(
    decision.ok === false && decision.code,
    "SUPPORT_ACCESS_WRONG_ORGANISATION"
  );
});

// Test 8 — IDOR: the record's own organisation decides, not the request.
test("phase7: swapping a document id to another tenant fails inside an active grant", () => {
  const actor = {
    userId: ADMIN,
    role: "SUPER_ADMIN",
    clientId: null,
    supportAccessScopes: ["DOCUMENTS"] as const,
    supportAccessClientId: ORG_A,
  };
  assert.equal(
    canViewDocument(actor, { client_id: ORG_A, owner_user_id: null, uploaded_by: null }, null),
    true
  );
  assert.equal(
    canViewDocument(actor, { client_id: ORG_B, owner_user_id: null, uploaded_by: null }, null),
    false
  );
});

// Test 9 — expiry is authoritative on the server, even if the row still says ACTIVE.
test("phase7: an expired grant fails even while stored as ACTIVE", () => {
  const stale = grant({
    status: "ACTIVE",
    expiresAt: new Date(NOW - 1_000).toISOString(),
  });
  assert.equal(effectiveGrantStatus(stale, NOW), "EXPIRED");
  assert.equal(grantRemainingMs(stale, NOW), 0);
  const decision = evaluate("LEADS", stale);
  assert.equal(decision.ok, false);
  assert.equal(decision.ok === false && decision.code, "SUPPORT_ACCESS_EXPIRED");
});

// Test 10 — revocation takes effect immediately.
test("phase7: a revoked grant fails immediately", () => {
  const revoked = grant({ revokedAt: new Date(NOW - 1_000).toISOString() });
  assert.equal(effectiveGrantStatus(revoked, NOW), "REVOKED");
  const decision = evaluate("LEADS", revoked);
  assert.equal(decision.ok, false);
  assert.equal(decision.ok === false && decision.code, "SUPPORT_ACCESS_REVOKED");
});

// Test 11 — a grant belongs to one administrator; it is not a shared key.
test("phase7: another administrator cannot ride an existing grant", () => {
  const decision = evaluate("LEADS", grant(), { adminUserId: OTHER_ADMIN });
  assert.equal(decision.ok, false);
  assert.equal(decision.ok === false && decision.code, "SUPPORT_ACCESS_WRONG_ADMIN");
});

// Test 12 — approval states other than ACTIVE never authorise access.
test("phase7: pending, approved and denied grants do not authorise access", () => {
  for (const status of ["PENDING", "APPROVED", "DENIED"] as const) {
    const decision = evaluate("LEADS", grant({ status }));
    assert.equal(decision.ok, false, `${status} must not authorise`);
    assert.equal(
      decision.ok === false && decision.code,
      "SUPPORT_ACCESS_NOT_ACTIVE"
    );
  }
});

// Test 13 — every client-data category maps to an audit event.
test("phase7: each scope maps to a client-data audit event", () => {
  for (const scope of ALL_SUPPORT_ACCESS_SCOPES) {
    const event = scopeAuditEvent(scope);
    assert.ok(
      (CLIENT_DATA_ACCESS_EVENTS as readonly string[]).includes(event),
      `${scope} produced a non client-data event: ${event}`
    );
  }
});

// Test 14 — audit metadata must not carry customer content.
test("phase7: audit metadata strips customer content but keeps identifiers", () => {
  const cleaned = stripCustomerContent({
    conversationId: "conv_8392",
    leadId: "lead_1",
    messageBody: "I want the 5kVA solar system for my house in Borrowdale",
    customerName: "Tawanda Mutasa",
    phone: "+263771234567",
    email: "tawanda@company.co.zw",
    summary: "Customer wants solar",
    failureCode: "TEMPLATE_RENDER_ERROR",
    failedSends: 2,
    nested: { note: "internal sales note", statusCode: 500 },
  });
  assert.equal(cleaned.conversationId, "conv_8392");
  assert.equal(cleaned.leadId, "lead_1");
  assert.equal(cleaned.failureCode, "TEMPLATE_RENDER_ERROR");
  assert.equal(cleaned.failedSends, 2);
  assert.deepEqual(cleaned.nested, { statusCode: 500 });
  for (const key of ["messageBody", "customerName", "phone", "email", "summary"]) {
    assert.equal(key in cleaned, false, `${key} must be stripped`);
  }
  const serialised = JSON.stringify(cleaned);
  assert.equal(serialised.includes("solar"), false);
  assert.equal(serialised.includes("Tawanda"), false);
  assert.equal(serialised.includes("263771234567"), false);
});

// Test 15 — masking happens server-side and never returns the full value.
test("phase7: masked references never contain the full sensitive value", () => {
  assert.equal(maskPhone("+263771234821"), "+263 77***4821");
  assert.equal(maskEmail("tawanda@company.co.zw"), "ta***@company.co.zw");
  assert.equal(maskPersonName("Tawanda Mutasa"), "Ta**** Mu****");

  const ref = maskedContactRef({
    id: "lead_1",
    name: "Tawanda Mutasa",
    phone: "+263771234821",
    email: "tawanda@company.co.zw",
  });
  const serialised = JSON.stringify(ref);
  assert.equal(serialised.includes("771234821"), false);
  assert.equal(serialised.includes("Tawanda"), false);
  assert.equal(serialised.includes("tawanda@"), false);
  assert.equal(ref.masked, true);
  assert.equal(ref.id, "lead_1");
});

// Test 16 — diagnostics describe content without reproducing it.
test("phase7: diagnostics describe content shape instead of content", () => {
  const described = describeContent("I want the 5kVA solar system");
  assert.equal(described, "28 characters (content withheld)");
  assert.equal(described?.includes("solar"), false);
  assert.equal(resourceRef("conversation", "8392abcd-0000-0000-0000-000000000000"), "Conversation #8392abcd");
  assert.equal(describeContent(""), null);
});

// Test 17 — the role profile itself no longer carries client-data permissions.
test("phase7: the super admin profile excludes every client-data permission", () => {
  const base = permissionsForSuperAdmin();
  for (const permission of CLIENT_DATA_PERMISSIONS) {
    assert.equal(
      base.includes(permission),
      false,
      `${permission} must not be implicit for SUPER_ADMIN`
    );
  }
  assert.ok(base.includes(P.PLATFORM_CLIENTS_READ));
});

// Test 18 — grants elevate only the matching categories, and only for reads.
test("phase7: support access elevates only the granted scope's read permissions", () => {
  const leadOnly = permissionsForSupportAccess(["LEADS"]);
  assert.ok(leadOnly.includes(P.LEADS_READ_ALL));
  assert.equal(leadOnly.includes(P.WHATSAPP_READ_ALL), false);
  assert.equal(leadOnly.includes(P.DOCUMENTS_READ), false);

  for (const scope of ALL_SUPPORT_ACCESS_SCOPES) {
    for (const permission of permissionsForSupportAccess([scope])) {
      assert.equal(
        isClientDataPermission(permission),
        true,
        `${permission} is not a client-data permission`
      );
      assert.equal(
        permission === P.CLIENT_DATA_EXPORT,
        false,
        "mass export must never come from an ordinary grant"
      );
    }
  }
});

// Test 19 — a grant does not confer the export permission.
test("phase7: bulk export is a separate permission from support access", () => {
  assert.equal(isClientDataPermission(P.CLIENT_DATA_EXPORT), false);
  const everyScope = permissionsForSupportAccess([...ALL_SUPPORT_ACCESS_SCOPES]);
  assert.equal(everyScope.includes(P.CLIENT_DATA_EXPORT), false);
  assert.equal(everyScope.includes(P.DATA_EXPORT), false);
});

// Test 20 — requests must be meaningful, scoped and time-boxed.
test("phase7: a support access request needs a real reason, a scope and a duration", () => {
  const ok = validateSupportAccessRequest({
    clientId: ORG_A,
    reason: "Investigating why inbound WhatsApp messages are missing from the Sales Hub",
    scopes: ["CONVERSATIONS"],
    durationMinutes: 30,
  });
  assert.equal(ok.ok, true);

  assert.equal(validateSupportAccessRequest({ clientId: "not-a-uuid", reason: "x".repeat(40), scopes: ["LEADS"], durationMinutes: 30 }).ok, false);
  assert.equal(validateSupportAccessRequest({ clientId: ORG_A, reason: "", scopes: ["LEADS"], durationMinutes: 30 }).ok, false);
  assert.equal(validateSupportAccessRequest({ clientId: ORG_A, reason: "a".repeat(SUPPORT_ACCESS_MIN_REASON_LENGTH + 5), scopes: ["LEADS"], durationMinutes: 30 }).ok, false, "padded single-word reasons are rejected");
  assert.equal(validateSupportAccessRequest({ clientId: ORG_A, reason: "Investigating duplicated lead records for this customer", scopes: [], durationMinutes: 30 }).ok, false, "at least one scope is required");
  assert.equal(validateSupportAccessRequest({ clientId: ORG_A, reason: "Investigating duplicated lead records for this customer", scopes: ["LEADS"], durationMinutes: 0 }).ok, false);
});

// Test 21 — no route to permanent access through this mechanism.
test("phase7: duration is capped and break-glass is capped harder", () => {
  const tooLong = validateSupportAccessRequest({
    clientId: ORG_A,
    reason: "Investigating duplicated lead records reported by this customer",
    scopes: ["LEADS"],
    durationMinutes: SUPPORT_ACCESS_MAX_DURATION_MINUTES + 1,
  });
  assert.equal(tooLong.ok, false);

  assert.equal(maxDurationMinutes("SUPPORT"), SUPPORT_ACCESS_MAX_DURATION_MINUTES);
  assert.equal(maxDurationMinutes("BREAK_GLASS"), BREAK_GLASS_MAX_DURATION_MINUTES);
  assert.ok(BREAK_GLASS_MAX_DURATION_MINUTES < SUPPORT_ACCESS_MAX_DURATION_MINUTES);

  const breakGlassTooLong = validateSupportAccessRequest({
    clientId: ORG_A,
    reason: "Active security incident affecting this organisation's messaging",
    scopes: ["CONVERSATIONS"],
    durationMinutes: BREAK_GLASS_MAX_DURATION_MINUTES + 1,
    accessKind: "BREAK_GLASS",
  });
  assert.equal(breakGlassTooLong.ok, false);
});

// Test 22 — scopes arriving from the network are normalised, never trusted.
test("phase7: untrusted scope input is normalised and unknown scopes dropped", () => {
  assert.deepEqual(parseSupportAccessScopes(["LEADS", "leads", "NOT_A_SCOPE"]), ["LEADS"]);
  assert.deepEqual(parseSupportAccessScopes("LEADS"), []);
  assert.deepEqual(parseSupportAccessScopes(null), []);
  assert.deepEqual(parseSupportAccessScopes([{ scope: "LEADS" }]), []);
});

// Test 23 — self-approval is an explicit configured policy, not a silent bypass.
test("phase7: approval mode is explicit configuration", () => {
  assert.equal(resolveApprovalMode("SECOND_ADMIN_REQUIRED"), "SECOND_ADMIN_REQUIRED");
  assert.equal(resolveApprovalMode("CLIENT_APPROVAL"), "CLIENT_APPROVAL");
  assert.equal(resolveApprovalMode(undefined), "SELF_APPROVAL");
  assert.equal(resolveApprovalMode("nonsense"), "SELF_APPROVAL");
  assert.equal(canSelfApprove("SELF_APPROVAL"), true);
  assert.equal(canSelfApprove("SECOND_ADMIN_REQUIRED"), false);
  assert.equal(canSelfApprove("CLIENT_APPROVAL"), false);
});

// Test 24 — impersonation runs as the customer identity, never as elevated staff.
test("phase7: impersonation is evaluated as the target identity, not as platform staff", () => {
  // Impersonation adopts the target user's role, so a SUPER_ADMIN role carrying
  // isImpersonating is a stale/forged state: it must fail closed rather than
  // fall back to either the platform-staff branch or a manager's powers.
  const stale = {
    userId: ADMIN,
    role: "SUPER_ADMIN",
    clientId: ORG_A,
    isImpersonating: true,
    supportAccessScopes: ["DOCUMENTS"] as const,
    supportAccessClientId: ORG_A,
  };
  assert.equal(hasDocumentPermission(stale, "documents.view"), false);
  assert.equal(hasDocumentPermission(stale, "documents.permissions.manage"), false);

  // A real impersonated session carries the customer's own role and tenant, and
  // stays bound to that tenant.
  const impersonated = { userId: ADMIN, role: "CLIENT_MANAGER", clientId: ORG_A, isImpersonating: true };
  assert.equal(
    canViewDocument(impersonated, { client_id: ORG_A, owner_user_id: null, uploaded_by: null }, null),
    true
  );
  assert.equal(
    canViewDocument(impersonated, { client_id: ORG_B, owner_user_id: null, uploaded_by: null }, null),
    false,
    "impersonation is still tenant-bound"
  );
});

// Test 25 — the grant is read-only: no writes to customer data.
test("phase7: a documents grant never confers write or manage permissions", () => {
  const actor = {
    userId: ADMIN,
    role: "SUPER_ADMIN",
    clientId: null,
    supportAccessScopes: ["DOCUMENTS", "FILES"] as const,
    supportAccessClientId: ORG_A,
  };
  assert.equal(hasDocumentPermission(actor, "documents.view"), true);
  assert.equal(hasDocumentPermission(actor, "documents.download"), true);
  for (const permission of [
    "documents.upload",
    "documents.edit",
    "documents.archive",
    "documents.permissions.manage",
    "documents.intelligence.correct",
    "documents.obligations.manage",
    "documents.categories.manage",
    "documents.versions.manage",
    "documents.ask",
  ] as const) {
    assert.equal(
      hasDocumentPermission(actor, permission),
      false,
      `${permission} must stay denied under support access`
    );
  }
});

// Test 26 — the countdown is cosmetic; zero remaining means denied.
test("phase7: the countdown reflects server expiry and never authorises by itself", () => {
  const g = grant({ expiresAt: new Date(NOW + 90_000).toISOString() });
  assert.equal(grantRemainingMs(g, NOW), 90_000);
  assert.equal(formatRemaining(grantRemainingMs(g, NOW)), "01:30");
  assert.equal(formatRemaining(grantRemainingMs(g, NOW + 120_000)), "00:00");
  assert.equal(evaluate("LEADS", g, { nowMs: NOW + 120_000 }).ok, false);
  assert.equal(formatRemaining(-5_000), "00:00");
});

// Test 27 — a grant with no expiry is not an open-ended grant.
test("phase7: a grant missing an expiry is treated as expired", () => {
  const g = grant({ expiresAt: null });
  assert.equal(effectiveGrantStatus(g, NOW), "EXPIRED");
  assert.equal(evaluate("LEADS", g).ok, false);
});

// Test 28 — malformed timestamps fail closed rather than opening access.
test("phase7: an unparseable expiry fails closed", () => {
  const g = grant({ expiresAt: "not-a-date" });
  assert.equal(effectiveGrantStatus(g, NOW), "EXPIRED");
  assert.equal(evaluate("LEADS", g).ok, false);
});

// Test 29 — impersonation is recorded without customer content.
test("phase7: impersonation audit labels stay free of customer content", () => {
  const label = supportAccessEventLabel({
    eventType: "CLIENT_IMPERSONATION_STARTED",
    resourceType: "impersonation",
    resourceId: ADMIN,
    scope: null,
  });
  assert.equal(label, "Customer impersonation started");
  assert.equal(label.includes(ADMIN), false);
});
