import type { LeadStatus } from "@/types";

export type CalendarEventKind =
  | "FOLLOW_UP"
  | "CALL"
  | "QUOTE_REVIEW"
  | "SITE_VISIT"
  | "INSTALLATION_MEETING"
  | "PERSONAL";

/** Event kinds backed by real SegmiQ data today. */
export const SUPPORTED_EVENT_KINDS: CalendarEventKind[] = [
  "FOLLOW_UP",
  "CALL",
  "QUOTE_REVIEW",
];

export type CalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  title: string;
  startAt: string;
  endAt?: string | null;
  leadId: string;
  dealId?: string | null;
  customerName: string | null;
  phone: string | null;
  location: string | null;
  pipelineStage: string | null;
  status: LeadStatus | string | null;
  source: string | null;
  notes: string | null;
  quoteNumber: string | null;
  quoteStatus: string | null;
  quoteTotal: number | null;
  projectType: string | null;
  leadScore: number | null;
  overdue: boolean;
  hasTimedCallback: boolean;
};

export type CalendarViewMode = "month" | "week" | "agenda";

export type CalendarLeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  location: string | null;
  follow_up_date: string | null;
  status: string | null;
  source: string | null;
  project_type?: string | null;
  form_data?: Record<string, unknown> | null;
  score?: number | null;
  latestQuoteNumber?: string | null;
  latestQuoteStatus?: string | null;
  latestQuoteTotal?: number | null;
};

export type CalendarDealOption = {
  id: string;
  name: string;
  originatingLeadId: string;
  phone: string | null;
  nextActionAt: string | null;
  nextActionLabel: string | null;
  stage: string | null;
};
