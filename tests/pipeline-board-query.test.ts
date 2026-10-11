import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_FILTERS,
  activeFilterGroupCount,
  applyBoardFilters,
  dealTemperature,
  nextActionBucket,
} from "../lib/sales/pipeline-board-query";
import type { PipelineDealCardItem } from "../components/sales/pipeline/PipelineDealCard";
import type { DealRow } from "../types";

function item(partial: Partial<DealRow> & { stage: DealRow["stage"] }): PipelineDealCardItem {
  return {
    deal: {
      id: "deal-1",
      client_id: "client-1",
      contact_id: null,
      originating_lead_id: "lead-1",
      owner_id: "user-1",
      name: "Kitchen",
      service_summary: null,
      value_status: "PENDING_ESTIMATE",
      value_basis: null,
      estimated_value: 1000,
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
      last_meaningful_activity_at: new Date().toISOString(),
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...partial,
    },
    commercial: { kind: "pending", amount: null, basis: null, label: "Pending", display: "Value pending" },
    customerName: "Ada",
    customerPhone: null,
    customerCompany: null,
    leadScore: null,
    leadSource: "whatsapp",
    leadManualPriority: null,
    quoteCount: 0,
    latestQuote: null,
  };
}

describe("pipeline board query", () => {
  it("treats temperatures inside one category as alternatives", () => {
    const now = new Date("2026-10-12T10:00:00.000Z");
    const hot = item({ stage: "QUALIFIED", leadManualPriority: "hot" } as Partial<DealRow> & { stage: DealRow["stage"] });
    hot.leadManualPriority = "hot";
    const cold = item({ stage: "QUALIFIED" });
    cold.leadManualPriority = "cold";
    const filters = { ...EMPTY_FILTERS, temperatures: ["hot" as const, "warm" as const] };
    assert.equal(applyBoardFilters(hot, filters, now), true);
    assert.equal(applyBoardFilters(cold, filters, now), false);
    assert.equal(dealTemperature(hot), "hot");
  });

  it("combines temperature and next-action filters", () => {
    const now = new Date("2026-10-12T10:00:00.000Z");
    const overdue = item({
      stage: "QUALIFIED",
      next_action_at: "2026-10-11T09:00:00.000Z",
    });
    overdue.leadManualPriority = "hot";
    const upcoming = item({
      stage: "QUALIFIED",
      next_action_at: "2026-10-20T09:00:00.000Z",
    });
    upcoming.leadManualPriority = "hot";
    const filters = {
      ...EMPTY_FILTERS,
      temperatures: ["hot" as const],
      nextActions: ["overdue" as const],
    };
    assert.equal(nextActionBucket(overdue.deal, now), "overdue");
    assert.equal(applyBoardFilters(overdue, filters, now), true);
    assert.equal(applyBoardFilters(upcoming, filters, now), false);
    assert.equal(activeFilterGroupCount(filters), 2);
  });

  it("leaves an empty filter set matching every active deal", () => {
    const now = new Date("2026-10-12T10:00:00.000Z");
    assert.equal(applyBoardFilters(item({ stage: "SCOPING" }), EMPTY_FILTERS, now), true);
    assert.equal(activeFilterGroupCount(EMPTY_FILTERS), 0);
  });
});
