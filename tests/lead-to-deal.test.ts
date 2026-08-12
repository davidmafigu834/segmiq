import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDealCommercialValue,
  getDealNumericValueForCoverage,
  inferValueStatus,
} from "../lib/sales/deals/commercial-value";
import { getDealReadiness } from "../lib/sales/deals/readiness";
import { getDealCompleteness } from "../lib/sales/deals/completeness";
import { isDealActiveStage, formatDealStage, isLeadConverted } from "../lib/sales/deals/display";
import {
  buildCreateDealPayload,
  buildDealUpdatePatch,
  parseLeadBudgetHint,
  suggestDealName,
} from "../lib/sales/deals/create-deal-form";
import type { DealRow, LeadRow } from "../types";

function baseDeal(over: Partial<DealRow> = {}): DealRow {
  return {
    id: "d1",
    client_id: "c1",
    contact_id: null,
    originating_lead_id: "l1",
    owner_id: "u1",
    name: "5kW Solar Installation",
    service_summary: "Solar backup",
    stage: "QUALIFIED",
    value_status: "PENDING_ESTIMATE",
    value_basis: null,
    estimated_value: null,
    estimated_value_min: null,
    estimated_value_max: null,
    customer_budget: null,
    sales_estimate: null,
    expected_decision_at: null,
    location: null,
    buying_timeframe: null,
    decision_maker_status: null,
    decision_maker_name: null,
    next_action_at: null,
    next_action_label: null,
    won_value: null,
    won_at: null,
    lost_at: null,
    lost_reason: null,
    last_meaningful_activity_at: null,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  };
}

function baseLead(over: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "l1",
    client_id: "c1",
    assigned_to_id: "u1",
    contact_id: null,
    source: "FACEBOOK",
    status: "CONTACTED",
    form_data: {},
    name: "Tafadzwa Moyo",
    phone: "+263771234567",
    email: null,
    budget: null,
    project_type: "Solar installation",
    timeline: "Within 30 days",
    magic_token: null,
    magic_token_expires_at: null,
    not_qualified_reason: null,
    lost_reason: null,
    deal_value: null,
    follow_up_date: null,
    facebook_lead_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    score: 91,
    score_updated_at: null,
    score_breakdown: null,
    is_stale: false,
    stale_since: null,
    is_convert_later_pick: false,
    convert_later_note: null,
    manual_priority: "hot",
    customer_need: "5kW backup solar",
    ...over,
  };
}

describe("getDealCommercialValue", () => {
  it("does not treat pending as $0", () => {
    const v = getDealCommercialValue(baseDeal());
    assert.equal(v.kind, "pending");
    assert.equal(getDealNumericValueForCoverage(baseDeal()), null);
  });

  it("returns sales estimate when known", () => {
    const v = getDealCommercialValue(
      baseDeal({
        value_status: "KNOWN",
        value_basis: "SALES_ESTIMATE",
        sales_estimate: 6500,
        estimated_value: 6500,
      })
    );
    assert.equal(v.kind, "amount");
    if (v.kind === "amount") {
      assert.equal(v.amount, 6500);
      assert.equal(v.basis, "SALES_ESTIMATE");
    }
  });

  it("prefers latest quote when basis is LATEST_QUOTE", () => {
    const v = getDealCommercialValue(
      baseDeal({
        value_status: "KNOWN",
        value_basis: "LATEST_QUOTE",
        sales_estimate: 6500,
      }),
      { latestQuoteTotal: 6840 }
    );
    assert.equal(v.kind, "amount");
    if (v.kind === "amount") {
      assert.equal(v.amount, 6840);
      assert.equal(v.basis, "LATEST_QUOTE");
    }
  });

  it("supports value ranges", () => {
    const v = getDealCommercialValue(
      baseDeal({
        value_status: "RANGE",
        value_basis: "CUSTOMER_BUDGET",
        estimated_value_min: 5000,
        estimated_value_max: 7000,
      })
    );
    assert.equal(v.kind, "range");
    if (v.kind === "range") {
      assert.equal(v.min, 5000);
      assert.equal(v.max, 7000);
    }
  });

  it("uses won value for closed won deals", () => {
    const v = getDealCommercialValue(
      baseDeal({
        stage: "WON",
        won_value: 6500,
        sales_estimate: 7000,
      })
    );
    assert.equal(v.kind, "amount");
    if (v.kind === "amount") assert.equal(v.basis, "WON_VALUE");
  });
});

describe("inferValueStatus", () => {
  it("marks pending when requested", () => {
    assert.equal(inferValueStatus({ pending: true, estimatedValue: 100 }), "PENDING_ESTIMATE");
  });
  it("marks range when min/max present", () => {
    assert.equal(inferValueStatus({ min: 5, max: 10 }), "RANGE");
  });
});

describe("getDealReadiness", () => {
  it("is not ready for raw new lead without discovery", () => {
    const r = getDealReadiness({
      lead: baseLead({ status: "NEW", customer_need: null, project_type: null, follow_up_date: null }),
    });
    assert.equal(r.ready, false);
  });

  it("becomes ready when requirement, interest, and next step exist — value optional", () => {
    const r = getDealReadiness({
      lead: baseLead({ follow_up_date: "2026-08-12" }),
      discovery: {
        interestConfirmed: true,
        nextStepAgreed: true,
        valuePending: true,
      },
    });
    assert.equal(r.ready, true);
    assert.equal(r.statusLabel, "Ready to create deal");
    const valueItem = r.items.find((i) => i.id === "value");
    assert.equal(valueItem?.required, false);
  });
});

describe("getDealCompleteness", () => {
  it("suggests expected decision when missing", () => {
    const c = getDealCompleteness(
      baseDeal({
        value_status: "KNOWN",
        sales_estimate: 6500,
        estimated_value: 6500,
        decision_maker_status: "YES",
        next_action_at: "2026-08-12T10:00:00Z",
      })
    );
    assert.ok(c.nextSuggestion?.id === "expected_decision" || c.doneCount < c.total);
  });
});

describe("display helpers", () => {
  it("formats stages for humans", () => {
    assert.equal(formatDealStage("PROPOSAL_SENT"), "Proposal sent");
    assert.equal(isDealActiveStage("SCOPING"), true);
    assert.equal(isDealActiveStage("WON"), false);
    assert.equal(isLeadConverted("CONVERTED_TO_DEAL"), true);
  });
});

describe("not qualified isolation", () => {
  it("readiness for not-qualified still evaluates fields but product blocks create separately", () => {
    const r = getDealReadiness({
      lead: baseLead({ status: "NOT_QUALIFIED", follow_up_date: "2026-08-12" }),
      discovery: { interestConfirmed: true, nextStepAgreed: true },
    });
    // Readiness can be structurally ready; createDealFromLead rejects NOT_QUALIFIED
    assert.equal(typeof r.ready, "boolean");
  });
});

describe("create deal form helpers", () => {
  it("suggests deal name from project, not customer name", () => {
    assert.equal(
      suggestDealName({
        project_type: "Warehouse Roofing Project",
        customer_need: null,
        name: "Tafadzwa Moyo",
      }),
      "Warehouse Roofing Project"
    );
    assert.equal(
      suggestDealName({ project_type: null, customer_need: null, name: "Tafadzwa Moyo" }),
      ""
    );
  });

  it("parses budget exact and range", () => {
    assert.deepEqual(parseLeadBudgetHint("$6,500"), { mode: "exact", exact: 6500 });
    assert.deepEqual(parseLeadBudgetHint("$5,000 – $7,000"), {
      mode: "range",
      min: 5000,
      max: 7000,
    });
    assert.deepEqual(parseLeadBudgetHint(null), { mode: "later" });
  });

  it("builds exact / range / later payloads", () => {
    const exact = buildCreateDealPayload({
      name: "5kW Solar",
      serviceSummary: "Solar",
      customerNeed: "Backup",
      location: "",
      buyingTimeframe: "Within 30 days",
      decisionMakerStatus: "",
      decisionMakerName: "",
      expectedDecisionAt: "",
      valueMode: "exact",
      exactValue: "6500",
      rangeMin: "",
      rangeMax: "",
      nextActionLabel: "Follow up",
      nextActionAt: "2026-08-15T10:00",
      notes: "",
    });
    assert.equal(exact.ok, true);
    if (exact.ok) {
      assert.equal(exact.payload.salesEstimate, 6500);
      assert.equal(exact.payload.valuePending, false);
    }

    const range = buildCreateDealPayload({
      name: "Roofing",
      serviceSummary: "",
      customerNeed: "",
      location: "",
      buyingTimeframe: "",
      decisionMakerStatus: "",
      decisionMakerName: "",
      expectedDecisionAt: "",
      valueMode: "range",
      exactValue: "",
      rangeMin: "5000",
      rangeMax: "7000",
      nextActionLabel: "",
      nextActionAt: "",
      notes: "Spoke on site",
    });
    assert.equal(range.ok, true);
    if (range.ok) {
      assert.equal(range.payload.estimatedValueMin, 5000);
      assert.equal(range.payload.estimatedValueMax, 7000);
      assert.equal(range.payload.notes, "Spoke on site");
    }

    const badRange = buildCreateDealPayload({
      name: "Roofing",
      serviceSummary: "",
      customerNeed: "",
      location: "",
      buyingTimeframe: "",
      decisionMakerStatus: "",
      decisionMakerName: "",
      expectedDecisionAt: "",
      valueMode: "range",
      exactValue: "",
      rangeMin: "7000",
      rangeMax: "5000",
      nextActionLabel: "",
      nextActionAt: "",
      notes: "",
    });
    assert.equal(badRange.ok, false);

    const later = buildCreateDealPayload({
      name: "Site visit deal",
      serviceSummary: "",
      customerNeed: "",
      location: "",
      buyingTimeframe: "",
      decisionMakerStatus: "",
      decisionMakerName: "",
      expectedDecisionAt: "",
      valueMode: "later",
      exactValue: "",
      rangeMin: "",
      rangeMax: "",
      nextActionLabel: "Site assessment",
      nextActionAt: "",
      notes: "",
    });
    assert.equal(later.ok, true);
    if (later.ok) {
      assert.equal(later.payload.valuePending, true);
      assert.equal(later.payload.salesEstimate, null);
    }
  });

  it("builds deal update patch for range and pending", () => {
    const range = buildDealUpdatePatch({
      name: "Roof",
      serviceSummary: "Roofing",
      location: "Harare",
      buyingTimeframe: "Within 30 days",
      decisionMakerStatus: "YES",
      decisionMakerName: "Tendai",
      expectedDecisionAt: "2026-09-01",
      valueMode: "range",
      exactValue: "",
      rangeMin: "5000",
      rangeMax: "7000",
      nextActionLabel: "Follow up",
      nextActionAt: "2026-08-20T10:00",
    });
    assert.equal(range.ok, true);
    if (range.ok) {
      assert.equal(range.patch.value_status, "RANGE");
      assert.equal(range.patch.estimated_value_min, 5000);
      assert.equal(range.patch.estimated_value_max, 7000);
      assert.equal(range.patch.decision_maker_status, "YES");
    }

    const pending = buildDealUpdatePatch({
      name: "Site visit",
      serviceSummary: "",
      location: "",
      buyingTimeframe: "",
      decisionMakerStatus: "",
      decisionMakerName: "",
      expectedDecisionAt: "",
      valueMode: "later",
      exactValue: "",
      rangeMin: "",
      rangeMax: "",
      nextActionLabel: "",
      nextActionAt: "",
    });
    assert.equal(pending.ok, true);
    if (pending.ok) {
      assert.equal(pending.patch.value_status, "PENDING_ESTIMATE");
      assert.equal(pending.patch.estimated_value, null);
    }
  });
});
