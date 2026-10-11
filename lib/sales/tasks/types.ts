export type SalesTaskView = "mine" | "assigned" | "created" | "all";

export type SalesTaskStatusFilter =
  | "all"
  | "pending"
  | "overdue"
  | "completed";

export type SalesTaskDueFilter =
  | "all"
  | "overdue"
  | "today"
  | "tomorrow"
  | "this_week"
  | "next_7"
  | "this_month";

export type SalesTaskPriority = "high" | "medium" | "low";

export type SalesTaskType = "follow_up" | "call" | "quote_review" | "whatsapp";

export type SalesTaskQuickFilter =
  | "high_priority"
  | "overdue"
  | "due_today"
  | "follow_ups"
  | "calls"
  | "quote_reviews";

export type SalesTaskStatusDisplay = "pending" | "overdue" | "completed";

export type TaskScheduleKind = "due" | "suggested" | "expected_reply" | "check_in" | "none";

export type TaskSchedule = {
  kind: TaskScheduleKind;
  label: "Due" | "Overdue" | "Suggested time" | "Expected reply" | "Check-in" | "No date set";
  at: string | null;
  overdue: boolean;
  passedSuggestion: boolean;
  expectedReplyAt: string | null;
};

export type SalesTaskItem = {
  id: string;
  leadId: string;
  title: string;
  type: SalesTaskType;
  typeLabel: string;
  relatedName: string;
  relatedSecondary: string | null;
  phone: string | null;
  source: string | null;
  /** Real deadline when one exists. Suggestions and undated work leave this null. */
  dueAt: string | null;
  deadlineAt: string | null;
  schedule: TaskSchedule;
  priority: SalesTaskPriority;
  status: SalesTaskStatusDisplay;
  completed: boolean;
  completedAt: string | null;
  createdById: string | null;
  createdByName: string | null;
  assignedToId: string;
  isWhatsAppCapable: boolean;
  leadHref: string;
  whatsappHref: string | null;
  score: number | null;
  notes: string | null;
  copilot?: {
    workItemId: string;
    queue: "needs_review" | "todo" | "waiting";
    actionType: string;
    explanation: string;
    reviewStatus: string;
    executionStatus: string;
    fulfilmentStatus: string;
    listState: "needs_review" | "todo" | "waiting";
    waitingActor: string | null;
    hourSuggested: boolean;
    currentDueAt: string | null;
    proposedAt: string | null;
    linkedQuotationId: string | null;
    linkedFollowUp: boolean;
    missing: string[];
    evidenceMessageIds: string[];
    evidence: Array<{ id: string; at: string; speaker: string; text: string }>;
    payload: Record<string, unknown>;
    executionError: string | null;
    primaryLabel: string;
    actionLabel: string;
    primaryAction: "review" | "quote" | "draft" | "retry" | "complete" | "details" | "choose" | "missing";
  } | null;
};

export type SalesTasksPayload = {
  meta: {
    view: SalesTaskView;
    generatedAt: string;
    currentUserId: string;
    timezone: string;
    copilotUnavailable: boolean;
  };
  counts: {
    mine: number;
    assigned: number;
    created: number;
    all: number;
  };
  kpis: {
    dueToday: number;
    dueTodayHighPriority: number;
    thisWeek: number;
    thisWeekOverdue: number;
    completedThisWeek: number;
    completedPrevWeek: number;
    overdue: number;
  };
  overview: {
    pending: number;
    overdue: number;
    completedThisWeek: number;
    total: number;
  };
  tasks: SalesTaskItem[];
  upcoming: SalesTaskItem[];
  tip: {
    kind: "high_priority_today" | "overdue" | "on_track";
    title: string;
    body: string;
  };
  assignableLeads: Array<{
    id: string;
    name: string;
    phone: string | null;
    source: string | null;
    status: string | null;
    followUpDate: string | null;
  }>;
  capabilities: {
    hasStandaloneTasks: false;
    hasTaskPriorities: false;
    hasTaskStatuses: false;
    hasTaskAssignees: false;
    hasCreatedBy: true;
    completionClearsFollowUp: true;
    notes: string;
  };
};
