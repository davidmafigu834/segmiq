/**
 * Pure-logic verification for loss aggregation and targeting rule thresholds.
 * Run: npx tsx scripts/verify-loss-analysis.ts
 */
import assert from "node:assert/strict";
import {
  aggregateLossFromData,
  buildTargetingRecommendations,
  leadEstimatedValue,
  LOSS_MIN_REASONED_EVENTS,
  TARGETING_MIN_NOT_FIT,
  TARGETING_SOURCE_SHARE_PCT,
  type LossCallLogRow,
  type LossLeadRow,
} from "../lib/loss-analysis";

function makeDedupKey(clientId: string, category: string, signal: string): string {
  return `${clientId}:${category}:${signal}`;
}

const windowStart = new Date("2026-05-01T00:00:00.000Z");
const windowEnd = new Date("2026-06-09T23:59:59.999Z");

const leads: LossLeadRow[] = [
  {
    id: "l1",
    status: "NEGOTIATING",
    source: "FACEBOOK",
    deal_value: 5000,
    budget: null,
    form_data: null,
    lost_reason: null,
    not_qualified_reason: null,
    created_at: "2026-05-10T00:00:00.000Z",
    updated_at: "2026-05-20T00:00:00.000Z",
  },
  {
    id: "l2",
    status: "CONTACTED",
    source: "FACEBOOK",
    deal_value: null,
    budget: "$12,000",
    form_data: null,
    lost_reason: null,
    not_qualified_reason: null,
    created_at: "2026-05-11T00:00:00.000Z",
    updated_at: "2026-05-21T00:00:00.000Z",
  },
  {
    id: "l3",
    status: "NOT_QUALIFIED",
    source: "FACEBOOK",
    deal_value: null,
    budget: null,
    form_data: null,
    lost_reason: null,
    not_qualified_reason: "Out of area",
    created_at: "2026-05-12T00:00:00.000Z",
    updated_at: "2026-05-22T00:00:00.000Z",
  },
  {
    id: "l4",
    status: "LOST",
    source: "MANUAL",
    deal_value: null,
    budget: null,
    form_data: null,
    lost_reason: "Chose a competitor",
    not_qualified_reason: null,
    created_at: "2026-05-13T00:00:00.000Z",
    updated_at: "2026-05-23T00:00:00.000Z",
  },
];

const windowLogs: LossCallLogRow[] = [
  {
    id: "c1",
    lead_id: "l1",
    reason: "Can't afford now",
    result: "follow_up",
    reach_outcome: "reached",
    created_at: "2026-05-15T10:00:00.000Z",
  },
  {
    id: "c2",
    lead_id: "l2",
    reason: "Waiting on money",
    result: "follow_up",
    reach_outcome: "reached",
    created_at: "2026-05-16T10:00:00.000Z",
  },
  {
    id: "c3",
    lead_id: "l3",
    reason: "Out of area",
    result: "not_qualified",
    reach_outcome: "reached",
    created_at: "2026-05-17T10:00:00.000Z",
  },
  {
    id: "c4",
    lead_id: "l4",
    reason: "Chose a competitor",
    result: "lost",
    reach_outcome: "reached",
    created_at: "2026-05-18T10:00:00.000Z",
  },
  {
    id: "c5",
    lead_id: "l3",
    reason: "Still deciding",
    result: "follow_up",
    reach_outcome: "reached",
    created_at: "2026-05-14T10:00:00.000Z",
  },
];

const recoverableLogs: LossCallLogRow[] = windowLogs.filter(
  (l) => l.result === "follow_up"
);

const result = aggregateLossFromData(
  windowLogs,
  leads,
  recoverableLogs,
  windowStart,
  windowEnd
);

// Stall counts from raw call_logs
const stallFromLogs = windowLogs.filter(
  (l) =>
    l.result === "follow_up" &&
    ["Comparing quotes", "Still deciding", "Can't afford now", "Waiting on money", "Project for later"].includes(
      l.reason ?? ""
    )
).length;
assert.equal(
  Object.values(result.stallReasons).reduce((s, n) => s + n, 0),
  stallFromLogs,
  "stall reason totals should match follow_up call_logs in window"
);

assert.equal(result.stallReasons["Can't afford now"], 1);
assert.equal(result.stallReasons["Waiting on money"], 1);
assert.equal(result.stallReasons["Still deciding"], 1);

assert.equal(result.lostReasons["Chose a competitor"], 1);
assert.equal(result.notFitReasons["Out of area"], 1);

assert.equal(result.recoverablePile.count, 2, "two active leads with recoverable stall reasons");
assert.equal(
  result.recoverablePile.estimatedValue,
  17000,
  "recoverable pile sums deal_value + parsed budget"
);
assert.equal(leadEstimatedValue(leads[1]!), 12000);

assert.equal(result.totalReasonedEvents, 5);
assert.equal(result.hasEnoughData, result.totalReasonedEvents >= LOSS_MIN_REASONED_EVENTS);

// Sparse data → no panel-worthy signal
const sparse = aggregateLossFromData(
  [windowLogs[0]!],
  leads,
  [windowLogs[0]!],
  windowStart,
  windowEnd
);
assert.equal(sparse.hasEnoughData, false);

// Targeting rule: should NOT fire below threshold
const belowThreshold = buildTargetingRecommendations(
  { ...result, notFitOutcomes: 2, hasEnoughData: true },
  "client-1",
  "roofing",
  makeDedupKey
);
assert.equal(belowThreshold.length, 0, "rule should not fire below min not-fit count");

// Fabricate high not-fit share for Facebook
const fbLeads: LossLeadRow[] = Array.from({ length: 6 }, (_, i) => ({
  id: `fb-${i}`,
  status: i < 2 ? "NOT_QUALIFIED" : "NEW",
  source: "FACEBOOK",
  deal_value: null,
  budget: null,
  form_data: null,
  lost_reason: null,
  not_qualified_reason: i < 2 ? "Out of area" : null,
  created_at: "2026-05-20T00:00:00.000Z",
  updated_at: "2026-05-25T00:00:00.000Z",
}));

const fbLogs: LossCallLogRow[] = [
  {
    id: "fb-c1",
    lead_id: "fb-0",
    reason: "Out of area",
    result: "not_qualified",
    reach_outcome: "reached",
    created_at: "2026-05-21T10:00:00.000Z",
  },
  {
    id: "fb-c2",
    lead_id: "fb-1",
    reason: "Out of area",
    result: "not_qualified",
    reach_outcome: "reached",
    created_at: "2026-05-22T10:00:00.000Z",
  },
];

const fbResult = aggregateLossFromData(fbLogs, fbLeads, [], windowStart, windowEnd);
assert.ok(
  fbResult.notFitBySource.FACEBOOK!.sharePct >= TARGETING_SOURCE_SHARE_PCT,
  "facebook not-fit share should exceed source threshold"
);

const targeting = buildTargetingRecommendations(
  { ...fbResult, hasEnoughData: true, notFitOutcomes: TARGETING_MIN_NOT_FIT },
  "client-1",
  "roofing",
  makeDedupKey
);
assert.equal(targeting.length, 1);
assert.equal(targeting[0]!.category, "targeting");
assert.match(targeting[0]!.title, /Facebook/i);
assert.match(targeting[0]!.title, /Out of area/i);

const deduped = buildTargetingRecommendations(
  { ...fbResult, hasEnoughData: true, notFitOutcomes: TARGETING_MIN_NOT_FIT },
  "client-1",
  "roofing",
  makeDedupKey
);
assert.equal(
  deduped[0]!.dedup_key,
  targeting[0]!.dedup_key,
  "dedup key should be stable for same signal"
);

console.log("verify-loss-analysis: all assertions passed");
