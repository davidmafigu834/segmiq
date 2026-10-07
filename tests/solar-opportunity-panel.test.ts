import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSolarSalesStage } from "../lib/sales/solar-workflow/derive";
import { emptySolarAssessment } from "../lib/work-projects/field-rules";
import {
  quotationDisplayStatus,
  resolveSolarActiveDeal,
  selectRelevantQuotation,
  solarAssessmentInProgress,
  solarAssessmentSectionsDone,
  solarMissingFacts,
  solarOpportunityAction,
  solarPanelProgress,
  solarPowerLines,
  solarRoofLine,
} from "../lib/sales/solar-workflow/opportunity";
import type { SolarSalesFacts } from "../lib/sales/solar-workflow/types";

function facts(patch: Partial<SolarSalesFacts> = {}): SolarSalesFacts {
  return {
    preset: "SOLAR_INSTALLATION",
    leadStatus: "QUALIFIED",
    dealStage: "QUALIFIED",
    salesCommercialIntent: null,
    visits: [],
    quotes: [],
    ...patch,
  };
}

test("solar panel action follows getSolarSalesStage and solarPrimaryAction", () => {
  assert.equal(getSolarSalesStage(facts({ leadStatus: "NEW", dealStage: null })), "NEW_LEAD");
  assert.equal(solarOpportunityAction(facts({ leadStatus: "NEW", dealStage: null }), { assessmentInProgress: false, projectId: null }).label, "Contact lead");
  assert.equal(solarOpportunityAction(facts({ leadStatus: "CONTACTED", dealStage: null }), { assessmentInProgress: false, projectId: null }).kind, "qualify");
  assert.equal(
    solarOpportunityAction(facts({ salesCommercialIntent: "SITE_VISIT_REQUIRED" }), { assessmentInProgress: false, projectId: null }).kind,
    "schedule_visit"
  );
  assert.equal(
    solarOpportunityAction(
      facts({
        salesCommercialIntent: "SITE_VISIT_REQUIRED",
        visits: [{ status: "SCHEDULED", assessmentStatus: "DRAFT" }],
      }),
      { assessmentInProgress: false, projectId: null }
    ).kind,
    "open_visit"
  );
  assert.equal(
    solarOpportunityAction(
      facts({
        salesCommercialIntent: "SITE_VISIT_REQUIRED",
        visits: [{ status: "SCHEDULED", assessmentStatus: "DRAFT" }],
      }),
      { assessmentInProgress: true, projectId: null }
    ).kind,
    "continue_assessment"
  );
  assert.equal(
    solarOpportunityAction(facts({ dealStage: "WON" }), { assessmentInProgress: false, projectId: null }).kind,
    "create_project"
  );
  assert.equal(
    solarOpportunityAction(facts({ dealStage: "WON" }), { assessmentInProgress: false, projectId: "prj" }).kind,
    "open_project"
  );
});

test("relevant quotation prefers accepted, then sent, over a newer draft", () => {
  const picked = selectRelevantQuotation([
    { id: "draft", status: "draft", createdAt: "2026-10-08T00:00:00.000Z" },
    { id: "sent", status: "sent", sentAt: "2026-10-01T00:00:00.000Z", createdAt: "2026-09-01T00:00:00.000Z" },
  ]);
  assert.equal(picked?.id, "sent");
  const accepted = selectRelevantQuotation([
    { id: "sent", status: "sent", sentAt: "2026-10-02T00:00:00.000Z" },
    { id: "accepted", status: "accepted", sentAt: "2026-10-01T00:00:00.000Z", acceptedAt: "2026-10-03T00:00:00.000Z" },
  ]);
  assert.equal(accepted?.id, "accepted");
  assert.equal(quotationDisplayStatus({ status: "pending_approval" }), "Pending approval");
  assert.equal(quotationDisplayStatus({ status: "approved", approvalStatus: "approved" }), "Approved");
  assert.equal(quotationDisplayStatus({ status: "sent", viewedAt: "2026-10-02T00:00:00.000Z" }), "Viewed");
  assert.equal(quotationDisplayStatus({ status: "declined" }), "Rejected");
  assert.equal(quotationDisplayStatus({ status: "expired" }), "Expired");
});

test("assessment summary is deterministic and a copied address is not progress", () => {
  const scheduled = emptySolarAssessment();
  scheduled.site.address = "Borrowdale, Harare";
  assert.equal(solarAssessmentInProgress(scheduled), false);
  const started = emptySolarAssessment();
  started.power.gridAvailable = "yes";
  started.power.generatorPresent = "yes";
  started.loads = [
    { name: "Lights", quantity: 1, watts: null, essential: true, notes: null },
    { name: "Fridge", quantity: 1, watts: null, essential: true, notes: null },
  ];
  started.roof.roofType = "Tile";
  started.roof.shading = "Moderate shade";
  started.outcome = "suitable";
  assert.equal(solarAssessmentInProgress(started), true);
  assert.equal(solarAssessmentSectionsDone(started), 4);
  assert.deepEqual(solarPowerLines(started), ["Grid available", "Generator present"]);
  assert.equal(solarRoofLine(started), "Tile · Moderate shade");
});

test("missing facts skip values already captured", () => {
  const missing = solarMissingFacts({
    stage: "QUALIFIED",
    location: "Borrowdale",
    budget: "5000",
    timeline: "This month",
    assessment: null,
    assessmentComplete: false,
  });
  assert.deepEqual(missing, ["Roof and site assessment"]);
  assert.deepEqual(
    solarMissingFacts({
      stage: "QUOTE_SENT",
      location: null,
      budget: null,
      timeline: null,
      assessment: null,
      assessmentComplete: true,
    }),
    []
  );
});

test("cue and panel share the active deal resolver", () => {
  const older = { id: "a", stage: "QUALIFIED", updated_at: "2026-10-01T00:00:00.000Z" };
  const newer = { id: "b", stage: "QUALIFIED", updated_at: "2026-10-05T00:00:00.000Z" };
  const won = { id: "won", stage: "WON", updated_at: "2026-10-08T00:00:00.000Z" };
  assert.equal(resolveSolarActiveDeal([won, newer, older], "a")?.id, "a");
  assert.equal(resolveSolarActiveDeal([won, newer, older], null)?.id, "b");
  assert.equal(resolveSolarActiveDeal([won], null)?.id, "won");
  const service = readFileSync("lib/sales/solar-workflow/service.ts", "utf8");
  const uses = service.split("resolveSolarActiveDeal(").length - 1;
  assert.ok(uses >= 2);
  assert.match(service, /focusSolarOpportunity/);
  assert.match(service, /\.eq\("client_id", actor\.clientId\)/);
  assert.match(service, /originating_lead_id !== leadId/);
  assert.doesNotMatch(readFileSync("components/inbox/SolarOpportunityPanel.tsx", "utf8"), /\/briefing/);
  assert.doesNotMatch(readFileSync("components/inbox/SolarOpportunityPanel.tsx", "utf8"), /Move to Next Stage/);
  assert.doesNotMatch(readFileSync("components/inbox/SolarOpportunityPanel.tsx", "utf8"), /DEAL_ACTIVE_STAGES/);
  assert.match(readFileSync("components/inbox/SalesIntelligenceRail.tsx", "utf8"), /Move to Next Stage/);
  assert.match(readFileSync("components/inbox/SalesIntelligenceRail.tsx", "utf8"), /DEAL_ACTIVE_STAGES/);
  assert.match(readFileSync("components/inbox/TeamInbox.tsx", "utf8"), /SOLAR_INSTALLATION/);
  assert.match(readFileSync("components/inbox/SolarOpportunityPanel.tsx", "utf8"), /canModifyDeal/);
  assert.match(readFileSync("components/inbox/SolarOpportunityPanel.tsx", "utf8"), /stageLabel/);
  assert.match(readFileSync("components/inbox/SolarOpportunityPanel.tsx", "utf8"), /Schedule site visit/);
  const progress = solarPanelProgress("SITE_VISIT_REQUIRED");
  assert.equal(progress.find((step) => step.id === "visit")?.state, "current");
  assert.equal(progress.some((step) => step.label === "Scoping"), false);
});
