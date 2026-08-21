import test from "node:test";
import assert from "node:assert/strict";
import { matchesInboxFilter } from "../lib/inbox/queue-filters";
import type { InboxConversation } from "../lib/inbox/types";
import { buildWhatsAppSalesHubNav, isWhatsAppSalesHubPath } from "../lib/sales/whatsapp-hub-nav";

function conversation(overrides: Partial<InboxConversation> = {}): InboxConversation {
  return {
    id: "lead-1",
    contactId: "contact-1",
    name: "Customer",
    whatsappProfileName: null,
    phone: "+263771234567",
    location: "Harare",
    source: "WHATSAPP_INBOUND",
    status: "CONTACTED",
    stageLabel: "Contacted",
    projectType: "Solar installation",
    leadBudget: "$6,000-$10,000",
    leadTimeline: "1-3 months",
    assignedToId: "rep-1",
    assignee: { id: "rep-1", name: "Rep One" },
    score: 86,
    scoreLabel: "Hot",
    lastMessage: "Can you send the quote?",
    lastMessageAt: "2026-08-14T08:00:00.000Z",
    lastMessageType: "text",
    unread: 1,
    tags: [],
    leadSummary: null,
    breakdown: { urgency: 20, budget: 20, location: 12, productInterest: 18, engagement: 16 },
    followUpDate: null,
    createdAt: "2026-08-10T08:00:00.000Z",
    company: null,
    dealValue: null,
    dealCurrency: "USD",
    sourceLabel: "WhatsApp",
    lastMessageDirection: "inbound",
    awaitingReplyMinutes: 30,
    latestQuoteNumber: null,
    latestQuoteStatus: null,
    latestQuoteTotal: null,
    conversationStatus: "OPEN",
    resolvedAt: null,
    firstContactAt: "2026-08-10T08:00:00.000Z",
    firstResponseSeconds: 120,
    messageCount: 6,
    activeDealId: null,
    dealName: null,
    dealStage: null,
    dealNextActionAt: null,
    dealNextActionLabel: null,
    conversationType: "SALES",
    conversationQueue: "SALES",
    collaboratorIds: [],
    supportCase: null,
    latestQuoteViewedAt: null,
    ...overrides,
  };
}

test("needs reply and waiting for customer remain mutually exclusive", () => {
  const inbound = conversation({ lastMessageDirection: "inbound" });
  const outbound = conversation({ lastMessageDirection: "outbound" });

  assert.equal(matchesInboxFilter(inbound, "awaiting_reply", "rep-1"), true);
  assert.equal(matchesInboxFilter(inbound, "waiting_customer", "rep-1"), false);
  assert.equal(matchesInboxFilter(outbound, "awaiting_reply", "rep-1"), false);
  assert.equal(matchesInboxFilter(outbound, "waiting_customer", "rep-1"), true);
});

test("quote and Deal filters use relationship data rather than message text", () => {
  const leadOnly = conversation({ lastMessage: "Please send a quote" });
  const deal = conversation({
    activeDealId: "deal-1",
    dealName: "5kW Solar Installation",
    dealStage: "PROPOSAL_SENT",
    latestQuoteStatus: "sent",
  });

  assert.equal(matchesInboxFilter(leadOnly, "quotes_sent", "rep-1"), false);
  assert.equal(matchesInboxFilter(leadOnly, "no_deal", "rep-1"), true);
  assert.equal(matchesInboxFilter(deal, "quotes_sent", "rep-1"), true);
  assert.equal(matchesInboxFilter(deal, "deal_proposal_sent", "rep-1"), true);
  assert.equal(matchesInboxFilter(deal, "no_deal", "rep-1"), false);
});

test("intent filters use the shared score thresholds", () => {
  assert.equal(matchesInboxFilter(conversation({ score: 86 }), "hot", "rep-1"), true);
  assert.equal(matchesInboxFilter(conversation({ score: 55 }), "warm", "rep-1"), true);
  assert.equal(matchesInboxFilter(conversation({ score: 20 }), "cold", "rep-1"), true);
});

test("WhatsApp Sales Hub nav is a single inbox item, not nested dashboard pages", () => {
  const nav = buildWhatsAppSalesHubNav({ hotLeads: 2, needsReply: 3, followUpDue: 1, followUpsToday: 4 });

  assert.equal(nav.href, "/sales/inbox");
  assert.equal(nav.badge, 6);
  assert.equal(nav.children, undefined);
  assert.equal(isWhatsAppSalesHubPath("/sales/inbox"), true);
  assert.equal(isWhatsAppSalesHubPath("/sales/inbox/needs-reply"), true);
  assert.equal(isWhatsAppSalesHubPath("/sales/followups"), false);
  assert.equal(isWhatsAppSalesHubPath("/sales/reports"), false);
});
