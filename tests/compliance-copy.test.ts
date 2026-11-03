import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { caseTypeLabel, invitationStatusLabel, paymentEvidenceLabel, requirementStateLabel } from "../components/real-estate/compliance/copy";

describe("compliance presentation labels", () => {
  it("does not show raw requirement states", () => {
    assert.equal(requirementStateLabel("submitted"), "Awaiting review");
    assert.equal(requirementStateLabel("more_information_required"), "Changes requested");
    assert.equal(requirementStateLabel("under_review"), "In review");
    assert.equal(requirementStateLabel("submitted").includes("_"), false);
  });

  it("keeps payment evidence distinct from confirmation", () => {
    assert.equal(paymentEvidenceLabel("proof_uploaded"), "Evidence submitted");
    assert.equal(paymentEvidenceLabel("independently_confirmed"), "Independently confirmed");
    assert.notEqual(paymentEvidenceLabel("proof_uploaded"), paymentEvidenceLabel("independently_confirmed"));
  });

  it("uses the recorded invitation states", () => {
    assert.equal(invitationStatusLabel("sent"), "Sent");
    assert.equal(invitationStatusLabel("expired"), "Expired");
    assert.equal(caseTypeLabel("buyer"), "Buyer");
  });
});
