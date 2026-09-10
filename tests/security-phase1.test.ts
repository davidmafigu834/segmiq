import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSameTenant,
  requireTenantClientId,
  resolveAuthorizedClientId,
  TenantContextError,
} from "@/lib/auth/tenant-context";
import { validateAuthClaims } from "@/lib/auth/session-validation";
import {
  isSealedIntegrationToken,
  maybeMigrateIntegrationToken,
  sanitizeClientSecrets,
  sealIntegrationToken,
  revealIntegrationToken,
} from "@/lib/integrations/token-vault";

// Deterministic 32-byte key for vault crypto tests (not a production secret).
process.env.WHATSAPP_SESSION_ENCRYPTION_KEY =
  process.env.WHATSAPP_SESSION_ENCRYPTION_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("requireTenantClientId fails closed when clientId missing", () => {
  assert.throws(
    () =>
      requireTenantClientId({
        userId: "u1",
        role: "CLIENT_MANAGER",
        clientId: null,
      }),
    (err: unknown) => err instanceof TenantContextError && err.status === 401
  );
});

test("resolveAuthorizedClientId ignores body clientId for tenant users", () => {
  assert.throws(
    () =>
      resolveAuthorizedClientId(
        { userId: "u1", role: "SALESPERSON", clientId: "client-a" },
        "client-b"
      ),
    (err: unknown) => err instanceof TenantContextError && err.status === 404
  );
  assert.equal(
    resolveAuthorizedClientId(
      { userId: "u1", role: "SALESPERSON", clientId: "client-a" },
      "client-a"
    ),
    "client-a"
  );
});

test("impersonating SUPER_ADMIN cannot use explicit other clientId", () => {
  assert.throws(
    () =>
      resolveAuthorizedClientId(
        {
          userId: "rep-a",
          role: "SALESPERSON",
          clientId: "client-a",
          isImpersonating: true,
          realUserId: "admin",
        },
        "client-b"
      ),
    (err: unknown) => err instanceof TenantContextError && err.status === 404
  );
});

test("platform SUPER_ADMIN requires explicit clientId (no fail-open all-tenants)", () => {
  assert.throws(
    () =>
      resolveAuthorizedClientId({
        userId: "admin",
        role: "SUPER_ADMIN",
        clientId: null,
      }),
    (err: unknown) => err instanceof TenantContextError && err.status === 400
  );
  assert.equal(
    resolveAuthorizedClientId(
      { userId: "admin", role: "SUPER_ADMIN", clientId: null },
      "client-x"
    ),
    "client-x"
  );
});

test("assertSameTenant denies cross-tenant without leaking", () => {
  assert.throws(
    () => assertSameTenant("client-a", "client-b", "CLIENT_MANAGER"),
    (err: unknown) =>
      err instanceof TenantContextError && err.status === 404 && err.message === "Not found"
  );
});

test("assertSameTenant allows explicit platform SUPER_ADMIN", () => {
  assert.doesNotThrow(() =>
    assertSameTenant(null, "client-b", "SUPER_ADMIN", { allowSuperAdmin: true })
  );
  assert.throws(
    () =>
      assertSameTenant("client-a", "client-b", "SUPER_ADMIN", {
        allowSuperAdmin: true,
        isImpersonating: true,
      }),
    TenantContextError
  );
});

test("TEST 10 offboarding: inactive user claims rejected", async () => {
  const result = await validateAuthClaims(
    {
      userId: "rep-1",
      role: "SALESPERSON",
      clientId: "c1",
      alsoSells: false,
      sessionVersion: 3,
    },
    {
      skipSessionRegistry: true,
      fetchUserById: async () => ({
        id: "rep-1",
        role: "SALESPERSON",
        client_id: "c1",
        is_active: false,
        session_version: 3,
        also_sells: false,
      }),
    }
  );
  assert.deepEqual(result, { ok: false, reason: "target_inactive" });
});

test("TEST 10 offboarding: session_version bump rejects old web/mobile session", async () => {
  const result = await validateAuthClaims(
    {
      userId: "rep-1",
      role: "SALESPERSON",
      clientId: "c1",
      alsoSells: false,
      sessionVersion: 3,
    },
    {
      skipSessionRegistry: true,
      fetchUserById: async () => ({
        id: "rep-1",
        role: "SALESPERSON",
        client_id: "c1",
        is_active: true,
        session_version: 4,
        also_sells: false,
      }),
    }
  );
  assert.deepEqual(result, { ok: false, reason: "session_version_mismatch" });
});

test("TEST 11 role downgrade: JWT role mismatch rejects manager privileges", async () => {
  const result = await validateAuthClaims(
    {
      userId: "mgr-1",
      role: "CLIENT_MANAGER",
      clientId: "c1",
      alsoSells: false,
      sessionVersion: 2,
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

test("TEST 9 impersonation: real admin session_version gates effective session", async () => {
  const result = await validateAuthClaims(
    {
      userId: "rep-a",
      role: "SALESPERSON",
      clientId: "client-a",
      alsoSells: false,
      sessionVersion: 10,
      realUserId: "admin-1",
    },
    {
      skipSessionRegistry: true,
      fetchUserById: async (id) => {
        if (id === "rep-a") {
          return {
            id: "rep-a",
            role: "SALESPERSON",
            client_id: "client-a",
            is_active: true,
            session_version: 1,
            also_sells: false,
          };
        }
        return {
          id: "admin-1",
          role: "SUPER_ADMIN",
          client_id: null,
          is_active: true,
          session_version: 11,
          also_sells: false,
        };
      },
    }
  );
  assert.deepEqual(result, { ok: false, reason: "session_version_mismatch" });
});

test("TEST 13 sanitizeClientSecrets strips Meta tokens from browser payloads", () => {
  const sanitized = sanitizeClientSecrets({
    id: "c1",
    name: "Acme",
    fb_access_token: "EAA_secret_page",
    fb_user_access_token: "EAA_secret_user",
    meta_whatsapp_access_token: "EAA_secret_wa",
    fb_page_name: "Acme Page",
  });
  assert.equal(sanitized.fb_connected, true);
  assert.equal(sanitized.meta_whatsapp_token_configured, true);
  assert.equal("fb_access_token" in sanitized, false);
  assert.equal("fb_user_access_token" in sanitized, false);
  assert.equal("meta_whatsapp_access_token" in sanitized, false);
  assert.equal(sanitized.fb_page_name, "Acme Page");
});

test("TEST 14 Meta token encryption seal/reveal roundtrip", async () => {
  const plaintext = "EAABTestTokenRoundTripValue0123456789abcdef0123456789";
  const sealed = await sealIntegrationToken(plaintext, "fb_page", "client-a");
  assert.equal(isSealedIntegrationToken(sealed), true);
  assert.ok(!sealed.includes(plaintext));
  const revealed = await revealIntegrationToken(sealed, "fb_page", "client-a");
  assert.equal(revealed, plaintext);
});

test("TEST 14 sealed token cannot decrypt under wrong tenant AAD", async () => {
  const plaintext = "EAABTestTokenWrongTenantValue0123456789abcdef01234567";
  const sealed = await sealIntegrationToken(plaintext, "fb_page", "client-a");
  await assert.rejects(() => revealIntegrationToken(sealed, "fb_page", "client-b"));
});

test("TEST 14 legacy plaintext migrates to sealed without losing value", async () => {
  const legacy = "EAABLegacyPlaintextToken0123456789abcdef0123456789abc";
  const mig = await maybeMigrateIntegrationToken(legacy, "meta_wa", "client-z");
  assert.equal(mig.migrated, true);
  assert.equal(mig.plaintext, legacy);
  assert.equal(isSealedIntegrationToken(mig.sealed), true);
  const again = await maybeMigrateIntegrationToken(mig.sealed, "meta_wa", "client-z");
  assert.equal(again.migrated, false);
  assert.equal(again.plaintext, legacy);
});

test("cross-tenant helper semantics: resource id alone is insufficient", () => {
  // Preferred pattern: resource.client_id must equal actor.client_id
  const actorClientId = "org-a";
  const foreignDeal = { id: "deal-uuid", client_id: "org-b" };
  assert.throws(
    () => assertSameTenant(actorClientId, foreignDeal.client_id, "SALESPERSON"),
    TenantContextError
  );
});
