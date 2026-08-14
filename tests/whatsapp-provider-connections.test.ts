import assert from "node:assert/strict";
import test from "node:test";
import { getWhatsAppCapabilities } from "../lib/whatsapp/providers/capabilities";
import { providerForType } from "../lib/whatsapp/providers/resolver";
import { canTransitionWhatsAppConnection } from "../lib/whatsapp/providers/state-machine";
import { isSupportedTemporaryChat } from "../lib/whatsapp/normalized-inbound";
import { decryptWhatsAppSecret, encryptWhatsAppSecret } from "../lib/whatsapp/security/secret-envelope";
import { signGatewayRequest, verifyGatewayRequest } from "../lib/whatsapp/security/gateway-auth";

test("temporary provider advertises only the supported beta capabilities", () => {
  const capabilities = getWhatsAppCapabilities("TEMPORARY_WEB");
  assert.equal(capabilities.manualText, true);
  assert.equal(capabilities.manualDocument, true);
  assert.equal(capabilities.templates, false);
  assert.equal(capabilities.broadcast, false);
  assert.equal(capabilities.automatedMessages, false);
  assert.equal(capabilities.messagingWindow, false);
  assert.equal(capabilities.limitedHistory, true);
});

test("provider resolver retains Meta and adds temporary provider without conflating them", () => {
  assert.equal(providerForType("META_CLOUD").type, "META_CLOUD");
  assert.equal(providerForType("TEMPORARY_WEB").type, "TEMPORARY_WEB");
  assert.equal(providerForType("META_COEXISTENCE").type, "META_COEXISTENCE");
});

test("connection state machine allows lifecycle transitions and rejects unsafe jumps", () => {
  assert.equal(canTransitionWhatsAppConnection("DISCONNECTED", "INITIALIZING"), true);
  assert.equal(canTransitionWhatsAppConnection("INITIALIZING", "AWAITING_QR"), true);
  assert.equal(canTransitionWhatsAppConnection("AWAITING_QR", "CONNECTING"), true);
  assert.equal(canTransitionWhatsAppConnection("AWAITING_QR", "CONNECTED"), true);
  assert.equal(canTransitionWhatsAppConnection("CONNECTING", "CONNECTED"), true);
  assert.equal(canTransitionWhatsAppConnection("CONNECTED", "DISCONNECTED"), false);
  assert.equal(canTransitionWhatsAppConnection("DISCONNECTED", "CONNECTED"), false);
});

test("temporary ingestion excludes non one-to-one WhatsApp surfaces", () => {
  assert.equal(isSupportedTemporaryChat("263771234567@s.whatsapp.net"), true);
  assert.equal(isSupportedTemporaryChat("120363000000@g.us"), false);
  assert.equal(isSupportedTemporaryChat("status@broadcast"), false);
  assert.equal(isSupportedTemporaryChat("123@newsletter"), false);
});

test("session and QR envelopes are authenticated and context-bound", async () => {
  process.env.WHATSAPP_SESSION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  const encrypted = await encryptWhatsAppSecret('{"private":"state"}', "session:a:tenant-a");
  assert.notEqual(encrypted.ciphertext, '{"private":"state"}');
  assert.equal(await decryptWhatsAppSecret(encrypted, "session:a:tenant-a"), '{"private":"state"}');
  await assert.rejects(() => decryptWhatsAppSecret(encrypted, "session:a:tenant-b"));
});

test("gateway request signatures bind method, path, body, nonce and time", async () => {
  process.env.WHATSAPP_GATEWAY_SHARED_SECRET = "test-only-shared-secret-that-is-long-enough";
  const now = 1_800_000_000_000;
  const body = '{"type":"HEARTBEAT"}';
  const signed = await signGatewayRequest({
    method: "POST",
    path: "/api/internal/whatsapp/gateway-events",
    body,
    now,
    nonce: "test_nonce_123456789",
  });
  const headers = new Headers(signed);
  assert.equal((await verifyGatewayRequest({ headers, method: "POST", path: "/api/internal/whatsapp/gateway-events", body, now })).ok, true);
  assert.equal((await verifyGatewayRequest({ headers, method: "POST", path: "/api/internal/whatsapp/gateway-events", body: "tampered", now })).ok, false);
});
