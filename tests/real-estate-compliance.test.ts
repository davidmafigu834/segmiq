import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  canCollectCompliance,
  canReviewCompliance,
  canSeeInternalComplianceNotes,
  canTransitionCompliance,
  checklistCompleteness,
  COMPLIANCE_STATUS_AGENT_LABEL,
  DEFAULT_COMPLIANCE_SETTINGS,
  evaluateComplianceGate,
  operationalComplianceLabel,
  parseComplianceSettings,
  profileComplete,
  riskChangeRequiresReason,
} from "../lib/real-estate/compliance";
import { generateComplianceDocKey } from "../lib/storage/r2";
import { resolveSalesNavItems, SALES_NAVIGATION } from "../lib/sales/navigation/sales-nav-config";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

const settings = DEFAULT_COMPLIANCE_SETTINGS;
const manager = { role: "CLIENT_MANAGER", userId: "mgr", userClientId: "c1" };
const agent = { role: "SALESPERSON", userId: "ag", userClientId: "c1" };
const admin = { role: "SUPER_ADMIN", userId: "adm", userClientId: null };

describe("compliance domain — individual and corporate CDD", () => {
  it("creates structured individual completeness from profile + required docs", () => {
    const incomplete = checklistCompleteness({
      entity: "individual",
      settings,
      profile: { legal_name: "Tendai Moyo" },
      docs: [
        { document_type: "identification", required: true, status: "received" },
        { document_type: "proof_of_address", required: true, status: "missing" },
        { document_type: "source_of_funds", required: true, status: "received" },
      ],
      partyCount: { directors: 0, beneficialOwners: 0 },
    });
    assert.equal(incomplete.readyForReview, false);
    assert.equal(incomplete.required, 4);
    assert.equal(incomplete.completed, 3);
    assert.ok(incomplete.items.some((i) => i.id === "proof_of_address" && !i.met));

    const complete = checklistCompleteness({
      entity: "individual",
      settings,
      profile: { legal_name: "Tendai Moyo" },
      docs: [
        { document_type: "identification", required: true, status: "received" },
        { document_type: "proof_of_address", required: true, status: "accepted" },
        { document_type: "source_of_funds", required: true, status: "under_review" },
      ],
      partyCount: { directors: 0, beneficialOwners: 0 },
    });
    assert.equal(complete.readyForReview, true);
    assert.equal(complete.completed, complete.required);
  });

  it("requires related director and beneficial owner records for corporate CDD", () => {
    const missingParties = profileComplete("corporate", { registered_name: "ABC Investments" }, {
      directors: 1,
      beneficialOwners: 0,
    });
    assert.equal(missingParties.complete, false);
    const ready = profileComplete(
      "corporate",
      { registered_name: "ABC Investments" },
      { directors: 2, beneficialOwners: 1 }
    );
    assert.equal(ready.complete, true);
  });
});

describe("compliance permissions", () => {
  it("does not let an agent approve or review", () => {
    assert.equal(canReviewCompliance(agent, settings), false);
    assert.equal(canSeeInternalComplianceNotes(agent, settings), false);
    assert.equal(
      canCollectCompliance(agent, settings, { caseClientId: "c1", buyerAgentId: "ag" }),
      true
    );
  });

  it("lets a company manager review; platform admin is not an LJP approver", () => {
    assert.equal(canReviewCompliance(manager, settings), true);
    assert.equal(canReviewCompliance(admin, settings), false);
    assert.equal(canSeeInternalComplianceNotes(admin, settings), true);
  });

  it("respects restrict_review_to_flagged_users", () => {
    const tight = { ...settings, restrict_review_to_flagged_users: true };
    assert.equal(canReviewCompliance({ ...manager, canReviewCompliance: false }, tight), false);
    assert.equal(canReviewCompliance({ ...manager, canReviewCompliance: true }, tight), true);
  });
});

describe("compliance risk, EDD and review transitions", () => {
  it("requires a reason when setting HIGH or lowering HIGH", () => {
    assert.equal(riskChangeRequiresReason("low", "high"), true);
    assert.equal(riskChangeRequiresReason("high", "medium"), true);
    assert.equal(riskChangeRequiresReason("low", "medium"), false);
  });

  it("supports collection → review → decision including EDD and restriction", () => {
    assert.equal(canTransitionCompliance("in_progress", "ready_for_review"), true);
    assert.equal(canTransitionCompliance("ready_for_review", "under_review"), true);
    assert.equal(canTransitionCompliance("under_review", "more_information_required"), true);
    assert.equal(canTransitionCompliance("under_review", "edd_required"), true);
    assert.equal(canTransitionCompliance("under_review", "approved"), true);
    assert.equal(canTransitionCompliance("under_review", "restricted"), true);
    assert.equal(canTransitionCompliance("under_review", "rejected"), true);
    assert.equal(canTransitionCompliance("in_progress", "approved"), false);
  });

  it("uses neutral agent wording for restricted and not-approved", () => {
    assert.equal(
      COMPLIANCE_STATUS_AGENT_LABEL.restricted,
      "Compliance review required before this transaction can proceed"
    );
    assert.equal(
      COMPLIANCE_STATUS_AGENT_LABEL.rejected,
      "Compliance review required before this transaction can proceed"
    );
    assert.equal(operationalComplianceLabel("restricted"), "Compliance hold");
    assert.equal(operationalComplianceLabel("approved"), "Approved");
  });
});

describe("compliance hard gate", () => {
  it("does not gate trades", () => {
    const r = evaluateComplianceGate({
      isRealEstate: false,
      settings,
      hasAcceptedOffer: true,
      caseStatus: null,
    });
    assert.equal(r.ok, true);
  });

  it("requires approval after an accepted offer when CDD has not started", () => {
    const r = evaluateComplianceGate({
      isRealEstate: true,
      settings,
      hasAcceptedOffer: true,
      caseStatus: null,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "COMPLIANCE_APPROVAL_REQUIRED");
  });

  it("holds restricted and rejected cases with COMPLIANCE_HOLD", () => {
    const r = evaluateComplianceGate({
      isRealEstate: true,
      settings,
      hasAcceptedOffer: true,
      caseStatus: "restricted",
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "COMPLIANCE_HOLD");
  });

  it("allows progression only when approved", () => {
    const r = evaluateComplianceGate({
      isRealEstate: true,
      settings,
      hasAcceptedOffer: true,
      caseStatus: "approved",
    });
    assert.equal(r.ok, true);
  });

  it("can be switched off in company settings", () => {
    const r = evaluateComplianceGate({
      isRealEstate: true,
      settings: { ...settings, require_approval_before_progression: false },
      hasAcceptedOffer: true,
      caseStatus: "in_progress",
    });
    assert.equal(r.ok, true);
  });
});

describe("compliance architecture contracts", () => {
  it("scopes start, list, mutate, upload and sign by client_id", () => {
    const src = read("lib/real-estate/compliance-service.ts");
    assert.ok(src.includes('.eq("client_id", opts.clientId)'));
    assert.ok(src.includes('.eq("contact_id"') || src.includes("offer.contact_id"));
    assert.ok(src.includes("if (existing) return { ok: true, case: existing, created: false }"));
    assert.ok(src.includes('if (opts.actor.role === "SALESPERSON") return { ok: false, error: "Forbidden."'));
    assert.ok(src.includes("approved_at"));
    assert.ok(src.includes("approved_by"));
    assert.ok(src.includes("internal_notes: seeInternal ? row.internal_notes : null"));
    assert.ok(src.includes("restriction_reason: seeInternal"));
    assert.ok(src.includes("startsWith(`clients/${opts.clientId}/compliance/`)"));
    assert.ok(src.includes("COMPLIANCE_ALERT"));
  });

  it("enforces the gate on listing sold/let and lead WON, not on offer accept", () => {
    const listing = read("app/api/clients/[clientId]/listings/[listingId]/route.ts");
    assert.ok(listing.includes("assertComplianceProgressAllowed"));
    assert.ok(listing.includes('body.status === "sold"'));
    const lead = read("app/api/leads/[leadId]/route.ts");
    assert.ok(lead.includes("assertComplianceProgressAllowed"));
    assert.ok(lead.includes('parsed.data.status === "WON"'));
    const offers = read("lib/real-estate/offer-service.ts");
    assert.equal(offers.includes("assertComplianceProgressAllowed"), false);
  });

  it("stores private keys and unique offer cases in the migration", () => {
    const sql = read("supabase/migrations/20260829140000_real_estate_compliance.sql");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS compliance_cases"));
    assert.ok(sql.includes("compliance_related_parties"));
    assert.ok(sql.includes("compliance_document_requirements"));
    assert.ok(sql.includes("compliance_case_events"));
    assert.ok(sql.includes("idx_compliance_cases_offer_unique"));
    assert.ok(sql.includes("ENABLE ROW LEVEL SECURITY"));
    assert.ok(sql.includes("storage_key"));
    assert.ok(sql.includes("COMPLIANCE_ALERT"));
    assert.ok(!sql.includes("pep"));
    assert.ok(!sql.includes("sanctions"));
  });

  it("does not invent PEP, sanctions or AI approval", () => {
    const domain = read("lib/real-estate/compliance.ts");
    assert.ok(!/pep|sanctions|watchlist|ai risk/i.test(domain));
    const key = generateComplianceDocKey("client-a", "case-1", "ID.pdf");
    assert.ok(key.startsWith("clients/client-a/compliance/case-1/"));
    assert.ok(key.endsWith(".pdf"));
  });

  it("keeps trades sales navigation on quotations, not compliance", () => {
    const trades = resolveSalesNavItems(false, "trades");
    assert.ok(trades.some((i) => i.id === "quotes"));
    assert.equal(
      trades.some((i) => i.href.includes("compliance")),
      false
    );
    assert.ok(SALES_NAVIGATION.some((i) => i.id === "quotes"));
  });

  it("does not rewrite trades quotation or deal routes", () => {
    const quotes = read("app/api/sales/quotes/route.ts");
    assert.ok(!quotes.includes("assertComplianceProgressAllowed"));
    const domain = read("lib/real-estate/compliance.ts");
    assert.ok(domain.includes("Trades quotations and deals are unchanged"));
  });

  it("parses empty company settings into LJP defaults without inventing legal thresholds", () => {
    const parsed = parseComplianceSettings({});
    assert.equal(parsed.require_cdd_after_accepted_offer, true);
    assert.equal(parsed.require_approval_before_progression, true);
    assert.deepEqual(parsed.individual_required_docs, ["identification", "proof_of_address", "source_of_funds"]);
  });
});
