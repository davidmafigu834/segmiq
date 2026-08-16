/**
 * Company Reports metric definitions — no Supabase.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  avgSalesCycleDays,
  avgWonDealValue,
  cohortConversionFunnel,
  formatAxisMoney,
  knownWonValue,
  leadToDealConversion,
  leadsBySource,
  reportTrend,
  semanticTrend,
  sumKnownWonValue,
} from "../lib/sales/company-reports/metrics";
import {
  formatRangeLabel,
  inclusiveDayCount,
  previousEquivalentRange,
  rangeForCompanyPreset,
  suggestGranularity,
} from "../lib/sales/company-reports/range";
import { buildCompanyReportCsv } from "../lib/sales/company-reports/export";
import type { CompanyReportOverview } from "../lib/sales/company-reports/types";

describe("company reports previous-period methodology", () => {
  it("uses an equivalent preceding window of the same duration", () => {
    const from = new Date("2026-05-17T00:00:00");
    const to = new Date("2026-06-16T00:00:00");
    const prev = previousEquivalentRange(from, to);
    assert.equal(prev.to.getTime(), from.getTime());
    assert.equal(prev.to.getTime() - prev.from.getTime(), to.getTime() - from.getTime());
    assert.equal(inclusiveDayCount(from, to), 30);
    assert.equal(inclusiveDayCount(prev.from, prev.to), 30);
    assert.match(formatRangeLabel(from, to), /May 17/);
    assert.match(formatRangeLabel(from, to), /Jun 15/);
  });

  it("defaults last 30 days to a 30-day exclusive-end window", () => {
    const now = new Date("2026-06-15T15:00:00");
    const range = rangeForCompanyPreset("last_30", now);
    assert.equal(inclusiveDayCount(range.from, range.to), 30);
  });

  it("suggests daily granularity for short ranges", () => {
    const from = new Date("2026-05-17T00:00:00");
    const to = new Date("2026-06-16T00:00:00");
    assert.equal(suggestGranularity(from, to), "day");
  });
});

describe("company reports trends", () => {
  it("never emits Infinity% when previous is 0", () => {
    const t = reportTrend(12, 0);
    assert.equal(t.direction, "new");
    assert.equal(t.label.includes("∞"), false);
    assert.equal(t.label.includes("Infinity"), false);
  });

  it("returns no comparison when both periods are empty", () => {
    const t = reportTrend(0, 0);
    assert.equal(t.direction, "none");
  });

  it("inverts response-time / lost / cycle direction so decreases are positive", () => {
    const slower = semanticTrend(reportTrend(20, 10), true);
    assert.equal(slower.direction, "down");
    const faster = semanticTrend(reportTrend(10, 20), true);
    assert.equal(faster.direction, "up");
  });
});

describe("company reports revenue and conversion", () => {
  it("sums known won values and ignores null", () => {
    const sum = sumKnownWonValue([{ won_value: 100 }, { won_value: null }, { won_value: 50 }]);
    assert.equal(sum, 150);
    assert.equal(knownWonValue(null), null);
  });

  it("avg won deal value is null when there are no known values", () => {
    assert.equal(avgWonDealValue(0, 0), null);
    assert.equal(avgWonDealValue(300, 2), 150);
  });

  it("Lead → Deal conversion is cohort deals / cohort leads", () => {
    assert.equal(leadToDealConversion(40, 168), 23.8);
    assert.equal(leadToDealConversion(0, 0), null);
  });

  it("cohort funnel uses the initial Lead count as 100%", () => {
    const stages = cohortConversionFunnel({
      cohortLeads: [
        { id: "1", status: "NEW" },
        { id: "2", status: "CONTACTED" },
        { id: "3", status: "QUALIFIED" },
        { id: "4", status: "CONVERTED_TO_DEAL" },
        { id: "5", status: "CONVERTED_TO_DEAL" },
      ],
      originatingDealLeadIds: new Set(["4", "5"]),
      wonOriginatingLeadIds: new Set(["5"]),
    });
    assert.equal(stages[0]!.count, 5);
    assert.equal(stages[0]!.conversionPct, 100);
    assert.equal(stages[1]!.count, 4);
    assert.equal(stages[3]!.label, "Deals Created");
    assert.equal(stages[3]!.count, 2);
    assert.equal(stages[4]!.count, 1);
    assert.equal(stages[4]!.conversionPct, 20);
  });

  it("does not treat a Qualified Lead without a Deal as Deals Created", () => {
    const stages = cohortConversionFunnel({
      cohortLeads: [{ id: "q", status: "QUALIFIED" }],
      originatingDealLeadIds: new Set(),
      wonOriginatingLeadIds: new Set(),
    });
    assert.equal(stages.find((s) => s.id === "qualified")!.count, 1);
    assert.equal(stages.find((s) => s.id === "deals_created")!.count, 0);
  });

  it("sales cycle is Deal created_at → closed_at, not Lead created", () => {
    const days = avgSalesCycleDays([
      { created_at: "2026-01-01T00:00:00.000Z", closed_at: "2026-01-11T00:00:00.000Z" },
      { created_at: "2026-01-01T00:00:00.000Z", closed_at: "2026-01-21T00:00:00.000Z" },
    ]);
    assert.equal(days, 15);
  });

  it("keeps unknown Lead sources in the denominator", () => {
    const { rows, total } = leadsBySource(
      [{ source: "WHATSAPP_INBOUND" }, { source: null }, { source: "WEBSITE" }],
      5
    );
    assert.equal(total, 3);
    const unknown = rows.find((r) => r.key === "unknown");
    assert.ok(unknown);
    assert.equal(unknown!.count, 1);
    assert.equal(unknown!.pct, 33.3);
  });

  it("abbreviates axis currency without inventing a $0 sale", () => {
    assert.equal(formatAxisMoney(0, "USD"), "$0");
    assert.equal(formatAxisMoney(20000, "USD"), "$20K");
  });
});

describe("company reports export", () => {
  it("exports the active Overview tab, not sample chart data", () => {
    const payload = {
      tab: "overview",
      generatedAt: "2026-06-15T08:24:00.000Z",
      currency: "USD",
      timezoneNote: "",
      range: {
        from: "2026-05-17T00:00:00.000Z",
        to: "2026-06-16T00:00:00.000Z",
        label: "May 17 – Jun 15, 2026",
        previousFrom: "",
        previousTo: "",
        previousLabel: "prior",
        granularity: "day",
      },
      filters: { ownerId: "u1", ownerName: "Tendai" },
      kpis: [
        {
          id: "revenue_won",
          label: "Revenue Won",
          value: "$100",
          raw: 100,
          trend: { direction: "up", pct: 10, label: "+10%" },
          sparkline: [1, 2],
        },
      ],
      revenueSeries: [{ key: "d", label: "May 17", current: 10, previous: 4 }],
      pipeline: { slices: [], activeCount: 0, knownValue: 0, pendingCount: 0, mode: "count" },
      performanceSummary: [],
      leadSeries: [],
      funnel: {
        stages: [{ id: "new_leads", label: "New Leads", count: 2, conversionPct: 100 }],
        methodology: "cohort",
      },
      topSalespeople: [],
      leadSources: { rows: [], total: 0 },
      owners: [],
      errors: {},
    } as unknown as CompanyReportOverview;
    const csv = buildCompanyReportCsv(payload);
    assert.match(csv, /Tab,overview/);
    assert.match(csv, /Salesperson,Tendai/);
    assert.match(csv, /Revenue Won/);
    assert.equal(csv.includes("sample"), false);
  });
});
