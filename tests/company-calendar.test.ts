import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canMutateCompanyCalendarLead,
  calendarDateKey,
  companyCalendarRangeKeys,
  inferDealCalendarKind,
  layoutOverlappingEvents,
  matchesCompanyCalendarFilters,
} from "../lib/sales/company-calendar/format";
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
    assert.equal(week.startKey, "2026-08-17");
    assert.equal(week.endKey, "2026-08-24");
    assert.equal(week.label, "Aug 17 – 23, 2026");
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
      }),
      true
    );
    assert.equal(
      matchesCompanyCalendarFilters(row, {
        ownerId: "owner-2",
        kinds: ["call"],
        includeCompleted: true,
      }),
      false
    );
    assert.equal(
      matchesCompanyCalendarFilters(row, {
        ownerId: "all",
        kinds: ["call"],
        includeCompleted: false,
      }),
      false
    );
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
