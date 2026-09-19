import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { P, hasPermission } from "../lib/auth/rbac";
import {
  canManageSocialChannels,
  canReplySocialInbox,
  canSeeConversation,
  canViewTeamSocialInbox,
} from "../lib/social-inbox/access";
import { classifySocialIntent } from "../lib/social-inbox/intent";
import { computeIndicators, matchesView, rankScoreForYou, sortQueue } from "../lib/social-inbox/ranking";
import { EMPTY_FILTERS, filterQueue } from "../lib/social-inbox/inbox-ui";
import { bandFromScore, explainScore, opportunityScoreFromClassification } from "../lib/social-inbox/scoring";
import { SOCIAL_VIEW_LABELS } from "../lib/social-inbox/display";
import { SALES_NAVIGATION, resolveSalesNavItems } from "../lib/sales/navigation/sales-nav-config";
import { getCompanyNavigation } from "../lib/sales/navigation/company-nav-config";
import { SETTINGS_SECTIONS } from "../lib/settings/company-settings-config";
import type { SocialQueueItem } from "../lib/social-inbox/types";

const manager = {
  userId: "mgr-a",
  role: "CLIENT_MANAGER" as const,
  clientId: "client-a",
  alsoSells: false,
};

const sellingMgr = { ...manager, alsoSells: true, userId: "mgr-sells" };

const repA = {
  userId: "rep-a",
  role: "SALESPERSON" as const,
  clientId: "client-a",
  alsoSells: false,
};

const repB = {
  userId: "rep-b",
  role: "SALESPERSON" as const,
  clientId: "client-b",
  alsoSells: false,
};

function item(partial: Partial<SocialQueueItem>): SocialQueueItem {
  return {
    conversationId: "c1",
    opportunityId: "o1",
    displayName: "Tendai Moyo",
    username: "tendai.moyo",
    avatarUrl: null,
    channel: "facebook_ad_comment",
    conversationKind: "comment",
    visibility: "public",
    preview: "How much deposit?",
    lastMessageAt: new Date().toISOString(),
    unread: true,
    assignedToId: "rep-a",
    assignedToName: "Ada",
    intentScore: 90,
    intentBand: "hot",
    intentReasons: ["Asked about price"],
    detectedProduct: "CAT 320 Excavator",
    followUpLabel: null,
    crmState: "none",
    primaryLabel: "Hot",
    origin: null,
    isDemo: false,
    rankScore: 0,
    ...partial,
  };
}

describe("social inbox intent", () => {
  it("treats a pricing + deposit + delivery comment as high intent", () => {
    const result = classifySocialIntent({
      text: "How much deposit do I need and can you deliver to Bulawayo?",
      conversationKind: "comment",
    });
    assert.ok(result.score >= 70, `expected hot score, got ${result.score}`);
    assert.equal(result.band, "hot");
    assert.ok(result.isOpportunity);
    assert.ok(result.signals.some((s) => s.type === "PRICING_INTENT"));
    assert.ok(result.signals.some((s) => s.type === "FINANCING_INTENT" || s.type === "DELIVERY_QUERY"));
    assert.equal(result.detectedLocation, "Bulawayo");
  });

  it("does not treat a fire emoji as a sales lead", () => {
    const result = classifySocialIntent({ text: "Great machine 🔥", conversationKind: "comment" });
    assert.ok(result.score < 45, `expected low score, got ${result.score}`);
    assert.equal(result.isOpportunity, false);
    assert.ok(result.signals.some((s) => s.type === "LOW_VALUE_ENGAGEMENT"));
  });

  it("keeps scoring compatible with existing hot/warm bands", () => {
    assert.equal(bandFromScore(70), "hot");
    assert.equal(bandFromScore(45), "warm");
    assert.equal(bandFromScore(20), "cold");
    const scored = opportunityScoreFromClassification(
      classifySocialIntent({ text: "Please send a quotation for the 5kVA system" }),
      { openDeal: true }
    );
    assert.ok(scored >= 70);
    assert.match(explainScore(["Asked about price", "Asked if it is still available"]), /Asked about price/);
  });
});

describe("social inbox ranking", () => {
  it("ranks For You by sales importance, not newest-first", () => {
    const olderHot = item({
      conversationId: "hot",
      intentScore: 94,
      intentBand: "hot",
      unread: true,
      lastMessageAt: new Date(Date.now() - 6 * 3600_000).toISOString(),
    });
    const newerLow = item({
      conversationId: "low",
      intentScore: 8,
      intentBand: "cold",
      unread: false,
      lastMessageAt: new Date().toISOString(),
      preview: "Nice",
    });
    const sorted = sortQueue([newerLow, olderHot], "for_you", "rep-a");
    assert.equal(sorted[0]?.conversationId, "hot");
    assert.ok(rankScoreForYou(olderHot, "rep-a") > rankScoreForYou(newerLow, "rep-a"));
  });

  it("filters views without hiding converted conversations from Converted", () => {
    const converted = item({ crmState: "converted", unread: false, intentBand: "warm", intentScore: 50 });
    assert.equal(matchesView(converted, "converted"), true);
    assert.equal(matchesView(item({ intentBand: "cold", unread: false, crmState: "none" }), "for_you"), false);
    assert.equal(matchesView(item({ intentBand: "cold", unread: true, crmState: "none" }), "for_you"), true);
    assert.equal(matchesView(item({ unread: true }), "needs_reply"), true);
    assert.equal(matchesView(item({ assignedToId: null }), "unassigned"), true);
    const indicators = computeIndicators([
      item({ intentBand: "hot", unread: true, followUpLabel: "Today", crmState: "open_deal" }),
    ]);
    assert.equal(indicators.highIntent, 1);
    assert.equal(indicators.awaitingReply, 1);
    assert.equal(indicators.followUpsDue, 1);
    assert.equal(indicators.openDealsNeedingAttention, 1);
  });
});

describe("social inbox permissions", () => {
  it("does not give salespeople channel administration", () => {
    assert.equal(hasPermission(repA, P.SOCIAL_INBOX_VIEW), true);
    assert.equal(hasPermission(repA, P.SOCIAL_INBOX_REPLY), true);
    assert.equal(hasPermission(repA, P.SOCIAL_INBOX_MANAGE_CHANNELS), false);
    assert.equal(canManageSocialChannels(repA), false);
    assert.equal(hasPermission(manager, P.SOCIAL_INBOX_MANAGE_CHANNELS), true);
    assert.equal(hasPermission(manager, P.SOCIAL_INBOX_REPLY), false);
    assert.equal(canReplySocialInbox(sellingMgr), true);
  });

  it("keeps assigned conversations tenant- and owner-scoped for salespeople", () => {
    assert.equal(canSeeConversation({ actor: repA, assignedToId: "rep-a" }), true);
    assert.equal(canSeeConversation({ actor: repA, assignedToId: "someone-else" }), false);
    assert.equal(canSeeConversation({ actor: repA, assignedToId: null }), false);
    assert.equal(canViewTeamSocialInbox(manager), true);
    assert.equal(canSeeConversation({ actor: manager, assignedToId: "rep-a" }), true);
    assert.equal(repA.clientId === repB.clientId, false);
  });
});

describe("social inbox navigation and settings", () => {
  it("adds Social Inbox without merging WhatsApp Sales Hub", () => {
    assert.ok(SALES_NAVIGATION.some((i) => i.id === "socialInbox" && i.label === "Social Inbox"));
    assert.ok(SALES_NAVIGATION.some((i) => i.id === "whatsapp" && i.href === "/sales/inbox"));
    assert.equal(
      SALES_NAVIGATION.find((i) => i.id === "socialInbox")?.href,
      "/sales/social-inbox"
    );
    const trades = resolveSalesNavItems(false, "trades");
    assert.ok(trades.some((i) => i.id === "socialInbox"));
    assert.ok(trades.some((i) => i.id === "whatsapp"));
    const company = getCompanyNavigation("trades");
    assert.ok(company.some((i) => i.id === "socialInbox" && i.href === "/client/social-inbox"));
    const re = getCompanyNavigation("real_estate");
    assert.ok(re.some((i) => i.id === "socialInbox"));
    assert.ok(SETTINGS_SECTIONS.integrations.some((s) => s.id === "channels" && s.label === "Channels"));
    assert.equal(SOCIAL_VIEW_LABELS.for_you, "For You");
  });

  it("does not treat a demo owner as the current salesperson", () => {
    const rows = [item({ assignedToId: "demo-rep", unread: true, intentBand: "hot", intentScore: 90 })];
    const mine = filterQueue(rows, "for_you", "rep-a", EMPTY_FILTERS, "", "mine", true);
    assert.equal(mine.length, 0);
  });

  it("extends the existing Meta webhook without treating Instagram as WhatsApp", () => {
    const webhook = readFileSync("app/api/facebook/webhook/route.ts", "utf8");
    assert.ok(webhook.includes("ingestSocialWebhook"));
    assert.ok(webhook.includes('payload.object === "instagram"'));
    assert.ok(webhook.includes('payload.object === "whatsapp_business_account" && change.value'));
  });
});
