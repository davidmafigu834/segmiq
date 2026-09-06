-- Real-estate post-offer transaction tracking + after-sales relationship cases.
-- Complements offers/compliance; does not replace lead WON / listing sold gates.
-- Trades quotations and deal tables are untouched.

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS real_estate_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  offer_id uuid UNIQUE REFERENCES real_estate_offers(id) ON DELETE SET NULL,
  compliance_case_id uuid REFERENCES compliance_cases(id) ON DELETE SET NULL,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  buyer_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  listing_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  transaction_type text NOT NULL DEFAULT 'sale'
    CHECK (transaction_type IN (
      'sale',
      'rental',
      'new_development',
      'property_management'
    )),
  status text NOT NULL DEFAULT 'pending_compliance'
    CHECK (status IN (
      'draft',
      'pending_compliance',
      'in_progress',
      'completed',
      'fallen_through',
      'cancelled'
    )),
  currency text NOT NULL DEFAULT 'USD',
  agreed_price numeric NOT NULL CHECK (agreed_price > 0),
  deposit_amount numeric CHECK (deposit_amount IS NULL OR deposit_amount >= 0),
  deposit_received_at timestamptz,
  expected_completion_date date,
  completed_at timestamptz,
  fallen_through_at timestamptz,
  fallen_through_reason text,
  agreement_signed_at timestamptz,
  conveyancing_started_at timestamptz,
  inspection_completed_at timestamptz,
  keys_handed_over_at timestamptz,
  listing_agent_commission_pct numeric,
  selling_agent_commission_pct numeric,
  listing_agent_commission_amount numeric,
  selling_agent_commission_amount numeric,
  commission_settled_at timestamptz,
  commission_notes text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_txn_client_id ON real_estate_transactions (client_id);
CREATE INDEX IF NOT EXISTS idx_re_txn_client_status ON real_estate_transactions (client_id, status);
CREATE INDEX IF NOT EXISTS idx_re_txn_listing_id ON real_estate_transactions (listing_id);
CREATE INDEX IF NOT EXISTS idx_re_txn_contact_id ON real_estate_transactions (contact_id);
CREATE INDEX IF NOT EXISTS idx_re_txn_lead_id ON real_estate_transactions (lead_id);
CREATE INDEX IF NOT EXISTS idx_re_txn_buyer_agent ON real_estate_transactions (buyer_agent_id);
CREATE INDEX IF NOT EXISTS idx_re_txn_completed ON real_estate_transactions (client_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_txn_updated ON real_estate_transactions (client_id, updated_at DESC);

COMMENT ON TABLE real_estate_transactions IS
  'Post-acceptance RE transaction lifecycle: agreements, payments, conveyancing, handover, commission.';

CREATE TABLE IF NOT EXISTS real_estate_transaction_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES real_estate_transactions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  milestone_key text NOT NULL
    CHECK (milestone_key IN (
      'agreement_drafted',
      'agreement_signed',
      'deposit_received',
      'balance_received',
      'conveyancing_started',
      'conveyancing_complete',
      'inspection_booked',
      'inspection_complete',
      'keys_handed_over',
      'commission_invoiced',
      'commission_settled',
      'other'
    )),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'done', 'skipped', 'blocked')),
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, milestone_key)
);

CREATE INDEX IF NOT EXISTS idx_re_txn_ms_txn ON real_estate_transaction_milestones (transaction_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_re_txn_ms_client ON real_estate_transaction_milestones (client_id);

CREATE TABLE IF NOT EXISTS real_estate_transaction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES real_estate_transactions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN (
      'TRANSACTION_CREATED',
      'STATUS_CHANGED',
      'MILESTONE_UPDATED',
      'DEPOSIT_RECORDED',
      'AGREEMENT_SIGNED',
      'COMPLETION_RECORDED',
      'FALLEN_THROUGH',
      'CANCELLED',
      'COMMISSION_UPDATED',
      'NOTE_ADDED'
    )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_txn_events_txn ON real_estate_transaction_events (transaction_id, created_at);
CREATE INDEX IF NOT EXISTS idx_re_txn_events_client ON real_estate_transaction_events (client_id);

ALTER TABLE real_estate_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_transaction_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_transaction_events ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS real_estate_transactions_set_updated_at ON real_estate_transactions;
CREATE TRIGGER real_estate_transactions_set_updated_at
  BEFORE UPDATE ON real_estate_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS real_estate_transaction_milestones_set_updated_at ON real_estate_transaction_milestones;
CREATE TRIGGER real_estate_transaction_milestones_set_updated_at
  BEFORE UPDATE ON real_estate_transaction_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- After-sales relationship
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS real_estate_after_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES real_estate_transactions(id) ON DELETE SET NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  kind text NOT NULL
    CHECK (kind IN (
      'post_sale_check_in',
      'satisfaction',
      'referral_ask',
      'testimonial_ask',
      'future_needs',
      'rental_renewal',
      'handover_follow_up',
      'other'
    )),
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN (
      'not_started',
      'check_in_due',
      'in_progress',
      'completed',
      'declined',
      'no_response'
    )),
  due_at timestamptz,
  completed_at timestamptz,
  outcome text
    CHECK (outcome IS NULL OR outcome IN (
      'satisfied',
      'neutral',
      'unsatisfied',
      'referral_received',
      'testimonial_received',
      'future_need_recorded',
      'complaint',
      'no_response',
      'other'
    )),
  satisfaction_score int CHECK (satisfaction_score IS NULL OR (satisfaction_score >= 1 AND satisfaction_score <= 5)),
  future_needs_notes text,
  notes text,
  linked_complaint_id uuid REFERENCES customer_complaints(id) ON DELETE SET NULL,
  linked_testimonial_id uuid REFERENCES testimonials(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_after_sales_client ON real_estate_after_sales (client_id);
CREATE INDEX IF NOT EXISTS idx_re_after_sales_status ON real_estate_after_sales (client_id, status);
CREATE INDEX IF NOT EXISTS idx_re_after_sales_due ON real_estate_after_sales (client_id, due_at);
CREATE INDEX IF NOT EXISTS idx_re_after_sales_txn ON real_estate_after_sales (transaction_id);
CREATE INDEX IF NOT EXISTS idx_re_after_sales_contact ON real_estate_after_sales (contact_id);
CREATE INDEX IF NOT EXISTS idx_re_after_sales_agent ON real_estate_after_sales (agent_id);

COMMENT ON TABLE real_estate_after_sales IS
  'Post-completion relationship: satisfaction, referrals, testimonials, future property needs.';

CREATE TABLE IF NOT EXISTS real_estate_after_sales_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  after_sales_id uuid NOT NULL REFERENCES real_estate_after_sales(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN (
      'CASE_CREATED',
      'STATUS_CHANGED',
      'OUTCOME_RECORDED',
      'NOTE_ADDED',
      'LINKED_TESTIMONIAL',
      'LINKED_COMPLAINT'
    )),
  note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_after_sales_events_case
  ON real_estate_after_sales_events (after_sales_id, created_at);

ALTER TABLE real_estate_after_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_after_sales_events ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS real_estate_after_sales_set_updated_at ON real_estate_after_sales;
CREATE TRIGGER real_estate_after_sales_set_updated_at
  BEFORE UPDATE ON real_estate_after_sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Viewing reminder observability
-- ---------------------------------------------------------------------------

ALTER TABLE viewings
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

COMMENT ON COLUMN viewings.reminder_sent_at IS
  'When the T-30 viewing reminder WhatsApp was sent (idempotency also via reminder_send_claims).';
