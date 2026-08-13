import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCompanyLeadsKpis,
  companyLeadScoreSignals,
  conversionRate,
  countCompanyLeadsTabs,
  customerNeedFromLead,
  isHotIntent,
  leadsTrend,
  matchesCompanyLeadsFilters,
  matchesCompanyLeadsSearch,
  matchesCompanyLeadsTab,
  sortCompanyLeadsRows,
} from "../lib/sales/company-leads-metrics";
import { DEFAULT_COMPANY_LEADS_FILTERS } from "../components/dashboard/company/leads/types";
import type { CompanyLeadRow } from "../components/dashboard/company/leads/types";

function row(partial: Partial<CompanyLeadRow> = {}): CompanyLeadRow {
  return {
    id: "lead-1",
    identity: "Moyo Residence",
    enquiryContext: "Residential solar",
    location: "Harare",
    sourceKey: "whatsapp",
    sourceLabel: "WhatsApp",
    sourceRaw: "WHATSAPP_INBOUND",
    phone: "+263 77 123 4567",
    email: "moyo@example.com",
    lifecycle: "NEW",
    lifecycleLabel: "New",
    leadScore: 92,
    intent: "hot",
    intentLabel: "Hot Lead",
    ownerId: "owner-1",
    ownerName: "Tendai Moyo",
    ownerAvatarUrl: null,
    createdAt: "2026-08-13T08:24:00.000Z",
    createdLabel: "13 Aug",
    firstContactAt: null,
    lastActivityAt: null,
    followUpAt: null,
    nextAction: {
      hasNextAction: false,
      isOverdue: false,
      label: null,
      at: null,
      whenLabel: null,
      urgency: null,
      completable: false,
    },
    hasDeal: false,
    activeDealId: null,
    contactId: null,
    customerWaiting: false,
    canModify: true,
    ...partial,
  };
}

describe("company Leads intent and lifecycle", () => {
  it("keeps Hot as score intent instead of a lifecycle status", () => {
    const hotNew = row({ lifecycle: "NEW", leadScore: 92, intent: "hot" });
    assert.equal(isHotIntent(hotNew.leadScore), true);
    assert.equal(matchesCompanyLeadsTab(hotNew, "hot"), true);
    assert.equal(matchesCompanyLeadsTab(hotNew, "new"), true);
    assert.equal(hotNew.lifecycle, "NEW");
  });

  it("does not surface Not Qualified records as actionable Hot Leads", () => {
    const notQualified = row({ lifecycle: "NOT_QUALIFIED", leadScore: 95, intent: "hot" });
    assert.equal(matchesCompanyLeadsTab(notQualified, "hot"), false);
    assert.deepEqual(countCompanyLeadsTabs([notQualified]), {
      all: 1,
      new: 0,
      hot: 0,
      contacted: 0,
      qualified: 0,
      not_qualified: 1,
    });
  });

  it("counts lifecycle tabs independently from intent", () => {
    const rows = [
      row({ id: "n", lifecycle: "NEW", leadScore: 80 }),
      row({ id: "c", lifecycle: "CONTACTED", leadScore: 60, intent: "warm" }),
      row({ id: "q", lifecycle: "QUALIFIED", leadScore: 88 }),
      row({ id: "d", lifecycle: "CONVERTED_TO_DEAL", leadScore: 75 }),
      row({ id: "x", lifecycle: "NOT_QUALIFIED", leadScore: 20, intent: "cold" }),
    ];
    assert.deepEqual(countCompanyLeadsTabs(rows), {
      all: 5,
      new: 1,
      hot: 3,
      contacted: 1,
      qualified: 2,
      not_qualified: 1,
    });
  });
});

describe("company Leads KPI definitions", () => {
  it("builds exactly the six approved KPI cards", () => {
    const kpis = buildCompanyLeadsKpis({
      newLeads: 56,
      newLeadsPrev: 45,
      hotLeads: 18,
      hotLeadsPrev: 16,
      contacted: 32,
      contactedPrev: 27,
      qualified: 14,
      qualifiedPrev: 11,
      conversionPct: 26,
      conversionPrev: 24,
      avgResponseMinutes: 108,
      avgResponseMinutesPrev: 127,
    });
    assert.deepEqual(
      kpis.map((k) => k.label),
      [
        "New Leads",
        "Hot Leads",
        "Contacted",
        "Qualified",
        "Conversion Rate",
        "Avg. Response Time",
      ]
    );
    assert.equal(kpis[4]?.value, "26%");
    assert.equal(kpis[5]?.value, "1h 48m");
  });

  it("uses Lead-to-Deal cohort conversion and never divides by zero", () => {
    assert.equal(conversionRate(13, 50), 26);
    assert.equal(conversionRate(1, 3), 33.3);
    assert.equal(conversionRate(0, 0), null);
  });

  it("renders a zero-baseline increase as New instead of Infinity", () => {
    const trend = leadsTrend(4, 0, "vs last 30 days");
    assert.equal(trend?.direction, "up");
    assert.match(trend?.label ?? "", /New/);
    assert.doesNotMatch(trend?.label ?? "", /Infinity/);
  });

  it("omits a Hot trend when historical score snapshots are unavailable", () => {
    const hot = buildCompanyLeadsKpis({
      newLeads: 0,
      newLeadsPrev: 0,
      hotLeads: 7,
      hotLeadsPrev: null,
      contacted: 0,
      contactedPrev: 0,
      qualified: 0,
      qualifiedPrev: 0,
      conversionPct: null,
      conversionPrev: null,
      avgResponseMinutes: null,
      avgResponseMinutesPrev: null,
    }).find((kpi) => kpi.id === "hot-leads");
    assert.equal(hot?.trend, undefined);
  });
});

describe("company Leads table behavior", () => {
  it("searches identity, contact, source, location, and owner fields", () => {
    const lead = row();
    for (const query of ["moyo", "263 77", "example.com", "whatsapp", "harare", "tendai"]) {
      assert.equal(matchesCompanyLeadsSearch(lead, query), true, query);
    }
    assert.equal(matchesCompanyLeadsSearch(lead, "bulawayo"), false);
  });

  it("applies owner, source, lifecycle, intent, contact, and Deal filters exactly", () => {
    const lead = row({ firstContactAt: "2026-08-13T09:00:00.000Z", hasDeal: true });
    assert.equal(
      matchesCompanyLeadsFilters(lead, {
        ...DEFAULT_COMPANY_LEADS_FILTERS,
        ownerId: "owner-1",
        source: "whatsapp",
        lifecycle: "NEW",
        intent: "hot",
        firstContact: "contacted",
        hasDeal: "has_deal",
      }),
      true
    );
    assert.equal(
      matchesCompanyLeadsFilters(lead, {
        ...DEFAULT_COMPANY_LEADS_FILTERS,
        ownerId: "unassigned",
      }),
      false
    );
  });

  it("sorts by score and keeps unknown scores last", () => {
    const sorted = sortCompanyLeadsRows(
      [
        row({ id: "unknown", identity: "Unknown", leadScore: null, intent: null }),
        row({ id: "warm", identity: "Warm", leadScore: 60, intent: "warm" }),
        row({ id: "hot", identity: "Hot", leadScore: 90, intent: "hot" }),
      ],
      "score"
    );
    assert.deepEqual(sorted.map((lead) => lead.id), ["hot", "warm", "unknown"]);
  });
});

describe("company Lead detail facts", () => {
  it("uses only stored score reasons and caps the checklist at four", () => {
    const signals = companyLeadScoreSignals({
      customerNeed: "5kW backup system",
      budget: "$5,000",
      buyingTimeframe: "1-3 months",
      decisionMakerStatus: "YES",
      projectType: "Solar",
      source: "WHATSAPP_INBOUND",
      scoreBreakdown: { calls: 10, assets_sent: 5 },
      status: "QUALIFIED",
    });
    assert.equal(signals.length, 4);
    assert.deepEqual(signals.map((signal) => signal.id), ["need", "budget", "timeframe", "decision"]);
  });

  it("uses canonical customer need fallbacks without rendering undefined", () => {
    assert.equal(
      customerNeedFromLead({ formData: { message: "Need backup power" } }),
      "Need backup power"
    );
    assert.equal(customerNeedFromLead({ formData: { message: "undefined" } }), null);
    assert.equal(customerNeedFromLead({ projectType: "Commercial solar" }), "Commercial solar");
  });
});
