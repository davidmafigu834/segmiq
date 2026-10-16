-- Phase 1 Real Estate foundation.
-- Additive only. Does not drop columns, rewrite old migrations, or delete customer rows.
-- Apply this before deploying the Phase 1 application code.
-- Rollback guidance is in docs/implementation/REAL_ESTATE_PHASE_1_REPORT.md.

-- ---------------------------------------------------------------------------
-- Viewings belong to an organisation
-- ---------------------------------------------------------------------------

ALTER TABLE viewings
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_viewings_client_id ON viewings (client_id);

CREATE TABLE IF NOT EXISTS real_estate_migration_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE real_estate_migration_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE real_estate_migration_reviews FROM PUBLIC, anon, authenticated;

INSERT INTO real_estate_migration_reviews (client_id, entity_type, entity_id, reason)
SELECT l.client_id, 'viewing', v.id, 'contact and listing belong to different organisations'
FROM viewings v
JOIN listings l ON l.id = v.listing_id
JOIN contacts c ON c.id = v.contact_id
WHERE c.client_id IS DISTINCT FROM l.client_id
  AND NOT EXISTS (
    SELECT 1 FROM real_estate_migration_reviews r
    WHERE r.entity_type = 'viewing' AND r.entity_id = v.id
  );

UPDATE viewings v
SET client_id = l.client_id
FROM listings l, contacts c
WHERE v.listing_id = l.id
  AND c.id = v.contact_id
  AND v.client_id IS NULL
  AND c.client_id = l.client_id;

CREATE OR REPLACE FUNCTION public.re_viewings_enforce_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  listing_client uuid;
  contact_client uuid;
BEGIN
  SELECT client_id INTO listing_client FROM listings WHERE id = NEW.listing_id;
  SELECT client_id INTO contact_client FROM contacts WHERE id = NEW.contact_id;
  IF listing_client IS NULL OR contact_client IS NULL THEN
    RAISE EXCEPTION 'viewing listing or contact was not found';
  END IF;
  IF listing_client IS DISTINCT FROM contact_client THEN
    RAISE EXCEPTION 'viewing contact and listing belong to different organisations';
  END IF;
  IF NEW.client_id IS NULL THEN
    NEW.client_id := listing_client;
  ELSIF NEW.client_id IS DISTINCT FROM listing_client THEN
    RAISE EXCEPTION 'viewing client_id does not match the listing organisation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_viewings_enforce_tenant ON viewings;
CREATE TRIGGER trg_viewings_enforce_tenant
  BEFORE INSERT OR UPDATE ON viewings
  FOR EACH ROW
  EXECUTE FUNCTION public.re_viewings_enforce_tenant();

-- ---------------------------------------------------------------------------
-- One reserving offer and one active transaction per listing
-- ---------------------------------------------------------------------------

ALTER TABLE real_estate_offers
  ADD COLUMN IF NOT EXISTS reserves_listing boolean NOT NULL DEFAULT false;

UPDATE real_estate_offers SET reserves_listing = false;

UPDATE real_estate_offers o
SET reserves_listing = true
WHERE o.id IN (
  SELECT DISTINCT ON (o2.listing_id) o2.id
  FROM real_estate_offers o2
  LEFT JOIN real_estate_transactions t ON t.offer_id = o2.id
  WHERE o2.status = 'accepted'
    AND (t.id IS NULL OR t.status IN ('draft', 'pending_compliance', 'in_progress'))
  ORDER BY o2.listing_id, o2.accepted_at DESC NULLS LAST, o2.updated_at DESC
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_re_offers_one_reserving
  ON real_estate_offers (listing_id)
  WHERE reserves_listing = true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM real_estate_transactions
    WHERE status IN ('draft', 'pending_compliance', 'in_progress')
    GROUP BY listing_id
    HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'phase1: skipped idx_re_txn_one_active_per_listing because duplicate active transactions exist';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_re_txn_one_active_per_listing'
  ) THEN
    CREATE UNIQUE INDEX idx_re_txn_one_active_per_listing
      ON real_estate_transactions (listing_id)
      WHERE status IN ('draft', 'pending_compliance', 'in_progress');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS real_estate_listing_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES real_estate_offers(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES real_estate_transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_listing_status_events_listing
  ON real_estate_listing_status_events (listing_id, created_at DESC);

ALTER TABLE real_estate_listing_status_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE real_estate_listing_status_events FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Contact roles, searches, interests, listing parties
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS real_estate_contact_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('buyer', 'tenant', 'seller', 'landlord')),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'reported', 'verified')),
  source text NOT NULL DEFAULT 'agent_classification',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, contact_id, role)
);

CREATE INDEX IF NOT EXISTS idx_re_contact_roles_contact
  ON real_estate_contact_roles (client_id, contact_id);

CREATE TABLE IF NOT EXISTS real_estate_buyer_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  assigned_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  intent text NOT NULL CHECK (intent IN ('purchase', 'rental')),
  property_type text,
  budget_min numeric,
  budget_max numeric,
  locations text[] NOT NULL DEFAULT '{}',
  bedrooms integer,
  bathrooms integer,
  other_requirements text,
  timeframe text,
  readiness text,
  status text NOT NULL DEFAULT 'needs_review'
    CHECK (status IN ('active', 'paused', 'completed', 'closed', 'needs_review')),
  closure_reason text,
  provenance text NOT NULL DEFAULT 'agent',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_re_buyer_searches_legacy
  ON real_estate_buyer_searches (client_id, contact_id)
  WHERE provenance = 'legacy_contact_fields';

CREATE INDEX IF NOT EXISTS idx_re_buyer_searches_client_status
  ON real_estate_buyer_searches (client_id, status);

CREATE INDEX IF NOT EXISTS idx_re_buyer_searches_agent
  ON real_estate_buyer_searches (client_id, assigned_agent_id);

CREATE TABLE IF NOT EXISTS real_estate_property_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  search_id uuid REFERENCES real_estate_buyer_searches(id) ON DELETE SET NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'needs_review'
    CHECK (status IN ('active', 'paused', 'closed', 'needs_review')),
  source text NOT NULL DEFAULT 'agent',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, contact_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_re_property_interests_listing
  ON real_estate_property_interests (client_id, listing_id, status);

CREATE TABLE IF NOT EXISTS real_estate_listing_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  party_role text NOT NULL CHECK (party_role IN ('owner', 'authorised_representative')),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'reported', 'verified')),
  source text NOT NULL DEFAULT 'reported',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, contact_id, party_role)
);

CREATE INDEX IF NOT EXISTS idx_re_listing_parties_client
  ON real_estate_listing_parties (client_id, listing_id);

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS buyer_search_id uuid REFERENCES real_estate_buyer_searches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_buyer_search_id
  ON leads (buyer_search_id)
  WHERE buyer_search_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.re_assert_contact_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  contact_client uuid;
BEGIN
  SELECT client_id INTO contact_client FROM contacts WHERE id = NEW.contact_id;
  IF contact_client IS DISTINCT FROM NEW.client_id THEN
    RAISE EXCEPTION 'contact belongs to another organisation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.re_assert_listing_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  listing_client uuid;
BEGIN
  IF NEW.listing_id IS NOT NULL THEN
    SELECT client_id INTO listing_client FROM listings WHERE id = NEW.listing_id;
    IF listing_client IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'listing belongs to another organisation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_re_contact_roles_tenant ON real_estate_contact_roles;
CREATE TRIGGER trg_re_contact_roles_tenant
  BEFORE INSERT OR UPDATE ON real_estate_contact_roles
  FOR EACH ROW EXECUTE FUNCTION public.re_assert_contact_tenant();

DROP TRIGGER IF EXISTS trg_re_searches_tenant ON real_estate_buyer_searches;
CREATE TRIGGER trg_re_searches_tenant
  BEFORE INSERT OR UPDATE ON real_estate_buyer_searches
  FOR EACH ROW EXECUTE FUNCTION public.re_assert_contact_tenant();

DROP TRIGGER IF EXISTS trg_re_interests_contact_tenant ON real_estate_property_interests;
CREATE TRIGGER trg_re_interests_contact_tenant
  BEFORE INSERT OR UPDATE ON real_estate_property_interests
  FOR EACH ROW EXECUTE FUNCTION public.re_assert_contact_tenant();

DROP TRIGGER IF EXISTS trg_re_interests_listing_tenant ON real_estate_property_interests;
CREATE TRIGGER trg_re_interests_listing_tenant
  BEFORE INSERT OR UPDATE ON real_estate_property_interests
  FOR EACH ROW EXECUTE FUNCTION public.re_assert_listing_tenant();

DROP TRIGGER IF EXISTS trg_re_parties_contact_tenant ON real_estate_listing_parties;
CREATE TRIGGER trg_re_parties_contact_tenant
  BEFORE INSERT OR UPDATE ON real_estate_listing_parties
  FOR EACH ROW EXECUTE FUNCTION public.re_assert_contact_tenant();

DROP TRIGGER IF EXISTS trg_re_parties_listing_tenant ON real_estate_listing_parties;
CREATE TRIGGER trg_re_parties_listing_tenant
  BEFORE INSERT OR UPDATE ON real_estate_listing_parties
  FOR EACH ROW EXECUTE FUNCTION public.re_assert_listing_tenant();

-- Legacy buyer columns stay. Unclassified contacts become needs_review, not active buyers.
INSERT INTO real_estate_buyer_searches (
  client_id, contact_id, intent, budget_min, budget_max, locations, bedrooms, timeframe, status, provenance
)
SELECT
  c.client_id,
  c.id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM leads l
      WHERE l.contact_id = c.id AND l.client_id = c.client_id AND l.deal_side = 'tenant_side'
    ) AND NOT EXISTS (
      SELECT 1 FROM leads l
      WHERE l.contact_id = c.id AND l.client_id = c.client_id AND l.deal_side = 'buy_side'
    ) THEN 'rental'
    ELSE 'purchase'
  END,
  c.buyer_budget_min,
  c.buyer_budget_max,
  CASE WHEN nullif(btrim(c.buyer_area_preference), '') IS NULL THEN '{}'::text[]
       ELSE ARRAY[btrim(c.buyer_area_preference)] END,
  c.buyer_bedrooms_wanted,
  c.buyer_timeline,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM leads l
      WHERE l.contact_id = c.id AND l.client_id = c.client_id
        AND l.deal_side IN ('buy_side', 'tenant_side')
    ) THEN 'active'
    ELSE 'needs_review'
  END,
  'legacy_contact_fields'
FROM contacts c
WHERE (
  c.buyer_budget_min IS NOT NULL
  OR c.buyer_budget_max IS NOT NULL
  OR c.buyer_bedrooms_wanted IS NOT NULL
  OR nullif(btrim(c.buyer_area_preference), '') IS NOT NULL
  OR nullif(btrim(c.buyer_timeline), '') IS NOT NULL
)
AND NOT EXISTS (
  SELECT 1 FROM real_estate_buyer_searches s
  WHERE s.client_id = c.client_id
    AND s.contact_id = c.id
    AND s.provenance = 'legacy_contact_fields'
);

INSERT INTO real_estate_contact_roles (client_id, contact_id, role, verification_status, source)
SELECT DISTINCT l.client_id, l.contact_id,
  CASE l.deal_side
    WHEN 'buy_side' THEN 'buyer'
    WHEN 'tenant_side' THEN 'tenant'
    WHEN 'sell_side' THEN 'seller'
    WHEN 'landlord_side' THEN 'landlord'
  END,
  'unverified',
  'lead_deal_side'
FROM leads l
WHERE l.contact_id IS NOT NULL
  AND l.deal_side IN ('buy_side', 'tenant_side', 'sell_side', 'landlord_side')
ON CONFLICT (client_id, contact_id, role) DO NOTHING;

INSERT INTO real_estate_property_interests (
  client_id, contact_id, listing_id, source, status
)
SELECT c.client_id, c.id, lid.listing_id, 'interested_listing_ids',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM leads l
      WHERE l.contact_id = c.id AND l.client_id = c.client_id
        AND l.deal_side IN ('buy_side', 'tenant_side')
    ) THEN 'active'
    ELSE 'needs_review'
  END
FROM contacts c
CROSS JOIN LATERAL (
  SELECT elem::uuid AS listing_id
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(c.interested_listing_ids) = 'array' THEN c.interested_listing_ids ELSE '[]'::jsonb END
  ) AS elem
  WHERE elem ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
) AS lid
JOIN listings lst ON lst.id = lid.listing_id AND lst.client_id = c.client_id
ON CONFLICT (client_id, contact_id, listing_id) DO NOTHING;

INSERT INTO real_estate_migration_reviews (client_id, entity_type, entity_id, reason)
SELECT c.client_id, 'interested_listing_id', c.id, 'interested listing id is not in this organisation: ' || lid.listing_id::text
FROM contacts c
CROSS JOIN LATERAL (
  SELECT elem::uuid AS listing_id
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(c.interested_listing_ids) = 'array' THEN c.interested_listing_ids ELSE '[]'::jsonb END
  ) AS elem
  WHERE elem ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
) AS lid
WHERE NOT EXISTS (
    SELECT 1 FROM listings lst WHERE lst.id = lid.listing_id AND lst.client_id = c.client_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM real_estate_migration_reviews r
    WHERE r.entity_type = 'interested_listing_id'
      AND r.entity_id = c.id
      AND r.reason = 'interested listing id is not in this organisation: ' || lid.listing_id::text
  );

-- ---------------------------------------------------------------------------
-- Shared activity subjects. Lead follow-ups are not moved or deleted.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS activity_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN (
    'lead', 'buyer_search', 'listing', 'viewing', 'offer', 'transaction', 'contact'
  )),
  subject_id uuid NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  assigned_to_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  due_at timestamptz,
  completed_at timestamptz,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_subjects_subject
  ON activity_subjects (client_id, subject_type, subject_id);

CREATE INDEX IF NOT EXISTS idx_activity_subjects_assignee
  ON activity_subjects (client_id, assigned_to_id, completed_at);

-- ---------------------------------------------------------------------------
-- Direct Data API access stays closed. SegmiQ authorises in the Next.js API
-- and queries with the service role. No anon or authenticated policies.
-- ---------------------------------------------------------------------------

ALTER TABLE real_estate_contact_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_buyer_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_property_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_listing_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_subjects ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE real_estate_contact_roles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_buyer_searches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_property_interests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_listing_parties FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE activity_subjects FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE developments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE listings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE viewings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_offers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_offer_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE compliance_cases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE compliance_related_parties FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE compliance_document_requirements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE compliance_case_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE re_marketing_campaigns FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE marketing_attributions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE customer_complaints FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_transactions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_transaction_milestones FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_transaction_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_after_sales FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE real_estate_after_sales_events FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE real_estate_buyer_searches IS
  'Authoritative for new buyer and tenant searches. contacts.buyer_* columns remain during compatibility.';
COMMENT ON TABLE activity_subjects IS
  'Optional subject link for activities. Closing a listing or deal must not delete these rows.';
