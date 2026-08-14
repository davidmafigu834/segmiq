import test from "node:test";
import assert from "node:assert/strict";
import { computeCompanyWhatsAppSummary } from "../lib/inbox/company-whatsapp-summary";
import type { InboxConversation } from "../lib/inbox/types";

function conversation(
  overrides: Partial<InboxConversation> & Pick<InboxConversation, "id">
): InboxConversation {
  return {
    contactId: null,
    name: "Customer",
    whatsappProfileName: null,
    phone: "+263771234567",
    location: null,
    source: "WHATSAPP_INBOUND",
    status: "NEW",
    stageLabel: "New",
    projectType: null,
    leadBudget: null,
    leadTimeline: null,
    assignedToId: "rep-1",
    assignee: { id: "rep-1", name: "Rep One" },
    score: 0,
    scoreLabel: "Cold",
    lastMessage: "Hello",
    lastMessageAt: "2026-08-13T10:00:00.000Z",
    lastMessageType: "text",
    unread: 0,
    tags: [],
    leadSummary: null,
    breakdown: { urgency: 0, budget: 0, location: 0, productInterest: 0, engagement: 0 },
    followUpDate: null,
    createdAt: "2026-08-13T10:00:00.000Z",
    company: null,
    dealValue: null,
    dealCurrency: "USD",
    sourceLabel: "WhatsApp",
    lastMessageDirection: "inbound",
    awaitingReplyMinutes: 60,
    latestQuoteNumber: null,
    latestQuoteStatus: null,
    latestQuoteTotal: null,
    conversationStatus: "OPEN",
    resolvedAt: null,
    firstContactAt: "2026-08-13T10:00:00.000Z",
    firstResponseSeconds: 120,
    messageCount: 2,
    activeDealId: null,
    dealName: null,
    dealStage: null,
    dealNextActionAt: null,
    ...overrides,
  };
}

test("company WhatsApp KPIs distinguish unread from Waiting on Team", () => {
  const rows = [
    conversation({ id: "waiting", unread: 0, lastMessageDirection: "inbound" }),
    conversation({ id: "unread-outbound", unread: 3, lastMessageDirection: "outbound" }),
  ];
  const summary = computeCompanyWhatsAppSummary(rows, {
    now: new Date("2026-08-14T12:00:00.000Z"),
  });

  assert.equal(summary.active, 2);
  assert.equal(summary.waitingOnTeam, 1);
});

test("resolved conversations are separate from active conversations and commercial state", () => {
  const rows = [
    conversation({ id: "active", status: "WON", conversationStatus: "OPEN" }),
    conversation({
      id: "resolved",
      status: "NEW",
      conversationStatus: "RESOLVED",
      resolvedAt: "2026-08-12T08:00:00.000Z",
    }),
  ];
  const summary = computeCompanyWhatsAppSummary(rows, {
    now: new Date("2026-08-14T12:00:00.000Z"),
  });

  assert.equal(summary.active, 1);
  assert.equal(summary.resolved, 1);
});

test("resolved conversations do not remain in waiting or unassigned work queues", async () => {
  const { matchesInboxFilter } = await import("../lib/inbox/queue-filters");
  const row = conversation({
    id: "resolved-inbound",
    assignedToId: null,
    assignee: null,
    conversationStatus: "RESOLVED",
    lastMessageDirection: "inbound",
  });

  assert.equal(matchesInboxFilter(row, "awaiting_reply", "manager-1"), false);
  assert.equal(matchesInboxFilter(row, "unassigned", "manager-1"), false);
});

test("average first response uses first inbound to first outbound durations", () => {
  const rows = [
    conversation({ id: "one", firstResponseSeconds: 60 }),
    conversation({ id: "two", firstResponseSeconds: 180 }),
    conversation({ id: "no-response", firstResponseSeconds: null }),
  ];
  const summary = computeCompanyWhatsAppSummary(rows, {
    now: new Date("2026-08-14T12:00:00.000Z"),
  });

  assert.equal(summary.avgFirstResponseSeconds, 120);
});
