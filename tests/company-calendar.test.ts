import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canMutateCompanyCalendarLead,
  calendarDateKey,
  companyCalendarTeamAttention,
  companyCalendarRangeKeys,
  groupCompanyCalendarEventsByOwnerDay,
  inferDealCalendarKind,
  layoutOverlappingEvents,
  matchesCompanyCalendarFilters,
} from "../lib/sales/company-calendar/format";
import {
  buildCompanyCalendarExecutionMetrics,
  buildCompanyCalendarExecutionSummary,
} from "../lib/sales/company-calendar/summary";
import type { CompanyCalendarEvent } from "../lib/sales/company-calendar/types";

function event(partial: Partial<CompanyCalendarEvent> = {}): CompanyCalendarEvent {
  return {
    id: "event-1",
    sourceType: "lead_follow_up",
    sourceId: "lead-1",
    kind: "call",
    title: "Follow up",
    startAt: "2026-08-20T09:00:00.000Z",
    endAt: "2026-08-20T10:00:00.000Z",
    allDay: false,
    status: "scheduled",
    sourceStatus: "CONTACTED",
    ownerId: "owner-1",
    ownerName: "Tendai Moyo",
    ownerAvatarUrl: null,
    ownerRoleLabel: "Sales Executive",
    relationType: "lead",
    relatedId: "lead-1",
    relatedLabel: "Moyo Residence",
    relatedSecondary: "Contacted",
    relatedHref: "/client/leads?lead=lead-1",
    leadId: "lead-1",
    dealId: null,
    customerId: null,
    phone: null,
    location: null,
    description: null,
    attentionReason: null,
    canEdit: true,
    canComplete: true,
    ...partial,
  };
}

describe("Company Calendar range logic", () => {
  it("moves Day, Week, and Month using their own calendar periods", () => {
    assert.deepEqual(companyCalendarRangeKeys("2026-08-20", "day"), {
      startKey: "2026-08-20",
      endKey: "2026-08-21",
      label: "Thursday, August 20, 2026",
    });
    const week = companyCalendarRangeKeys("2026-08-20", "week");
    assert.equal(week.startKey, "2026-08-16");
    assert.equal(week.endKey, "2026-08-23");
    assert.equal(week.label, "Aug 16 – 22, 2026");
    const month = companyCalendarRangeKeys("2026-08-20", "month");
    assert.equal(month.startKey, "2026-08-01");
    assert.equal(month.endKey, "2026-09-01");
    assert.equal(month.label, "August 2026");
  });

  it("derives the calendar date in the configured timezone around midnight", () => {
    const nearMidnight = "2026-08-19T22:30:00.000Z";
    assert.equal(calendarDateKey(nearMidnight, "UTC"), "2026-08-19");
    assert.equal(calendarDateKey(nearMidnight, "Africa/Harare"), "2026-08-20");
  });
});

describe("Company Calendar business filters", () => {
  it("filters owner, activity type, and completed state consistently", () => {
    const row = event({ status: "completed" });
    assert.equal(
      matchesCompanyCalendarFilters(row, {
        ownerId: "owner-1",
        kinds: ["call"],
        includeCompleted: true,
        status: "all",
        relationType: "all",
      }),
      true
    );
    assert.equal(
      matchesCompanyCalendarFilters(row, {
        ownerId: "owner-2",
        kinds: ["call"],
        includeCompleted: true,
        status: "all",
        relationType: "all",
      }),
      false
    );
    assert.equal(
      matchesCompanyCalendarFilters(row, {
        ownerId: "all",
        kinds: ["call"],
        includeCompleted: false,
        status: "all",
        relationType: "all",
      }),
      false
    );
  });

  it("filters status, attention, and related record without changing ownership semantics", () => {
    const row = event({ relationType: "deal", attentionReason: "Deal has stalled" });
    assert.equal(matchesCompanyCalendarFilters(row, {
      ownerId: "all",
      kinds: ["call"],
      includeCompleted: true,
      status: "at_risk",
      relationType: "deal",
    }), true);
    assert.equal(matchesCompanyCalendarFilters(row, {
      ownerId: "all",
      kinds: ["call"],
      includeCompleted: true,
      status: "overdue",
      relationType: "deal",
    }), false);
  });

  it("uses activity semantics, not owner identity, to classify Deal actions", () => {
    assert.equal(inferDealCalendarKind("Call decision maker"), "call");
    assert.equal(inferDealCalendarKind("Review proposal"), "quote_review");
    assert.equal(inferDealCalendarKind("Site assessment"), "site_visit");
    assert.equal(inferDealCalendarKind("Confirm procurement timeline"), "deal_action");
  });
});

describe("Company Calendar overlap layout", () => {
  it("places simultaneous activities side-by-side without affecting later events", () => {
    const positioned = layoutOverlappingEvents(
      [
        event(),
        event({ id: "event-2", startAt: "2026-08-20T09:30:00.000Z", endAt: "2026-08-20T10:30:00.000Z" }),
        event({ id: "event-3", startAt: "2026-08-20T11:00:00.000Z", endAt: "2026-08-20T12:00:00.000Z" }),
      ],
      "UTC"
    );
    assert.equal(positioned[0]?.columnCount, 2);
    assert.equal(positioned[1]?.columnCount, 2);
    assert.notEqual(positioned[0]?.column, positioned[1]?.column);
    assert.equal(positioned[2]?.columnCount, 1);
    assert.equal(positioned[2]?.column, 0);
  });
});

describe("Company Calendar team matrix", () => {
  it("groups and sorts multiple events by owner and company-local day", () => {
    const grouped = groupCompanyCalendarEventsByOwnerDay([
      event({ id: "later", startAt: "2026-08-20T10:00:00.000Z" }),
      event({ id: "earlier", startAt: "2026-08-20T08:00:00.000Z" }),
      event({ id: "unassigned", ownerId: null, startAt: "2026-08-19T22:30:00.000Z" }),
    ], "Africa/Harare");
    assert.deepEqual(grouped["owner-1"]?.["2026-08-20"]?.map((row) => row.id), ["earlier", "later"]);
    assert.equal(grouped.unassigned?.["2026-08-20"]?.[0]?.id, "unassigned");
  });

  it("surfaces overdue work ahead of softer attention signals", () => {
    assert.deepEqual(companyCalendarTeamAttention([
      event({ status: "scheduled", attentionReason: "Deal has stalled" }),
      event({ id: "overdue", status: "overdue" }),
    ]), { tone: "overdue", label: "1 overdue activity" });
    assert.equal(companyCalendarTeamAttention([event()]).tone, "clear");
  });
});

describe("Company Calendar execution summary", () => {
  const period = {
    nowIso: "2026-08-20T08:00:00.000Z",
    todayKey: "2026-08-20",
    nextSevenDaysEndIso: "2026-08-27T22:00:00.000Z",
    weekStartIso: "2026-08-15T22:00:00.000Z",
    weekEndIso: "2026-08-22T22:00:00.000Z",
    timezone: "Africa/Harare",
  };
  const signals = [
    { ownerId: "owner-1", sourceType: "lead_follow_up" as const, startAt: "2026-08-20T09:00:00.000Z", completedAt: null, status: "scheduled" as const, atRisk: false },
    { ownerId: "owner-1", sourceType: "lead_follow_up" as const, startAt: "2026-08-18T09:00:00.000Z", completedAt: null, status: "overdue" as const, atRisk: true },
    { ownerId: "owner-2", sourceType: "viewing" as const, startAt: "2026-08-19T22:30:00.000Z", completedAt: "2026-08-20T11:00:00.000Z", status: "completed" as const, atRisk: false },
    { ownerId: "owner-2", sourceType: "deal_next_action" as const, startAt: "2026-08-25T10:00:00.000Z", completedAt: null, status: "scheduled" as const, atRisk: true },
    { ownerId: null, sourceType: "viewing" as const, startAt: "2026-08-28T10:00:00.000Z", completedAt: null, status: "scheduled" as const, atRisk: false },
  ];

  it("uses canonical source and company-local period definitions", () => {
    const metrics = buildCompanyCalendarExecutionMetrics(signals, period, 108, 120);
    assert.deepEqual(metrics, {
      upcomingActivities: 2,
      overdueFollowUps: 1,
      todayActivities: 2,
      completedWeek: 1,
      atRiskActivities: 2,
      responseTimeMinutes: 108,
      responseTimeMinutesPrevious: 120,
    });
  });

  it("keeps company and salesperson KPI scopes consistent", () => {
    const summary = buildCompanyCalendarExecutionSummary({
      signals,
      ownerIds: ["owner-1", "owner-2"],
      period,
      responseAll: { current: 108, previous: 120 },
      responseByOwner: {
        "owner-1": { current: 75, previous: 90 },
        "owner-2": { current: 140, previous: null },
      },
    });
    assert.equal(summary.all.atRiskActivities, 2);
    assert.equal(summary.byOwner["owner-1"]?.overdueFollowUps, 1);
    assert.equal(summary.byOwner["owner-2"]?.completedWeek, 1);
    assert.equal(summary.byOwner["owner-1"]?.responseTimeMinutes, 75);
  });
});

describe("Company Calendar authorization", () => {
  it("allows super admins and the assigned sales-capable owner only", () => {
    assert.equal(
      canMutateCompanyCalendarLead({
        canManageAny: true,
        canActAsSalesperson: false,
        actorId: "super-admin",
        ownerId: "salesperson-a",
      }),
      true
    );
    assert.equal(
      canMutateCompanyCalendarLead({
        canManageAny: false,
        canActAsSalesperson: true,
        actorId: "salesperson-a",
        ownerId: "salesperson-a",
      }),
      true
    );
    assert.equal(
      canMutateCompanyCalendarLead({
        canManageAny: false,
        canActAsSalesperson: true,
        actorId: "salesperson-b",
        ownerId: "salesperson-a",
      }),
      false
    );
    assert.equal(
      canMutateCompanyCalendarLead({
        canManageAny: false,
        canActAsSalesperson: false,
        actorId: "manager",
        ownerId: "manager",
      }),
      false
    );
  });
});
