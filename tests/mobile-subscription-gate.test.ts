import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import {
  clearSubscriptionGateCaches,
  evaluateSalesAppSubscriptionGate,
  isSalesAppBearer,
  isSubscriptionGateExemptPath,
  userSessionChannelQuery,
} from "../lib/mobile/sales-app/subscription-gate";
import type { MiddlewareFetch } from "../lib/supabase/middleware-admin";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake-project.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

type Calls = { subscriptions: number; invoices: number; sessions: number; grace: number };

function billingFetch(opts: {
  subscription?: { status: string; grace_days?: number } | null;
  overdueDueAt?: string | null;
  sessionChannel?: string | null;
  failSubscriptions?: boolean;
}): { fetchImpl: MiddlewareFetch; calls: Calls } {
  const calls: Calls = { subscriptions: 0, invoices: 0, sessions: 0, grace: 0 };
  const fetchImpl: MiddlewareFetch = async (input) => {
    const url = String(input);
    if (url.includes("/subscriptions?")) {
      calls.subscriptions += 1;
      if (opts.failSubscriptions) return new Response("down", { status: 503 });
      return Response.json(opts.subscription ? [opts.subscription] : []);
    }
    if (url.includes("/invoices?")) {
      calls.invoices += 1;
      return Response.json(opts.overdueDueAt ? [{ due_at: opts.overdueDueAt }] : []);
    }
    if (url.includes("/platform_grace_periods?")) {
      calls.grace += 1;
      return Response.json([]);
    }
    if (url.includes("/user_sessions?")) {
      calls.sessions += 1;
      return Response.json(
        opts.sessionChannel === undefined ? [] : [{ metadata: { channel: opts.sessionChannel } }]
      );
    }
    return new Response("unexpected", { status: 500 });
  };
  return { fetchImpl, calls };
}

const salesClaims = {
  userId: "sp-a",
  role: "SALESPERSON",
  clientId: "org-a",
  sessionId: "sess-1",
  channel: "sales_app",
};

beforeEach(() => clearSubscriptionGateCaches());

test("login, logout, MFA, bootstrap, billing and health stay reachable", () => {
  for (const path of [
    "/api/auth/mfa/login",
    "/api/auth/session/logout",
    "/api/auth/sessions",
    "/api/sales/app/auth",
    "/api/sales/app/bootstrap",
    "/api/billing/portal",
    "/api/health",
    "/api/users/me/security-meta",
  ]) {
    assert.equal(isSubscriptionGateExemptPath(path), true, path);
  }
  for (const path of ["/api/sales/app/leads", "/api/leads/abc", "/api/sales/pipeline", "/api/auth-proxy"]) {
    assert.equal(isSubscriptionGateExemptPath(path), false, path);
  }
});

test("suspended CRM subscription blocks Sales API calls with 402 SUBSCRIPTION_SUSPENDED", async () => {
  const { fetchImpl } = billingFetch({ subscription: { status: "suspended" } });
  const res = await evaluateSalesAppSubscriptionGate("/api/sales/app/leads", salesClaims, { fetchImpl });
  assert.ok(res);
  assert.equal(res.status, 402);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.code, "SUBSCRIPTION_SUSPENDED");
  assert.equal(body.error, "SUBSCRIPTION_SUSPENDED");
});

test("overdue invoice past grace is suspended exactly like the web portal gate", async () => {
  const { fetchImpl } = billingFetch({
    subscription: { status: "past_due", grace_days: 7 },
    overdueDueAt: "2026-10-01T00:00:00Z",
  });
  const res = await evaluateSalesAppSubscriptionGate("/api/leads/1", salesClaims, {
    fetchImpl,
    now: new Date("2026-10-23T12:00:00Z"),
  });
  assert.equal(res?.status, 402);
});

test("active, past_due within grace, cancelled and missing subscriptions are not blocked", async () => {
  for (const subscription of [
    { status: "active" },
    { status: "past_due", grace_days: 7 },
    { status: "cancelled" },
    null,
  ]) {
    clearSubscriptionGateCaches();
    const { fetchImpl } = billingFetch({ subscription });
    const res = await evaluateSalesAppSubscriptionGate("/api/leads/1", salesClaims, { fetchImpl });
    assert.equal(res, null, JSON.stringify(subscription));
  }
});

test("billing read failure fails open (same as the web gate)", async () => {
  const { fetchImpl } = billingFetch({ failSubscriptions: true });
  assert.equal(await evaluateSalesAppSubscriptionGate("/api/leads/1", salesClaims, { fetchImpl }), null);
});

test("exempt paths never query billing", async () => {
  const { fetchImpl, calls } = billingFetch({ subscription: { status: "suspended" } });
  const res = await evaluateSalesAppSubscriptionGate("/api/auth/session/logout", salesClaims, { fetchImpl });
  assert.equal(res, null);
  assert.equal(calls.subscriptions, 0);
});

test("billing decision is cached per organisation (no repeated billing queries)", async () => {
  const { fetchImpl, calls } = billingFetch({ subscription: { status: "suspended" } });
  const now = new Date("2026-10-30T10:00:00Z");
  for (let i = 0; i < 5; i += 1) {
    const res = await evaluateSalesAppSubscriptionGate("/api/leads/1", salesClaims, { fetchImpl, now });
    assert.equal(res?.status, 402);
  }
  assert.equal(calls.subscriptions, 1);
  const later = new Date(now.getTime() + 31_000);
  await evaluateSalesAppSubscriptionGate("/api/leads/1", salesClaims, { fetchImpl, now: later });
  assert.equal(calls.subscriptions, 2);
});

test("Cloud tokens, web roles and tokens without an organisation are not gated", async () => {
  const { fetchImpl, calls } = billingFetch({ subscription: { status: "suspended" }, sessionChannel: "mobile_cloud" });
  assert.equal(
    await evaluateSalesAppSubscriptionGate("/api/leads/1", { ...salesClaims, channel: "cloud_app" }, { fetchImpl }),
    null
  );
  assert.equal(
    await evaluateSalesAppSubscriptionGate("/api/leads/1", { ...salesClaims, channel: undefined }, { fetchImpl }),
    null
  );
  assert.equal(
    await evaluateSalesAppSubscriptionGate("/api/leads/1", { ...salesClaims, role: "SUPER_ADMIN" }, { fetchImpl }),
    null
  );
  assert.equal(
    await evaluateSalesAppSubscriptionGate("/api/leads/1", { ...salesClaims, clientId: null }, { fetchImpl }),
    null
  );
  assert.equal(calls.subscriptions, 0);
});

test("legacy Sales tokens without a channel claim are recognised from the session row", async () => {
  const { fetchImpl, calls } = billingFetch({ subscription: { status: "suspended" }, sessionChannel: "mobile_sales" });
  const legacy = { ...salesClaims, channel: undefined, sessionId: "legacy-sess" };
  const res = await evaluateSalesAppSubscriptionGate("/api/leads/1", legacy, { fetchImpl });
  assert.equal(res?.status, 402);
  await evaluateSalesAppSubscriptionGate("/api/leads/1", legacy, { fetchImpl });
  assert.equal(calls.sessions, 1, "session channel lookup is cached");
});

test("unreadable session row is treated as not-Sales (fail open)", async () => {
  const fetchImpl: MiddlewareFetch = async () => new Response("down", { status: 503 });
  assert.equal(await isSalesAppBearer({ sessionId: "s-x" }, { fetchImpl }), false);
  assert.equal(userSessionChannelQuery("s/1"), "select=metadata&id=eq.s%2F1&limit=1");
});
