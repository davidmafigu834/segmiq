export type JourneyTriggerType =
  | "quotation_no_response"
  | "dormant_lead"
  | "customer_anniversary"
  | "lost_deal_funds";

export type JourneyStepType =
  | "send_whatsapp"
  | "wait_days"
  | "check_still_eligible"
  | "notify_assignee"
  | "complete";

export type JourneyStep = {
  type: JourneyStepType;
  config?: Record<string, unknown>;
};

export type JourneyStats = {
  enrolled: number;
  completed: number;
  cancelled: number;
  messages_sent: number;
};

export type JourneyRow = {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  template_key: string;
  trigger_type: JourneyTriggerType;
  trigger_config: Record<string, unknown>;
  steps: JourneyStep[];
  template_name: string | null;
  template_language: string;
  template_variables: Record<string, string>;
  is_active: boolean;
  is_predefined: boolean;
  stats: JourneyStats;
  created_at: string;
  updated_at: string;
};

export type EnrollmentRow = {
  id: string;
  journey_id: string;
  client_id: string;
  contact_id: string | null;
  lead_id: string | null;
  phone: string;
  status: string;
  current_step_index: number;
  next_run_at: string | null;
  enrolled_at: string;
  completed_at: string | null;
  context: Record<string, unknown>;
  last_error: string | null;
};

export const EMPTY_JOURNEY_STATS: JourneyStats = {
  enrolled: 0,
  completed: 0,
  cancelled: 0,
  messages_sent: 0,
};
