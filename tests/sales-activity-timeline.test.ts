/**
 * Phase 16 — Timeline & Activity Feed
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { formatActivityGroupLabel, groupActivitiesByDay } from "@/lib/activity/date-groups";
import { presentationForLeadEvent, filterCategoryMatches } from "@/lib/activity/presentation";
import type { ActivityTimelineItem } from "@/lib/activity/types";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function sampleItem(overrides: Partial<ActivityTimelineItem> = {}): ActivityTimelineItem {
  return {
    id: "lead_event:1",
    sourceType: "LEAD_EVENT",
    sourceId: "1",
    activityType: "NOTE_ADDED",
    title: "Note added",
    summary: "Called back tomorrow",
    occurredAt: "2026-08-28T10:00:00.000Z",
    actorType: "USER",
    actorName: "Rep",
    actorRole: "SALESPERSON",
    actorUserId: "u1",
    filterCategory: "notes",
    metadata: { iconKey: "sticky-note", tone: "warning" },
    pinnedAt: null,
    pinnedByUserId: null,
    pinnedByName: null,
    refType: null,
    refId: null,
    ...overrides,
  };
}

describe("sales activity timeline Phase 16", () => {
  it("maps lead event types to human labels and filter categories", () => {
    const p = presentationForLeadEvent("CALL_LOGGED", {});
    assert.equal(p.label, "Call logged");
    assert.equal(p.filterCategory, "calls");
    assert.equal(p.iconKey, "phone-call");

    const wa = presentationForLeadEvent("MESSAGE_SENT", {});
    assert.equal(wa.label, "WhatsApp sent");
    assert.equal(wa.filterCategory, "whatsapp");
    assert.equal(wa.iconKey, "whatsapp");
  });

  it("reads internal notes from note or notes field", () => {
    const p = presentationForLeadEvent("NOTE_ADDED", { note: "Hello" });
    assert.equal(p.label, "Note added");
    assert.ok(filterCategoryMatches("notes", "notes"));
    assert.ok(!filterCategoryMatches("calls", "notes"));
  });

  it("groups activities by day with Today label", () => {
    const now = new Date("2026-08-28T15:00:00.000Z");
    const groups = groupActivitiesByDay(
      [
        sampleItem({ occurredAt: "2026-08-28T09:00:00.000Z" }),
        sampleItem({ id: "lead_event:2", sourceId: "2", occurredAt: "2026-08-27T09:00:00.000Z" }),
      ],
      now
    );
    assert.equal(groups.length, 2);
    assert.match(groups[0]!.label, /Today/);
    assert.match(groups[1]!.label, /Yesterday/);
    assert.equal(groups[0]!.items.length, 1);
  });

  it("timeline API uses buildLeadTimeline with pagination params", () => {
    const route = read("app/api/leads/[leadId]/timeline/route.ts");
    assert.ok(route.includes("buildLeadTimeline"));
    assert.ok(route.includes("cursor"));
    assert.ok(route.includes("filter"));
  });

  it("ActivityTimeline uses real Lucide icons and SiWhatsapp", () => {
    const icon = read("components/sales/activity/ActivityIcon.tsx");
    assert.ok(icon.includes("lucide-react"));
    assert.ok(icon.includes("SiWhatsapp"));
    assert.ok(!icon.includes("📞"));
    assert.ok(!icon.includes("emoji"));
  });

  it("LeadTimeline delegates to ActivityTimeline", () => {
    const lead = read("components/leads/LeadTimeline.tsx");
    assert.ok(lead.includes("ActivityTimeline"));
  });

  it("pin route validates lead event ownership", () => {
    const pin = read("app/api/leads/[leadId]/timeline/[eventId]/pin/route.ts");
    assert.ok(pin.includes("canModifyLead") || pin.includes("resolveAccess"));
    assert.ok(pin.includes("pinned_at"));
  });

  it("migration adds pin and dedupe columns", () => {
    const sql = read("supabase/migrations/20260901160000_lead_events_timeline_phase16.sql");
    assert.ok(sql.includes("pinned_at"));
    assert.ok(sql.includes("dedupe_key"));
  });
});
