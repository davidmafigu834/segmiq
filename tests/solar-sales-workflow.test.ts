import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSolarSalesStage } from "../lib/sales/solar-workflow/derive";
import { initialDeliveryStatus, planWonProjectHandoff, rejectCrossTenant } from "../lib/sales/solar-workflow/handoff";
import { classifySolarSalesQuestion, solarSalesReport } from "../lib/sales/solar-workflow/reporting";
import { transitionSolarSalesStage } from "../lib/sales/solar-workflow/transitions";
import type { SolarSalesFacts } from "../lib/sales/solar-workflow/types";

const quote = (status: string, sentAt: string | null = null) => ({ status, sentAt, id: "q1" });
const visit = (status: string, assessmentStatus: "DRAFT" | "COMPLETED" | null) => ({ status, assessmentStatus });

function facts(patch: Partial<SolarSalesFacts> = {}): SolarSalesFacts {
  return {
    preset: "SOLAR_INSTALLATION",
    leadStatus: "NEW",
    dealStage: null,
    salesCommercialIntent: null,
    visits: [],
    quotes: [],
    ...patch,
  };
}

test("solar workflow maps each sales stage from the underlying records", () => {
  assert.equal(getSolarSalesStage(facts()), "NEW_LEAD");
  assert.equal(getSolarSalesStage(facts({ leadStatus: "CONTACTED" })), "CONTACTED");
  assert.equal(getSolarSalesStage(facts({ leadStatus: "QUALIFIED" })), "QUALIFIED");
  assert.equal(
    getSolarSalesStage(facts({ leadStatus: "QUALIFIED", dealStage: "QUALIFIED", salesCommercialIntent: "SITE_VISIT_REQUIRED" })),
    "SITE_VISIT_REQUIRED"
  );
  assert.equal(
    getSolarSalesStage(facts({
      leadStatus: "CONVERTED_TO_DEAL",
      dealStage: "QUALIFIED",
      salesCommercialIntent: "SITE_VISIT_REQUIRED",
      visits: [visit("COMPLETED", "COMPLETED")],
    })),
    "SITE_VISIT_COMPLETED"
  );
  assert.equal(
    getSolarSalesStage(facts({
      dealStage: "QUALIFIED",
      visits: [visit("COMPLETED", "COMPLETED")],
      quotes: [quote("draft")],
    })),
    "PROPOSAL_PREPARED"
  );
  assert.equal(
    getSolarSalesStage(facts({
      dealStage: "PROPOSAL_SENT",
      quotes: [quote("sent", "2026-10-04T10:00:00.000Z")],
    })),
    "QUOTE_SENT"
  );
  assert.equal(
    getSolarSalesStage(facts({
      dealStage: "NEGOTIATING",
      quotes: [quote("sent", "2026-10-04T10:00:00.000Z")],
    })),
    "NEGOTIATION"
  );
  assert.equal(getSolarSalesStage(facts({ dealStage: "WON", quotes: [quote("accepted", "2026-10-04T10:00:00.000Z")] })), "WON");
  assert.equal(getSolarSalesStage(facts({ dealStage: "LOST", visits: [visit("COMPLETED", "COMPLETED")] })), "LOST");
});

test("existing solar opportunities map without inventing a completed visit", () => {
  assert.equal(getSolarSalesStage(facts({ leadStatus: "NEW" })), "NEW_LEAD");
  assert.equal(getSolarSalesStage(facts({ leadStatus: "CONTACTED" })), "CONTACTED");
  assert.equal(getSolarSalesStage(facts({ leadStatus: "QUALIFIED", dealStage: "QUALIFIED" })), "QUALIFIED");
  assert.equal(getSolarSalesStage(facts({ leadStatus: "CONVERTED_TO_DEAL", dealStage: "SCOPING" })), "SITE_VISIT_REQUIRED");
  assert.equal(
    getSolarSalesStage(facts({
      dealStage: "SCOPING",
      visits: [visit("SCHEDULED", "DRAFT")],
    })),
    "SITE_VISIT_REQUIRED"
  );
  assert.equal(
    getSolarSalesStage(facts({ dealStage: "SCOPING", quotes: [quote("pending_approval")] })),
    "PROPOSAL_PREPARED"
  );
  assert.equal(
    getSolarSalesStage(facts({ dealStage: "PROPOSAL_SENT" })),
    "QUALIFIED"
  );
});

test("a passed appointment date does not complete the site visit", () => {
  const stage = getSolarSalesStage(facts({
    dealStage: "QUALIFIED",
    salesCommercialIntent: "SITE_VISIT_REQUIRED",
    visits: [{ status: "SCHEDULED", assessmentStatus: "DRAFT", scheduledStartAt: "2020-01-01T08:00:00.000Z" }],
  }));
  assert.equal(stage, "SITE_VISIT_REQUIRED");
});

test("proposal prepared and quote sent require the real quotation state", () => {
  assert.equal(
    getSolarSalesStage(facts({ dealStage: "SCOPING", visits: [visit("COMPLETED", "COMPLETED")] })),
    "SITE_VISIT_COMPLETED"
  );
  const unsent = transitionSolarSalesStage(
    facts({ dealStage: "QUALIFIED", visits: [visit("COMPLETED", "COMPLETED")], quotes: [quote("approved")] }),
    "QUOTE_SENT"
  );
  assert.equal(unsent.persisted, false);
  assert.equal(unsent.action, "send_quote");
  const missing = transitionSolarSalesStage(
    facts({ dealStage: "QUALIFIED", visits: [visit("COMPLETED", "COMPLETED")] }),
    "PROPOSAL_PREPARED"
  );
  assert.equal(missing.action, "create_quote");
  assert.equal(missing.persisted, false);
});

test("invalid jumps are rejected and do not create a work project", () => {
  const skip = transitionSolarSalesStage(facts(), "SITE_VISIT_COMPLETED");
  assert.equal(skip.allowed, false);
  assert.equal(skip.createsWorkProject, false);
  const fakeComplete = transitionSolarSalesStage(
    facts({ leadStatus: "QUALIFIED", dealStage: "QUALIFIED", salesCommercialIntent: "SITE_VISIT_REQUIRED" }),
    "SITE_VISIT_COMPLETED"
  );
  assert.equal(fakeComplete.allowed, false);
  assert.equal(fakeComplete.action, "complete_visit");
  const lost = transitionSolarSalesStage(
    facts({ leadStatus: "QUALIFIED", dealStage: "QUALIFIED", salesCommercialIntent: "SITE_VISIT_REQUIRED" }),
    "LOST"
  );
  assert.equal(lost.action, "mark_lost");
  assert.equal(lost.createsWorkProject, false);
  assert.equal(lost.persisted, false);
});

test("won handoff links a completed sales assessment and does not start another one", () => {
  const won = planWonProjectHandoff({ dealStage: "WON", assessmentStatus: "COMPLETED" });
  assert.equal(won.createProjectAllowed, true);
  assert.equal(won.linkAssessment, true);
  assert.equal(won.skipOperationalAssessment, true);
  assert.equal(won.initialStatus, "PLANNING");
  const lost = planWonProjectHandoff({ dealStage: "LOST", assessmentStatus: "COMPLETED" });
  assert.equal(lost.createProjectAllowed, false);
  assert.equal(lost.linkAssessment, false);
  assert.equal(
    initialDeliveryStatus({
      workflow: "SOLAR_INSTALLATION",
      salesAssessmentCompleted: true,
      paymentReady: false,
      equipmentReady: true,
    }),
    "PLANNING"
  );
  assert.equal(
    initialDeliveryStatus({
      workflow: "SOLAR_INSTALLATION",
      salesAssessmentCompleted: true,
      paymentReady: true,
      equipmentReady: true,
    }),
    "READY_TO_SCHEDULE"
  );
});

test("general trades stays on its own workflow", () => {
  assert.equal(getSolarSalesStage(facts({ preset: "GENERAL_TRADES", dealStage: "SCOPING" })), null);
  const move = transitionSolarSalesStage(facts({ preset: "GENERAL_TRADES", dealStage: "SCOPING" }), "SITE_VISIT_REQUIRED");
  assert.equal(move.allowed, false);
  assert.match(readFileSync("lib/sales/deals/display.ts", "utf8"), /SCOPING: "Scoping"/);
});

test("tenant isolation rejects another company", () => {
  assert.equal(rejectCrossTenant("company-a", "company-b"), true);
  assert.equal(rejectCrossTenant("company-a", "company-a"), false);
  const service = readFileSync("lib/sales/solar-workflow/service.ts", "utf8");
  assert.match(service, /\.eq\("client_id", actor\.clientId\)/);
  assert.match(service, /sales_site_visits/);
  assert.doesNotMatch(service, /from\("work_projects"\)\.insert/);
});

test("solar questions use workflow stages and reporting stays distinct from delivery", () => {
  assert.equal(classifySolarSalesQuestion("Which solar leads still need a site visit?"), "needs_site_visit");
  assert.equal(
    classifySolarSalesQuestion("Which assessments were completed but no proposal has been prepared?"),
    "assessment_without_proposal"
  );
  assert.equal(classifySolarSalesQuestion("Which proposals haven't been sent?"), "unsent_proposals");
  assert.equal(classifySolarSalesQuestion("Which quotes need follow-up?"), "quote_follow_up");
  const report = solarSalesReport([
    { stage: "NEW_LEAD", visitCompleted: false, quotePrepared: false, quoteSent: false },
    { stage: "SITE_VISIT_REQUIRED", visitCompleted: false, quotePrepared: false, quoteSent: false },
    { stage: "SITE_VISIT_COMPLETED", visitCompleted: true, quotePrepared: false, quoteSent: false },
    { stage: "QUOTE_SENT", visitCompleted: true, quotePrepared: true, quoteSent: true },
    { stage: "WON", visitCompleted: true, quotePrepared: true, quoteSent: true },
  ]);
  assert.equal(report.newEnquiries, 5);
  assert.equal(report.siteVisitRequired, 1);
  assert.equal(report.siteVisitsCompleted, 3);
  assert.equal(report.quotesSent, 2);
  assert.equal(report.won, 1);
  assert.equal(report.siteVisitToProposalRate, 66.7);
});
