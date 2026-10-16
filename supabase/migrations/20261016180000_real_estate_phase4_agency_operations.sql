-- Phase 4 agency operations. Additive. Requires Phase 1 transaction tables.
-- Do not apply to production without explicit approval.

DO $$ BEGIN
  IF to_regclass('public.real_estate_transactions') IS NULL THEN
    RAISE EXCEPTION 'Apply the real estate transactions migration before Phase 4.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS real_estate_deal_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES real_estate_transactions(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  participant_role text NOT NULL
    CHECK (participant_role IN (
      'sourcing_agent', 'listing_agent', 'buyer_agent', 'introducing_agent',
      'transaction_coordinator', 'supervising_manager', 'additional', 'external_agency'
    )),
  responsibilities text,
  added_by uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  access_status text NOT NULL DEFAULT 'active' CHECK (access_status IN ('active', 'ended')),
  external_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT re_deal_participant_target CHECK (transaction_id IS NOT NULL OR listing_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_re_participants_active_txn
  ON real_estate_deal_participants (client_id, transaction_id, user_id, participant_role)
  WHERE transaction_id IS NOT NULL AND ended_at IS NULL AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_re_participants_client_user
  ON real_estate_deal_participants (client_id, user_id, access_status);

CREATE TABLE IF NOT EXISTS real_estate_collaboration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind text NOT NULL
    CHECK (kind IN ('listing_assistance', 'buyer_introduction', 'transaction_participation', 'manager_intervention')),
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  search_id uuid,
  transaction_id uuid REFERENCES real_estate_transactions(id) ON DELETE CASCADE,
  requesting_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  owning_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'declined')),
  note text,
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_collab_owner
  ON real_estate_collaboration_requests (client_id, owning_user_id, status);

CREATE TABLE IF NOT EXISTS real_estate_commission_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('sale', 'rental')),
  mode text NOT NULL CHECK (mode IN ('percent', 'fixed')),
  basis_points integer,
  fixed_cents bigint,
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  effective_from date,
  effective_to date,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS real_estate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES real_estate_transactions(id) ON DELETE CASCADE,
  template_id uuid REFERENCES real_estate_commission_templates(id) ON DELETE SET NULL,
  basis_cents bigint NOT NULL,
  mode text NOT NULL CHECK (mode IN ('percent', 'fixed')),
  basis_points integer,
  fixed_cents bigint,
  gross_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'projected'
    CHECK (status IN (
      'projected', 'earned', 'invoiced', 'reported_received', 'verified_received',
      'allocation_approved', 'partially_paid', 'paid', 'disputed', 'cancelled', 'unverified_legacy'
    )),
  provenance text NOT NULL DEFAULT 'agent',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_re_commissions_legacy
  ON real_estate_commissions (transaction_id)
  WHERE provenance = 'legacy_transaction_fields';

CREATE INDEX IF NOT EXISTS idx_re_commissions_client_status
  ON real_estate_commissions (client_id, status);

CREATE TABLE IF NOT EXISTS real_estate_commission_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  commission_id uuid NOT NULL REFERENCES real_estate_commissions(id) ON DELETE CASCADE,
  beneficiary_id uuid REFERENCES users(id) ON DELETE SET NULL,
  participant_role text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('percent', 'fixed')),
  basis_points integer,
  fixed_cents bigint,
  amount_cents bigint NOT NULL,
  absorbs_remainder boolean NOT NULL DEFAULT false,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  payout_cents bigint NOT NULL DEFAULT 0,
  payout_status text NOT NULL DEFAULT 'unpaid' CHECK (payout_status IN ('unpaid', 'reported', 'verified', 'partially_paid', 'paid')),
  payment_reference text,
  verified_paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_allocations_beneficiary
  ON real_estate_commission_allocations (client_id, beneficiary_id);

CREATE TABLE IF NOT EXISTS real_estate_commission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  commission_id uuid NOT NULL REFERENCES real_estate_commissions(id) ON DELETE CASCADE,
  allocation_id uuid REFERENCES real_estate_commission_allocations(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  from_value text,
  to_value text,
  amount_cents bigint,
  note text,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS real_estate_commission_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  commission_id uuid NOT NULL REFERENCES real_estate_commissions(id) ON DELETE CASCADE,
  allocation_id uuid REFERENCES real_estate_commission_allocations(id) ON DELETE SET NULL,
  opened_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'upheld', 'adjusted', 'resolved')),
  decision_note text,
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS real_estate_transaction_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES real_estate_transactions(id) ON DELETE CASCADE,
  document_id uuid,
  category text NOT NULL,
  filename text,
  review_status text NOT NULL DEFAULT 'awaiting_review'
    CHECK (review_status IN ('missing', 'uploaded', 'awaiting_review', 'verified', 'rejected')),
  visibility text NOT NULL DEFAULT 'participants' CHECK (visibility IN ('participants', 'managers', 'finance')),
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_txn_docs_txn
  ON real_estate_transaction_documents (client_id, transaction_id);

CREATE TABLE IF NOT EXISTS real_estate_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'partial')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS real_estate_handover_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  handover_id uuid NOT NULL REFERENCES real_estate_handovers(id) ON DELETE CASCADE,
  record_type text NOT NULL,
  record_id uuid NOT NULL,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS real_estate_staff_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capability text NOT NULL,
  granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id, capability)
);

ALTER TABLE real_estate_transaction_milestones
  ADD COLUMN IF NOT EXISTS assigned_to_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE real_estate_deal_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_collaboration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_commission_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_commission_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_commission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_commission_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_transaction_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_handover_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_staff_capabilities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE real_estate_deal_participants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_collaboration_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_commission_templates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_commissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_commission_allocations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_commission_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_commission_disputes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_transaction_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_handovers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_handover_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_staff_capabilities FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE real_estate_commissions IS
  'Agency commission ledger in integer cents. unverified_legacy rows copy old transaction fields and are not verified receipts. A buyer deposit is not a commission.';
COMMENT ON COLUMN real_estate_commission_allocations.payout_status IS
  'reported is not verified. verified and paid require an authorised user who is not the beneficiary.';
