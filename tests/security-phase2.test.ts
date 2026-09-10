import assert from "node:assert/strict";
import test from "node:test";
import {
  absoluteTtlMsForRole,
  idleTtlMsForRole,
  ABSOLUTE_TTL_MS,
  IDLE_TTL_MS,
  JWT_MAX_AGE_SEC,
} from "@/lib/auth/session-policy";
import { validateUserSession, type UserSessionRow } from "@/lib/auth/user-sessions";
import { sanitizeEventMetadata } from "@/lib/auth/security-events";
import { validateAuthClaims } from "@/lib/auth/session-validation";

function activeSession(overrides: Partial<UserSessionRow> = {}): UserSessionRow {
  const now = Date.now();
  return {
    id: "11111111-1111-1111-1111-111111111111",
    user_id: "user-1",
    client_id: "client-1",
    session_type: "WEB",
    session_version: 3,
    created_at: new Date(now - 60_000).toISOString(),
    last_seen_at: new Date(now - 60_000).toISOString(),
    expires_at: new Date(now + ABSOLUTE_TTL_MS.STANDARD).toISOString(),
    revoked_at: null,
    revoked_reason: null,
    user_agent: "test",
    device_id: null,
    metadata: {},
    ...overrides,
  };
}

test("TEST policy: standard vs SUPER_ADMIN durations", () => {
  assert.equal(absoluteTtlMsForRole("SALESPERSON"), ABSOLUTE_TTL_MS.STANDARD);
  assert.equal(absoluteTtlMsForRole("CLIENT_MANAGER"), ABSOLUTE_TTL_MS.STANDARD);
  assert.equal(absoluteTtlMsForRole("SUPER_ADMIN"), ABSOLUTE_TTL_MS.SUPER_ADMIN);
  assert.equal(idleTtlMsForRole("SALESPERSON"), IDLE_TTL_MS.STANDARD);
  assert.equal(idleTtlMsForRole("SUPER_ADMIN"), IDLE_TTL_MS.SUPER_ADMIN);
  assert.equal(JWT_MAX_AGE_SEC, Math.floor(ABSOLUTE_TTL_MS.STANDARD / 1000));
});

test("TEST 3: missing session id fails closed", async () => {
  const result = await validateUserSession({
    sessionId: null,
    userId: "user-1",
    sessionVersion: 3,
    role: "SALESPERSON",
    sessionRow: null,
  });
  assert.deepEqual(result, { ok: false, reason: "missing_session_id" });
});

test("TEST 3: nonexistent session fails", async () => {
  const result = await validateUserSession({
    sessionId: "missing",
    userId: "user-1",
    sessionVersion: 3,
    role: "SALESPERSON",
    sessionRow: null,
  });
  assert.deepEqual(result, { ok: false, reason: "session_missing" });
});

test("TEST 4: revoked session fails", async () => {
  const result = await validateUserSession({
    sessionId: "11111111-1111-1111-1111-111111111111",
    userId: "user-1",
    sessionVersion: 3,
    role: "SALESPERSON",
    sessionRow: activeSession({
      revoked_at: new Date().toISOString(),
      revoked_reason: "USER_LOGOUT",
    }),
  });
  assert.deepEqual(result, { ok: false, reason: "session_revoked" });
});

test("TEST 5: absolute expiry fails", async () => {
  const now = Date.now();
  const result = await validateUserSession({
    sessionId: "11111111-1111-1111-1111-111111111111",
    userId: "user-1",
    sessionVersion: 3,
    role: "SALESPERSON",
    nowMs: now,
    sessionRow: activeSession({
      expires_at: new Date(now - 1000).toISOString(),
      last_seen_at: new Date(now - 1000).toISOString(),
    }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "session_expired");
});

test("TEST 6: idle expiry fails", async () => {
  const now = Date.now();
  const result = await validateUserSession({
    sessionId: "11111111-1111-1111-1111-111111111111",
    userId: "user-1",
    sessionVersion: 3,
    role: "SALESPERSON",
    nowMs: now,
    sessionRow: activeSession({
      last_seen_at: new Date(now - IDLE_TTL_MS.STANDARD - 1000).toISOString(),
      expires_at: new Date(now + ABSOLUTE_TTL_MS.STANDARD).toISOString(),
    }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "session_idle");
});

test("TEST 8: logout one session leaves sibling session valid", async () => {
  const a = activeSession({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" });
  const b = activeSession({ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" });
  const checkA = await validateUserSession({
    sessionId: a.id,
    userId: "user-1",
    sessionVersion: 3,
    role: "SALESPERSON",
    sessionRow: { ...a, revoked_at: new Date().toISOString(), revoked_reason: "USER_LOGOUT" },
  });
  const checkB = await validateUserSession({
    sessionId: b.id,
    userId: "user-1",
    sessionVersion: 3,
    role: "SALESPERSON",
    sessionRow: b,
  });
  assert.equal(checkA.ok, false);
  assert.equal(checkB.ok, true);
});

test("TEST 18: session_version mismatch rejects registry row", async () => {
  const result = await validateUserSession({
    sessionId: "11111111-1111-1111-1111-111111111111",
    userId: "user-1",
    sessionVersion: 9,
    role: "SALESPERSON",
    sessionRow: activeSession({ session_version: 3 }),
  });
  assert.deepEqual(result, { ok: false, reason: "session_version_mismatch" });
});

test("TEST 13: role downgrade still fails claim match", async () => {
  const result = await validateAuthClaims(
    {
      userId: "mgr-1",
      role: "CLIENT_MANAGER",
      clientId: "c1",
      alsoSells: false,
      sessionVersion: 2,
      sessionId: "sess-1",
    },
    {
      skipSessionRegistry: true,
      fetchUserById: async () => ({
        id: "mgr-1",
        role: "SALESPERSON",
        client_id: "c1",
        is_active: true,
        session_version: 3,
        also_sells: false,
      }),
    }
  );
  assert.deepEqual(result, { ok: false, reason: "target_mismatch" });
});

test("TEST 20: security event metadata strips secrets", () => {
  const cleaned = sanitizeEventMetadata({
    password: "secret",
    token: "jwt-here",
    reason: "ok",
    accessToken: "EAA",
  });
  assert.equal("password" in cleaned, false);
  assert.equal("token" in cleaned, false);
  assert.equal("accessToken" in cleaned, false);
  assert.equal(cleaned.reason, "ok");
});

test("active session within idle/absolute windows passes", async () => {
  const result = await validateUserSession({
    sessionId: "11111111-1111-1111-1111-111111111111",
    userId: "user-1",
    sessionVersion: 3,
    role: "SALESPERSON",
    sessionRow: activeSession(),
  });
  assert.equal(result.ok, true);
});

test("SUPER_ADMIN idle is stricter than salesperson", async () => {
  const now = Date.now();
  const lastSeen = new Date(now - IDLE_TTL_MS.SUPER_ADMIN - 1000).toISOString();
  const row = activeSession({ last_seen_at: lastSeen });
  const asAdmin = await validateUserSession({
    sessionId: row.id,
    userId: "user-1",
    sessionVersion: 3,
    role: "SUPER_ADMIN",
    nowMs: now,
    sessionRow: row,
  });
  const asRep = await validateUserSession({
    sessionId: row.id,
    userId: "user-1",
    sessionVersion: 3,
    role: "SALESPERSON",
    nowMs: now,
    sessionRow: row,
  });
  assert.equal(asAdmin.ok, false);
  assert.equal(asRep.ok, true);
});

test("claims without sessionId fail closed when registry enabled", async () => {
  const result = await validateAuthClaims(
    {
      userId: "user-1",
      role: "SALESPERSON",
      clientId: "c1",
      alsoSells: false,
      sessionVersion: 1,
    },
    {
      fetchUserById: async () => ({
        id: "user-1",
        role: "SALESPERSON",
        client_id: "c1",
        is_active: true,
        session_version: 1,
        also_sells: false,
      }),
    }
  );
  assert.deepEqual(result, { ok: false, reason: "missing_session_id" });
});
