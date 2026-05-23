export type UserRole = "AGENCY_ADMIN" | "CLIENT_MANAGER" | "SALESPERSON";

export type LeadSource = "LANDING_PAGE" | "FACEBOOK" | "MANUAL" | "REFERRAL";

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "NEGOTIATING"
  | "PROPOSAL_SENT"
  | "WON"
  | "LOST"
  | "NOT_QUALIFIED";

export type CallOutcome =
  | "ANSWERED"
  | "NO_ANSWER"
  | "FOLLOW_UP"
  | "WON"
  | "LOST"
  | "NOT_QUALIFIED";

export type NotificationType =
  | "NEW_LEAD"
  | "FOLLOW_UP_DUE"
  | "DEAL_WON"
  | "LEAD_FLAG"
  | "UNCONTACTED_MANAGER_ALERT";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  client_id: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ClientRow {
  id: string;
  name: string;
  industry: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  response_time_limit_hours: number;
  round_robin_index: number;
  twilio_whatsapp_override: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  fb_access_token: string | null;
  fb_access_token_expires_at: string | null;
  fb_page_id: string | null;
  fb_page_name: string | null;
  fb_form_id: string | null;
  fb_form_name: string | null;
  fb_connected_by_user_id: string | null;
  fb_connected_at: string | null;
  fb_webhook_verified: boolean | null;
  fb_token_expired_at: string | null;
  last_lead_received_at: string | null;
}

export interface LeadRow {
  id: string;
  client_id: string;
  assigned_to_id: string | null;
  source: LeadSource;
  status: LeadStatus;
  form_data: Record<string, unknown>;
  name: string | null;
  phone: string | null;
  email: string | null;
  budget: string | null;
  project_type: string | null;
  timeline: string | null;
  magic_token: string | null;
  magic_token_expires_at: string | null;
  not_qualified_reason: string | null;
  lost_reason: string | null;
  deal_value: number | null;
  follow_up_date: string | null;
  facebook_lead_id: string | null;
  created_at: string;
  updated_at: string;
  score: number | null;
  score_updated_at: string | null;
  score_breakdown: Record<string, number> | null;
  is_stale: boolean | null;
  stale_since: string | null;
}

export interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  conditionalLogic?: {
    action: "show" | "hide" | "block";
    fieldId: string;
    operator: "equals" | "not_equals";
    value: string;
    blockMessage?: string;
  };
}

export interface FormSchemaRow {
  id: string;
  client_id: string;
  fields: FormField[];
  thank_you_message: string | null;
  form_title: string | null;
  submit_button_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  lead_id: string | null;
  created_at: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  clientId: string | null;
}
