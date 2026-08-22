export type UserRole = "SUPER_ADMIN" | "CLIENT_MANAGER" | "SALESPERSON";

export type ClientMode = "team" | "solo";

export type LeadSource =
  | "LANDING_PAGE"
  | "FACEBOOK"
  | "MANUAL"
  | "REFERRAL"
  | "WHATSAPP_INBOUND"
  | "WEBSITE"
  | "FACEBOOK_AD";

export type BusinessType = "trades" | "real_estate";

export type ListingTransactionType = "sale" | "rental" | "new_development";
export type ListingStatus = "available" | "under_offer" | "reserved" | "sold" | "let";
export type MandateType = "sole" | "joint" | "open";
export type DealSide = "buy_side" | "sell_side" | "landlord_side" | "tenant_side";
export type OfferStatus = "submitted" | "countered" | "accepted" | "rejected";
export type ViewingStatus = "scheduled" | "completed" | "cancelled" | "no_show";
export type FeedbackSentiment = "positive" | "neutral" | "negative";

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "CONVERTED_TO_DEAL"
  | "NOT_QUALIFIED"
  /** @deprecated Legacy commercial statuses — migrated to deals; retained for history/compat */
  | "NEGOTIATING"
  | "PROPOSAL_SENT"
  | "WON"
  | "LOST";

/** Lead acquisition/qualification lifecycle (excludes legacy commercial statuses). */
export type LeadLifecycleStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "CONVERTED_TO_DEAL"
  | "NOT_QUALIFIED";

export type DealStage =
  | "QUALIFIED"
  | "SCOPING"
  | "PROPOSAL_SENT"
  | "NEGOTIATING"
  | "WON"
  | "LOST";

export type DealValueStatus = "KNOWN" | "RANGE" | "PENDING_ESTIMATE";

export type DealValueBasis =
  | "CUSTOMER_BUDGET"
  | "SALES_ESTIMATE"
  | "LATEST_QUOTE"
  | "WON_VALUE";

export type DecisionMakerStatus = "YES" | "NO" | "UNKNOWN";

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
  | "WHATSAPP_CONNECTION_ALERT"
  | "FOLLOW_UP_DUE"
  | "FOLLOW_UP_PREP"
  | "DEAL_WON"
  | "LEAD_FLAG"
  | "UNCONTACTED_MANAGER_ALERT"
  | "QUOTATION_ALERT";

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
  business_type: BusinessType;
  website_integration_api_key?: string | null;
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
  /** When true, Segmiq is the client's managed marketing partner. */
  agency_managed?: boolean;
  agency_managed_changed_at?: string | null;
  agency_managed_changed_by?: string | null;
  /** Super Admin enrolment for WhatsApp Sales Hub QR (temporary web) connection. */
  whatsapp_temporary_web_enabled?: boolean;
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
  /** Canonical Customer relationship fields (nullable for legacy/unclassified contacts). */
  customer_type?: "company" | "individual" | null;
  primary_contact_name?: string | null;
  industry?: string | null;
  relationship_owner_id?: string | null;
  notes: string | null;
  tags: string[];
  /** Trade-show / exhibition name when captured via Event Capture (nullable). */
  event_name?: string | null;
  /** Real-estate buyer prefs (nullable; unused for trades). */
  buyer_budget_min?: number | null;
  buyer_budget_max?: number | null;
  buyer_bedrooms_wanted?: number | null;
  buyer_area_preference?: string | null;
  buyer_timeline?: string | null;
  /** Append-only list of listing UUIDs this contact has shown interest in. */
  interested_listing_ids?: string[];
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
  qualified_at?: string | null;
  converted_at?: string | null;
  customer_need?: string | null;
  decision_maker_status?: DecisionMakerStatus | null;
  buying_timeframe?: string | null;
  active_deal_id?: string | null;
  /** Real-estate deal fields (nullable; unused for trades). */
  deal_side?: DealSide | null;
  linked_listing_id?: string | null;
  offer_amount?: number | null;
  offer_status?: OfferStatus | null;
  listing_agent_commission_pct?: number | null;
  selling_agent_commission_pct?: number | null;
}

export interface DealRow {
  id: string;
  client_id: string;
  contact_id: string | null;
  originating_lead_id: string;
  owner_id: string | null;
  name: string;
  service_summary: string | null;
  stage: DealStage;
  value_status: DealValueStatus;
  value_basis: DealValueBasis | null;
  estimated_value: number | null;
  estimated_value_min: number | null;
  estimated_value_max: number | null;
  customer_budget: number | null;
  sales_estimate: number | null;
  expected_decision_at: string | null;
  location: string | null;
  buying_timeframe: string | null;
  decision_maker_status: DecisionMakerStatus | null;
  decision_maker_name: string | null;
  next_action_at: string | null;
  next_action_label: string | null;
  won_value: number | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  last_meaningful_activity_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DevelopmentRow {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  total_units: number | null;
  completion_date: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListingRow {
  id: string;
  client_id: string;
  agent_id: string | null;
  development_id: string | null;
  transaction_type: ListingTransactionType;
  status: ListingStatus;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  address: string | null;
  suburb: string | null;
  description: string | null;
  photos: string[];
  mandate_type: MandateType | null;
  mandate_expiry_date: string | null;
  lease_term_months: number | null;
  external_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface ViewingRow {
  id: string;
  contact_id: string;
  listing_id: string;
  agent_id: string | null;
  scheduled_at: string;
  status: ViewingStatus;
  feedback_text: string | null;
  feedback_sentiment: FeedbackSentiment | null;
  created_at: string;
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

export type QuotationStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired"
  | "superseded";

export type QuotationApprovalStatus =
  | "not_required"
  | "required"
  | "pending"
  | "approved"
  | "changes_requested"
  | "rejected";

export type MarginVisibility = "none" | "health" | "percent" | "full";
export type PriceEditPolicy =
  | "standard_only"
  | "discount_allowed"
  | "price_override"
  | "manager_controlled";
export type MarginHealthState = "healthy" | "near_minimum" | "below_policy" | "unknown";

export type DiscountAuthorityRule = {
  role: string;
  max_percent: number | null;
};

export type QuotationOfferOption = {
  id: string;
  label: string;
  description?: string | null;
  is_recommended?: boolean;
};

export type QuotationCustomerConfiguration = {
  selected_optional_keys?: string[];
  declined_optional_keys?: string[];
  selected_offer_option_id?: string | null;
  selected_total?: number | null;
};

export type ApprovalTriggerType =
  | "discount"
  | "margin"
  | "quotation_value"
  | "payment_terms"
  | "price_override"
  | "special_product"
  | "custom_item";

export interface QuotationApprovalPolicyRow {
  id: string;
  client_id: string;
  name: string;
  is_active: boolean;
  trigger_type: ApprovalTriggerType | string;
  operator: string;
  threshold_numeric: number | null;
  threshold_text: string | null;
  approver_role: string | null;
  approver_user_id: string | null;
  sequence_group: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface QuotationPackageRow {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  pricing_model: "component_total" | "fixed" | "discounted_bundle" | string;
  flexibility: "locked" | "flexible" | "quantity_adjustable" | string;
  fixed_price: number | null;
  discount_percent: number;
  currency: string;
  notes: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface QuotationPackageComponentRow {
  id: string;
  package_id: string;
  catalog_item_id: string | null;
  item_name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  cost_price: number | null;
  sku: string | null;
  is_optional: boolean;
  sort_order: number;
}

export type QuotationSectionDef = {
  id: string;
  title: string;
  sort_order: number;
  collapsed?: boolean;
};

export type QuotationNoteBlock = {
  id: string;
  title: string;
  body: string;
  sort_order: number;
  section_id?: string | null;
};

export type QuotationPaymentScheduleRow = {
  id: string;
  label: string;
  percent: number | null;
  amount: number | null;
  trigger: string | null;
  sort_order: number;
};

export type QuotationTimelineMilestone = {
  id: string;
  title: string;
  due_date: string | null;
  sort_order: number;
  payment_percent?: number | null;
  notes?: string | null;
};

export type QuotationEventType =
  | "CREATED"
  | "EDITED"
  | "APPROVAL_REQUESTED"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "SENT"
  | "VIEWED"
  | "CUSTOMER_RESPONDED"
  | "REVISION_CREATED"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "SUPERSEDED"
  | "PDF_DOWNLOADED"
  | "FOLLOW_UP_SCHEDULED"
  | "DUPLICATED"
  | "CANCELLED"
  | "APPROVAL_INVALIDATED"
  | "RESUBMITTED"
  | "REJECTED"
  | "PRICE_OVERRIDE"
  | "CUSTOMER_SELECTED_OPTION"
  | "CUSTOMER_REQUESTED_CHANGES"
  | "CUSTOMER_ASKED_QUESTION"
  | "MATERIAL_CHANGE"
  | "LINK_REVOKED";

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
  sku?: string | null;
  unit?: string | null;
  cost_price?: number | null;
  min_selling_price?: number | null;
  tax_rate?: number | null;
  image_url?: string | null;
  warranty?: string | null;
  item_kind?: "product" | "service" | string;
  requires_approval?: boolean;
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
  default_currency?: string;
  default_validity_days?: number;
  default_payment_terms?: string | null;
  max_discount_percent?: number;
  min_margin_percent?: number | null;
  approval_value_threshold?: number | null;
  require_approval_above_discount?: boolean;
  supported_currencies?: string[];
  salesperson_can_see_margin?: boolean;
  salesperson_can_see_cost?: boolean;
  price_edit_policy?: PriceEditPolicy;
  margin_warning_percent?: number | null;
  margin_visibility?: MarginVisibility;
  discount_authority?: DiscountAuthorityRule[];
  allow_quotation_discount?: boolean;
  salesperson_can_create_custom_item?: boolean;
  salesperson_can_create_package?: boolean;
  require_approval_for_custom_items?: boolean;
  customer_allow_accept?: boolean;
  customer_allow_request_changes?: boolean;
  customer_allow_ask_question?: boolean;
  customer_allow_decline?: boolean;
  customer_allow_option_selection?: boolean;
  require_acceptance_name?: boolean;
  require_acceptance_checkbox?: boolean;
  secure_link_ttl_days?: number | null;
  brand_footer?: string | null;
  bank_details?: string | null;
  tax_registration?: string | null;
  legal_registration?: string | null;
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
  section_id?: string | null;
  unit?: string;
  sku?: string | null;
  discount_percent?: number;
  discount_amount?: number;
  tax_rate?: number | null;
  tax_inclusive?: boolean;
  is_optional?: boolean;
  option_group?: string | null;
  cost_price?: number | null;
  image_url?: string | null;
  catalog_unit_price?: number | null;
  price_override?: boolean;
  package_id?: string | null;
  package_locked?: boolean;
  offer_option_id?: string | null;
  option_state?: "available" | "selected" | "declined" | string;
}

export interface QuotationRow {
  id: string;
  client_id: string;
  lead_id: string;
  deal_id?: string | null;
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
  payment_terms_label?: string | null;
  payment_schedule?: QuotationPaymentScheduleRow[];
  delivery_terms?: string | null;
  warranty_terms?: string | null;
  commercial_notes?: string | null;
  customer_obligations?: string | null;
  sections?: QuotationSectionDef[];
  note_blocks?: QuotationNoteBlock[];
  timeline_milestones?: QuotationTimelineMilestone[];
  discount_percent?: number;
  approval_status?: QuotationApprovalStatus;
  approval_required_reasons?: string[];
  approval_note?: string | null;
  approval_requested_at?: string | null;
  approval_requested_by_id?: string | null;
  approved_at?: string | null;
  approved_by_id?: string | null;
  revision_note?: string | null;
  declined_reason?: string | null;
  commercial_fingerprint?: string | null;
  approval_snapshot?: Record<string, unknown> | null;
  terms_snapshot?: string | null;
  view_count?: number;
  last_viewed_at?: string | null;
  customer_response_type?: string | null;
  customer_response_category?: string | null;
  customer_response_message?: string | null;
  accepted_total?: number | null;
  accepted_snapshot?: Record<string, unknown> | null;
  customer_configuration?: QuotationCustomerConfiguration;
  link_revoked_at?: string | null;
  template_id?: string | null;
  template_layout_key?: string | null;
  template_layout_version?: number | null;
  template_fields?: Record<string, unknown>;
  project_summary?: string | null;
  presentation_snapshot?: Record<string, unknown> | null;
  offer_options?: QuotationOfferOption[];
  selected_offer_option_id?: string | null;
  accepted_by_name?: string | null;
  declined_category?: string | null;
}

export interface QuotationEventRow {
  id: string;
  quotation_id: string;
  client_id: string;
  lead_id: string | null;
  deal_id: string | null;
  actor_id: string | null;
  actor_name: string;
  event_type: QuotationEventType | string;
  event_data: Record<string, unknown>;
  created_at: string;
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
  section_id?: string | null;
  unit?: string;
  sku?: string | null;
  discount_percent?: number;
  tax_rate?: number | null;
  is_optional?: boolean;
  package_id?: string | null;
  offer_option_id?: string | null;
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
  sections?: QuotationSectionDef[];
  note_blocks?: QuotationNoteBlock[];
  payment_terms_label?: string | null;
  warranty_terms?: string | null;
  delivery_terms?: string | null;
  package_ids?: string[];
  customer_actions?: Record<string, unknown>;
  discount_percent?: number;
  locked_terms?: boolean;
  layout_key?: string | null;
  category?: string | null;
  presentation?: Record<string, unknown>;
  field_schema?: unknown;
  is_builtin?: boolean;
  builtin_key?: string | null;
  source_template_id?: string | null;
  layout_version?: number;
  thumbnail?: string | null;
}

/** A line item as sent from / to the quote builder UI. */
export interface QuotationLineItemInput {
  catalog_item_id?: string | null;
  item_name: string;
  description?: string | null;
  unit_price: number;
  quantity: number;
  group_label?: string | null;
  section_id?: string | null;
  unit?: string | null;
  sku?: string | null;
  discount_percent?: number | null;
  discount_amount?: number | null;
  tax_rate?: number | null;
  tax_inclusive?: boolean | null;
  is_optional?: boolean | null;
  option_group?: string | null;
  cost_price?: number | null;
  image_url?: string | null;
  catalog_unit_price?: number | null;
  price_override?: boolean | null;
  package_id?: string | null;
  package_locked?: boolean | null;
  offer_option_id?: string | null;
  option_state?: "available" | "selected" | "declined" | string | null;
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
