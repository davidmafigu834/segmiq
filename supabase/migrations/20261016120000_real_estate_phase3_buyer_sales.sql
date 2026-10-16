-- Phase 3 buyer and tenant sales. Additive. Requires the Phase 1 foundation tables.
-- Do not apply to production without explicit approval.

DO $$ BEGIN
  IF to_regclass('public.real_estate_buyer_searches') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261016013000_real_estate_phase1_foundation.sql before this migration.';
  END IF;
END $$;

ALTER TABLE real_estate_buyer_searches
  ADD COLUMN IF NOT EXISTS pipeline_stage text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS land_size text,
  ADD COLUMN IF NOT EXISTS building_size text,
  ADD COLUMN IF NOT EXISTS features text,
  ADD COLUMN IF NOT EXISTS amenities text,
  ADD COLUMN IF NOT EXISTS lease_months integer,
  ADD COLUMN IF NOT EXISTS move_in_date date,
  ADD COLUMN IF NOT EXISTS allow_above_budget boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_alternate_locations boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_action_note text,
  ADD COLUMN IF NOT EXISTS closure_note text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'real_estate_buyer_searches_pipeline_stage_check'
  ) THEN
    ALTER TABLE real_estate_buyer_searches
      ADD CONSTRAINT real_estate_buyer_searches_pipeline_stage_check
      CHECK (
        pipeline_stage IS NULL OR pipeline_stage IN (
          'new_enquiry', 'requirements_discovery', 'actively_searching',
          'viewings_in_progress', 'decision_pending', 'paused', 'completed', 'closed'
        )
      );
  END IF;
END $$;

UPDATE real_estate_buyer_searches
SET pipeline_stage = CASE status
  WHEN 'paused' THEN 'paused'
  WHEN 'completed' THEN 'completed'
  WHEN 'closed' THEN 'closed'
  WHEN 'active' THEN 'actively_searching'
  ELSE NULL
END
WHERE pipeline_stage IS NULL AND status <> 'needs_review';

CREATE TABLE IF NOT EXISTS real_estate_buyer_search_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  search_id uuid NOT NULL REFERENCES real_estate_buyer_searches(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  field_name text,
  from_value text,
  to_value text,
  note text,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_search_events_search
  ON real_estate_buyer_search_events (client_id, search_id, created_at DESC);

ALTER TABLE real_estate_property_interests
  ADD COLUMN IF NOT EXISTS interest_state text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS rejection_note text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'real_estate_property_interests_interest_state_check'
  ) THEN
    ALTER TABLE real_estate_property_interests
      ADD CONSTRAINT real_estate_property_interests_interest_state_check
      CHECK (
        interest_state IS NULL OR interest_state IN (
          'matched', 'recommended', 'sent', 'interested', 'not_interested',
          'viewing_requested', 'viewing_completed', 'offer'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_re_interests_search_state
  ON real_estate_property_interests (client_id, search_id, interest_state);

ALTER TABLE viewings
  ADD COLUMN IF NOT EXISTS buyer_search_id uuid REFERENCES real_estate_buyer_searches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmation_status text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'viewings_confirmation_status_check'
  ) THEN
    ALTER TABLE viewings
      ADD CONSTRAINT viewings_confirmation_status_check
      CHECK (
        confirmation_status IS NULL OR confirmation_status IN (
          'tentative', 'awaiting_confirmation', 'confirmed', 'rescheduled'
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_viewings_idempotency
  ON viewings (client_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_viewings_buyer_search
  ON viewings (buyer_search_id)
  WHERE buyer_search_id IS NOT NULL;

ALTER TABLE real_estate_offers
  ADD COLUMN IF NOT EXISTS buyer_search_id uuid REFERENCES real_estate_buyer_searches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_interest_id uuid REFERENCES real_estate_property_interests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_re_offers_buyer_search
  ON real_estate_offers (client_id, buyer_search_id)
  WHERE buyer_search_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS real_estate_match_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  search_id uuid NOT NULL REFERENCES real_estate_buyer_searches(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  fingerprint text NOT NULL,
  strength text,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, search_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_re_match_notifications_agent
  ON real_estate_match_notifications (client_id, agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS real_estate_buyer_introductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  search_id uuid NOT NULL REFERENCES real_estate_buyer_searches(id) ON DELETE CASCADE,
  requesting_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  owning_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, search_id, requesting_agent_id)
);

CREATE INDEX IF NOT EXISTS idx_re_introductions_owner
  ON real_estate_buyer_introductions (client_id, owning_agent_id, status);

CREATE TABLE IF NOT EXISTS real_estate_rental_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  search_id uuid NOT NULL REFERENCES real_estate_buyer_searches(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'accepted', 'declined')),
  deposit_status text NOT NULL DEFAULT 'expected'
    CHECK (deposit_status IN ('expected', 'reported', 'verified')),
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_rental_applications_search
  ON real_estate_rental_applications (client_id, search_id);

ALTER TABLE real_estate_buyer_search_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_match_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_buyer_introductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_rental_applications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE real_estate_buyer_search_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_match_notifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_buyer_introductions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_rental_applications FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE real_estate_match_notifications IS
  'Internal agent alerts when a live listing matches a search. Not a WhatsApp send.';
COMMENT ON COLUMN real_estate_buyer_searches.pipeline_stage IS
  'Agent-facing stage. status remains the coarse active/paused/completed/closed/needs_review value used by matching.';
COMMENT ON COLUMN real_estate_rental_applications.deposit_status IS
  'verified is a manager decision. An uploaded screenshot must stay reported.';
