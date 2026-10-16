-- Phase 2 property acquisition.
-- Requires the Phase 1 foundation migration (activity_subjects).
-- Additive. Does not drop listing or contact columns. Not applied by this change.

-- ---------------------------------------------------------------------------
-- Opportunities
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS real_estate_acquisition_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  reference_number text NOT NULL,
  assigned_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  sourced_by_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'other'
    CHECK (source IN (
      'referral', 'whatsapp', 'phone', 'walk_in', 'facebook', 'website', 'agent_prospecting', 'other'
    )),
  referral_details text,
  owner_name text,
  owner_phone text,
  property_intent text NOT NULL DEFAULT 'unknown'
    CHECK (property_intent IN ('sale', 'rent', 'unknown')),
  property_type text,
  property_description text,
  suburb text,
  city text,
  address text,
  location_notes text,
  expected_price numeric(14, 2),
  currency text NOT NULL DEFAULT 'USD',
  expected_availability_date date,
  stage text NOT NULL DEFAULT 'new_opportunity'
    CHECK (stage IN (
      'new_opportunity', 'owner_contacted', 'owner_interested', 'inspection_scheduled',
      'inspection_completed', 'pricing_discussion', 'mandate_negotiation', 'mandate_secured',
      'listing_preparation', 'submitted_for_approval'
    )),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'on_hold', 'nurturing', 'not_interested', 'lost', 'converted')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  next_action_at timestamptz,
  last_contacted_at timestamptz,
  lost_reason text,
  hold_reason text,
  converted_listing_id uuid,
  converted_at timestamptz,
  idempotency_key text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, reference_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_re_acq_idempotency
  ON real_estate_acquisition_opportunities (client_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_re_acq_one_listing
  ON real_estate_acquisition_opportunities (converted_listing_id)
  WHERE converted_listing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_re_acq_client_status
  ON real_estate_acquisition_opportunities (client_id, status, stage);

CREATE INDEX IF NOT EXISTS idx_re_acq_agent
  ON real_estate_acquisition_opportunities (client_id, assigned_agent_id);

CREATE INDEX IF NOT EXISTS idx_re_acq_contact
  ON real_estate_acquisition_opportunities (client_id, contact_id);

CREATE INDEX IF NOT EXISTS idx_re_acq_next_action
  ON real_estate_acquisition_opportunities (client_id, next_action_at);

CREATE TABLE IF NOT EXISTS real_estate_acquisition_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES real_estate_acquisition_opportunities(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  from_value text,
  to_value text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_acq_events_opp
  ON real_estate_acquisition_events (opportunity_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Inspections (not buyer viewings)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS real_estate_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES real_estate_acquisition_opportunities(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'scheduled', 'confirmed', 'rescheduled', 'cancelled', 'in_progress', 'completed', 'incomplete'
    )),
  scheduled_at timestamptz,
  completed_at timestamptz,
  property_type text,
  address text,
  suburb text,
  city text,
  location_notes text,
  property_usage text,
  bedrooms integer,
  bathrooms integer,
  garages integer,
  parking integer,
  land_size text,
  building_size text,
  floors integer,
  amenities text,
  utilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  documentation jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  unresolved_questions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_inspections_opp
  ON real_estate_inspections (client_id, opportunity_id, status);

CREATE INDEX IF NOT EXISTS idx_re_inspections_schedule
  ON real_estate_inspections (client_id, scheduled_at);

CREATE TABLE IF NOT EXISTS real_estate_inspection_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  inspection_id uuid NOT NULL REFERENCES real_estate_inspections(id) ON DELETE CASCADE,
  document_id uuid,
  storage_key text,
  caption text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_inspection_photos
  ON real_estate_inspection_photos (inspection_id, created_at);

-- ---------------------------------------------------------------------------
-- Pricing history
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS real_estate_price_discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES real_estate_acquisition_opportunities(id) ON DELETE CASCADE,
  amount numeric(14, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  price_type text NOT NULL
    CHECK (price_type IN (
      'owner_asking', 'informal_estimate', 'professional_valuation', 'proposed_listing', 'agreed_marketing'
    )),
  notes text,
  document_id uuid,
  recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_prices_opp
  ON real_estate_price_discussions (opportunity_id, recorded_at DESC);

-- ---------------------------------------------------------------------------
-- Mandates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS real_estate_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES real_estate_acquisition_opportunities(id) ON DELETE SET NULL,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  mandate_type text CHECK (mandate_type IS NULL OR mandate_type IN ('sole', 'joint', 'open')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'awaiting_evidence', 'submitted', 'approved', 'rejected', 'expired', 'revoked', 'superseded', 'legacy_unverified'
    )),
  evidence_status text NOT NULL DEFAULT 'not_provided'
    CHECK (evidence_status IN (
      'not_provided', 'reported', 'provided', 'under_review', 'verified', 'rejected'
    )),
  start_date date,
  expiry_date date,
  responsible_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  document_id uuid,
  review_note text,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  revocation_reason text,
  provenance text NOT NULL DEFAULT 'agent',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_re_mandates_legacy_listing
  ON real_estate_mandates (listing_id)
  WHERE provenance = 'legacy_listing_fields' AND listing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_re_mandates_client
  ON real_estate_mandates (client_id, status, expiry_date);

CREATE INDEX IF NOT EXISTS idx_re_mandates_opp
  ON real_estate_mandates (opportunity_id);

CREATE TABLE IF NOT EXISTS real_estate_mandate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  mandate_id uuid NOT NULL REFERENCES real_estate_mandates(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS acquisition_opportunity_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_one_acquisition
  ON listings (acquisition_opportunity_id)
  WHERE acquisition_opportunity_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_acquisition_opportunity_id_fkey'
  ) THEN
    ALTER TABLE listings
      ADD CONSTRAINT listings_acquisition_opportunity_id_fkey
      FOREIGN KEY (acquisition_opportunity_id)
      REFERENCES real_estate_acquisition_opportunities(id)
      ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 're_acq_converted_listing_fkey'
  ) THEN
    ALTER TABLE real_estate_acquisition_opportunities
      ADD CONSTRAINT re_acq_converted_listing_fkey
      FOREIGN KEY (converted_listing_id)
      REFERENCES listings(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Legacy listing mandate fields become unverified mandate rows. They are not approved.
INSERT INTO real_estate_mandates (
  client_id, listing_id, mandate_type, status, evidence_status, expiry_date, provenance
)
SELECT l.client_id, l.id, l.mandate_type, 'legacy_unverified', 'not_provided', l.mandate_expiry_date, 'legacy_listing_fields'
FROM listings l
WHERE l.client_id IS NOT NULL
  AND (l.mandate_type IS NOT NULL OR l.mandate_expiry_date IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM real_estate_mandates m
    WHERE m.listing_id = l.id AND m.provenance = 'legacy_listing_fields'
  );

-- ---------------------------------------------------------------------------
-- Tenant checks
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_acq_enforce_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  contact_client uuid;
  listing_client uuid;
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    SELECT client_id INTO contact_client FROM contacts WHERE id = NEW.contact_id;
    IF contact_client IS NULL OR contact_client IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'acquisition contact belongs to another organisation';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'real_estate_inspections' AND NEW.listing_id IS NOT NULL THEN
    SELECT client_id INTO listing_client FROM listings WHERE id = NEW.listing_id;
    IF listing_client IS NULL OR listing_client IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'inspection listing belongs to another organisation';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'real_estate_mandates' AND NEW.listing_id IS NOT NULL THEN
    SELECT client_id INTO listing_client FROM listings WHERE id = NEW.listing_id;
    IF listing_client IS NULL OR listing_client IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'mandate listing belongs to another organisation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_re_acq_tenant ON real_estate_acquisition_opportunities;
CREATE TRIGGER trg_re_acq_tenant
  BEFORE INSERT OR UPDATE ON real_estate_acquisition_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.re_acq_enforce_tenant();

DROP TRIGGER IF EXISTS trg_re_inspections_tenant ON real_estate_inspections;
CREATE TRIGGER trg_re_inspections_tenant
  BEFORE INSERT OR UPDATE ON real_estate_inspections
  FOR EACH ROW EXECUTE FUNCTION public.re_acq_enforce_tenant();

DROP TRIGGER IF EXISTS trg_re_mandates_tenant ON real_estate_mandates;
CREATE TRIGGER trg_re_mandates_tenant
  BEFORE INSERT OR UPDATE ON real_estate_mandates
  FOR EACH ROW EXECUTE FUNCTION public.re_acq_enforce_tenant();

-- Extend shared activity subjects. Lead follow-ups are unchanged.
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.activity_subjects') IS NULL THEN
    RAISE EXCEPTION 'activity_subjects is missing. Apply 20261016013000_real_estate_phase1_foundation.sql first.';
  END IF;
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.activity_subjects'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%subject_type%'
  LOOP
    EXECUTE format('ALTER TABLE activity_subjects DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE activity_subjects
  ADD CONSTRAINT activity_subjects_subject_type_check
  CHECK (subject_type IN (
    'lead', 'buyer_search', 'listing', 'viewing', 'offer', 'transaction', 'contact',
    'acquisition', 'inspection', 'mandate'
  ));

ALTER TABLE real_estate_acquisition_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_acquisition_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_price_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_mandate_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE real_estate_acquisition_opportunities FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_acquisition_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_inspections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_inspection_photos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_price_discussions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_mandates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_mandate_events FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE real_estate_acquisition_opportunities IS
  'Potential property stock. Not a marketable listing until converted and approved.';
COMMENT ON TABLE real_estate_inspections IS
  'Acquisition inspections. Buyer viewings stay in viewings.';
COMMENT ON TABLE real_estate_mandates IS
  'Marketing authority. legacy_unverified rows are copied from old listing fields and are not active.';
