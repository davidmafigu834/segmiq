import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { introductionNotifyUserIds } from "@/lib/real-estate/buyer-introduction-review";
import {
  announcementVisible,
  canPublishAnnouncements,
  compactUnreadCount,
  filterImportantMessages,
  introductionDestination,
  mapIntroductionNotification,
  redactPrivateContact,
  safeInternalPath,
  unreadImportantCount,
  type ImportantMessage,
} from "@/lib/important-messages/model";

const now = new Date("2026-10-18T12:00:00.000Z");

function message(partial: Partial<ImportantMessage> & Pick<ImportantMessage, "id" | "category" | "read">): ImportantMessage {
  return {
    source: "notification",
    priority: partial.category === "approvals" ? "action" : "info",
    title: partial.title ?? "Message",
    description: partial.description ?? "Details",
    createdAt: partial.createdAt ?? now.toISOString(),
    href: partial.href ?? null,
    actionLabel: partial.actionLabel ?? null,
    resolved: partial.resolved ?? false,
    ...partial,
  };
}

describe("important messages", () => {
  it("maps a reviewer request once, as an approval, without a phone number", () => {
    const item = mapIntroductionNotification({
      id: "n1",
      message: "Introduction requested for a matched buyer at Borrowdale. Call +263 77 123 4567.",
      read: false,
      createdAt: now.toISOString(),
      introductionId: "11111111-1111-1111-1111-111111111111",
      role: "CLIENT_MANAGER",
    });
    assert.equal(item?.category, "approvals");
    assert.equal(item?.resolved, false);
    assert.equal(item?.title, "Buyer introduction requested");
    assert.equal(item?.href, "/client/buyers/introductions?open=11111111-1111-1111-1111-111111111111");
    assert.equal(PHONE_IN(item?.description ?? ""), false);
    const again = filterImportantMessages([item!], "collaboration");
    assert.equal(again.length, 0);
  });

  it("routes an unassigned buyer to managers and a salesperson decision to the sales queue", () => {
    const managers = introductionNotifyUserIds({
      requesterId: "agent",
      currentAssigneeId: null,
      assigneeActive: false,
      activeManagerIds: ["manager-a", "manager-b", "agent"],
    });
    assert.deepEqual(managers, ["manager-a", "manager-b"]);
    assert.equal(
      introductionDestination({ role: "SALESPERSON", introductionId: "abc" }),
      "/sales/buyers/introductions?open=abc"
    );
  });

  it("maps approved and declined decisions for the requester", () => {
    const approved = mapIntroductionNotification({
      id: "n2",
      message: "Your introduction request was approved. Open it to see the next step.",
      read: false,
      createdAt: now.toISOString(),
      introductionId: "abc",
      role: "SALESPERSON",
    });
    const declined = mapIntroductionNotification({
      id: "n3",
      message: "Your introduction request was declined. Buyer details stay private.",
      read: true,
      createdAt: now.toISOString(),
      introductionId: "abc",
      role: "SALESPERSON",
    });
    assert.equal(approved?.category, "collaboration");
    assert.equal(approved?.title, "Introduction approved");
    assert.equal(approved?.resolved, true);
    assert.equal(declined?.title, "Introduction declined");
    assert.equal(declined?.description.includes("private"), false);
    assert.equal(declined?.description, "Your buyer introduction request was declined.");
  });

  it("keeps a read approval unresolved and counts only unread important items", () => {
    const pending = message({ id: "n1", category: "approvals", read: true, resolved: false });
    const update = message({ id: "n2", category: "whats_new", read: false });
    assert.equal(pending.resolved, false);
    assert.equal(unreadImportantCount([pending, update]), 1);
    assert.equal(compactUnreadCount(12), "9+");
    assert.equal(compactUnreadCount(0), null);
  });

  it("filters categories without duplicating one record", () => {
    const items = [message({ id: "same", category: "approvals", read: false })];
    assert.equal(filterImportantMessages(items, "all").length, 1);
    assert.equal(filterImportantMessages(items, "approvals").length, 1);
    assert.equal(filterImportantMessages(items, "whats_new").length, 0);
  });

  it("hides drafts, other industries, and other organisations", () => {
    const base = {
      publishedAt: "2026-10-18T11:00:00.000Z",
      expiresAt: null,
      now,
      viewerRole: "SALESPERSON",
      viewerClientId: "org-a",
      viewerBusinessType: "real_estate",
    };
    assert.equal(announcementVisible({ ...base, status: "draft", audience: "all", industry: null, roleTarget: null, clientId: null }), false);
    assert.equal(announcementVisible({ ...base, status: "published", audience: "industry", industry: "solar", roleTarget: null, clientId: null }), false);
    assert.equal(announcementVisible({ ...base, status: "published", audience: "industry", industry: "real_estate", roleTarget: null, clientId: null }), true);
    assert.equal(announcementVisible({ ...base, status: "published", audience: "organisation", industry: null, roleTarget: null, clientId: "org-b" }), false);
    assert.equal(announcementVisible({ ...base, status: "published", audience: "role", industry: null, roleTarget: "CLIENT_MANAGER", clientId: null }), false);
  });

  it("allows only platform administrators to publish and rejects unsafe links", () => {
    assert.equal(canPublishAnnouncements("SUPER_ADMIN"), true);
    assert.equal(canPublishAnnouncements("CLIENT_MANAGER"), false);
    assert.equal(canPublishAnnouncements("SALESPERSON"), false);
    assert.equal(safeInternalPath("/sales/listings"), "/sales/listings");
    assert.equal(safeInternalPath("https://example.com"), null);
    assert.equal(safeInternalPath("//evil.example"), null);
  });

  it("omits a review action when the introduction link is not available", () => {
    const item = mapIntroductionNotification({
      id: "n4",
      message: "Introduction requested for a matched buyer at a property.",
      read: false,
      createdAt: now.toISOString(),
      introductionId: null,
      role: "CLIENT_MANAGER",
    });
    assert.equal(item?.href, null);
    assert.equal(item?.actionLabel, null);
  });

  it("redacts a phone that was stored in an older message", () => {
    assert.equal(redactPrivateContact("Call +263771234567 today").includes("263"), false);
  });
});

function PHONE_IN(value: string) {
  return /\d{6,}/.test(value);
}
