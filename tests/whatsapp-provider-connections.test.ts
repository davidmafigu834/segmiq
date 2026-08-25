import assert from "node:assert/strict";
import test from "node:test";
import { getWhatsAppCapabilities } from "../lib/whatsapp/providers/capabilities";
import { providerForType } from "../lib/whatsapp/providers/resolver";
import { canTransitionWhatsAppConnection } from "../lib/whatsapp/providers/state-machine";
import { isSupportedTemporaryChat } from "../lib/whatsapp/normalized-inbound";
import { decryptWhatsAppSecret, encryptWhatsAppSecret } from "../lib/whatsapp/security/secret-envelope";
import { signGatewayRequest, verifyGatewayRequest } from "../lib/whatsapp/security/gateway-auth";
import {
  GatewayRequestError,
  gatewayUserError,
  isGatewayTimeoutError,
  isMissingGatewayRoute,
} from "../lib/whatsapp/gateway-client";
import {
  pairingAfterLoggedOut,
  pairingForAdminConnect,
  pairingForAutoRetry,
  pairingForRestore,
} from "../lib/whatsapp/pairing-policy";

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
  assert.equal(typeof providerForType("META_CLOUD").sendMedia, "function");
  assert.equal(typeof providerForType("TEMPORARY_WEB").sendMedia, "function");
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

test("a restarted gateway can resume live connections without a new QR scan", () => {
  // The gateway parks restorable connections in RECONNECTING before re-opening
  // each socket, so every status a restore can start from must reach it.
  for (const from of ["CONNECTING", "CONNECTED", "DEGRADED", "RECONNECTING", "ERROR"] as const) {
    assert.equal(canTransitionWhatsAppConnection(from, "RECONNECTING"), true, from);
  }
  assert.equal(canTransitionWhatsAppConnection("RECONNECTING", "CONNECTING"), true);
  assert.equal(canTransitionWhatsAppConnection("RECONNECTING", "CONNECTED"), true);
});

test("a restore whose stored session is rejected ends in RECONNECT_REQUIRED, not a QR loop", () => {
  assert.equal(canTransitionWhatsAppConnection("RECONNECTING", "RECONNECT_REQUIRED"), true);
  // An unattended reconnect must never publish a QR code, so this transition
  // stays unavailable and the gateway reports RECONNECT_REQUIRED instead.
  assert.equal(canTransitionWhatsAppConnection("RECONNECTING", "AWAITING_QR"), false);
  // An admin-initiated reconnect resets the record first and starts over.
  assert.equal(canTransitionWhatsAppConnection("RECONNECT_REQUIRED", "INITIALIZING"), true);
  assert.equal(canTransitionWhatsAppConnection("INITIALIZING", "AWAITING_QR"), true);
});

test("admin connect always starts a fresh QR pairing instead of reusing a logged-out session", () => {
  assert.deepEqual(pairingForAdminConnect(), { allowQr: true, freshPairing: true });
  assert.deepEqual(pairingForRestore(), { allowQr: false, freshPairing: false });
  assert.deepEqual(pairingForAutoRetry({ allowQr: true, freshPairing: true }), {
    allowQr: true,
    freshPairing: false,
  });
  assert.deepEqual(pairingForAutoRetry({ allowQr: false, freshPairing: false }), {
    allowQr: false,
    freshPairing: false,
  });
  // A logged-out restore must not emit a QR. An admin pair that still had old
  // creds should throw those away and pair again.
  assert.equal(pairingAfterLoggedOut({ allowQr: false, freshPairing: false }), null);
  assert.deepEqual(pairingAfterLoggedOut({ allowQr: true, freshPairing: false }), {
    allowQr: true,
    freshPairing: true,
  });
  assert.equal(pairingAfterLoggedOut({ allowQr: true, freshPairing: true }), null);
});

test("gateway timeouts are explained instead of a raw abort message", () => {
  const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
  assert.equal(isGatewayTimeoutError(timeout), true);
  assert.match(gatewayUserError(timeout), /still starting/i);
  assert.equal(isGatewayTimeoutError(new Error("Unauthorized")), false);
});

test("an older gateway missing /messages/media is detected so photos can fall back", () => {
  assert.equal(isMissingGatewayRoute(new GatewayRequestError("Not found", 404)), true);
  assert.equal(isMissingGatewayRoute(new Error("Not found")), true);
  assert.equal(isMissingGatewayRoute(new GatewayRequestError("Connection is offline", 409)), false);
  assert.equal(isMissingGatewayRoute(new Error("Unauthorized")), false);
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
