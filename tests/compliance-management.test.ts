import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listingMarketingGate } from "../lib/real-estate/agent-listing-pages/policy";
import {
  agentStatusLabel,
  canTransitionPayment,
  canTransitionRequirement,
  commercialStageDoesNotImplyTransfer,
  complianceCapabilities,
  confirmPayment,
  deriveReadiness,
  evaluateDecision,
  filePresenceDoesNotVerify,
  hashSecret,
  independentReviewer,
  invitationAccess,
  instantiateTemplate,
  legalTransferAfterMilestone,
  listingPublicationDecision,
  maskProfileForAgent,
  newInvitationToken,
  otpAccess,
  paymentStateAfterProof,
  pickProfileFields,
  requirementApplies,
  safeAuditSummary,
  secretsMatch,
  stateAfterUpload,
  templateByKey,
  verificationMayBeReused,
} from "../lib/real-estate/compliance-management/engine";

const reviewer = complianceCapabilities({
  userId: "manager",
  role: "CLIENT_MANAGER",
  permissions: new Set(["compliance.read", "compliance.review", "compliance.invite", "compliance.policy", "compliance.audit", "compliance.escalate", "compliance.finance", "compliance.conveyancing"]),
  canReviewFlag: true,
  restrictReviewToFlaggedUsers: true,
});

const agent = complianceCapabilities({
  userId: "agent",
  role: "SALESPERSON",
  permissions: new Set(["compliance.read", "compliance.invite"]),
  canReviewFlag: false,
  restrictReviewToFlaggedUsers: false,
});

describe("compliance capabilities", () => {
  it("lets an agent collect and request documents without review authority", () => {
    assert.equal(agent.collect, true);
    assert.equal(agent.invite, true);
    assert.equal(agent.review, false);
    assert.equal(agent.viewEscalation, false);
    assert.equal(agent.managePolicy, false);
  });

  it("requires the flagged reviewer when the organisation restricts review", () => {
    const blocked = complianceCapabilities({
      userId: "manager",
      role: "CLIENT_MANAGER",
      permissions: new Set(["compliance.review", "compliance.escalate"]),
      canReviewFlag: false,
      restrictReviewToFlaggedUsers: true,
    });
    assert.equal(blocked.review, false);
    assert.equal(reviewer.review, true);
    assert.equal(reviewer.viewEscalation, true);
  });
});

describe("requirement state machine", () => {
  it("treats an upload as submitted evidence", () => {
    assert.equal(stateAfterUpload("awaiting_information"), "submitted");
    assert.equal(stateAfterUpload("verified"), null);
    assert.equal(filePresenceDoesNotVerify("submitted", true), true);
  });

  it("blocks an agent from verifying their own submission", () => {
    const decision = evaluateDecision({
      decision: "verify",
      from: "under_review",
      waiverPermitted: false,
      actorIsIndependent: false,
      actorMayReview: true,
    });
    assert.equal(decision.ok, false);
  });

  it("requires a reason before a permitted waiver", () => {
    assert.equal(evaluateDecision({ decision: "waive", from: "under_review", waiverPermitted: false, actorIsIndependent: true, actorMayReview: true, reason: "not needed" }).ok, false);
    assert.equal(evaluateDecision({ decision: "waive", from: "under_review", waiverPermitted: true, actorIsIndependent: true, actorMayReview: true, reason: "short" }).ok, false);
    assert.equal(evaluateDecision({ decision: "waive", from: "under_review", waiverPermitted: true, actorIsIndependent: true, actorMayReview: true, reason: "Customer is exempt under the reviewed policy." }).ok, true);
  });

  it("does not jump from not started to verified", () => {
    assert.equal(canTransitionRequirement("not_started", "verified"), false);
  });
});

describe("templates and routes", () => {
  it("does not apply a title deed requirement to a cession property", () => {
    const template = templateByKey("listing_readiness");
    assert.ok(template);
    const items = instantiateTemplate(template, { customerType: "individual", legalRoute: "cession" });
    assert.equal(items.some((item) => item.key === "title_deed_copy"), false);
    assert.equal(items.some((item) => item.key === "cession_rights"), true);
  });

  it("keeps company ownership as separate party requirements", () => {
    const template = templateByKey("company_purchaser");
    assert.ok(template);
    const owners = template.requirements.find((item) => item.key === "beneficial_owners");
    assert.equal(owners?.evidence, "party");
  });

  it("hides a title-deed item when the route does not match", () => {
    const deed = templateByKey("title_deed_transfer")?.requirements.find((item) => item.key === "registration_confirmed");
    assert.ok(deed);
    assert.equal(requirementApplies(deed, { customerType: "individual", legalRoute: "cession", transactionType: "sale" }), false);
  });
});

describe("readiness is separate from payment and transfer", () => {
  it("does not approve a case because every slot has a file", () => {
    const readiness = deriveReadiness({
      caseStatus: "under_review",
      requirements: [{ key: "identity", state: "submitted", mandatory: true }],
    });
    assert.equal(readiness, "under_review");
  });

  it("keeps payment proof distinct from confirmation", () => {
    assert.equal(paymentStateAfterProof("reported"), "proof_uploaded");
    assert.equal(canTransitionPayment("proof_uploaded", "independently_confirmed"), false);
    assert.equal(confirmPayment({ from: "proof_uploaded", actorMayRecordFinance: true }).ok, false);
    assert.equal(confirmPayment({ from: "under_verification", actorMayRecordFinance: false }).ok, false);
    assert.equal(confirmPayment({ from: "under_verification", actorMayRecordFinance: true }).ok, true);
  });

  it("does not treat handover or a completed sale as registered transfer", () => {
    assert.equal(legalTransferAfterMilestone({ milestoneKey: "keys_handed_over", milestoneDone: true, route: "title_deed", current: "in_progress" }), "in_progress");
    assert.equal(legalTransferAfterMilestone({ milestoneKey: "handover_authorised", milestoneDone: true, route: "cession", current: "in_progress" }), "in_progress");
    assert.equal(legalTransferAfterMilestone({ milestoneKey: "deeds_or_cession_lodged", milestoneDone: true, route: "cession", current: "in_progress" }), "lodged");
    assert.equal(legalTransferAfterMilestone({ milestoneKey: "registration_confirmed", milestoneDone: true, route: "title_deed", current: "lodged" }), "registered");
    assert.equal(commercialStageDoesNotImplyTransfer("completed", "in_progress"), true);
  });
});

describe("invitations, reuse and masking", () => {
  it("rejects an expired, revoked or replayed invitation", () => {
    const now = new Date("2026-11-03T12:00:00Z");
    assert.equal(invitationAccess({ status: "sent", expiresAt: "2026-11-03T11:00:00Z", now, revoked: false }).ok, false);
    assert.equal(invitationAccess({ status: "revoked", expiresAt: "2026-11-04T11:00:00Z", now, revoked: true }).ok, false);
    assert.equal(invitationAccess({ status: "submitted", expiresAt: "2026-11-04T11:00:00Z", now, revoked: false }).ok, false);
  });

  it("locks a code after repeated attempts and compares it in constant time", () => {
    assert.equal(otpAccess({ attempts: 5, expiresAt: "2026-11-04T00:00:00Z", now: new Date("2026-11-03T00:00:00Z"), verified: false }).ok, false);
    const pepper = "pepper";
    const token = newInvitationToken();
    assert.equal(secretsMatch(token, pepper, hashSecret(token, pepper)), true);
    assert.equal(secretsMatch("other-token-value", pepper, hashSecret(token, pepper)), false);
  });

  it("refuses reuse across a risk increase or another organisation", () => {
    const base = {
      sameOrganisation: true,
      sourceStatus: "approved",
      sourceApprovedAt: "2026-10-01T00:00:00Z",
      validityDays: 365,
      now: new Date("2026-11-03T00:00:00Z"),
      policyAllowsReuse: true,
      materialUnchanged: true,
      sourceRisk: "low",
      nextRisk: "low",
    };
    assert.equal(verificationMayBeReused(base).allowed, true);
    assert.equal(verificationMayBeReused({ ...base, sameOrganisation: false }).allowed, false);
    assert.equal(verificationMayBeReused({ ...base, nextRisk: "high" }).allowed, false);
    assert.equal(verificationMayBeReused({ ...base, policyAllowsReuse: false }).allowed, false);
  });

  it("hides identity numbers and escalation detail from an agent", () => {
    const masked = maskProfileForAgent({ legal_name: "Amina Dube", identification_reference: "63-000000A00" });
    assert.equal(masked.legal_name, "Amina Dube");
    assert.equal("identification_reference" in masked, false);
    assert.equal(agentStatusLabel("edd_required", "escalated"), "Additional review required");
    assert.equal(safeAuditSummary("REQUIREMENT_DECIDED").includes("63-"), false);
    assert.equal(independentReviewer("agent", { createdBy: "agent", buyerAgentId: null, submittedBy: null }), false);
  });

  it("keeps listing publication unchanged until enforcement is on", () => {
    const approved = { organisationId: "org-a", listingOrganisationId: "org-a", approvalStatus: "approved", status: "available", featureEnabled: true, organisationActive: true };
    assert.equal(listingMarketingGate(approved).ok, true);
    assert.equal(listingMarketingGate({ ...approved, compliancePublication: "inactive" }).ok, true);
    assert.equal(listingMarketingGate({ ...approved, compliancePublication: "blocked" }).ok, false);
    assert.equal(listingPublicationDecision({ enforcementActive: false, caseReadiness: null }), "inactive");
    assert.equal(listingPublicationDecision({ enforcementActive: true, caseReadiness: "incomplete" }), "blocked");
  });

  it("only stores allow-listed profile fields", () => {
    const picked = pickProfileFields({ legal_name: "Amina", identification_reference: "secret", unexpected: "no" }, ["legal_name"]);
    assert.deepEqual(picked, { legal_name: "Amina" });
  });
});
