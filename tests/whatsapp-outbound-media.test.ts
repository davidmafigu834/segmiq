import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyWhatsAppOutboundMedia,
  isWhatsAppOutboundKeyForLead,
  metaCloudMediaType,
  placeholderBodyForMedia,
  resolveOutboundMediaContentType,
  sanitizeOutboundFilename,
  validateWhatsAppOutboundMedia,
} from "../lib/whatsapp/outbound-media";

test("composer media is classified from mime type and filename", () => {
  assert.equal(classifyWhatsAppOutboundMedia("image/jpeg"), "image");
  assert.equal(classifyWhatsAppOutboundMedia("video/mp4"), "video");
  assert.equal(classifyWhatsAppOutboundMedia("application/pdf"), "document");
  assert.equal(resolveOutboundMediaContentType("site-plan.pdf", ""), "application/pdf");
  assert.equal(resolveOutboundMediaContentType("photo.HEIC", "image/heic"), "image/heic");
});

test("Meta Cloud remaps iPhone formats WhatsApp Cloud API cannot send as media", () => {
  assert.equal(metaCloudMediaType("image/heic", "image"), "document");
  assert.equal(metaCloudMediaType("video/quicktime", "video"), "document");
  assert.equal(metaCloudMediaType("image/jpeg", "image"), "image");
  assert.equal(metaCloudMediaType("video/mp4", "video"), "video");
});

test("outbound media validation rejects empty, huge, and unknown files", () => {
  assert.equal(validateWhatsAppOutboundMedia({ filename: "ok.jpg", mimeType: "image/jpeg", size: 1200 }).ok, true);
  assert.equal(validateWhatsAppOutboundMedia({ filename: "empty.jpg", mimeType: "image/jpeg", size: 0 }).ok, false);
  assert.equal(
    validateWhatsAppOutboundMedia({ filename: "huge.jpg", mimeType: "image/jpeg", size: 6 * 1024 * 1024 }).ok,
    false
  );
  assert.equal(validateWhatsAppOutboundMedia({ filename: "notes.exe", mimeType: "application/x-msdownload", size: 100 }).ok, false);
});

test("caption or a type label becomes the stored WhatsApp body", () => {
  assert.equal(placeholderBodyForMedia("image", "yard.jpg", "South elevation"), "South elevation");
  assert.equal(placeholderBodyForMedia("image", "yard.jpg", "  "), "Photo");
  assert.equal(placeholderBodyForMedia("document", "Quote v2.pdf", ""), "Quote v2.pdf");
  assert.equal(sanitizeOutboundFilename("../../etc/passwd"), "passwd");
});

test("outbound storage keys stay scoped to the conversation", () => {
  const key = "whatsapp/client-1/outbound/lead-9/123.jpg";
  assert.equal(isWhatsAppOutboundKeyForLead(key, "client-1", "lead-9"), true);
  assert.equal(isWhatsAppOutboundKeyForLead(key, "client-2", "lead-9"), false);
  assert.equal(isWhatsAppOutboundKeyForLead("whatsapp/client-1/outbound/lead-9/../secret", "client-1", "lead-9"), false);
});
