import assert from "node:assert/strict";
import test from "node:test";
import { companyCalendarKindOptions, companyCalendarQueryRange } from "../lib/sales/company-calendar/format";
import { buildCalendarGrid, buildWeekDays, eventDateKey, eventHour, eventsForDateKey, toDateKey } from "../lib/sales/calendar/format";
import { canReadListing } from "../lib/real-estate/listing-access";
import {
  appendViewingEvents,
  buyerRecordIsOpenable,
  calendarViewingBounds,
  presentViewingOnCalendar,
  replaceViewingEvents,
  salesCalendarViewingWindow,
  shouldApplyViewingLoad,
  uniqueCalendarEntries,
  viewingCalendarLinks,
  viewingFallsOnDate,
  viewingInHalfOpenWindow,
  viewingWindowCovers,
  type ViewingCalendarRecord,
} from "../lib/real-estate/viewing-calendar";
import { addDays, parseISO } from "date-fns";

const ZONE = "Africa/Johannesburg";
const NOW = Date.parse("2026-11-06T12:00:00.000Z");

const OPEN = { propertyReadable: true, buyerOpenable: true };

function viewing(overrides: Partial<ViewingCalendarRecord> = {}): ViewingCalendarRecord {
  return {
    id: "view-1",
    scheduledAt: "2026-11-06T22:30:00.000Z",
    status: "scheduled",
    confirmationStatus: "confirmed",
    access: "full",
    listingId: "listing-1",
    propertyLabel: "12 Oak Street, Rosebank",
    addressAuthorised: true,
    agentId: "agent-1",
    buyerSearchId: "search-1",
    buyerName: "Jane Buyer",
    buyerPhone: "+263770000000",
    ...overrides,
  };
}

test("a viewing just after midnight uses the configured calendar date", () => {
  const presented = presentViewingOnCalendar(viewing(), { surface: "sales", timezone: ZONE, nowMs: NOW, ...OPEN });
  assert.ok(presented);
  assert.equal(presented.sales.calendarDateKey, "2026-11-07");
  assert.equal(viewingFallsOnDate("2026-11-06T22:30:00.000Z", ZONE, "2026-11-07"), true);
  assert.equal(viewingFallsOnDate("2026-11-06T21:30:00.000Z", ZONE, "2026-11-06"), true);
  assert.equal(eventDateKey(presented.sales), "2026-11-07");
  assert.equal(eventHour(presented.sales), 0);
  assert.equal(eventsForDateKey([presented.sales], "2026-11-07").length, 1);
  assert.equal(eventsForDateKey([presented.sales], "2026-11-06").length, 0);
});

test("refresh and reschedule keep one event for the viewing", () => {
  const first = presentViewingOnCalendar(viewing(), { surface: "sales", timezone: ZONE, nowMs: NOW, ...OPEN });
  const moved = presentViewingOnCalendar(
    viewing({ scheduledAt: "2026-11-08T08:00:00.000Z" }),
    { surface: "sales", timezone: ZONE, nowMs: NOW, ...OPEN }
  );
  assert.equal(first?.sales.id, moved?.sales.id);
  const unique = uniqueCalendarEntries([first!.sales, moved!.sales]);
  assert.equal(unique.length, 1);
  assert.equal(unique[0]?.startAt, moved?.sales.startAt);
});

test("pending confirmation stays scheduled and cancelled follows the booking state", () => {
  const pending = presentViewingOnCalendar(
    viewing({ confirmationStatus: "awaiting_confirmation" }),
    { surface: "client", timezone: ZONE, nowMs: NOW, ...OPEN }
  );
  assert.equal(pending?.sales.pipelineStage, "Pending confirmation");
  assert.equal(pending?.company.status, "scheduled");
  assert.equal(pending?.company.sourceStatus, "awaiting_confirmation");

  const cancelled = presentViewingOnCalendar(
    viewing({ status: "cancelled", confirmationStatus: null }),
    { surface: "client", timezone: ZONE, nowMs: NOW, ...OPEN }
  );
  assert.equal(cancelled?.company.status, "cancelled");
  assert.equal(cancelled?.sales.pipelineStage, "Cancelled");

  const missed = presentViewingOnCalendar(
    viewing({ status: "no_show" }),
    { surface: "client", timezone: ZONE, nowMs: NOW, ...OPEN }
  );
  assert.equal(missed?.company.status, "cancelled");
  assert.equal(missed?.sales.pipelineStage, "No show");

  const done = presentViewingOnCalendar(
    viewing({ status: "completed" }),
    { surface: "client", timezone: ZONE, nowMs: NOW, ...OPEN }
  );
  assert.equal(done?.company.status, "completed");

  assert.equal(
    presentViewingOnCalendar(viewing({ source: "inquiry" }), { surface: "sales", timezone: ZONE, nowMs: NOW, ...OPEN }),
    null
  );
  assert.equal(
    presentViewingOnCalendar(viewing({ scheduledAt: "not-a-time" }), { surface: "sales", timezone: ZONE, nowMs: NOW, ...OPEN }),
    null
  );
  const tentative = presentViewingOnCalendar(
    viewing({ confirmationStatus: "tentative" }),
    { surface: "sales", timezone: ZONE, nowMs: NOW, ...OPEN }
  );
  assert.equal(tentative?.sales.pipelineStage, "Tentative");
  assert.equal(tentative?.company.sourceStatus, "tentative");
  assert.equal(tentative?.sales.endAt, null);
});

test("listing-only access hides buyer details and another surface cannot invent them", () => {
  const restricted = presentViewingOnCalendar(
    viewing({ access: "listing_only" }),
    { surface: "sales", timezone: ZONE, nowMs: NOW, ...OPEN }
  );
  assert.equal(restricted?.sales.customerName, null);
  assert.equal(restricted?.sales.phone, null);
  assert.equal(restricted?.sales.buyerHref, null);
  assert.equal(restricted?.company.phone, null);
  assert.equal(restricted?.company.relatedSecondary, null);
  assert.equal(restricted?.sales.propertyHref, "/sales/listings/listing-1");
  assert.equal(restricted?.sales.viewingHref, "/sales/viewings");
  assert.equal(restricted?.company.customerId, null);
  assert.ok(!restricted?.company.actions?.some((action) => action.href.includes("/buyers/")));
  assert.ok(!JSON.stringify(restricted).includes("Jane Buyer"));
  assert.ok(!JSON.stringify(restricted).includes("+263770000000"));
  assert.ok(!JSON.stringify(restricted).includes("search-1"));

  const manager = viewingCalendarLinks(viewing(), "client", OPEN);
  assert.equal(manager.viewingHref, "/client/viewings?viewing=view-1");
  assert.equal(manager.propertyHref, "/client/listings/listing-1");
  assert.equal(manager.buyerHref, "/client/buyers/search-1");

  const unlinked = presentViewingOnCalendar(
    viewing({ listingId: null, propertyLabel: null, buyerSearchId: null }),
    { surface: "sales", timezone: ZONE, nowMs: NOW, ...OPEN }
  );
  assert.equal(unlinked?.sales.propertyHref, null);
  assert.equal(unlinked?.sales.buyerHref, null);
});

test("a failed viewing source leaves the other calendar events in place", () => {
  const followUp = { id: "lead-followup-1", startAt: "2026-11-06T09:00:00.000Z" };
  const failed = appendViewingEvents([followUp], { ok: false });
  assert.equal(failed.partial, true);
  assert.deepEqual(failed.events, [followUp]);

  const viewingEvent = presentViewingOnCalendar(viewing(), { surface: "sales", timezone: ZONE, nowMs: NOW, ...OPEN });
  const loaded = appendViewingEvents([followUp], { ok: true, events: [viewingEvent!.sales], incomplete: true });
  assert.equal(loaded.partial, true);
  assert.equal(loaded.events.length, 2);
  assert.equal(loaded.events.some((event) => event.id === "viewing:view-1"), true);

  const empty = appendViewingEvents([followUp], { ok: true, events: [], incomplete: false });
  assert.equal(empty.partial, false);
  assert.deepEqual(empty.events, [followUp]);

  const current = replaceViewingEvents(
    [followUp, { ...viewingEvent!.sales, kind: "VIEWING" as const }],
    { ok: false }
  );
  assert.equal(current.partial, true);
  assert.equal(current.events.some((event) => event.id === "viewing:view-1"), true);
  const moved = presentViewingOnCalendar(
    viewing({ scheduledAt: "2026-11-08T08:00:00.000Z" }),
    { surface: "sales", timezone: ZONE, nowMs: NOW, ...OPEN }
  );
  const retried = replaceViewingEvents(current.events, { ok: true, events: [moved!.sales], incomplete: false });
  assert.equal(retried.partial, false);
  assert.equal(retried.events.filter((event) => event.id === "viewing:view-1").length, 1);
  assert.equal(retried.events.find((event) => event.id === "viewing:view-1")?.startAt, moved?.sales.startAt);
  assert.equal(retried.events.some((event) => event.id === "lead-followup-1"), true);
});

test("the calendar window includes local midnight and excludes the exact end", () => {
  const bounds = calendarViewingBounds("2026-11-07", "2026-11-08", ZONE);
  assert.ok(bounds);
  assert.equal(bounds?.fromIso, "2026-11-06T22:00:00.000Z");
  assert.equal(bounds?.toIsoExclusive, "2026-11-07T22:00:00.000Z");
  assert.equal(viewingInHalfOpenWindow(bounds!.fromIso, bounds!.fromIso, bounds!.toIsoExclusive), true);
  assert.equal(viewingInHalfOpenWindow("2026-11-07T21:59:59.000Z", bounds!.fromIso, bounds!.toIsoExclusive), true);
  assert.equal(viewingInHalfOpenWindow(bounds!.toIsoExclusive, bounds!.fromIso, bounds!.toIsoExclusive), false);
  const grid = salesCalendarViewingWindow(parseISO("2026-11-06T12:00:00"));
  assert.ok(grid.startKey < "2026-11-01");
  assert.ok(grid.endKeyExclusive > "2026-11-30");
  assert.equal(viewingWindowCovers(grid, { startKey: "2026-11-02", endKeyExclusive: "2026-11-09" }), true);
  assert.equal(viewingWindowCovers(grid, { startKey: "2026-12-01", endKeyExclusive: "2026-12-08" }), false);
  assert.equal(shouldApplyViewingLoad(2, 2), true);
  assert.equal(shouldApplyViewingLoad(1, 2), false);

  const month = parseISO("2026-11-15T12:00:00");
  const monthWindow = salesCalendarViewingWindow(month);
  for (const day of buildCalendarGrid(month)) {
    const key = toDateKey(day);
    assert.equal(
      viewingWindowCovers(monthWindow, { startKey: key, endKeyExclusive: toDateKey(addDays(day, 1)) }),
      true
    );
  }
  const week = buildWeekDays(parseISO("2026-11-01T12:00:00"));
  const november = salesCalendarViewingWindow(parseISO("2026-11-01T12:00:00"));
  assert.equal(
    viewingWindowCovers(november, {
      startKey: toDateKey(week[0]!),
      endKeyExclusive: toDateKey(addDays(week[6]!, 1)),
    }),
    true
  );
  const manager = companyCalendarQueryRange("2026-11-06");
  const managerBounds = calendarViewingBounds(manager.startKey, manager.endKey, ZONE);
  assert.ok(managerBounds);
  const span = Date.parse(managerBounds!.toIsoExclusive) - Date.parse(managerBounds!.fromIso);
  assert.ok(span > 0 && span <= 100 * 24 * 60 * 60 * 1000);
  assert.equal(viewingWindowCovers({ startKey: manager.startKey, endKeyExclusive: manager.endKey }, november), true);
});

test("property and buyer links follow the destination access rules", () => {
  const hiddenFile = presentViewingOnCalendar(viewing(), {
    surface: "sales",
    timezone: ZONE,
    nowMs: NOW,
    propertyReadable: false,
    buyerOpenable: false,
  });
  assert.ok(hiddenFile);
  assert.equal(hiddenFile?.sales.location, "12 Oak Street, Rosebank");
  assert.equal(hiddenFile?.company.location, "12 Oak Street, Rosebank");
  assert.equal(hiddenFile?.sales.propertyHref, null);
  const withheld = presentViewingOnCalendar(
    viewing({ addressAuthorised: false, propertyLabel: "12 Secret Road" }),
    { surface: "sales", timezone: ZONE, nowMs: NOW, propertyReadable: false, buyerOpenable: false }
  );
  assert.equal(withheld?.sales.location, "Property viewing");
  assert.equal(withheld?.company.location, "Property viewing");
  assert.equal(withheld?.company.relatedLabel, "Property viewing");
  assert.equal(withheld?.sales.propertyHref, null);
  assert.equal(JSON.stringify(withheld).includes("12 Secret Road"), false);
  assert.equal(hiddenFile?.sales.customerName, "Jane Buyer");
  assert.equal(hiddenFile?.sales.buyerHref, null);
  assert.equal(hiddenFile?.sales.viewingHref, "/sales/viewings");
  assert.equal(hiddenFile?.company.customerId, "search-1");
  const sellingManager = viewingCalendarLinks(viewing(), "sales", OPEN);
  assert.equal(sellingManager.viewingHref, "/sales/viewings");
  assert.equal(sellingManager.propertyHref, "/sales/listings/listing-1");
  assert.equal(sellingManager.buyerHref, "/sales/buyers/search-1");

  const agent = { actorRole: "SALESPERSON", actorId: "agent-1", actorClientId: "org-1" };
  assert.equal(buyerRecordIsOpenable({ ...agent, searchClientId: "org-1", assignedAgentId: "agent-1" }), true);
  assert.equal(buyerRecordIsOpenable({ ...agent, searchClientId: "org-1", assignedAgentId: "other-agent" }), false);
  assert.equal(buyerRecordIsOpenable({ ...agent, searchClientId: "org-2", assignedAgentId: "agent-1" }), false);
  assert.equal(
    buyerRecordIsOpenable({
      actorRole: "CLIENT_MANAGER",
      actorId: "manager-1",
      actorClientId: "org-1",
      searchClientId: "org-1",
      assignedAgentId: "other-agent",
    }),
    true
  );
  assert.equal(
    buyerRecordIsOpenable({
      actorRole: "SUPER_ADMIN",
      actorId: "platform-1",
      actorClientId: null,
      searchClientId: "org-1",
      assignedAgentId: "other-agent",
    }),
    true
  );
  assert.equal(
    canReadListing(
      { userId: "agent-1", role: "SALESPERSON", clientId: "org-1" },
      { client_id: "org-1", agent_id: "other-agent", approval_status: "draft" }
    ),
    false
  );
  assert.equal(
    canReadListing(
      { userId: "manager-1", role: "CLIENT_MANAGER", clientId: "org-1" },
      { client_id: "org-1", agent_id: "other-agent", approval_status: "draft" }
    ),
    true
  );
  assert.equal(
    canReadListing(
      { userId: "agent-1", role: "SALESPERSON", clientId: "org-1" },
      { client_id: "org-2", agent_id: "agent-1", approval_status: "approved" }
    ),
    false
  );
});

test("trade and solar kind lists do not gain a viewing filter", () => {
  assert.equal(companyCalendarKindOptions(false).includes("viewing"), false);
  assert.equal(companyCalendarKindOptions(true).includes("viewing"), true);
});
