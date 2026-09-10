import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import type { CredentialsConfig } from "next-auth/providers/credentials";
import { authOptions } from "@/lib/auth";
import { isMfaRestrictedAllowlistedPath } from "@/lib/auth/mfa/allowlist";

test("NextAuth plain-object headers reach credential verification without throwing", async (t) => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://login-test.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  });
  let credentialLookup = false;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "login-test.invalid");
    if (url.pathname === "/rest/v1/users") {
      credentialLookup = true;
      assert.equal(url.searchParams.get("email"), "eq.test@example.com");
    }
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const provider = authOptions.providers.find((p) => p.id === "credentials") as CredentialsConfig;
  const authorize = provider.options?.authorize;
  assert.ok(authorize);
  const result = await authorize({ email: "test@example.com", password: "invalid-test-password" }, {
    headers: { "x-forwarded-for": "192.0.2.1, 192.0.2.2", "user-agent": "Login regression test" },
    method: "POST", query: {}, body: {},
  });
  assert.equal(result, null);
  assert.equal(credentialLookup, true);
});

test("NextAuth owns its session endpoint and device management has a separate route", () => {
  assert.equal(existsSync("app/api/auth/session/route.ts"), false);
  assert.equal(existsSync("app/api/auth/[...nextauth]/route.ts"), true);
  assert.equal(existsSync("app/api/auth/sessions/route.ts"), true);
  const panel = readFileSync("components/settings/SecuritySettingsPanel.tsx", "utf8");
  assert.ok(panel.includes('"/api/auth/sessions"'));
  assert.equal(panel.includes('"/api/auth/session"'), false);
  assert.equal(isMfaRestrictedAllowlistedPath("/api/auth/sessions"), true);
  assert.equal(isMfaRestrictedAllowlistedPath("/api/auth/session"), true);
});
