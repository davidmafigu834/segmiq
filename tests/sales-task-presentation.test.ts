import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { copilotRowToTask } from "@/lib/sales-copilot/project";
import { presentCopilotWork, type PresentableWork } from "@/lib/sales-copilot/present";
import type { WorkItemRow } from "@/lib/sales-copilot/store";
import { formatScheduleWhen } from "@/lib/sales/tasks/format";

const TZ = "Africa/Harare";
const NOW = new Date("2026-10-11T10:00:00.000Z");

function work(overrides: Partial<PresentableWork> = {}): PresentableWork {
  return {
    actionType: "open_commitment",
    title: "Open commitment",
    explanation: "You said “I'll check stock”. No date was given, so nothing was scheduled.",
    queue: "needs_review",
    reviewStatus: "pending",
    executionStatus: "none",
    fulfilmentStatus: "open",
    waitingActor: "salesperson",
    proposedAt: null,
    currentDueAt: null,
    linkedFollowUp: false,
    missing: [],
    payload: { kind: "open_commitment", intent: "check_stock", actor: "salesperson" },
    semanticKey: "salesperson:check_stock:undated",
    executionError: null,
    linkedQuotationId: null,
    ...overrides,
  };
}

function row(overrides: Partial<WorkItemRow> = {}): WorkItemRow {
  return {
    id: "w1",
    client_id: "c1",
    lead_id: "l1",
    deal_id: null,
    owner_id: "u1",
    action_type: "open_commitment",
    queue: "needs_review",
    title: "Open commitment",
    explanation: "You said “I'll check stock”. No date was given, so nothing was scheduled.",
    evidence_message_ids: ["m1"],
    proposed_payload: {
      kind: "open_commitment",
      intent: "check_stock",
      actor: "salesperson",
      evidence: [{ id: "m1", at: "2026-10-10T12:00:00.000Z", speaker: "salesperson", text: "I'll check stock." }],
    },
    payload_hash: "hash",
    missing_information: [],
    linked_quotation_id: null,
    linked_follow_up: false,
    review_status: "pending",
    execution_status: "none",
    fulfilment_status: "open",
    waiting_actor: "salesperson",
    proposed_at: null,
    hour_suggested: false,
    current_due_at: null,
    snooze_until: null,
    context_revision: "rev",
    semantic_key: "salesperson:check_stock:undated",
    priority: "medium",
    execution_error: null,
    audit: [],
    updated_at: "2026-10-11T01:08:00.000Z",
    ...overrides,
  };
}

describe("Sales task date projection", () => {
  it("does not treat an analysis timestamp as a deadline", () => {
    const task = copilotRowToTask(row(), NOW, "Adlense");
    assert.equal(task.deadlineAt, null);
    assert.equal(task.schedule.kind, "none");
    assert.equal(task.schedule.label, "No date set");
    assert.equal(task.schedule.overdue, false);
    assert.equal(task.status, "pending");
    assert.notEqual(task.dueAt, row().updated_at);
    assert.match(task.title, /stock check/i);
    assert.match(task.notes ?? "", /I'll check stock/);
  });

  it("keeps a genuine 3:08 reminder instead of rewriting the hour", () => {
    const at = "2026-10-11T01:08:00.000Z";
    const task = copilotRowToTask(
      row({
        action_type: "create_reminder",
        title: "Reminder suggested from your promise",
        queue: "todo",
        review_status: "approved",
        execution_status: "succeeded",
        linked_follow_up: true,
        proposed_at: at,
        semantic_key: "salesperson:contact:2026-10-11",
        proposed_payload: { kind: "follow_up", followUpAt: at, source: "HUMAN_CREATED" },
      }),
      NOW,
      "Adlense"
    );
    assert.equal(task.deadlineAt, at);
    assert.equal(task.schedule.kind, "due");
    assert.equal(task.schedule.overdue, true);
    assert.equal(formatScheduleWhen(at, TZ, NOW), "Today, 3:08 AM");
  });

  it("formats relative days in the company timezone", () => {
    const now = new Date("2026-10-11T22:30:00.000Z");
    const at = "2026-10-12T07:00:00.000Z";
    assert.equal(formatScheduleWhen(at, TZ, now), "Today, 9:00 AM");
  });
});

describe("Sales task lifecycle presentation", () => {
  it("keeps an unapproved customer check-in in review and separates the two dates", () => {
    const view = presentCopilotWork(
      work({
        actionType: "customer_checkin",
        title: "Customer is expected to reply first",
        queue: "needs_review",
        waitingActor: "customer",
        proposedAt: "2026-10-15T13:00:00.000Z",
        linkedFollowUp: true,
        explanation: "The customer said they would get back to you tomorrow.",
        payload: {
          kind: "follow_up",
          followUpAt: "2026-10-15T13:00:00.000Z",
          customerPromisedAt: "2026-10-14T13:00:00.000Z",
          hourSuggested: true,
        },
      }),
      NOW
    );
    assert.equal(view.listState, "needs_review");
    assert.equal(view.schedule.kind, "suggested");
    assert.equal(view.deadlineAt, null);
    assert.equal(view.schedule.overdue, false);
    assert.equal(view.schedule.expectedReplyAt, "2026-10-14T13:00:00.000Z");
    assert.match(view.title, /check-in/i);
    assert.equal(view.primaryAction, "review");
    assert.equal(view.explanation, "The customer said they would get back to you tomorrow.");
  });

  it("titles an approved future check-in as the salesperson's action", () => {
    const view = presentCopilotWork(
      work({
        actionType: "customer_checkin",
        title: "Customer is expected to reply first",
        queue: "todo",
        reviewStatus: "approved",
        executionStatus: "succeeded",
        waitingActor: "customer",
        proposedAt: "2026-10-15T13:00:00.000Z",
        linkedFollowUp: true,
        payload: { customerPromisedAt: "2026-10-14T13:00:00.000Z", followUpAt: "2026-10-15T13:00:00.000Z" },
      }),
      NOW
    );
    assert.equal(view.listState, "todo");
    assert.equal(view.title, "Check in if the customer has not replied");
    assert.equal(view.schedule.kind, "check_in");
    assert.equal(view.schedule.label, "Check-in");
    assert.equal(view.schedule.overdue, false);
    assert.equal(view.deadlineAt, "2026-10-15T13:00:00.000Z");
    assert.equal(view.schedule.expectedReplyAt, "2026-10-14T13:00:00.000Z");
    assert.equal(view.primaryAction, "complete");
  });

  it("does not call a passed meeting suggestion an overdue approved meeting", () => {
    const view = presentCopilotWork(
      work({
        actionType: "create_reminder",
        title: "Save a meeting reminder?",
        semanticKey: "meeting:2026-10-10",
        proposedAt: "2026-10-10T06:00:00.000Z",
        linkedFollowUp: true,
        payload: { subject: "the tyres", followUpAt: "2026-10-10T06:00:00.000Z" },
      }),
      NOW
    );
    assert.equal(view.schedule.overdue, false);
    assert.equal(view.schedule.kind, "suggested");
    assert.equal(view.schedule.passedSuggestion, true);
    assert.equal(view.title, "Choose a new meeting time");
    assert.equal(view.deadlineAt, null);
  });

  it("sends a saved quotation to its draft and a failure to retry", () => {
    const draft = presentCopilotWork(
      work({
        actionType: "quotation_draft",
        title: "Quotation draft ready",
        reviewStatus: "pending",
        executionStatus: "succeeded",
        linkedQuotationId: "quote-1",
        explanation: "Please review the items and prices before sending.",
      }),
      NOW
    );
    assert.equal(draft.title, "Review quotation draft");
    assert.equal(draft.primaryAction, "quote");
    assert.match(draft.explanation, /review the items/i);

    const failed = presentCopilotWork(
      work({
        actionType: "create_reminder",
        title: "Reminder suggested from your promise",
        queue: "todo",
        reviewStatus: "approved",
        executionStatus: "failed",
        executionError: "The reminder was not saved.",
        linkedFollowUp: true,
        proposedAt: "2026-10-12T07:00:00.000Z",
      }),
      NOW
    );
    assert.equal(failed.primaryAction, "retry");
    assert.equal(failed.actionLabel, "Retry");
    assert.equal(failed.schedule.overdue, false);
    assert.equal(failed.explanation, work().explanation);
  });

  it("keeps an approved undated commitment open without inventing a deadline", () => {
    const view = presentCopilotWork(
      work({
        reviewStatus: "approved",
        executionStatus: "succeeded",
        queue: "needs_review",
      }),
      NOW
    );
    assert.equal(view.listState, "todo");
    assert.equal(view.schedule.kind, "none");
    assert.equal(view.deadlineAt, null);
    assert.equal(view.primaryAction, "complete");
    assert.match(view.explanation, /No date was given/);
  });

  it("leaves a waiting item in Waiting when it is not a check-in to approve", () => {
    const view = presentCopilotWork(
      work({
        actionType: "answer_question",
        title: "Waiting on the customer",
        queue: "waiting",
        reviewStatus: "approved",
        executionStatus: "succeeded",
        waitingActor: "customer",
      }),
      NOW
    );
    assert.equal(view.listState, "waiting");
  });
});
