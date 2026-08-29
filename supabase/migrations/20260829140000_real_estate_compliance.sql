-- Additive real-estate CDD / compliance cases.
-- Does not alter trades quotations or deals.
-- Does not invent legal thresholds. SegmiQ stores workflow and decisions only.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS compliance_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN clients.compliance_settings IS
  'RE CDD workflow config: require CDD after accepted offer, required document keys, reviewer restriction. Empty object uses code defaults.';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_review_compliance boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN users.can_review_compliance IS
  'When clients.compliance_settings.restrict_review_to_flagged_users is true, only these users may review/approve CDD. Default review is all CLIENT_MANAGER users.';

CREATE TABLE IF NOT EXISTS compliance_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES real_estate_offers(id) ON DELETE SET NULL,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  entity_type text NOT NULL DEFAULT 'individual'
    CHECK (entity_type IN ('individual', 'corporate')),
  case_type text NOT NULL DEFAULT 'cdd',
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN (
      'not_started',
      'in_progress',
      'awaiting_documents',
      'ready_for_review',
      'under_review',
      'more_information_required',
      'edd_required',
      'approved',
      'restricted',
      'rejected',
      'closed'
    )),
  risk_level text NOT NULL DEFAULT 'unclassified'
    CHECK (risk_level IN ('unclassified', 'low', 'medium', 'high')),
  assigned_compliance_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  buyer_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  submitted_for_review_at timestamptz,
  review_started_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  rejected_by uuid REFERENCES users(id) ON DELETE SET NULL,
  restricted_at timestamptz,
  restricted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  last_reviewed_at timestamptz,
  agent_request_message text,
  review_notes text,
  internal_notes text,
  restriction_reason text,
  rejection_reason text,
  edd_reason text,
  cdd_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_cases_offer_unique
  ON compliance_cases (client_id, offer_id)
  WHERE offer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_cases_client_id ON compliance_cases (client_id);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_client_status ON compliance_cases (client_id, status);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_contact_id ON compliance_cases (contact_id);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_lead_id ON compliance_cases (lead_id);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_listing_id ON compliance_cases (listing_id);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_buyer_agent ON compliance_cases (buyer_agent_id);

COMMENT ON TABLE compliance_cases IS
  'Transaction-scoped CDD case. Identity may be reused from prior cases for the same contact; approval is never inherited automatically.';

CREATE TABLE IF NOT EXISTS compliance_related_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  compliance_case_id uuid NOT NULL REFERENCES compliance_cases(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  relationship_type text NOT NULL
    CHECK (relationship_type IN (
      'director',
      'beneficial_owner',
      'authorised_representative',
      'other'
    )),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_parties_case ON compliance_related_parties (compliance_case_id);
CREATE INDEX IF NOT EXISTS idx_compliance_parties_client ON compliance_related_parties (client_id);

CREATE TABLE IF NOT EXISTS compliance_document_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  compliance_case_id uuid NOT NULL REFERENCES compliance_cases(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  status text NOT NULL DEFAULT 'missing'
    CHECK (status IN (
      'missing',
      'requested',
      'received',
      'under_review',
      'accepted',
      'rejected',
      'expired'
    )),
  required boolean NOT NULL DEFAULT true,
  storage_key text,
  original_filename text,
  content_type text,
  uploaded_at timestamptz,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  review_notes text,
  expiry_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_docs_case ON compliance_document_requirements (compliance_case_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_client ON compliance_document_requirements (client_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_storage ON compliance_document_requirements (storage_key)
  WHERE storage_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS compliance_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  compliance_case_id uuid NOT NULL REFERENCES compliance_cases(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  summary text,
  before_value text,
  after_value text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_events_case ON compliance_case_events (compliance_case_id, created_at);
CREATE INDEX IF NOT EXISTS idx_compliance_events_client ON compliance_case_events (client_id);

ALTER TABLE compliance_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_related_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_case_events ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS compliance_cases_set_updated_at ON compliance_cases;
CREATE TRIGGER compliance_cases_set_updated_at
  BEFORE UPDATE ON compliance_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS compliance_docs_set_updated_at ON compliance_document_requirements;
CREATE TRIGGER compliance_docs_set_updated_at
  BEFORE UPDATE ON compliance_document_requirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'NEW_LEAD', 'WHATSAPP_MESSAGE', 'WHATSAPP_CONNECTION_ALERT', 'FOLLOW_UP_DUE', 'FOLLOW_UP_PREP',
    'DEAL_WON', 'LEAD_FLAG', 'UNCONTACTED_MANAGER_ALERT', 'FB_TOKEN_EXPIRED', 'BACKFILL_COMPLETE',
    'PHOTO_UPLOADED', 'STORAGE_WARNING', 'TEAM_MEMBER_JOINED', 'QUOTATION_ALERT', 'AGENT_ALERT',
    'INVENTORY_ALERT', 'COMMERCIAL_IMPORT', 'LEARNING_ALERT', 'COMPLIANCE_ALERT'
  ));
