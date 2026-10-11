import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  briefingCopy,
  buildWorkspaceBriefing,
  dedupeFollowUps,
  greetingPartInTimeZone,
  isDueOnLocalDay,
  rankNextActions,
  workspaceDateLine,
  workspacePrimary,
} from "../lib/sales/dashboard/daily-workspace";
import { mapLeadEvent, mapQuotationEvent, selectRecentUpdates } from "../lib/sales/dashboard/recent-updates";
import { resolveDashboardVisit } from "../lib/sales/dashboard/visit-cursor";
import type { SalesTaskItem, TaskSchedule } from "../lib/sales/tasks/types";

const TZ = "Africa/Harare";
const NOW = new Date("2026-10-11T08:00:00.000Z");

function schedule(partial: Partial<TaskSchedule> = {}): TaskSchedule {
  return {
    kind: "due",
    label: "Due",
    at: "2026-10-11T06:00:00.000Z",
    overdue: false,
    passedSuggestion: false,
    expectedReplyAt: null,
    ...partial,
  };
}

function task(partial: Partial<SalesTaskItem> & { id: string }): SalesTaskItem {
  return {
    leadId: partial.leadId ?? partial.id,
    title: partial.title ?? "Follow up",
    type: "follow_up",
    typeLabel: "Follow-up",
    relatedName: partial.relatedName ?? "Amina",
    relatedSecondary: null,
    phone: null,
    source: "WHATSAPP_INBOUND",
    dueAt: partial.dueAt ?? null,
    deadlineAt: partial.deadlineAt ?? null,
    schedule: partial.schedule ?? schedule(),
    priority: "medium",
    status: "pending",
    completed: false,
    completedAt: null,
    createdById: null,
    createdByName: null,
    assignedToId: "user-1",
    isWhatsAppCapable: true,
    leadHref: "/sales/inbox?lead=lead-1",
    whatsappHref: "/sales/inbox?lead=lead-1",
    score: null,
    notes: null,
    ...partial,
  };
}

describe("daily workspace briefing and rank", () => {
  it("counts the full task set and shows only three actions", () => {
    const tasks = [0, 1, 2, 3, 4].map((index) =>
      task({
        id: `due-${index}`,
        title: `Follow-up ${index}`,
        schedule: schedule({ at: `2026-10-11T0${index}:30:00.000Z`, overdue: index < 6 }),
        deadlineAt: `2026-10-11T0${index}:30:00.000Z`,
      })
    );
    const summary = buildWorkspaceBriefing(tasks, NOW, TZ);
    assert.equal(summary.dueToday, 5);
    assert.equal(summary.openCount, 5);
    assert.equal(rankNextActions(tasks, NOW, TZ).length, 3);
    assert.match(summary.briefing, /5 follow-ups due today/);
  });

  it("does not treat a suggested date or a completed item as due today", () => {
    const suggested = task({
      id: "suggest",
      schedule: schedule({ kind: "suggested", label: "Suggested time", at: "2026-10-11T06:00:00.000Z", overdue: false }),
      copilot: {
        workItemId: "suggest",
        queue: "needs_review",
        actionType: "appointment",
        explanation: "You offered 11 October at 8:00 am. Can I save a reminder? The client has not confirmed yet.",
        reviewStatus: "pending",
        executionStatus: "none",
        fulfilmentStatus: "open",
        listState: "needs_review",
        waitingActor: null,
        hourSuggested: false,
        currentDueAt: null,
        proposedAt: "2026-10-11T06:00:00.000Z",
        linkedQuotationId: null,
        linkedFollowUp: false,
        missing: [],
        evidenceMessageIds: [],
        evidence: [],
        payload: { awaitingCustomerConfirmation: true },
        executionError: null,
        primaryLabel: "Save reminder",
        actionLabel: "Save reminder",
        primaryAction: "review",
      },
    });
    const done = task({
      id: "done",
      completed: true,
      schedule: schedule({ overdue: true, label: "Overdue", at: "2026-10-10T06:00:00.000Z" }),
    });
    const summary = buildWorkspaceBriefing([suggested, done], NOW, TZ);
    assert.equal(summary.dueToday, 0);
    assert.equal(summary.overdue, 0);
    assert.equal(summary.needsReview, 1);
    assert.equal(isDueOnLocalDay(suggested, NOW, TZ), false);
    assert.equal(workspaceDateLine(suggested, TZ, NOW).tone, "attention");
    assert.match(workspaceDateLine(suggested, TZ, NOW).text, /Awaiting customer confirmation/);
    assert.equal(workspacePrimary(suggested).label, "Save reminder");
  });

  it("ranks a follow-up due now ahead of a meeting reminder next week", () => {
    const dueNow = task({ id: "now", title: "Follow-up due today", schedule: schedule({ at: "2026-10-11T06:00:00.000Z" }) });
    const nextWeek = task({
      id: "week",
      title: "Save a meeting reminder",
      schedule: schedule({ at: "2026-10-18T06:00:00.000Z", label: "Due" }),
      deadlineAt: "2026-10-18T06:00:00.000Z",
    });
    const ranked = rankNextActions([nextWeek, dueNow], NOW, TZ);
    assert.equal(ranked[0]?.id, "now");
  });

  it("keeps overdue work ahead of a review and does not infer a quotation deadline", () => {
    const overdue = task({
      id: "overdue",
      title: "Follow-up due today",
      schedule: schedule({ at: "2026-10-10T06:00:00.000Z", label: "Overdue", overdue: true }),
    });
    const quote = task({
      id: "quote",
      title: "Review quotation draft",
      type: "quote_review",
      schedule: schedule({ kind: "none", label: "No date set", at: null, overdue: false }),
      deadlineAt: null,
      copilot: {
        workItemId: "quote",
        queue: "needs_review",
        actionType: "quotation_draft",
        explanation: "The draft using the confirmed items is ready. Check the items and total before sending.",
        reviewStatus: "pending",
        executionStatus: "succeeded",
        fulfilmentStatus: "open",
        listState: "needs_review",
        waitingActor: null,
        hourSuggested: false,
        currentDueAt: null,
        proposedAt: null,
        linkedQuotationId: "quote-1",
        linkedFollowUp: false,
        missing: [],
        evidenceMessageIds: [],
        evidence: [],
        payload: {},
        executionError: null,
        primaryLabel: "Review draft",
        actionLabel: "Review draft",
        primaryAction: "quote",
      },
    });
    const summary = buildWorkspaceBriefing([overdue, quote], NOW, TZ);
    assert.equal(summary.overdue, 1);
    assert.equal(summary.dueToday, 0);
    assert.equal(summary.needsReview, 1);
    assert.match(summary.briefing, /1 follow-up is overdue/);
    assert.match(summary.briefing, /1 item needs your review/);
    assert.equal(rankNextActions([quote, overdue], NOW, TZ)[0]?.id, "overdue");
    assert.equal(workspacePrimary(quote).kind, "quote");
  });

  it("uses prepare wording until a quotation draft exists", () => {
    const unsaved = task({
      id: "missing",
      title: "Add missing details",
      schedule: schedule({ kind: "none", label: "No date set", at: null }),
      copilot: {
        workItemId: "missing",
        queue: "needs_review",
        actionType: "quotation_missing",
        explanation: "Quantity is still needed.",
        reviewStatus: "pending",
        executionStatus: "none",
        fulfilmentStatus: "open",
        listState: "needs_review",
        waitingActor: null,
        hourSuggested: false,
        currentDueAt: null,
        proposedAt: null,
        linkedQuotationId: null,
        linkedFollowUp: false,
        missing: ["Quantity"],
        evidenceMessageIds: [],
        evidence: [],
        payload: {},
        executionError: null,
        primaryLabel: "Add missing details",
        actionLabel: "Add missing details",
        primaryAction: "missing",
      },
    });
    assert.equal(workspacePrimary(unsaved).label, "Add missing details");
    assert.equal(workspacePrimary(unsaved).kind, "review");
  });

  it("drafts an approved check-in instead of sending it", () => {
    const checkIn = task({
      id: "check",
      title: "Follow-up due today",
      schedule: schedule({ kind: "check_in", label: "Check-in" }),
      copilot: {
        workItemId: "check",
        queue: "todo",
        actionType: "contact_later",
        explanation: "This customer was comparing options. Your approved check-in is due today.",
        reviewStatus: "approved",
        executionStatus: "succeeded",
        fulfilmentStatus: "open",
        listState: "todo",
        waitingActor: null,
        hourSuggested: false,
        currentDueAt: "2026-10-11T06:00:00.000Z",
        proposedAt: "2026-10-11T06:00:00.000Z",
        linkedQuotationId: null,
        linkedFollowUp: true,
        missing: [],
        evidenceMessageIds: [],
        evidence: [],
        payload: {},
        executionError: null,
        primaryLabel: "View details",
        actionLabel: "View details",
        primaryAction: "complete",
      },
    });
    assert.equal(workspacePrimary(checkIn).label, "Draft check-in");
    assert.equal(workspacePrimary(checkIn).kind, "draft");
  });

  it("drops a manual follow-up already represented by an approved Copilot reminder", () => {
    const manual = task({ id: "followup-lead-1", leadId: "lead-1", title: "Follow up with Amina" });
    const copilot = task({
      id: "work-1",
      leadId: "lead-1",
      title: "Follow up as promised",
      copilot: {
        workItemId: "work-1",
        queue: "todo",
        actionType: "create_reminder",
        explanation: "Saved reminder.",
        reviewStatus: "approved",
        executionStatus: "succeeded",
        fulfilmentStatus: "open",
        listState: "todo",
        waitingActor: null,
        hourSuggested: false,
        currentDueAt: "2026-10-11T06:00:00.000Z",
        proposedAt: "2026-10-11T06:00:00.000Z",
        linkedQuotationId: null,
        linkedFollowUp: true,
        missing: [],
        evidenceMessageIds: [],
        evidence: [],
        payload: {},
        executionError: null,
        primaryLabel: "View details",
        actionLabel: "View details",
        primaryAction: "complete",
      },
    });
    const open = dedupeFollowUps([manual, copilot]);
    assert.deepEqual(open.map((item) => item.id), ["work-1"]);
    assert.equal(buildWorkspaceBriefing([manual, copilot], NOW, TZ).dueToday, 1);
  });

  it("uses singular and empty briefing copy without claiming the pipeline is clear", () => {
    assert.equal(briefingCopy({ overdue: 0, dueToday: 1, needsReview: 0 }), "1 follow-up is due today.");
    assert.equal(
      briefingCopy({ overdue: 0, dueToday: 0, needsReview: 0 }),
      "No follow-ups are due today, and nothing is waiting on your review."
    );
  });

  it("asks for a retry when execution failed", () => {
    const failed = task({
      id: "failed",
      schedule: schedule({ kind: "suggested", label: "Suggested time", overdue: false }),
      copilot: {
        workItemId: "failed",
        queue: "needs_review",
        actionType: "create_reminder",
        explanation: "The reminder was not saved.",
        reviewStatus: "approved",
        executionStatus: "failed",
        fulfilmentStatus: "open",
        listState: "needs_review",
        waitingActor: null,
        hourSuggested: false,
        currentDueAt: null,
        proposedAt: "2026-10-11T06:00:00.000Z",
        linkedQuotationId: null,
        linkedFollowUp: false,
        missing: [],
        evidenceMessageIds: [],
        evidence: [],
        payload: {},
        executionError: "The reminder was not saved.",
        primaryLabel: "Retry",
        actionLabel: "Retry",
        primaryAction: "retry",
      },
    });
    assert.equal(workspacePrimary(failed).kind, "retry");
    assert.match(workspaceDateLine(failed, TZ, NOW).text, /not saved/);
  });
});

describe("daily workspace greeting", () => {
  it("uses the company timezone", () => {
    assert.equal(greetingPartInTimeZone(new Date("2026-10-11T06:00:00.000Z"), TZ), "morning");
    assert.equal(greetingPartInTimeZone(new Date("2026-10-11T10:00:00.000Z"), TZ), "afternoon");
    assert.equal(greetingPartInTimeZone(new Date("2026-10-11T15:30:00.000Z"), TZ), "evening");
  });
});

describe("dashboard visit cursor", () => {
  it("keeps the first visit unreliable and does not advance on reload", () => {
    const first = resolveDashboardVisit({
      stored: null,
      incomingVisitId: null,
      now: new Date("2026-10-11T08:00:00.000Z"),
      nextVisitId: "visit-1",
    });
    assert.equal(first.reliableAwayWindow, false);
    assert.equal(first.sinceAt, null);

    const reload = resolveDashboardVisit({
      stored: {
        sinceAt: first.sinceAt,
        visitId: first.visitId,
        visitStartedAt: first.visitStartedAt,
        updatedAt: first.updatedAt,
      },
      incomingVisitId: "visit-1",
      now: new Date("2026-10-11T08:05:00.000Z"),
      nextVisitId: "visit-2",
    });
    assert.equal(reload.sameVisit, true);
    assert.equal(reload.visitId, "visit-1");
    assert.equal(reload.sinceAt, null);
  });

  it("opens the next visit from the previous arrival and ignores a stale tab during the gap", () => {
    const next = resolveDashboardVisit({
      stored: {
        sinceAt: null,
        visitId: "visit-1",
        visitStartedAt: "2026-10-11T08:00:00.000Z",
        updatedAt: "2026-10-11T08:00:00.000Z",
      },
      incomingVisitId: null,
      now: new Date("2026-10-11T12:00:00.000Z"),
      nextVisitId: "visit-2",
    });
    assert.equal(next.sameVisit, false);
    assert.equal(next.reliableAwayWindow, true);
    assert.equal(next.sinceAt, "2026-10-11T08:00:00.000Z");

    const staleTab = resolveDashboardVisit({
      stored: {
        sinceAt: next.sinceAt,
        visitId: next.visitId,
        visitStartedAt: next.visitStartedAt,
        updatedAt: next.updatedAt,
      },
      incomingVisitId: "visit-1",
      now: new Date("2026-10-11T12:01:00.000Z"),
      nextVisitId: "visit-3",
    });
    assert.equal(staleTab.sameVisit, true);
    assert.equal(staleTab.visitId, "visit-2");
    assert.equal(staleTab.sinceAt, "2026-10-11T08:00:00.000Z");
  });
});

describe("recent updates", () => {
  it("summarises real events without treating a reply as approval", () => {
    const reply = mapLeadEvent({
      id: "e1",
      eventType: "MESSAGE_RECEIVED",
      at: "2026-10-11T07:00:00.000Z",
      leadId: "lead-1",
      leadName: "Amina",
      userId: "user-1",
      data: { body: "Can we meet tomorrow?" },
      timeZone: TZ,
      now: NOW,
    });
    assert.ok(reply);
    assert.match(reply.summary, /replied/);
    assert.doesNotMatch(reply.summary, /approv|confirm|complete/i);
    assert.equal(reply.linkLabel, "View chat");

    const approved = mapQuotationEvent({
      id: "q1",
      eventType: "APPROVED",
      at: "2026-10-11T07:30:00.000Z",
      leadId: "lead-1",
      leadName: "Amina",
      quotationId: "quote-1",
    });
    assert.equal(approved?.summary, "A quotation for Amina was approved.");
    assert.equal(approved?.href, "/sales/quotes/quote-1");

    assert.equal(
      mapLeadEvent({
        id: "noise",
        eventType: "LEARNING_OBSERVED",
        at: "2026-10-11T07:40:00.000Z",
        leadId: "lead-1",
        leadName: "Amina",
        userId: "user-1",
        data: {},
        timeZone: TZ,
      }),
      null
    );
    assert.equal(
      mapLeadEvent({
        id: "done",
        eventType: "FOLLOW_UP_SET",
        at: "2026-10-11T07:45:00.000Z",
        leadId: "lead-1",
        leadName: "Amina",
        userId: "user-1",
        data: { completed: true, follow_up_date: null },
        timeZone: TZ,
      }),
      null
    );
  });

  it("keeps the newest of duplicate replies and ignores another salesperson's assignment", () => {
    const older = mapLeadEvent({
      id: "old",
      eventType: "MESSAGE_RECEIVED",
      at: "2026-10-11T06:00:00.000Z",
      leadId: "lead-1",
      leadName: "Amina",
      userId: "user-1",
      data: { body: "First" },
      timeZone: TZ,
    })!;
    const newer = mapLeadEvent({
      id: "new",
      eventType: "MESSAGE_RECEIVED",
      at: "2026-10-11T07:00:00.000Z",
      leadId: "lead-1",
      leadName: "Amina",
      userId: "user-1",
      data: { body: "Second" },
      timeZone: TZ,
    })!;
    const other = mapLeadEvent({
      id: "other",
      eventType: "LEAD_ASSIGNED",
      at: "2026-10-11T07:10:00.000Z",
      leadId: "lead-2",
      leadName: "Other",
      userId: "user-1",
      data: { assigned_to_id: "user-2" },
      timeZone: TZ,
    });
    assert.equal(other, null);
    const picked = selectRecentUpdates([older, newer], 3);
    assert.equal(picked.length, 1);
    assert.match(picked[0]!.summary, /Second/);
  });
});
