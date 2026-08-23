import assert from "node:assert/strict";
import test from "node:test";
import {
  crmSubscriptionQuery,
  fetchMiddlewareCrmSubscriptionStatus,
  fetchMiddlewareFirstRow,
  fetchMiddlewareSessionVersion,
  middlewareRestUrl,
  sessionVersionQuery,
} from "../lib/supabase/middleware-admin";

test("middleware REST URLs stay scoped to one user or one CRM subscription", () => {
  assert.equal(
    middlewareRestUrl("https://example.supabase.co/", "users", sessionVersionQuery("user-1")),
    "https://example.supabase.co/rest/v1/users?select=session_version&id=eq.user-1"
  );
  assert.equal(
    crmSubscriptionQuery("client-1"),
    "select=status&client_id=eq.client-1&product=eq.crm&limit=1"
  );
});

test("middleware reads take the first row and fail open on errors or empty results", async () => {
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
