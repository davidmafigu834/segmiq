import assert from "node:assert/strict";
import test from "node:test";
import { confirmationRequired, riskForTool } from "@/lib/agent/manager/policy";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { redactSecrets, redactUnknown } from "@/lib/security/log-redaction";
import {
  classifyStorageKey,
  PRIVATE_DOWNLOAD_TTL_SEC,
} from "@/lib/storage/access-class";
import { requireTrustedClientId, isHumanActorType } from "@/lib/auth/system-actor";
import { hasPermission } from "@/lib/auth/rbac/resolve";
import { P } from "@/lib/auth/rbac/permissions";

test("TEST manager risk: high tools require confirmation", () => {
  assert.equal(riskForTool("approve_quotation", 1), "HIGH");
  assert.equal(confirmationRequired("HIGH", 1), true);
  assert.equal(confirmationRequired("LOW", 1), false);
  assert.equal(riskForTool("create_follow_ups", 3), "HIGH");
  assert.equal(confirmationRequired(riskForTool("create_follow_ups", 3), 3), true);
});

test("TEST 5: salesperson lacks AGENT_MANAGE", () => {
  const sales = { userId: "u1", role: "SALESPERSON" as const, clientId: "c1" };
  assert.equal(hasPermission(sales, P.AGENT_USE), true);
  assert.equal(hasPermission(sales, P.AGENT_MANAGE), false);
  assert.equal(hasPermission(sales, P.WHATSAPP_CONNECTION_MANAGE), false);
  assert.equal(hasPermission(sales, P.WHATSAPP_SEND), true);
});

test("TEST 13/14: manager can manage WA connection; sales cannot", () => {
  const mgr = { userId: "u2", role: "CLIENT_MANAGER" as const, clientId: "c1" };
  const sales = { userId: "u1", role: "SALESPERSON" as const, clientId: "c1" };
  assert.equal(hasPermission(mgr, P.WHATSAPP_CONNECTION_MANAGE), true);
  assert.equal(hasPermission(mgr, P.AGENT_MANAGE), true);
  assert.equal(hasPermission(sales, P.WHATSAPP_CONNECTION_MANAGE), false);
});

test("TEST cron: rejects missing/wrong secret in production mode", () => {
  const prevNode = process.env.NODE_ENV;
  const prevSecret = process.env.CRON_SECRET;
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.CRON_SECRET = "super-secret-cron-key-32chars!!";
    assert.equal(
      isAuthorizedCronRequest(
        new Request("https://app.segmiq.com/api/cron/x", {
          headers: { authorization: "Bearer wrong" },
        })
      ),
      false
    );
    assert.equal(
      isAuthorizedCronRequest(
        new Request("https://app.segmiq.com/api/cron/x", {
          headers: { authorization: "Bearer super-secret-cron-key-32chars!!" },
        })
      ),
      true
    );
    delete process.env.CRON_SECRET;
    assert.equal(
      isAuthorizedCronRequest(
        new Request("https://app.segmiq.com/api/cron/x", {
          headers: { authorization: "Bearer anything" },
        })
      ),
      false
    );
  } finally {
    Object.assign(process.env, { NODE_ENV: prevNode });
    if (prevSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevSecret;
  }
});

test("TEST log redaction strips Meta tokens and Bearer", () => {
  const raw =
    "Authorization: Bearer abcdefghijklmnop failed EAAGm0xTestTokenValue12345678901234567890123456789012";
  const cleaned = redactSecrets(raw);
  assert.doesNotMatch(cleaned, /Bearer abcdef/);
  assert.doesNotMatch(cleaned, /EAAGm0xTestToken/);
  assert.match(cleaned, /REDACTED/);
});

test("TEST redactUnknown strips secret keys", () => {
  const cleaned = redactUnknown({
    access_token: "EAA...",
    status: "ok",
    nested: { refresh_token: "x", page: "ABC" },
  }) as Record<string, unknown>;
  assert.equal(cleaned.access_token, "[REDACTED]");
  assert.equal(cleaned.status, "ok");
  assert.equal((cleaned.nested as Record<string, unknown>).refresh_token, "[REDACTED]");
  assert.equal((cleaned.nested as Record<string, unknown>).page, "ABC");
});

test("TEST storage classification", () => {
  assert.equal(classifyStorageKey("marketing/hero.png"), "PUBLIC");
  assert.equal(classifyStorageKey("clients/c1/documents/d1/file.pdf"), "PRIVATE");
  assert.equal(classifyStorageKey("whatsapp/c1/inbound/x.jpg"), "PRIVATE");
  assert.equal(PRIVATE_DOWNLOAD_TTL_SEC, 300);
});

test("TEST system actor helpers", () => {
  assert.equal(requireTrustedClientId("c1", "test"), "c1");
  assert.throws(() => requireTrustedClientId(null, "test"));
  assert.equal(isHumanActorType("HUMAN_USER"), true);
  assert.equal(isHumanActorType("SYSTEM_AGENT"), false);
});

test("TEST ASSIST allowlist invariant (static)", () => {
  // Mirrors registry ASSIST_SAFE_TOOLS — keep in sync when changing registry.
  const assistSafe = new Set([
    "catalog_search",
    "product.search",
    "product.get",
    "inventory.getAvailability",
    "package.search",
    "package.get",
    "package.checkAvailability",
    "brain_lookup",
    "calendar_get_availability",
    "quotation_get_current",
    "conversation_add_internal_note",
    "agent_escalate",
    "agent_notify_owner",
  ]);
  assert.equal(assistSafe.has("memory_update"), false);
  assert.equal(assistSafe.has("quotation_send"), false);
  assert.equal(assistSafe.has("deal_create"), false);
});
