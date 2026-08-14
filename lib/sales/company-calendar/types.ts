import type { PriorityLead } from "@/lib/sales-priority-lead";

export type CompanyCalendarView = "day" | "week" | "month" | "agenda";

export type CompanyCalendarEventKind =
  | "whatsapp"
  | "call"
  | "follow_up"
  | "quote_review"
  | "deal_action"
  | "site_visit";

export type CompanyCalendarEventSource = "lead_follow_up" | "deal_next_action" | "viewing";
export type CompanyCalendarRelationType = "lead" | "deal" | "customer";
export type CompanyCalendarEventStatus =
  | "scheduled"
  | "overdue"
  | "completed"
  | "cancelled";

export type CompanyCalendarEvent = {
  id: string;
  sourceType: CompanyCalendarEventSource;
  sourceId: string;
  kind: CompanyCalendarEventKind;
  title: string;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  status: CompanyCalendarEventStatus;
  sourceStatus: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  ownerRoleLabel: string | null;
  relationType: CompanyCalendarRelationType;
  relatedId: string;
  relatedLabel: string;
  relatedSecondary: string | null;
  relatedHref: string;
  leadId: string | null;
  dealId: string | null;
  customerId: string | null;
  phone: string | null;
  location: string | null;
  description: string | null;
  attentionReason: string | null;
  canEdit: boolean;
  canComplete: boolean;
};

export type CompanyCalendarOwnerOption = {
  id: string;
  name: string;
  avatarUrl: string | null;
  roleLabel: string;
};

export type CompanyCalendarLeadOwner = {
  id: string | null;
  name: string | null;
  avatarUrl: string | null;
  roleLabel: string | null;
};

export type CompanyCalendarExecutionMetrics = {
  upcomingActivities: number;
  overdueFollowUps: number;
  todayActivities: number;
  completedWeek: number;
  atRiskActivities: number;
  responseTimeMinutes: number | null;
  responseTimeMinutesPrevious: number | null;
};

export type CompanyCalendarExecutionSummary = {
  all: CompanyCalendarExecutionMetrics;
  byOwner: Record<string, CompanyCalendarExecutionMetrics>;
  definition: {
    upcoming: string;
    overdue: string;
    today: string;
    completed: string;
    response: string;
    atRisk: string;
  };
};

export type CompanyCalendarPageData = {
  clientId: string;
  clientName: string;
  timezone: string;
  rangeStartKey: string;
  rangeEndKey: string;
  events: CompanyCalendarEvent[];
  owners: CompanyCalendarOwnerOption[];
  scheduleableLeads: PriorityLead[];
  leadOwners: Record<string, CompanyCalendarLeadOwner>;
  summary: CompanyCalendarExecutionSummary;
};

export type CompanyCalendarFilters = {
  ownerId: string;
  kinds: CompanyCalendarEventKind[];
  includeCompleted: boolean;
  status: "all" | CompanyCalendarEventStatus | "at_risk";
  relationType: "all" | CompanyCalendarRelationType;
};

export const COMPANY_CALENDAR_EVENT_KINDS: CompanyCalendarEventKind[] = [
  "whatsapp",
  "call",
  "follow_up",
  "quote_review",
  "deal_action",
  "site_visit",
];

export const DEFAULT_COMPANY_CALENDAR_FILTERS: CompanyCalendarFilters = {
  ownerId: "all",
  kinds: [...COMPANY_CALENDAR_EVENT_KINDS],
  includeCompleted: true,
  status: "all",
  relationType: "all",
};
