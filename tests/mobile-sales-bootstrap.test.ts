/**
 * GET /api/sales/app/bootstrap — experience resolution, tenant isolation,
 * role refusal, subscription state and session failures.
 * Runs against an in-memory PostgREST; no network or real credentials.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { SignJWT } from "jose";
import { createFakePostgrest, type FakePostgrest, type Row } from "./helpers/fake-postgrest";
import { resolveSalesExperience } from "../lib/mobile/sales-app/experience";
import type { ApiAuth, ApiAuthResolution } from "../lib/auth/resolveApiAuth";
import type { SalesAppBootstrapV1 } from "../lib/mobile/sales-app/bootstrap";

const SUPABASE_URL = "https://fake-project.supabase.co";
const SECRET = "test-nextauth-secret-not-real-0123456789";
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.NEXTAUTH_SECRET = SECRET;

let activeDb: FakePostgrest | null = null;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  if (!activeDb) throw new Error("fake PostgREST not installed");
  return activeDb.fetch(input, init);
}) as typeof fetch;

const NOW = () => new Date().toISOString();
const IN_ONE_DAY = () => new Date(Date.now() + 86_400_000).toISOString();

function seed(): Record<string, Row[]> {
  return {
    users: [
      { id: "sp-a", name: "Alice", role: "SALESPERSON", client_id: "org-a", is_active: true, session_version: 0, also_sells: false, avatar_url: null },
      { id: "sp-b", name: "Bob", role: "SALESPERSON", client_id: "org-b", is_active: true, session_version: 0, also_sells: false, avatar_url: null },
      { id: "mgr-a", name: "Mia", role: "CLIENT_MANAGER", client_id: "org-a", is_active: true, session_version: 0, also_sells: true, avatar_url: null },
      { id: "mgr-ns", name: "Nora", role: "CLIENT_MANAGER", client_id: "org-a", is_active: true, session_version: 0, also_sells: false, avatar_url: null },
      { id: "sp-solo", name: "Sol", role: "SALESPERSON", client_id: "org-solo", is_active: true, session_version: 0, also_sells: false, avatar_url: null },
      { id: "sp-re", name: "Rae", role: "SALESPERSON", client_id: "org-re", is_active: true, session_version: 0, also_sells: false, avatar_url: null },
      { id: "sp-solar", name: "Sunny", role: "SALESPERSON", client_id: "org-solar", is_active: true, session_version: 0, also_sells: false, avatar_url: null },
      { id: "sp-off", name: "Off", role: "SALESPERSON", client_id: "org-a", is_active: false, session_version: 0, also_sells: false, avatar_url: null },
      { id: "sp-locked", name: "Lock", role: "SALESPERSON", client_id: "org-locked", is_active: true, session_version: 0, also_sells: false, avatar_url: null },
    ],
    clients: [
      { id: "org-a", name: "Alpha Trades", mode: "team", business_type: "trades", sales_workflow_preset: "GENERAL_TRADES", assignment_mode: "round_robin", is_active: true, is_archived: false, security_suspended_at: null, country: "ZW", dial_code: "263", response_time_limit_hours: 4, workspace_mode: "production", owner_email: "owner@alpha.test", stripe_customer_id: "cus_hidden" },
      { id: "org-b", name: "Bravo Solar", mode: "team", business_type: "trades", sales_workflow_preset: "SOLAR_INSTALLATION", assignment_mode: "pool", is_active: true, is_archived: false, security_suspended_at: null },
      { id: "org-solo", name: "Solo Co", mode: "solo", business_type: "trades", sales_workflow_preset: "GENERAL_TRADES", is_active: true, is_archived: false, security_suspended_at: null },
      { id: "org-re", name: "Realty", mode: "team", business_type: "real_estate", sales_workflow_preset: "SOLAR_INSTALLATION", is_active: true, is_archived: false, security_suspended_at: null },
      { id: "org-solar", name: "Sunpower", mode: "team", business_type: "trades", sales_workflow_preset: "SOLAR_INSTALLATION", workspace_mode: "demo", is_active: true, is_archived: false, security_suspended_at: null },
      { id: "org-locked", name: "Locked", mode: "team", business_type: "trades", is_active: true, is_archived: false, security_suspended_at: "2026-10-01T00:00:00Z" },
    ],
    user_sessions: [],
    user_mfa_methods: [],
    subscriptions: [],
    invoices: [],
    platform_grace_periods: [],
    client_marketing_settings: [],
    agency_settings: [],
    quotation_settings: [],
  };
}

function session(id: string, userId: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    user_id: userId,
    session_type: "MOBILE",
    session_version: 0,
    revoked_at: null,
    expires_at: IN_ONE_DAY(),
    last_seen_at: NOW(),
    metadata: { channel: "sales_app" },
    auth_strength: "password",
    mfa_verified_at: null,
    ...overrides,
  };
}

function authFor(row: Row, extra: Partial<ApiAuth> = {}): ApiAuth {
  return {
    userId: String(row.id),
    role: row.role as ApiAuth["role"],
    clientId: (row.client_id as string | null) ?? null,
    alsoSells: Boolean(row.also_sells),
    sessionId: `sess-${row.id}`,
    sessionVersion: 0,
    ...extra,
  };
}

function userRow(data: Record<string, Row[]>, id: string): Row {
  const row = data.users.find((u) => u.id === id);
  assert.ok(row, id);
  return row;
}

async function bootstrapAs(
  data: Record<string, Row[]>,
  auth: ApiAuthResolution,
  url = "https://app.segmiq.test/api/sales/app/bootstrap"
) {
  const db = createFakePostgrest(SUPABASE_URL, data);
  activeDb = db;
  const { handleSalesAppBootstrap, loadSalesAppBootstrapSource } = await import("../lib/mobile/sales-app/bootstrap");
  let loaderCalls = 0;
  const res = await handleSalesAppBootstrap(new Request(url), {
    resolveAuth: async () => auth,
    loadSource: (actor) => {
      loaderCalls += 1;
      return loadSalesAppBootstrapSource(actor);
    },
    now: () => new Date("2026-10-30T08:00:00Z"),
  });
  return { res, body: (await res.json()) as Record<string, unknown>, db, loaderCalls };
}

function ok(auth: ApiAuth, tokenExpiresAt: number | null = null): ApiAuthResolution {
  return { ok: true, auth, tokenExpiresAt };
}

// --- Experience precedence (pure) --------------------------------------------

test("experience precedence: real estate beats solar, solar beats general", () => {
  assert.equal(
    resolveSalesExperience({ role: "SALESPERSON", clientMode: "team", businessType: "real_estate", salesWorkflowPreset: "SOLAR_INSTALLATION" }).id,
    "REAL_ESTATE"
  );
  const solar = resolveSalesExperience({ role: "SALESPERSON", clientMode: "team", businessType: "trades", salesWorkflowPreset: "SOLAR_INSTALLATION" });
  assert.equal(solar.id, "SOLAR");
  assert.equal(solar.resolvedBy, "SALES_WORKFLOW_PRESET");
  const general = resolveSalesExperience({ role: "SALESPERSON", clientMode: "team", businessType: "trades", salesWorkflowPreset: "GENERAL_TRADES" });
  assert.equal(general.id, "GENERAL");
  assert.equal(general.resolvedBy, "DEFAULT");
  assert.equal(
    resolveSalesExperience({ role: "SALESPERSON", clientMode: null, businessType: null, salesWorkflowPreset: "nonsense" }).id,
    "GENERAL"
  );
});

test("solo home variant only applies to a salesperson in a solo organisation", () => {
  const base = { businessType: "trades", salesWorkflowPreset: "GENERAL_TRADES" };
  assert.equal(resolveSalesExperience({ ...base, role: "SALESPERSON", clientMode: "solo" }).homeVariant, "SOLO");
  assert.equal(resolveSalesExperience({ ...base, role: "CLIENT_MANAGER", clientMode: "solo" }).homeVariant, "TEAM");
  assert.equal(resolveSalesExperience({ ...base, role: "SALESPERSON", clientMode: "team" }).homeVariant, "TEAM");
  const soloRe = resolveSalesExperience({ role: "SALESPERSON", clientMode: "solo", businessType: "real_estate", salesWorkflowPreset: null });
  assert.equal(soloRe.homeVariant, "SOLO");
  assert.equal(soloRe.id, "REAL_ESTATE");
});

// --- Handler: tenant isolation and roles ------------------------------------

test("salesperson receives only their own organisation, whatever the query string says", async () => {
  const data = seed();
  data.user_sessions.push(session("sess-sp-a", "sp-a"));
  const { res, body, db } = await bootstrapAs(
    data,
    ok(authFor(userRow(data, "sp-a"))),
    "https://app.segmiq.test/api/sales/app/bootstrap?clientId=org-b&userId=sp-b&organisationId=org-b"
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const b = body as unknown as SalesAppBootstrapV1;
  assert.equal(b.schemaVersion, 1);
  assert.equal(b.user.id, "sp-a");
  assert.equal(b.organisation.id, "org-a");
  assert.equal(b.organisation.name, "Alpha Trades");
  for (const req of db.requests) {
    const q = decodeURIComponent(req.url.search);
    assert.equal(q.includes("org-b"), false, `query leaked org-b: ${req.table}${q}`);
    assert.equal(q.includes("sp-b"), false, `query leaked sp-b: ${req.table}${q}`);
  }
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes("owner@alpha.test"), false, "owner_email must not be exposed");
  assert.equal(serialized.includes("cus_hidden"), false, "billing ids must not be exposed");
});

test("salesperson B gets organisation B's (solar) configuration, never A's", async () => {
  const data = seed();
  const { res, body } = await bootstrapAs(data, ok(authFor(userRow(data, "sp-b"))));
  assert.equal(res.status, 200);
  const b = body as unknown as SalesAppBootstrapV1;
  assert.equal(b.organisation.id, "org-b");
  assert.equal(b.experience.id, "SOLAR");
  assert.equal(b.capabilities.restrictions.leadVisibility, "ASSIGNED_AND_UNASSIGNED");
});

test("non-selling manager is refused without loading organisation data", async () => {
  const data = seed();
  const { res, body, loaderCalls } = await bootstrapAs(data, ok(authFor(userRow(data, "mgr-ns"))));
  assert.equal(res.status, 403);
  assert.equal(body.code, "INSUFFICIENT_ROLE");
  assert.equal(loaderCalls, 0);
});

test("platform admin, impersonation and demo guest sessions are refused", async () => {
  const data = seed();
  const admin = await bootstrapAs(data, ok({ userId: "sa", role: "SUPER_ADMIN", clientId: "org-a", alsoSells: true }));
  assert.equal(admin.res.status, 403);
  assert.equal(admin.body.code, "INSUFFICIENT_ROLE");
  const imp = await bootstrapAs(data, ok(authFor(userRow(data, "sp-a"), { isImpersonating: true })));
  assert.equal(imp.body.code, "UNSUPPORTED_SESSION");
  const guest = await bootstrapAs(data, ok(authFor(userRow(data, "sp-a"), { demoGuest: true })));
  assert.equal(guest.body.code, "UNSUPPORTED_SESSION");
  assert.equal(imp.loaderCalls + guest.loaderCalls + admin.loaderCalls, 0);
});

test("selling manager is accepted with organisation-wide lead visibility", async () => {
  const data = seed();
  const { res, body } = await bootstrapAs(data, ok(authFor(userRow(data, "mgr-a"))));
  assert.equal(res.status, 200);
  const b = body as unknown as SalesAppBootstrapV1;
  assert.equal(b.user.role, "CLIENT_MANAGER");
  assert.equal(b.user.alsoSells, true);
  assert.equal(b.capabilities.restrictions.leadVisibility, "ORGANISATION");
  assert.equal(b.capabilities.restrictions.canManageCompanyProfile, true);
});

test("salesperson capabilities never include company-profile management", async () => {
  const data = seed();
  const { body } = await bootstrapAs(data, ok(authFor(userRow(data, "sp-a"))));
  const b = body as unknown as SalesAppBootstrapV1;
  assert.equal(b.capabilities.restrictions.canManageCompanyProfile, false);
  assert.equal(b.capabilities.restrictions.leadModification, "ASSIGNED_ONLY");
  assert.equal(b.capabilities.restrictions.leadVisibility, "ASSIGNED_ONLY");
});

// --- Handler: experiences ---------------------------------------------------

test("real estate, solar and general organisations resolve to their experiences", async () => {
  const data = seed();
  const re = (await bootstrapAs(data, ok(authFor(userRow(data, "sp-re"))))).body as unknown as SalesAppBootstrapV1;
  assert.equal(re.experience.id, "REAL_ESTATE");
  assert.equal(re.experience.resolvedBy, "BUSINESS_TYPE");
  assert.equal(re.salesConfiguration.pipeline.model, "REAL_ESTATE_STAGE");
  assert.equal(re.capabilities.featureFlags.realEstateWorkflow, true);
  assert.equal(re.capabilities.featureFlags.solarWorkflow, false);
  assert.ok(re.navigation.destinations.some((d) => d.id === "LISTINGS"));

  const solar = (await bootstrapAs(data, ok(authFor(userRow(data, "sp-solar"))))).body as unknown as SalesAppBootstrapV1;
  assert.equal(solar.experience.id, "SOLAR");
  assert.equal(solar.salesConfiguration.pipeline.model, "SOLAR_SALES_STAGE");
  assert.equal(solar.capabilities.featureFlags.solarWorkflow, true);
  assert.equal(solar.capabilities.featureFlags.demoWorkspace, true);
  assert.equal(solar.organisation.workspaceMode, "demo");
  assert.ok(solar.navigation.destinations.some((d) => d.id === "PROJECTS"));
  assert.equal(solar.navigation.destinations.some((d) => d.id === "LISTINGS"), false);

  const general = (await bootstrapAs(data, ok(authFor(userRow(data, "sp-a"))))).body as unknown as SalesAppBootstrapV1;
  assert.equal(general.experience.id, "GENERAL");
  assert.equal(general.salesConfiguration.pipeline.model, "DEAL_STAGE");
  assert.equal(general.navigation.destinations.some((d) => d.id === "PROJECTS"), false);
  assert.equal(general.navigation.home, "DASHBOARD");
  assert.ok(general.navigation.primary.every((id) => general.navigation.destinations.some((d) => d.id === id)));
});

test("solo salesperson keeps the solo home variant and solo dashboard", async () => {
  const data = seed();
  const { body } = await bootstrapAs(data, ok(authFor(userRow(data, "sp-solo"))));
  const b = body as unknown as SalesAppBootstrapV1;
  assert.equal(b.experience.homeVariant, "SOLO");
  assert.equal(b.organisation.clientMode, "solo");
  const dashboard = b.navigation.destinations.find((d) => d.id === "DASHBOARD");
  assert.equal(dashboard?.webPath, "/solo/dashboard");
});

// --- Handler: configuration honesty -----------------------------------------

test("currency and time zone are null/default when not configured, real values when set", async () => {
  const data = seed();
  const bare = (await bootstrapAs(data, ok(authFor(userRow(data, "sp-a"))))).body as unknown as SalesAppBootstrapV1;
  assert.deepEqual(bare.salesConfiguration.currency, { quotationDefault: null, supported: [], source: "NOT_CONFIGURED" });
  assert.equal(bare.salesConfiguration.timeZone.configured, null);
  assert.equal(bare.salesConfiguration.timeZone.source, "PLATFORM_DEFAULT");
  assert.equal(typeof bare.salesConfiguration.timeZone.effective, "string");
  assert.equal(bare.capabilities.restrictions.quotationMarginVisibleToSalespeople, null);

  data.client_marketing_settings.push({ client_id: "org-a", timezone: "Africa/Johannesburg" });
  data.quotation_settings.push({
    client_id: "org-a",
    default_currency: "ZAR",
    supported_currencies: ["ZAR", "USD"],
    salesperson_can_see_margin: false,
    salesperson_can_see_cost: true,
  });
  const set = (await bootstrapAs(data, ok(authFor(userRow(data, "sp-a"))))).body as unknown as SalesAppBootstrapV1;
  assert.deepEqual(set.salesConfiguration.currency, {
    quotationDefault: "ZAR",
    supported: ["ZAR", "USD"],
    source: "QUOTATION_SETTINGS",
  });
  assert.equal(set.salesConfiguration.timeZone.configured, "Africa/Johannesburg");
  assert.equal(set.salesConfiguration.timeZone.effective, "Africa/Johannesburg");
  assert.equal(set.salesConfiguration.timeZone.source, "ORGANISATION");
  assert.equal(set.capabilities.restrictions.quotationMarginVisibleToSalespeople, false);
});

test("session expiry is the earlier of the session row and the token", async () => {
  const data = seed();
  const rowExpiry = new Date(Date.now() + 3_600_000).toISOString();
  data.user_sessions.push(session("sess-sp-a", "sp-a", { expires_at: rowExpiry }));
  const tokenExp = Date.now() + 7_200_000;
  const { body } = await bootstrapAs(data, ok(authFor(userRow(data, "sp-a")), tokenExp));
  const b = body as unknown as SalesAppBootstrapV1;
  assert.equal(b.session.expiresAt, rowExpiry);
  assert.equal(b.session.sessionType, "MOBILE");
  assert.equal(b.session.refreshSupported, false);
});

// --- Handler: subscription --------------------------------------------------

test("suspended subscription: bootstrap still answers, sales access BLOCKED, no destinations", async () => {
  const data = seed();
  data.subscriptions.push({ client_id: "org-a", product: "crm", status: "suspended" });
  const { res, body } = await bootstrapAs(data, ok(authFor(userRow(data, "sp-a"))));
  assert.equal(res.status, 200);
  const b = body as unknown as SalesAppBootstrapV1;
  assert.equal(b.subscription.status, "SUSPENDED");
  assert.equal(b.subscription.salesAccess, "BLOCKED");
  assert.equal(b.capabilities.restrictions.salesOperations, "BLOCKED");
  assert.deepEqual(b.navigation.destinations, []);
  assert.deepEqual(b.capabilities.modules, []);
});

test("active / past_due subscription keeps sales access", async () => {
  for (const status of ["active", "past_due"]) {
    const data = seed();
    data.subscriptions.push({ client_id: "org-a", product: "crm", status, grace_days: 7 });
    const b = (await bootstrapAs(data, ok(authFor(userRow(data, "sp-a"))))).body as unknown as SalesAppBootstrapV1;
    assert.equal(b.subscription.salesAccess, "ALLOWED", status);
    assert.equal(b.subscription.status, status === "active" ? "ACTIVE" : "PAST_DUE");
  }
});

// --- Handler: auth failure mapping ------------------------------------------

test("auth failures map to stable mobile codes", async () => {
  const data = seed();
  const cases: [Parameters<typeof bootstrapAs>[1], number, string][] = [
    [{ ok: false, reason: "no_credentials" }, 401, "TOKEN_INVALID"],
    [{ ok: false, reason: "token_invalid" }, 401, "TOKEN_INVALID"],
    [{ ok: false, reason: "token_expired" }, 401, "TOKEN_EXPIRED"],
    [{ ok: false, reason: "session_revoked" }, 401, "SESSION_REVOKED"],
    [{ ok: false, reason: "session_version_mismatch" }, 401, "SESSION_REVOKED"],
    [{ ok: false, reason: "session_idle" }, 401, "SESSION_EXPIRED"],
    [{ ok: false, reason: "target_inactive" }, 401, "ACCOUNT_DISABLED"],
    [{ ok: false, reason: "client_security_suspended" }, 403, "ORGANISATION_SUSPENDED"],
    [{ ok: false, reason: "mfa_required" }, 403, "MFA_REQUIRED"],
    [{ ok: false, reason: "mfa_enrolment_required" }, 403, "MFA_ENROLMENT_REQUIRED"],
    [{ ok: false, reason: "auth_unavailable" }, 503, "SERVICE_UNAVAILABLE"],
  ];
  for (const [resolution, status, code] of cases) {
    const { res, body, loaderCalls } = await bootstrapAs(data, resolution);
    assert.equal(res.status, status, code);
    assert.equal(body.code, code);
    assert.equal(loaderCalls, 0);
  }
});

// --- Bearer path end-to-end (real token verification + session registry) ----

async function bearerBootstrap(data: Record<string, Row[]>, token: string) {
  const db = createFakePostgrest(SUPABASE_URL, data);
  activeDb = db;
  const { handleSalesAppBootstrap, loadSalesAppBootstrapSource } = await import("../lib/mobile/sales-app/bootstrap");
  const { verifyBearerTokenDetailed } = await import("../lib/auth/resolveApiAuth");
  const res = await handleSalesAppBootstrap(
    new Request("https://app.segmiq.test/api/sales/app/bootstrap", {
      headers: { authorization: `Bearer ${token}`, "user-agent": "SegmiQSales-Android/test" },
    }),
    { resolveAuth: verifyBearerTokenDetailed, loadSource: (actor) => loadSalesAppBootstrapSource(actor) }
  );
  return { res, body: (await res.json()) as Record<string, unknown>, db };
}

async function salesToken(userId: string, clientId: string, opts: { expSec?: number; secret?: string; role?: string; alsoSells?: boolean } = {}) {
  return new SignJWT({
    userId,
    role: opts.role ?? "SALESPERSON",
    clientId,
    alsoSells: opts.alsoSells ?? false,
    sessionVersion: 0,
    sessionId: `sess-${userId}`,
    channel: "sales_app",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(opts.expSec ?? Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(opts.secret ?? SECRET));
}

test("Bearer: valid Sales token bootstraps", async () => {
  const data = seed();
  data.user_sessions.push(session("sess-sp-a", "sp-a"));
  const { res, body } = await bearerBootstrap(data, await salesToken("sp-a", "org-a"));
  assert.equal(res.status, 200);
  assert.equal((body as unknown as SalesAppBootstrapV1).organisation.id, "org-a");
});

test("Bearer: revoked session is refused with SESSION_REVOKED", async () => {
  const data = seed();
  data.user_sessions.push(session("sess-sp-a", "sp-a", { revoked_at: NOW() }));
  const { res, body } = await bearerBootstrap(data, await salesToken("sp-a", "org-a"));
  assert.equal(res.status, 401);
  assert.equal(body.code, "SESSION_REVOKED");
});

test("Bearer: missing session row and bumped session_version are refused", async () => {
  const data = seed();
  const missing = await bearerBootstrap(data, await salesToken("sp-a", "org-a"));
  assert.equal(missing.body.code, "SESSION_REVOKED");

  const bumped = seed();
  bumped.users = bumped.users.map((u) => (u.id === "sp-a" ? { ...u, session_version: 3 } : u));
  bumped.user_sessions.push(session("sess-sp-a", "sp-a"));
  const res = await bearerBootstrap(bumped, await salesToken("sp-a", "org-a"));
  assert.equal(res.body.code, "SESSION_REVOKED");
});

test("Bearer: expired token is TOKEN_EXPIRED, forged token is TOKEN_INVALID", async () => {
  const data = seed();
  data.user_sessions.push(session("sess-sp-a", "sp-a"));
  const expired = await bearerBootstrap(data, await salesToken("sp-a", "org-a", { expSec: Math.floor(Date.now() / 1000) - 60 }));
  assert.equal(expired.res.status, 401);
  assert.equal(expired.body.code, "TOKEN_EXPIRED");
  const forged = await bearerBootstrap(data, await salesToken("sp-a", "org-a", { secret: "attacker-secret-0123456789abcdef" }));
  assert.equal(forged.res.status, 401);
  assert.equal(forged.body.code, "TOKEN_INVALID");
});

test("Bearer: token claiming organisation B for a user of organisation A is refused", async () => {
  const data = seed();
  data.user_sessions.push(session("sess-sp-a", "sp-a"));
  const { res, body } = await bearerBootstrap(data, await salesToken("sp-a", "org-b"));
  assert.equal(res.status, 401);
  assert.equal(body.code, "SESSION_REVOKED");
});

test("Bearer: disabled user and security-suspended organisation are refused", async () => {
  const data = seed();
  data.user_sessions.push(session("sess-sp-off", "sp-off"), session("sess-sp-locked", "sp-locked"));
  const off = await bearerBootstrap(data, await salesToken("sp-off", "org-a"));
  assert.equal(off.body.code, "ACCOUNT_DISABLED");
  const locked = await bearerBootstrap(data, await salesToken("sp-locked", "org-locked"));
  assert.equal(locked.res.status, 403);
  assert.equal(locked.body.code, "ORGANISATION_SUSPENDED");
});

test("Bearer: non-selling manager token is refused even with a valid session", async () => {
  const data = seed();
  data.user_sessions.push(session("sess-mgr-ns", "mgr-ns"));
  const { res, body } = await bearerBootstrap(
    data,
    await salesToken("mgr-ns", "org-a", { role: "CLIENT_MANAGER", alsoSells: false })
  );
  assert.equal(res.status, 403);
  assert.equal(body.code, "INSUFFICIENT_ROLE");
});

test("Bearer: database outage answers 503 SERVICE_UNAVAILABLE", async () => {
  const data = seed();
  data.user_sessions.push(session("sess-sp-a", "sp-a"));
  const db = createFakePostgrest(SUPABASE_URL, data);
  db.failingTables.add("users");
  activeDb = db;
  const { handleSalesAppBootstrap } = await import("../lib/mobile/sales-app/bootstrap");
  const { verifyBearerTokenDetailed } = await import("../lib/auth/resolveApiAuth");
  const res = await handleSalesAppBootstrap(
    new Request("https://app.segmiq.test/api/sales/app/bootstrap", {
      headers: { authorization: `Bearer ${await salesToken("sp-a", "org-a")}` },
    }),
    { resolveAuth: verifyBearerTokenDetailed, loadSource: async () => { throw new Error("unreachable"); } }
  );
  assert.equal(res.status, 503);
  assert.equal(((await res.json()) as Row).code, "SERVICE_UNAVAILABLE");
});
