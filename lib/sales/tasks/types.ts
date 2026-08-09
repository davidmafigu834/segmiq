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
  dueAt: string;
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
};

export type SalesTasksPayload = {
  meta: {
    view: SalesTaskView;
    generatedAt: string;
    currentUserId: string;
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
