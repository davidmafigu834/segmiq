import type { TaskSchedule } from "@/lib/sales/tasks/types";

export type CopilotListState = "needs_review" | "todo" | "waiting";

export type CopilotPrimaryAction =
  | "review"
  | "quote"
  | "draft"
  | "retry"
  | "complete"
  | "details"
  | "choose"
  | "missing";

export type PresentableWork = {
  actionType: string;
  title: string;
  explanation: string;
  queue: "needs_review" | "todo" | "waiting";
  reviewStatus: string;
  executionStatus: string;
  fulfilmentStatus: string;
  waitingActor: string | null;
  proposedAt: string | null;
  currentDueAt: string | null;
  linkedFollowUp: boolean;
  missing: string[];
  payload: Record<string, unknown>;
  semanticKey: string;
  executionError: string | null;
  linkedQuotationId: string | null;
};

export type CopilotPresentation = {
  title: string;
  explanation: string;
  listState: CopilotListState;
  schedule: TaskSchedule;
  deadlineAt: string | null;
  actionLabel: string;
  primaryAction: CopilotPrimaryAction;
};

const VAGUE_TITLES = new Set([
  "Open commitment",
  "Customer is expected to reply first",
  "Customer commitment is still open",
  "Follow-up has no date",
  "Waiting on a colleague",
]);

export function primaryLabel(actionType: string, executionStatus: string, missing: string[] = []): string {
  if (executionStatus === "failed") return "Retry";
  if (missing.length > 0 && (actionType === "appointment" || actionType === "create_reminder" || actionType === "update_reminder")) {
    return "Change time";
  }
  if (actionType === "quotation_draft") return "Review draft";
  if (actionType === "quotation_missing") return "Add missing details";
  if (actionType === "quotation_choice" || actionType === "listing_shortlist") return "Choose product";
  if (actionType === "contact_later") return "Approve follow-up";
  if (actionType === "customer_checkin") return "Set follow-up";
  if (actionType === "update_reminder" || actionType === "create_reminder") return "Save reminder";
  if (actionType === "appointment") return "Change time";
  if (actionType === "send_quotation") return "Open draft";
  if (actionType === "answer_question") return "Draft reply";
  return "Review";
}

function pendingReview(row: PresentableWork): boolean {
  return row.reviewStatus === "pending" || row.reviewStatus === "snoozed" || row.reviewStatus === "stale";
}

function approved(row: PresentableWork): boolean {
  return row.reviewStatus === "approved" && (row.executionStatus === "succeeded" || row.executionStatus === "failed");
}

function meetingLike(row: PresentableWork): boolean {
  return row.semanticKey.startsWith("meeting:") || row.actionType === "appointment" || "subject" in row.payload;
}

function payloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function copilotListState(row: PresentableWork): CopilotListState {
  if (row.queue === "waiting" && row.actionType !== "customer_checkin" && row.actionType !== "contact_later") {
    return "waiting";
  }
  if (pendingReview(row)) {
    if (row.actionType === "answer_question" && row.queue === "todo") return "todo";
    return "needs_review";
  }
  if (row.reviewStatus === "approved" && row.queue === "waiting" && row.actionType !== "customer_checkin") {
    return "waiting";
  }
  if (row.reviewStatus === "approved") return "todo";
  if (row.queue === "waiting") return "waiting";
  if (row.queue === "needs_review") return "needs_review";
  return "todo";
}

export function copilotDisplayTitle(row: PresentableWork, now: Date): string {
  const saved = approved(row);
  const intent = payloadString(row.payload, "intent") ?? "";
  const actor = payloadString(row.payload, "actor") ?? row.waitingActor ?? "";
  const proposedPast = row.proposedAt != null && Number.isFinite(new Date(row.proposedAt).getTime()) && new Date(row.proposedAt).getTime() < now.getTime();

  if (row.actionType === "customer_checkin") {
    return saved ? "Check in if the customer has not replied" : "Approve a check-in if they have not replied";
  }
  if (row.actionType === "contact_later" && saved) return "Check in while they compare options";
  if (saved && meetingLike(row) && /save|suggest|approve|remind/i.test(row.title)) return "Follow up on the meeting";
  if (saved && (row.actionType === "create_reminder" || row.actionType === "update_reminder") && /suggest|save a|approve/i.test(row.title)) {
    return "Follow up as promised";
  }
  if (row.actionType === "quotation_missing") return "Add missing details";
  if (row.actionType === "quotation_choice") return "Choose product";
  if (row.actionType === "listing_shortlist") return row.title === "Choose a listing" ? row.title : "Choose a listing";
  if ((row.actionType === "quotation_draft" || row.actionType === "send_quotation") && !row.title.startsWith("Quotation is")) {
    return "Review quotation draft";
  }
  if (meetingLike(row) && !saved && (row.missing.includes("Time") || !row.proposedAt)) return "Confirm a meeting time";
  if (meetingLike(row) && !saved && proposedPast) return "Choose a new meeting time";
  if (row.actionType === "open_commitment" || VAGUE_TITLES.has(row.title)) {
    if (row.semanticKey.startsWith("review:") || intent === "ask_colleague" || actor === "colleague") {
      return "Follow up on the promised team review";
    }
    if (intent === "check_stock") return "Follow up on the stock check";
    if (intent === "send_measurements") return "Follow up on the measurements";
    if (actor === "customer") return "Review the customer's open promise";
    if (actor === "salesperson") return "Follow up on your promise";
    if (row.title && !VAGUE_TITLES.has(row.title)) return row.title;
    return "Review an undated promise";
  }
  if ((row.actionType === "create_reminder" || row.actionType === "update_reminder") && !saved && VAGUE_TITLES.has(row.title)) {
    return "Approve follow-up reminder";
  }
  if (row.title.trim()) return row.title;
  return "Review this task";
}

function scheduleFor(row: PresentableWork, now: Date): { schedule: TaskSchedule; deadlineAt: string | null } {
  const promised = payloadString(row.payload, "customerPromisedAt");
  const at = row.proposedAt && Number.isFinite(new Date(row.proposedAt).getTime()) ? row.proposedAt : null;
  const saved = row.reviewStatus === "approved" && row.executionStatus === "succeeded" && row.fulfilmentStatus === "open";
  const checkIn = row.actionType === "customer_checkin" || row.actionType === "contact_later";
  const reminder = row.linkedFollowUp || row.actionType === "create_reminder" || row.actionType === "update_reminder" || row.actionType === "appointment";
  const past = at != null && new Date(at).getTime() < now.getTime();

  if (pendingReview(row)) {
    if (!at) {
      return {
        deadlineAt: null,
        schedule: {
          kind: "none",
          label: "No date set",
          at: null,
          overdue: false,
          passedSuggestion: false,
          expectedReplyAt: promised,
        },
      };
    }
    const passedSuggestion = past && (meetingLike(row) || checkIn || reminder);
    return {
      deadlineAt: null,
      schedule: {
        kind: "suggested",
        label: "Suggested time",
        at,
        overdue: false,
        passedSuggestion,
        expectedReplyAt: promised,
      },
    };
  }

  if (saved && checkIn && at) {
    return {
      deadlineAt: at,
      schedule: {
        kind: "check_in",
        label: past ? "Overdue" : "Check-in",
        at,
        overdue: past,
        passedSuggestion: false,
        expectedReplyAt: promised,
      },
    };
  }

  if (saved && reminder && at) {
    return {
      deadlineAt: at,
      schedule: {
        kind: "due",
        label: past ? "Overdue" : "Due",
        at,
        overdue: past,
        passedSuggestion: false,
        expectedReplyAt: promised,
      },
    };
  }

  if (!at) {
    return {
      deadlineAt: null,
      schedule: {
        kind: "none",
        label: "No date set",
        at: null,
        overdue: false,
        passedSuggestion: false,
        expectedReplyAt: promised,
      },
    };
  }

  return {
    deadlineAt: null,
    schedule: {
      kind: "suggested",
      label: "Suggested time",
      at,
      overdue: false,
      passedSuggestion: past,
      expectedReplyAt: promised,
    },
  };
}

function actions(row: PresentableWork, listState: CopilotListState): { actionLabel: string; primaryAction: CopilotPrimaryAction } {
  if (row.executionStatus === "failed") return { actionLabel: "Retry", primaryAction: "retry" };
  const quoteReady = Boolean(
    row.linkedQuotationId &&
      row.executionStatus === "succeeded" &&
      (row.actionType === "quotation_draft" || row.actionType === "send_quotation")
  );
  if (quoteReady) return { actionLabel: "Review draft", primaryAction: "quote" };
  if (row.actionType === "quotation_missing") return { actionLabel: "Add missing details", primaryAction: "missing" };
  if (row.actionType === "quotation_choice" || row.actionType === "listing_shortlist") {
    return {
      actionLabel: row.actionType === "listing_shortlist" ? "Choose a listing" : "Choose product",
      primaryAction: "choose",
    };
  }
  if (row.actionType === "answer_question") return { actionLabel: "Draft reply", primaryAction: "draft" };
  if (listState === "needs_review") {
    return {
      actionLabel: primaryLabel(row.actionType, row.executionStatus, row.missing),
      primaryAction: "review",
    };
  }
  if (listState === "todo" && row.reviewStatus === "approved" && row.fulfilmentStatus === "open") {
    return { actionLabel: "View details", primaryAction: "complete" };
  }
  return { actionLabel: "View details", primaryAction: "details" };
}

export function presentCopilotWork(row: PresentableWork, now = new Date()): CopilotPresentation {
  const listState = copilotListState(row);
  const { schedule, deadlineAt } = scheduleFor(row, now);
  const action = actions(row, listState);
  return {
    title: copilotDisplayTitle(row, now),
    explanation: row.explanation,
    listState,
    schedule,
    deadlineAt,
    actionLabel: action.actionLabel,
    primaryAction: action.primaryAction,
  };
}
