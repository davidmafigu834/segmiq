import assert from "node:assert/strict";
import test from "node:test";
import { adaptDealToCalendarEvent, nextActionAtFromDateKey } from "../lib/sales/calendar/adapters";

test("deal next actions become calendar events instead of being dropped", () => {
  const event = adaptDealToCalendarEvent({
    id: "deal-1",
    name: "Solar install",
    originatingLeadId: "lead-1",
    phone: "+263771234567",
    nextActionAt: "2026-08-20T10:00:00.000Z",
    nextActionLabel: "Call customer",
    stage: "QUALIFIED",
  });
  assert.ok(event);
  assert.equal(event?.dealId, "deal-1");
  assert.equal(event?.leadId, "lead-1");
  assert.equal(event?.kind, "CALL");
  assert.equal(event?.id, "deal-action-deal-1");
});

test("a deal without a next action is not shown on the calendar", () => {
  assert.equal(
    adaptDealToCalendarEvent({
      id: "deal-2",
      name: "Fence",
      originatingLeadId: "lead-2",
      phone: null,
      nextActionAt: null,
      nextActionLabel: null,
      stage: "SCOPING",
    }),
    null
  );
});

test("calendar date keys become a morning next-action timestamp", () => {
  const iso = nextActionAtFromDateKey("2026-08-21");
  assert.match(iso, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Number.isFinite(Date.parse(iso)));
});
