import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  cookieIsSentTo,
  evidenceAccessDecision,
  invitationDeliveryPrecheck,
  invitationSessionCookieOptions,
  partyRequirementSatisfied,
  paymentStatusChange,
  relatedPartiesFromFields,
  replaceOpenInvitation,
  salespersonMaySeeCase,
  submissionDecision,
} from "../lib/real-estate/compliance-management/remediation";

const field = (key: string, label: string, mandatory = true) => ({
  key,
  label,
  mandatory,
  evidence: "field",
  state: "not_started",
  fieldKeys: [key],
});

test("the verification cookie is sent to the public API and not limited to /verify", () => {
  const options = invitationSessionCookieOptions("production");
  assert.equal(options.path, "/");
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(cookieIsSentTo(options.path, "/api/public/compliance-invitations"), true);
  assert.equal(cookieIsSentTo("/verify", "/api/public/compliance-invitations"), false);
  const route = readFileSync("app/api/public/compliance-invitations/route.ts", "utf8");
  assert.equal(route.includes('path: "/verify"'), false);
  assert.equal(route.includes("invitationSessionCookieOptions"), true);
});

test("a salesperson sees only an assigned case", () => {
  assert.equal(salespersonMaySeeCase({ role: "SALESPERSON", actorId: "a", buyerAgentId: "a", organisationWide: false }), true);
  assert.equal(salespersonMaySeeCase({ role: "SALESPERSON", actorId: "b", buyerAgentId: "a", organisationWide: false }), false);
  assert.equal(salespersonMaySeeCase({ role: "SALESPERSON", actorId: "b", buyerAgentId: null, listingAgentId: null, organisationWide: false }), false);
  assert.equal(salespersonMaySeeCase({ role: "SALESPERSON", actorId: "b", organisationWide: true }), true);
});

test("an invitation is refused before it is created when email delivery cannot work", () => {
  const missing = invitationDeliveryPrecheck({ email: null, providerConfigured: true });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.status, 400);
  const provider = invitationDeliveryPrecheck({ email: "buyer@example.com", providerConfigured: false });
  assert.equal(provider.ok, false);
  if (!provider.ok) assert.equal(provider.status, 503);
  assert.equal(invitationDeliveryPrecheck({ email: "buyer@example.com", providerConfigured: true }).ok, true);
});

test("a second correction request replaces the open invitation instead of leaving two active links", () => {
  const now = new Date("2026-11-04T00:00:00Z");
  assert.equal(replaceOpenInvitation({ status: "sent", expiresAt: "2026-11-05T00:00:00Z", now }, ), "replace");
  assert.equal(replaceOpenInvitation({ status: "submitted", expiresAt: "2026-11-05T00:00:00Z", now }, ), "create");
  assert.equal(replaceOpenInvitation(null), "create");
});

test("unscanned and quarantined files are not downloadable", () => {
  assert.equal(evidenceAccessDecision("unscanned").allowBytes, false);
  assert.equal(evidenceAccessDecision("quarantined").allowBytes, false);
  assert.equal(evidenceAccessDecision("clean").allowBytes, true);
  assert.notEqual(evidenceAccessDecision("unscanned").allowBytes, evidenceAccessDecision("clean").allowBytes);
});

test("an empty submission does not become ready for review", () => {
  const empty = submissionDecision({ action: "submit", requirements: [field("legal_name", "Full legal name")], fields: {}, providedKeys: [] });
  assert.equal(empty.ok, false);
  const saved = submissionDecision({ action: "save", requirements: [field("legal_name", "Full legal name")], fields: {}, providedKeys: [] });
  assert.equal(saved.ok, true);
  if (saved.ok) assert.equal(saved.advance, false);
  const ready = submissionDecision({
    action: "submit",
    requirements: [field("legal_name", "Full legal name"), { key: "identity_document_copy", label: "Identity document copy", mandatory: true, evidence: "document", state: "not_started", fieldKeys: [] }],
    fields: { legal_name: "Ada Example" },
    providedKeys: ["identity_document_copy"],
  });
  assert.equal(ready.ok, true);
  if (ready.ok) {
    assert.equal(ready.advance, true);
    assert.deepEqual(ready.updates.sort(), ["identity_document_copy", "legal_name"]);
  }
});

test("payment proof requires a stored file and cannot skip confirmation", () => {
  const bare = paymentStatusChange({ from: "reported", to: "proof_uploaded", hasStoredFile: false, actorMayRecordFinance: true, actorMayCollect: true });
  assert.equal(bare.ok, false);
  const stored = paymentStatusChange({ from: "reported", to: "proof_uploaded", hasStoredFile: true, actorMayRecordFinance: false, actorMayCollect: true });
  assert.equal(stored.ok, true);
  const skip = paymentStatusChange({ from: "reported", to: "independently_confirmed", hasStoredFile: true, actorMayRecordFinance: true, actorMayCollect: true });
  assert.equal(skip.ok, false);
  const confirm = paymentStatusChange({ from: "under_verification", to: "independently_confirmed", hasStoredFile: true, actorMayRecordFinance: true, actorMayCollect: false });
  assert.equal(confirm.ok, true);
  const agent = paymentStatusChange({ from: "under_verification", to: "independently_confirmed", hasStoredFile: true, actorMayRecordFinance: false, actorMayCollect: true });
  assert.equal(agent.ok, false);
});

test("company owners are separate party records", () => {
  const parties = relatedPartiesFromFields({
    directors: "Ada Director\nBo Director",
    beneficial_owners: ["Ada Owner", "Bo Owner"],
    representative_name: "Cee Representative",
  });
  assert.equal(parties.filter((party) => party.relationshipType === "director").length, 2);
  assert.equal(parties.filter((party) => party.relationshipType === "beneficial_owner").length, 2);
  assert.equal(partyRequirementSatisfied("directors", parties), true);
  assert.equal(partyRequirementSatisfied("beneficial_owners", parties), true);
  assert.equal(partyRequirementSatisfied("directors", parties.filter((party) => party.relationshipType !== "director")), false);
});
