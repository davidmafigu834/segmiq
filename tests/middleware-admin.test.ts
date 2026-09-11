import assert from "node:assert/strict";
import test from "node:test";
import {
  crmSubscriptionQuery,
  fetchMiddlewareCrmSubscriptionStatus,
  fetchMiddlewareFirstRow,
  fetchMiddlewareSessionAlive,
  fetchMiddlewareSessionVersion,
  middlewareRestUrl,
  sessionVersionQuery,
  userSessionAliveQuery,
} from "../lib/supabase/middleware-admin";
import { shouldTreatApi401AsSessionExpiry } from "../lib/auth/session-expiry-client";

test("middleware REST URLs stay scoped to one user or one CRM subscription", () => {
  assert.equal(
    middlewareRestUrl("https://example.supabase.co/", "users", sessionVersionQuery("user-1")),
    "https://example.supabase.co/rest/v1/users?select=session_version&id=eq.user-1"
  );
  assert.equal(
    crmSubscriptionQuery("client-1"),
    "select=status&client_id=eq.client-1&product=eq.crm&limit=1"
  );
  assert.equal(
    userSessionAliveQuery("sess-1"),
    "select=id,user_id,revoked_at,expires_at,last_seen_at,metadata&id=eq.sess-1"
  );
});

test("middleware session alive rejects revoked / idle / missing rows", async () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  const now = Date.parse("2026-09-11T12:00:00.000Z");

  try {
    const alive = await fetchMiddlewareSessionAlive("sess-1", "user-1", "SUPER_ADMIN", {
      nowMs: now,
      fetchImpl: async () =>
        new Response(
          JSON.stringify([
            {
              id: "sess-1",
              user_id: "user-1",
              revoked_at: null,
              expires_at: "2026-09-12T12:00:00.000Z",
              last_seen_at: "2026-09-11T11:30:00.000Z",
              metadata: { idleTtlMs: 7_200_000 },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        ),
    });
    assert.equal(alive, true);

    const idle = await fetchMiddlewareSessionAlive("sess-1", "user-1", "SUPER_ADMIN", {
      nowMs: now,
      fetchImpl: async () =>
        new Response(
          JSON.stringify([
            {
              id: "sess-1",
              user_id: "user-1",
              revoked_at: null,
              expires_at: "2026-09-12T12:00:00.000Z",
              last_seen_at: "2026-09-11T09:00:00.000Z",
              metadata: { idleTtlMs: 7_200_000 },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        ),
    });
    assert.equal(idle, false);

    const revoked = await fetchMiddlewareSessionAlive("sess-1", "user-1", "SUPER_ADMIN", {
      nowMs: now,
      fetchImpl: async () =>
        new Response(
          JSON.stringify([
            {
              id: "sess-1",
              user_id: "user-1",
              revoked_at: "2026-09-11T10:00:00.000Z",
              expires_at: "2026-09-12T12:00:00.000Z",
              last_seen_at: "2026-09-11T11:30:00.000Z",
              metadata: {},
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        ),
    });
    assert.equal(revoked, false);

    const missing = await fetchMiddlewareSessionAlive("sess-1", "user-1", "SUPER_ADMIN", {
      nowMs: now,
      fetchImpl: async () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    assert.equal(missing, false);
  } finally {
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
  }
});

test("middleware reads take the first row and return null on errors or empty results", async () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

  try {
    const version = await fetchMiddlewareSessionVersion("user-1", {
      fetchImpl: async () =>
        new Response(JSON.stringify([{ session_version: 4 }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    assert.equal(version, 4);

    const status = await fetchMiddlewareCrmSubscriptionStatus("client-1", {
      fetchImpl: async () =>
        new Response(JSON.stringify([{ status: "suspended" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    assert.equal(status, "suspended");

    const empty = await fetchMiddlewareFirstRow("users", sessionVersionQuery("user-1"), {
      fetchImpl: async () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    assert.equal(empty, null);

    const failed = await fetchMiddlewareFirstRow("users", sessionVersionQuery("user-1"), {
      fetchImpl: async () => new Response("down", { status: 503 }),
    });
    assert.equal(failed, null);

    const hung = await fetchMiddlewareFirstRow("users", sessionVersionQuery("user-1"), {
      fetchImpl: async () => {
        throw new DOMException("The operation was aborted.", "AbortError");
      },
    });
    assert.equal(hung, null);
  } finally {
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
  }
});

test("session-expiry fetch hook treats MFA setup 401 as expired session", () => {
  assert.equal(shouldTreatApi401AsSessionExpiry("/api/auth/mfa"), true);
  assert.equal(shouldTreatApi401AsSessionExpiry("/api/auth/sessions"), true);
  assert.equal(shouldTreatApi401AsSessionExpiry("/api/agency/settings"), true);
  assert.equal(shouldTreatApi401AsSessionExpiry("/api/auth/csrf"), false);
  assert.equal(shouldTreatApi401AsSessionExpiry("/api/auth/session"), false);
  assert.equal(shouldTreatApi401AsSessionExpiry("/api/auth/mfa/login"), false);
});
