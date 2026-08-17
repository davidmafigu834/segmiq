import assert from "node:assert/strict";
import test from "node:test";
import {
  isLiveUpsertType,
  isSelfWhatsAppChat,
  messageTimestampMs,
  phoneFromWhatsAppKey,
  unwrapWhatsAppContent,
} from "../lib/whatsapp/gateway-message";
import { isSupportedTemporaryChat } from "../lib/whatsapp/normalized-inbound";

test("linked-device ingest keeps live append events and skips history prepend", () => {
  assert.equal(isLiveUpsertType("notify"), true);
  assert.equal(isLiveUpsertType("append"), true);
  assert.equal(isLiveUpsertType("prepend"), false);
});

test("linked-device ingest prefers the phone JID over a LID and skips the business self-chat", () => {
  assert.equal(
    phoneFromWhatsAppKey({
      remoteJid: "123456789012345@lid",
      remoteJidAlt: "263771234567@s.whatsapp.net",
    }),
    "263771234567"
  );
  assert.equal(
    isSelfWhatsAppChat("263718558160:42@s.whatsapp.net", ["263718558160:42@s.whatsapp.net"]),
    true
  );
  assert.equal(isSelfWhatsAppChat("263771234567@s.whatsapp.net", ["263718558160:42@s.whatsapp.net"]), false);
});

test("linked-device ingest unwraps ephemeral content and reads protobuf timestamps", () => {
  const content = unwrapWhatsAppContent({
    ephemeralMessage: { message: { conversation: "Hello from the phone" } },
  });
  assert.equal(content?.conversation, "Hello from the phone");
  assert.equal(messageTimestampMs({ toNumber: () => 1_800_000_000 }), 1_800_000_000_000);
  assert.equal(messageTimestampMs(1_800_000_000), 1_800_000_000_000);
});

test("temporary ingestion allows LID chats and still excludes groups", () => {
  assert.equal(isSupportedTemporaryChat("123456789012345@lid"), true);
  assert.equal(isSupportedTemporaryChat("120363000000@g.us"), false);
});
