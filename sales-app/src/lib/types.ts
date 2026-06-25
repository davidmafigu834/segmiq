export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "NEGOTIATING"
  | "PROPOSAL_SENT"
  | "WON"
  | "LOST"
  | "NOT_QUALIFIED";

export type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email?: string | null;
  status: LeadStatus | string;
  score?: number | null;
  is_stale?: boolean | null;
  budget?: string | null;
  project_type?: string | null;
  timeline?: string | null;
  form_data?: Record<string, unknown> | null;
  created_at: string;
  follow_up_date: string | null;
  client_id: string;
  source?: string | null;
  updated_at?: string;
  clients?: {
    name?: string | null;
    industry?: string | null;
    response_time_limit_hours?: number | null;
  } | null;
  aiScore?: number | null;
  followUpDue?: boolean;
};

export type DashboardData = {
  assignmentMode?: "direct" | "pool" | "round_robin";
  allActiveLeads: LeadRow[];
  numbers: {
    totalActive: number;
    callNow: number;
    calledToday: number;
    followUpToday: number;
    slipped: number;
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

export type ReachOutcome = "reached" | "no_answer" | "call_back";
export type CallResult = "won" | "follow_up" | "lost" | "not_qualified";

export type LogCallPayload = {
  reachOutcome: ReachOutcome;
  result?: CallResult | null;
  reason?: string | null;
  callbackAt?: string | null;
  notes?: string;
  channel?: "call" | "whatsapp";
};
