export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "NEGOTIATING"
  | "PROPOSAL_SENT"
  | "WON"
  | "LOST"
  | "NOT_QUALIFIED";

export const MANUAL_LEAD_STAGES: {
  value: LeadStatus;
  label: string;
  hint: string;
}[] = [
  { value: "NEW", label: "New", hint: "Fresh in the pipeline" },
  { value: "CONTACTED", label: "Contacted", hint: "You've already spoken" },
  { value: "NEGOTIATING", label: "Negotiating", hint: "Discussing terms or price" },
  { value: "PROPOSAL_SENT", label: "Proposal sent", hint: "Quote is out" },
  { value: "WON", label: "Won", hint: "Closed deal — also files as customer" },
  { value: "LOST", label: "Lost", hint: "Didn't convert" },
  { value: "NOT_QUALIFIED", label: "Not qualified", hint: "Not a fit" },
];

export type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email?: string | null;
  status: LeadStatus | string;
  score?: number | null;
  score_breakdown?: Record<string, number> | null;
  is_stale?: boolean | null;
  stale_since?: string | null;
  budget?: string | null;
  project_type?: string | null;
  timeline?: string | null;
  form_data?: Record<string, unknown> | null;
  created_at: string;
  follow_up_date: string | null;
  client_id: string;
  source?: string | null;
  updated_at?: string;
  magic_token?: string | null;
  manual_priority?: "hot" | "warm" | "cold" | null;
  deal_value?: number | null;
  lost_reason?: string | null;
  not_qualified_reason?: string | null;
  clients?: {
    name?: string | null;
    industry?: string | null;
    response_time_limit_hours?: number | null;
  } | null;
  qualifiers?: CampaignQualifiers | null;
  aiScore?: number | null;
  followUpDue?: boolean;
};

export type CampaignQualifiers = {
  budget_min?: number | null;
  budget_max?: number | null;
  target_service_types?: string[] | null;
  target_locations?: string[] | null;
  min_urgency?: string | null;
};

export type SalesMirror = {
  mode: "rules" | "stall" | "ai";
  line: string;
  dominantReason?: string;
};

export type DashboardData = {
  assignmentMode?: "direct" | "pool" | "round_robin";
  allActiveLeads: LeadRow[];
  mirror?: SalesMirror;
  numbers: {
    totalActive: number;
    callNow: number;
    calledToday: number;
    followUpToday: number;
    slipped: number;
    convertLaterCount?: number;
    wonThisMonth: number;
  };
};

export type TimelineEvent = {
  id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  actor_name?: string | null;
  actor_role?: string | null;
  channel?: string | null;
  created_at: string;
  _source?: string;
};

export type {
  ReachOutcome,
  CallResult,
  AssetRequestKey,
  CallbackScheduleOption,
} from "./call-log-constants";

export type LogCallPayload = {
  reachOutcome: import("./call-log-constants").ReachOutcome;
  result?: import("./call-log-constants").CallResult | null;
  reason?: string | null;
  callbackAt?: string | null;
  assetsRequested?: import("./call-log-constants").AssetRequestKey[] | null;
  notes?: string;
  channel?: "call" | "whatsapp";
  isConvertLaterPick?: boolean;
  convertLaterNote?: string | null;
};
