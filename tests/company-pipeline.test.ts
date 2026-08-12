import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  averageKnownDealValue,
  companyPipelineHealth,
  companyPipelineHealthBarPct,
  companyPipelineValueLabel,
  countPipelineTabs,
  formatExpectedDecision,
  isCompanyPipelineAtRisk,
  isNextActionDueTodayOrOverdue,
  locationFromDealOrLead,
  matchesCompanyPipelineFilters,
  matchesCompanyPipelineSearch,
  matchesCompanyPipelineTab,
  sumKnownDealValue,
} from "../lib/sales/company-pipeline-metrics";
import { getDealAttentionState } from "../lib/sales/deals/attention";
import { DEFAULT_COMPANY_PIPELINE_FILTERS } from "../components/dashboard/company/pipeline/types";
import type { CompanyPipelineDealRow } from "../components/dashboard/company/pipeline/types";
import type { DealRow } from "../types";

function att(partial: Partial<Parameters<typeof getDealAttentionState>[0]>) {
  return getDealAttentionState(
    {
      stage: "QUALIFIED",
      next_action_at: new Date(Date.now() + 86_400_000 * 14).toISOString(),
      next_action_label: "Follow up",
      expected_decision_at: null,
      last_meaningful_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      value_status: "KNOWN",
      ...partial,
    },
    new Date()
  );
}

function row(partial: Partial<CompanyPipelineDealRow>): CompanyPipelineDealRow {
  return {
    id: "d1",
    dealName: "Kitchen remodel",
    category: "Renovation",
    customerName: "Ada Okonkwo",
    customerLocation: "Lagos",
    customerPhone: "+234800000000",
    originatingLeadId: "l1",
    stage: "QUALIFIED",
    stageLabel: "Qualified",
    valueLabel: "$12,000",
    valueKnown: 12000,
    valuePending: false,
    expectedDecisionAt: "2026-05-28",
    expectedDecisionLabel: "May 28, 2026",
    nextAction: {
      hasNextAction: true,
      isOverdue: false,
      label: "Site visit",
      at: new Date(Date.now() + 86_400_000).toISOString(),
      whenLabel: "Tomorrow",
      urgency: "tomorrow",
    },
    ownerId: "u1",
    ownerName: "Tendai",
    ownerAvatarUrl: null,
    health: "on_track",
    healthLabel: "On track",
    healthReason: "Recent activity and a clear next action are recorded.",
    atRisk: false,
    urgency: 30,
    sourceKey: "whatsapp",
    sourceLabel: "WhatsApp",
    lostReason: null,
    wonValue: null,
    closedAt: null,
    closedAtLabel: null,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    canModify: false,
    ...partial,
  };
}

describe("company pipeline metrics", () => {
  it("never treats unknown Deal value as zero in the pipeline total", () => {
    const { total, pendingCount, knownCount } = sumKnownDealValue([15000, null, 5000]);
    assert.equal(total, 20000);
    assert.equal(pendingCount, 1);
    assert.equal(knownCount, 2);
  });

  it("averages known active values only", () => {
    assert.equal(averageKnownDealValue([100, 200, 300]), 200);
    assert.equal(averageKnownDealValue([]), null);
  });

  it("displays pending commercial value as Value not estimated, never $0", () => {
    assert.equal(
      companyPipelineValueLabel({
        kind: "pending",
        amount: null,
        basis: null,
        label: "Value not estimated yet",
        display: "Value not estimated yet",
      }),
      "Value not estimated"
    );
  });

  it("maps attention to On track / Needs attention / At risk without a fake percentage model", () => {
    const healthy = att({});
    assert.equal(companyPipelineHealth(healthy), "on_track");
    assert.equal(companyPipelineHealthBarPct("on_track"), 100);

    const noNext = att({ next_action_at: null, next_action_label: null });
    assert.equal(isCompanyPipelineAtRisk(noNext), true);
    assert.equal(companyPipelineHealth(noNext), "at_risk");
  });

  it("counts All Deals as active stages only", () => {
    const counts = countPipelineTabs([
      { stage: "QUALIFIED" },
      { stage: "SCOPING" },
      { stage: "WON" },
      { stage: "LOST" },
    ]);
    assert.equal(counts.all, 2);
    assert.equal(counts.QUALIFIED, 1);
    assert.equal(counts.WON, 1);
    assert.equal(counts.LOST, 1);
  });

  it("All Deals tab excludes Won and Lost", () => {
    assert.equal(matchesCompanyPipelineTab(row({ stage: "QUALIFIED" }), "all"), true);
    assert.equal(matchesCompanyPipelineTab(row({ stage: "WON" }), "all"), false);
    assert.equal(matchesCompanyPipelineTab(row({ stage: "WON" }), "WON"), true);
  });

  it("formats missing expected decision as Not set, not a dash", () => {
    assert.equal(formatExpectedDecision(null), "Not set");
    assert.equal(formatExpectedDecision("2026-05-28T12:00:00.000Z"), "May 28, 2026");
  });

  it("omits missing location instead of rendering undefined", () => {
    assert.equal(locationFromDealOrLead(null, { city: "undefined" }), null);
    assert.equal(locationFromDealOrLead(" Harare ", null), "Harare");
    assert.equal(locationFromDealOrLead(null, { city: "Nairobi" }), "Nairobi");
  });

  it("next actions due today/overdue ignore Deals with no action", () => {
    const deal = {
      stage: "QUALIFIED",
      next_action_at: null,
      next_action_label: null,
    } as Pick<DealRow, "stage" | "next_action_at" | "next_action_label">;
    assert.equal(isNextActionDueTodayOrOverdue(deal), false);

    const overdue = {
      stage: "QUALIFIED",
      next_action_at: new Date(Date.now() - 86_400_000).toISOString(),
      next_action_label: "Call",
    } as Pick<DealRow, "stage" | "next_action_at" | "next_action_label">;
    assert.equal(isNextActionDueTodayOrOverdue(overdue), true);
  });

  it("search matches Deal name and customer, not missing fields as undefined", () => {
    assert.equal(matchesCompanyPipelineSearch(row({}), "kitchen"), true);
    assert.equal(matchesCompanyPipelineSearch(row({}), "ada"), true);
    assert.equal(matchesCompanyPipelineSearch(row({}), "zzzz"), false);
  });

  it("at-risk and owner filters are exact", () => {
    const atRisk = row({ health: "at_risk", atRisk: true, ownerId: "u2" });
    assert.equal(
      matchesCompanyPipelineFilters(atRisk, {
        ...DEFAULT_COMPANY_PIPELINE_FILTERS,
        health: "at_risk",
      }),
      true
    );
    assert.equal(
      matchesCompanyPipelineFilters(atRisk, {
        ...DEFAULT_COMPANY_PIPELINE_FILTERS,
        ownerId: "u1",
      }),
      false
    );
    assert.equal(
      matchesCompanyPipelineFilters(row({ valueKnown: 5000 }), DEFAULT_COMPANY_PIPELINE_FILTERS),
      true
    );
    assert.equal(
      matchesCompanyPipelineFilters(row({ valueKnown: null, valuePending: true }), {
        ...DEFAULT_COMPANY_PIPELINE_FILTERS,
        valueMin: "1000",
      }),
      false
    );
  });
});
