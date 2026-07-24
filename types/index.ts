export type UserRole = "AGENCY_ADMIN" | "CLIENT_MANAGER" | "SALESPERSON";

export type ClientMode = "team" | "solo";

export type LeadSource = "LANDING_PAGE" | "FACEBOOK" | "MANUAL" | "REFERRAL" | "WHATSAPP_INBOUND";

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "NEGOTIATING"
  | "PROPOSAL_SENT"
  | "WON"
  | "LOST"
  | "NOT_QUALIFIED";

export type DealValueSource = "manual" | "proposal";

export type CallOutcome =
  | "ANSWERED"
  | "NO_ANSWER"
  | "FOLLOW_UP"
  | "WON"
  | "LOST"
  | "NOT_QUALIFIED";

export type NotificationType =
  | "NEW_LEAD"
  | "WHATSAPP_MESSAGE"
  | "FOLLOW_UP_DUE"
  | "FOLLOW_UP_PREP"
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
  /** When true on CLIENT_MANAGER, user can work leads like a salesperson. */
  also_sells: boolean;
  created_at: string;
}

export type ClientSetupStatus = "pending" | "active";

export interface ClientRow {
  id: string;
  name: string;
  industry: string;
  slug: string;
  mode: ClientMode;
  setup_status?: ClientSetupStatus;
  owner_email?: string | null;
  country?: string | null;
  website?: string | null;
  logo_url: string | null;
  primary_color: string | null;
  response_time_limit_hours: number;
  round_robin_index: number;
  assignment_mode: "direct" | "pool" | "round_robin";
  meta_whatsapp_phone_number_id: string | null;
  meta_whatsapp_display_number: string | null;
  meta_whatsapp_access_token: string | null;
  twilio_whatsapp_override: string | null;
  dial_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  fb_access_token: string | null;
  fb_access_token_expires_at: string | null;
  fb_page_id: string | null;
  fb_page_name: string | null;
  fb_form_id: string | null;
  fb_form_name: string | null;
  fb_form_questions?: unknown | null;
  fb_qualification_enabled?: boolean;
  fb_qualification_rules?: unknown | null;
  fb_connected_by_user_id: string | null;
  fb_connected_at: string | null;
  fb_webhook_verified: boolean | null;
  fb_token_expired_at: string | null;
  last_lead_received_at: string | null;
}

export type ContactLifecycle = "cold" | "aware" | "pipeline" | "customer";

export interface ContactRow {
  id: string;
  client_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  source: string | null;
  lead_origin: "segmiq" | "client";
  lifecycle: ContactLifecycle;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface LeadRow {
  id: string;
  client_id: string;
  assigned_to_id: string | null;
  contact_id: string | null;
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
  /** manual = rep estimate; proposal = from sent/accepted quotation (locked). */
  deal_value_source?: DealValueSource | null;
  /** Set at quote/proposal stage for revenue forecast bucketing. */
  expected_close_date?: string | null;
  follow_up_date: string | null;
  facebook_lead_id: string | null;
  created_at: string;
  updated_at: string;
  score: number | null;
  score_updated_at: string | null;
  score_breakdown: Record<string, number> | null;
  is_stale: boolean | null;
  stale_since: string | null;
  is_convert_later_pick: boolean | null;
  convert_later_note: string | null;
  manual_priority: "hot" | "warm" | "cold" | null;
}

export interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  role?: "location" | "urgency";
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

export type InstantFormStatus = "draft" | "published";
export type InstantFormType = "more_volume" | "higher_intent";
export type InstantFormQuestionKind = "contact" | "custom";
export type InstantFormContactFieldType =
  | "full_name"
  | "email"
  | "phone"
  | "street_address"
  | "city"
  | "state"
  | "country"
  | "zip"
  | "company"
  | "job_title";
export type InstantFormCustomFieldType = "short_answer" | "multiple_choice";
export type InstantFormCtaType = "view_website" | "call" | "download" | "none";

export interface InstantFormConditionalLogic {
  question_id: string;
  operator: "equals" | "not_equals";
  value: string;
}

export interface InstantFormQuestion {
  id: string;
  kind: InstantFormQuestionKind;
  field_type: InstantFormContactFieldType | InstantFormCustomFieldType;
  label: string;
  placeholder?: string;
  options?: string[];
  is_required: boolean;
  maps_to?: string;
  conditional_logic?: InstantFormConditionalLogic;
  sort_order: number;
}

export interface InstantFormConsent {
  id: string;
  label: string;
  is_required: boolean;
}

export interface InstantFormIntro {
  headline?: string;
  body?: string;
  layout?: "paragraph" | "list";
  image_url?: string;
  button_text?: string;
}

export interface InstantFormPrivacy {
  policy_url?: string;
  link_text?: string;
  disclaimer?: string;
}

export interface InstantFormCompletion {
  headline?: string;
  body?: string;
  cta_type?: InstantFormCtaType;
  cta_text?: string;
  cta_link?: string;
}

export interface InstantFormRow {
  id: string;
  client_id: string;
  name: string;
  slug: string;
  status: InstantFormStatus;
  form_type: InstantFormType;
  intro: InstantFormIntro;
  questions: InstantFormQuestion[];
  consents: InstantFormConsent[];
  privacy: InstantFormPrivacy;
  completion: InstantFormCompletion;
  submission_count: number;
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

export type QuotationStatus = "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";

export interface CatalogItemRow {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  unit_price: number;
  category: string | null;
  currency: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/** Personal reusable quote items saved by a salesperson (or manager). */
export interface SavedItemRow {
  id: string;
  client_id: string;
  user_id: string;
  name: string;
  description: string | null;
  unit_price: number;
  category: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuotationSettingsRow {
  client_id: string;
  company_address: string | null;
  company_email: string | null;
  company_website: string | null;
  company_phone: string | null;
  default_terms: string | null;
  footer_note: string | null;
  quote_prefix: string;
  next_number: number;
  default_tax_rate: number;
  created_at: string;
  updated_at: string;
}

export interface QuotationLineItemRow {
  id: string;
  quotation_id: string;
  catalog_item_id: string | null;
  item_name: string;
  description: string | null;
  unit_price: number;
  quantity: number;
  amount: number;
  group_label: string | null;
  sort_order: number;
  created_at: string;
}

export interface QuotationRow {
  id: string;
  client_id: string;
  lead_id: string;
  quote_number: string | null;
  status: QuotationStatus;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  other_amount: number;
  total: number;
  currency: string;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  prepared_by_id: string | null;
  prepared_by_name: string | null;
  pdf_url: string | null;
  pdf_key: string | null;
  public_token: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  parent_quotation_id: string | null;
  revision_number: number;
  superseded_by_id: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteTemplateLineItemRow {
  id: string;
  template_id: string;
  catalog_item_id: string | null;
  item_name: string;
  description: string | null;
  unit_price: number;
  quantity: number;
  group_label: string | null;
  sort_order: number;
  created_at: string;
}

export interface QuoteTemplateRow {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  tax_rate: number;
  other_amount: number;
  notes: string | null;
  terms: string | null;
  valid_for_days: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  items?: QuoteTemplateLineItemRow[];
}

/** A line item as sent from / to the quote builder UI. */
export interface QuotationLineItemInput {
  catalog_item_id?: string | null;
  item_name: string;
  description?: string | null;
  unit_price: number;
  quantity: number;
  group_label?: string | null;
}

// ---------------------------------------------------------------------------
// Agency sales proposals (Segmiq -> prospect companies). Distinct from
// tenant-level quotations above. See supabase/migrations/053_agency_proposals.
// ---------------------------------------------------------------------------

export type ProposalStatus = "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";
export type ProposalSectionKind =
  | "cover"
  | "scope"
  | "approach"
  | "timeline"
  | "terms"
  | "investment"
  | "custom";

export interface ProposalSettingsRow {
  id: string;
  company_name: string | null;
  company_address: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_website: string | null;
  logo_url: string | null;
  brand_color: string;
  default_terms: string | null;
  footer_note: string | null;
  proposal_prefix: string;
  next_number: number;
  default_tax_rate: number;
  default_validity_days: number;
  created_at: string;
  updated_at: string;
}

export interface ProposalSectionRow {
  id: string;
  proposal_id: string;
  kind: ProposalSectionKind;
  heading: string | null;
  body: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProposalLineItemRow {
  id: string;
  proposal_id: string;
  item_name: string;
  description: string | null;
  unit_price: number;
  quantity: number;
  amount: number;
  group_label: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProposalRow {
  id: string;
  proposal_number: string | null;
  submission_id: string | null;
  client_id: string | null;
  company_name: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  title: string;
  status: ProposalStatus;
  public_token: string | null;
  proposed_mode: "team" | "solo";
  proposed_plan: "starter" | "professional" | "business";
  billing_cycle: "monthly" | "annual";
  currency: string;
  subtotal: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  prepared_by_id: string | null;
  prepared_by_name: string | null;
  pdf_url: string | null;
  pdf_key: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalSectionInput {
  kind?: ProposalSectionKind;
  heading?: string | null;
  body?: string | null;
}

export interface ProposalLineItemInput {
  item_name: string;
  description?: string | null;
  unit_price: number;
  quantity: number;
  group_label?: string | null;
}

export type ProposalWithDetails = ProposalRow & {
  sections?: ProposalSectionRow[];
  items?: ProposalLineItemRow[];
};

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  clientId: string | null;
}
