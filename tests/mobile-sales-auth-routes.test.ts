/**
 * Route-level regression tests for SegmiQ Sales token issuance:
 * POST /api/sales/app/auth and POST /api/auth/mfa/login (action=complete, channel=mobile_sales).
 * Runs against an in-memory PostgREST; no network or real credentials.
 */
import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import bcrypt from "bcryptjs";
import { decodeJwt } from "jose";
import { createFakePostgrest, type FakePostgrest, type Row } from "./helpers/fake-postgrest";

const SUPABASE_URL = "https://fake-project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.NEXTAUTH_SECRET = "test-nextauth-secret-not-real-0123456789";

const PASSWORD = "correct-horse-battery";
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);
const NOW_ISO = () => new Date().toISOString();

function user(id: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    name: `User ${id}`,
    email: `${id}@example.test`,
    password: PASSWORD_HASH,
    role: "SALESPERSON",
    client_id: "org-a",
    is_active: true,
    session_version: 0,
    also_sells: false,
    ...overrides,
  };
}

function org(id: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    name: `Org ${id}`,
    mode: "team",
    is_active: true,
    is_archived: false,
    security_suspended_at: null,
    security_policy: null,
    ...overrides,
  };
}

function seed(): Record<string, Row[]> {
  return {
    users: [
      user("sp-a"),
      user("mgr-nonselling", { role: "CLIENT_MANAGER", also_sells: false }),
      user("mgr-selling", { role: "CLIENT_MANAGER", also_sells: true }),
      user("sp-suspended-org", { client_id: "org-suspended" }),
      user("sp-archived-org", { client_id: "org-archived" }),
      user("sp-no-org", { client_id: null }),
      user("sp-disabled", { is_active: false }),
      user("admin", { role: "SUPER_ADMIN", client_id: null }),
    ],
    clients: [
      org("org-a"),
      org("org-suspended", { security_suspended_at: "2026-10-01T00:00:00Z" }),
      org("org-archived", { is_archived: true }),
    ],
    user_sessions: [],
    user_mfa_methods: [],
    user_mfa_recovery_codes: [],
    user_auth_challenges: [],
    security_events: [],
    security_rate_limits: [],
  };
}

// Fire-and-forget writes (security events) can outlive a test, so fetch stays
// routed to the in-memory database for the whole file instead of being restored.
let activeDb: FakePostgrest | null = null;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  if (!activeDb) throw new Error("fake PostgREST not installed");
  return activeDb.fetch(input, init);
}) as typeof fetch;

function install(_t: TestContext, db: FakePostgrest) {
  activeDb = db;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

let ipCounter = 0;
function loginRequest(body: unknown, ip = `10.0.0.${++ipCounter}`): Request {
  return new Request("https://app.segmiq.test/api/sales/app/auth", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, "user-agent": "SegmiQSales-Android/test" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function salesLogin(db: FakePostgrest, email: string, password = PASSWORD) {
  const { POST } = await import("../app/api/sales/app/auth/route");
  const res = await POST(loginRequest({ email, password, deviceId: "device-1", deviceName: "Pixel" }));
  return { res, body: (await res.json()) as Record<string, unknown>, db };
}

// --- POST /api/sales/app/auth ------------------------------------------------

test("salesperson receives a Sales token bound to a new MOBILE session", async (t) => {
  const db = createFakePostgrest(SUPABASE_URL, seed());
  install(t, db);
  const { res, body } = await salesLogin(db, "sp-a@example.test");
  assert.equal(res.status, 200);
  assert.equal(typeof body.token, "string");
  assert.equal(typeof body.expiresAt, "string");
  const claims = decodeJwt(String(body.token));
  assert.equal(claims.userId, "sp-a");
  assert.equal(claims.clientId, "org-a");
  assert.equal(claims.channel, "sales_app");
  assert.equal(typeof claims.sessionId, "string");
  const sessions = db.inserted("user_sessions");
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].session_type, "MOBILE");
  assert.equal((sessions[0].metadata as Row).channel, "sales_app");
  assert.equal(Date.parse(String(body.expiresAt)) <= Number(claims.exp) * 1000, true);
});

test("non-selling manager is refused before any session or challenge is created", async (t) => {
  const db = createFakePostgrest(SUPABASE_URL, seed());
  install(t, db);
  const { res, body } = await salesLogin(db, "mgr-nonselling@example.test");
  assert.equal(res.status, 403);
  assert.equal(body.code, "INSUFFICIENT_ROLE");
  assert.equal(body.error, "Segmiq Sales is for salesperson and selling manager accounts only.");
  assert.equal(db.inserted("user_sessions").length, 0);
  assert.equal(db.inserted("user_auth_challenges").length, 0);
});

test("platform admin is refused", async (t) => {
  const db = createFakePostgrest(SUPABASE_URL, seed());
  install(t, db);
  const { res, body } = await salesLogin(db, "admin@example.test");
  assert.equal(res.status, 403);
  assert.equal(body.code, "INSUFFICIENT_ROLE");
  assert.equal(db.inserted("user_sessions").length, 0);
});

test("selling manager is accepted", async (t) => {
  const db = createFakePostgrest(SUPABASE_URL, seed());
  install(t, db);
  const { res, body } = await salesLogin(db, "mgr-selling@example.test");
  assert.equal(res.status, 200);
  assert.equal(decodeJwt(String(body.token)).alsoSells, true);
});

test("security-suspended or archived organisation cannot obtain a session", async (t) => {
  const db = createFakePostgrest(SUPABASE_URL, seed());
  install(t, db);
  for (const email of ["sp-suspended-org@example.test", "sp-archived-org@example.test"]) {
    const { res, body } = await salesLogin(db, email);
    assert.equal(res.status, 403, email);
    assert.equal(body.code, "ORGANISATION_SUSPENDED", email);
  }
  assert.equal(db.inserted("user_sessions").length, 0);
});

test("user without an organisation is refused", async (t) => {
  const db = createFakePostgrest(SUPABASE_URL, seed());
  install(t, db);
  const { res, body } = await salesLogin(db, "sp-no-org@example.test");
  assert.equal(res.status, 403);
  assert.equal(body.code, "NO_ORGANISATION");
  assert.equal(body.error, "Your account is not linked to a client.");
});

test("wrong password and disabled account both answer INVALID_CREDENTIALS (no enumeration)", async (t) => {
  const db = createFakePostgrest(SUPABASE_URL, seed());
  install(t, db);
  const wrong = await salesLogin(db, "sp-a@example.test", "wrong-password");
  assert.equal(wrong.res.status, 401);
  assert.equal(wrong.body.code, "INVALID_CREDENTIALS");
  assert.equal(wrong.body.error, "Unauthorized");
  const disabled = await salesLogin(db, "sp-disabled@example.test");
  assert.equal(disabled.res.status, 401);
  assert.equal(disabled.body.code, "INVALID_CREDENTIALS");
  assert.equal(db.inserted("user_sessions").length, 0);
});

test("database outage answers 503 SERVICE_UNAVAILABLE instead of 500", async (t) => {
  const db = createFakePostgrest(SUPABASE_URL, seed());
  db.failingTables.add("users");
  install(t, db);
  const { res, body } = await salesLogin(db, "sp-a@example.test");
  assert.equal(res.status, 503);
  assert.equal(body.code, "SERVICE_UNAVAILABLE");
});

test("rate limit answers 429 RATE_LIMITED", async (t) => {
  const { hashLoginIdentifier } = await import("../lib/auth/security-events");
  const ip = "10.9.9.9";
  const emailHash = await hashLoginIdentifier("sp-a@example.test");
  const data = seed();
  data.security_rate_limits = [
    { key: `mobile-sales-login:${emailHash}:${ip}`, count: 10, window_start: NOW_ISO() },
  ];
  const db = createFakePostgrest(SUPABASE_URL, data);
  install(t, db);
  const { POST } = await import("../app/api/sales/app/auth/route");
  const res = await POST(loginRequest({ email: "sp-a@example.test", password: PASSWORD }, ip));
  const body = (await res.json()) as Row;
  assert.equal(res.status, 429);
  assert.equal(body.code, "RATE_LIMITED");
});

test("invalid JSON keeps the legacy error string and adds INVALID_REQUEST", async (t) => {
  const db = createFakePostgrest(SUPABASE_URL, seed());
  install(t, db);
  const { POST } = await import("../app/api/sales/app/auth/route");
  const res = await POST(loginRequest("{not json"));
  const body = (await res.json()) as Row;
  assert.equal(res.status, 400);
  assert.equal(body.error, "Invalid JSON");
  assert.equal(body.code, "INVALID_REQUEST");
});

test("MFA-enabled salesperson gets a challenge and no session", async (t) => {
  const data = seed();
  data.user_mfa_methods = [{ id: "m1", user_id: "sp-a", type: "TOTP", status: "active", secret_encrypted: {} }];
  const db = createFakePostgrest(SUPABASE_URL, data);
  install(t, db);
  const { res, body } = await salesLogin(db, "sp-a@example.test");
  assert.equal(res.status, 200);
  assert.equal(body.mfaRequired, true);
  assert.equal(typeof body.challengeToken, "string");
  assert.equal(body.token, undefined);
  assert.equal(db.inserted("user_sessions").length, 0);
});

test("org MFA policy marks the Sales session restricted and the token carries the flag", async (t) => {
  const data = seed();
  data.clients = data.clients.map((c) =>
    c.id === "org-a" ? { ...c, security_policy: { mfaRequirement: "all" } } : c
  );
  const db = createFakePostgrest(SUPABASE_URL, data);
  install(t, db);
  const { res, body } = await salesLogin(db, "sp-a@example.test");
  assert.equal(res.status, 200);
  assert.equal(body.mfaEnrolmentRequired, true);
  const claims = decodeJwt(String(body.token));
  assert.equal(claims.mfaEnrolmentRequired, true);
  assert.equal(claims.channel, "sales_app");
  assert.equal((db.inserted("user_sessions")[0].metadata as Row).restricted, true);
});

// --- POST /api/auth/mfa/login (complete, mobile_sales) -----------------------

async function seedChallenge(data: Record<string, Row[]>, userId: string) {
  const { hashChallengeToken, hashRecoveryCode } = await import("../lib/auth/mfa/recovery-codes");
  const challengeToken = `challenge-${userId}-token`;
  const recoveryCode = "ABCD-EFGH-IJ";
  data.user_auth_challenges.push({
    id: `ch-${userId}`,
    user_id: userId,
    purpose: "login",
    token_hash: await hashChallengeToken(challengeToken),
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    consumed_at: null,
    attempt_count: 0,
    max_attempts: 5,
  });
  data.user_mfa_recovery_codes.push({
    id: `rc-${userId}`,
    user_id: userId,
    code_hash: await hashRecoveryCode(recoveryCode, userId),
    used_at: null,
  });
  return { challengeId: `ch-${userId}`, challengeToken, recoveryCode };
}

async function mfaComplete(body: Record<string, unknown>) {
  const { POST } = await import("../app/api/auth/mfa/login/route");
  const res = await POST(
    new Request("https://app.segmiq.test/api/auth/mfa/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.1.0.${++ipCounter}` },
      body: JSON.stringify({ action: "complete", ...body }),
    })
  );
  return { res, body: (await res.json()) as Row };
}

test("MFA completion refuses a non-selling manager on the mobile_sales channel", async (t) => {
  const data = seed();
  const ch = await seedChallenge(data, "mgr-nonselling");
  const db = createFakePostgrest(SUPABASE_URL, data);
  install(t, db);
  const { res, body } = await mfaComplete({ ...ch, channel: "mobile_sales" });
  assert.equal(res.status, 403);
  assert.equal(body.code, "INSUFFICIENT_ROLE");
  assert.equal(body.token, undefined);
  assert.equal(db.inserted("user_sessions").length, 0);
  await settle();
  const failed = db.inserted("security_events").filter((e) => e.event_type === "LOGIN_FAILED");
  assert.equal(failed.length >= 1, true);
});

test("MFA completion refuses a salesperson whose organisation is suspended", async (t) => {
  const data = seed();
  const ch = await seedChallenge(data, "sp-suspended-org");
  const db = createFakePostgrest(SUPABASE_URL, data);
  install(t, db);
  const { res, body } = await mfaComplete({ ...ch, channel: "mobile_sales" });
  assert.equal(res.status, 403);
  assert.equal(body.code, "ORGANISATION_SUSPENDED");
  assert.equal(db.inserted("user_sessions").length, 0);
});

test("MFA completion issues a Sales token for an eligible salesperson", async (t) => {
  const data = seed();
  const ch = await seedChallenge(data, "sp-a");
  const db = createFakePostgrest(SUPABASE_URL, data);
  install(t, db);
  const { res, body } = await mfaComplete({ ...ch, channel: "mobile_sales" });
  assert.equal(res.status, 200);
  const claims = decodeJwt(String(body.token));
  assert.equal(claims.userId, "sp-a");
  assert.equal(claims.channel, "sales_app");
  assert.equal(typeof body.expiresAt, "string");
  const sessions = db.inserted("user_sessions");
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].auth_strength, "password_mfa");
  assert.equal(typeof sessions[0].mfa_verified_at, "string");
});

test("MFA completion with a wrong code answers MFA_VERIFICATION_FAILED", async (t) => {
  const data = seed();
  const ch = await seedChallenge(data, "sp-a");
  const db = createFakePostgrest(SUPABASE_URL, data);
  install(t, db);
  const { res, body } = await mfaComplete({ ...ch, recoveryCode: "ZZZZ-ZZZZ-ZZ", channel: "mobile_sales" });
  assert.equal(res.status, 401);
  assert.equal(body.error, "Verification failed");
  assert.equal(body.code, "MFA_VERIFICATION_FAILED");
  assert.equal(body.reason, "invalid_code");
  assert.equal(db.inserted("user_sessions").length, 0);
});

test("mobile_cloud MFA completion is unchanged (no Sales eligibility, no Sales channel claim)", async (t) => {
  const data = seed();
  const ch = await seedChallenge(data, "mgr-nonselling");
  const db = createFakePostgrest(SUPABASE_URL, data);
  install(t, db);
  const { res, body } = await mfaComplete({ ...ch, channel: "mobile_cloud" });
  assert.equal(res.status, 200);
  const claims = decodeJwt(String(body.token));
  assert.equal(claims.channel, undefined);
  assert.equal(body.expiresAt, undefined);
});
