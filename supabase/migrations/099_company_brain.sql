-- SegmiQ Company Brain — structured business knowledge + approved documents.
-- Canonical CRM (products, deals, quotations, hours, teams) is not duplicated.
-- Agent-specific operating context lives here and is tenant-scoped by client_id.

-- ---------------------------------------------------------------------------
-- 1:1 company brain settings (identity, selling guidance, voice, support, payments).
CREATE TABLE IF NOT EXISTS public.company_brain_settings (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,

  trading_name text,
  business_kind text
    CHECK (business_kind IS NULL OR business_kind IN (
      'manufacturer', 'distributor', 'wholesaler', 'installer',
      'service_provider', 'rental_company', 'contractor', 'dealership',
      'property_agency', 'other'
    )),
  customer_model text
    CHECK (customer_model IS NULL OR customer_model IN ('B2B', 'B2C', 'BOTH')),
  agent_business_explanation text,
  languages jsonb NOT NULL DEFAULT '["English"]'::jsonb,

  primary_offering text,
  catalogue_customer_type text,
  typical_order_type text,
  we_do_not_normally_sell text,
  special_selling_conditions text,

  pricing_guidance text,
  never_estimate_prices boolean NOT NULL DEFAULT true,
  credit_offered boolean NOT NULL DEFAULT false,
  payment_plans_offered boolean NOT NULL DEFAULT false,
  nonstandard_terms_require_approval boolean NOT NULL DEFAULT true,
  payment_guidance text,

  support_offered boolean NOT NULL DEFAULT false,
  support_hours_note text,
  support_destination_type text
    CHECK (support_destination_type IS NULL OR support_destination_type IN (
      'USER', 'TEAM', 'SUPPORT_QUEUE', 'OWNER', 'ADMIN'
    )),
  support_destination_id uuid,
  support_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  support_intake_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  autonomous_troubleshooting boolean NOT NULL DEFAULT false,
  warranty_boundaries text,

  voice_primary text NOT NULL DEFAULT 'professional'
    CHECK (voice_primary IN ('professional', 'warm', 'direct', 'technical', 'premium', 'conversational')),
  voice_secondary text
    CHECK (voice_secondary IS NULL OR voice_secondary IN (
      'professional', 'warm', 'direct', 'technical', 'premium', 'conversational'
    )),
  response_length text NOT NULL DEFAULT 'short'
    CHECK (response_length IN ('short', 'balanced', 'detailed')),
  emoji_policy text NOT NULL DEFAULT 'none'
    CHECK (emoji_policy IN ('none', 'minimal', 'normal')),
  greeting_style text,
  preferred_terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  claims_to_avoid jsonb NOT NULL DEFAULT '[]'::jsonb,

  quote_follow_up_business_days integer NOT NULL DEFAULT 2
    CHECK (quote_follow_up_business_days BETWEEN 1 AND 30),
  second_follow_up_business_days integer NOT NULL DEFAULT 5
    CHECK (second_follow_up_business_days BETWEEN 1 AND 60),
  max_autonomous_follow_ups integer NOT NULL DEFAULT 2
    CHECK (max_autonomous_follow_ups BETWEEN 0 AND 10),

  default_escalation_message text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.company_brain_settings IS
  'Agent-specific operating context for a company. Canonical profile, catalogue, hours and commercial policy remain in their existing tables.';

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_brain_ideal_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  typical_requirements text,
  min_project_size text,
  typical_decision_maker text,
  primary_interest text,
  geographic_requirements text,
  good_fit_indicators text,
  poor_fit_indicators text,
  disqualifying_conditions text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_ideal_customers_client
  ON public.company_brain_ideal_customers (client_id, sort_order);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_brain_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  applies_to text,
  trigger_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  completion_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  deal_readiness_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_playbooks_client
  ON public.company_brain_playbooks (client_id, enabled, sort_order);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_brain_stage_guidance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stage text NOT NULL,
  guidance text,
  preconditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_brain_stage_guidance_client
  ON public.company_brain_stage_guidance (client_id);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_brain_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label text,
  country text,
  province text,
  city text,
  region text,
  radius_km numeric,
  service_category text,
  status text NOT NULL DEFAULT 'PRIMARY'
    CHECK (status IN ('PRIMARY', 'EXTENDED', 'CONFIRMATION_REQUIRED', 'NOT_SERVED')),
  travel_charge_applies boolean NOT NULL DEFAULT false,
  travel_charge_note text,
  min_order text,
  manager_confirmation_required boolean NOT NULL DEFAULT false,
  assigned_note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_service_areas_client
  ON public.company_brain_service_areas (client_id, active);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_brain_appointment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60
    CHECK (duration_minutes BETWEEN 15 AND 480),
  eligible_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  working_hours_source text NOT NULL DEFAULT 'COMPANY'
    CHECK (working_hours_source IN ('COMPANY', 'SALES', 'SUPPORT', 'CUSTOM')),
  custom_working_days integer[],
  custom_start_time text,
  custom_end_time text,
  min_notice_hours integer NOT NULL DEFAULT 2
    CHECK (min_notice_hours BETWEEN 0 AND 168),
  location_required boolean NOT NULL DEFAULT false,
  buffer_minutes integer NOT NULL DEFAULT 0
    CHECK (buffer_minutes BETWEEN 0 AND 120),
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_appointment_types_client
  ON public.company_brain_appointment_types (client_id, enabled);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_brain_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  question text NOT NULL,
  approved_answer text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  category text,
  active boolean NOT NULL DEFAULT true,
  product_ids uuid[] NOT NULL DEFAULT '{}',
  last_reviewed_at timestamptz,
  reviewer_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(question, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(aliases, ' '), '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(approved_answer, '')), 'B')
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_brain_faqs_client_active
  ON public.company_brain_faqs (client_id, active);
CREATE INDEX IF NOT EXISTS idx_brain_faqs_search
  ON public.company_brain_faqs USING gin (search_vector);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_brain_faq_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faq_id uuid NOT NULL REFERENCES public.company_brain_faqs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  version integer NOT NULL,
  question text NOT NULL,
  approved_answer text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  changed_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_faq_versions_faq
  ON public.company_brain_faq_versions (faq_id, version DESC);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_brain_response_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  situation text NOT NULL,
  customer_message text NOT NULL,
  preferred_response text NOT NULL,
  why_preferred text,
  category text NOT NULL DEFAULT 'NEW_ENQUIRY'
    CHECK (category IN (
      'NEW_ENQUIRY', 'PRICING_REQUEST', 'DISCOUNT_REQUEST', 'APPOINTMENT_REQUEST',
      'HUMAN_HANDOFF', 'SUPPORT_REQUEST', 'COMPLAINT', 'FOLLOW_UP', 'QUOTATION_REQUEST'
    )),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_examples_client
  ON public.company_brain_response_examples (client_id, active);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_brain_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  rule_type text NOT NULL
    CHECK (rule_type IN ('NEVER_SAY', 'NEVER_DO')),
  text text NOT NULL,
  structured_key text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_rules_client
  ON public.company_brain_rules (client_id, enabled);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_brain_escalation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  condition_key text NOT NULL,
  condition_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  destination_type text NOT NULL DEFAULT 'OWNER'
    CHECK (destination_type IN ('USER', 'TEAM', 'OWNER', 'SALES_MANAGER', 'SUPPORT_QUEUE', 'ADMIN')),
  destination_id uuid,
  priority text NOT NULL DEFAULT 'NORMAL'
    CHECK (priority IN ('NORMAL', 'HIGH', 'URGENT')),
  customer_message text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_escalation_rules_client
  ON public.company_brain_escalation_rules (client_id, enabled);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_brain_knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'COMPANY'
    CHECK (category IN (
      'COMPANY', 'PRODUCT', 'PRICING', 'WARRANTY', 'SERVICE_AREA', 'PAYMENT',
      'INSTALLATION', 'SUPPORT', 'TERMS', 'TECHNICAL', 'FAQ', 'TRAINING'
    )),
  description text,
  storage_key text,
  content_text text,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'APPROVED', 'OUTDATED', 'ARCHIVED')),
  version integer NOT NULL DEFAULT 1,
  uploaded_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  last_reviewed_at timestamptz,
  effective_date date,
  expires_at date,
  approved_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_knowledge_client_status
  ON public.company_brain_knowledge_documents (client_id, status);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_brain_knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.company_brain_knowledge_documents(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  page_ref text,
  category text,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(content, ''))
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_chunks_document
  ON public.company_brain_knowledge_chunks (document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_brain_chunks_client
  ON public.company_brain_knowledge_chunks (client_id);
CREATE INDEX IF NOT EXISTS idx_brain_chunks_search
  ON public.company_brain_knowledge_chunks USING gin (search_vector);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_brain_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  summary text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_audit_client
  ON public.company_brain_audit (client_id, created_at DESC);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_brain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  summary text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_events_client
  ON public.company_brain_events (client_id, created_at DESC);

-- ---------------------------------------------------------------------------
ALTER TABLE public.agent_executions
  ADD COLUMN IF NOT EXISTS sources jsonb;

ALTER TABLE public.agent_escalations DROP CONSTRAINT IF EXISTS agent_escalations_reason_check;
ALTER TABLE public.agent_escalations
  ADD CONSTRAINT agent_escalations_reason_check
  CHECK (reason IN (
    'LOW_CONFIDENCE', 'CUSTOMER_REQUESTED_HUMAN', 'PRICING_DISPUTE',
    'COMPLAINT', 'TECHNICAL_RISK', 'COMMERCIAL_APPROVAL',
    'UNSUPPORTED_REQUEST', 'POLICY_BLOCKED', 'CONFLICTING_CUSTOMER_DATA',
    'SYSTEM_FAILURE', 'RATE_LIMITED', 'ATTACHMENT_REVIEW', 'KNOWLEDGE_CONFLICT'
  ));

-- ---------------------------------------------------------------------------
ALTER TABLE public.company_brain_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brain_ideal_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brain_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brain_stage_guidance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brain_service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brain_appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brain_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brain_faq_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brain_response_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brain_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brain_escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brain_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brain_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brain_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brain_events ENABLE ROW LEVEL SECURITY;
