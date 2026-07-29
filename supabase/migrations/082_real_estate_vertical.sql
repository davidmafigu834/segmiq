-- 082_real_estate_vertical.sql
-- Additive Real Estate vertical support. No renames/drops/removals.
-- Trades clients keep business_type = 'trades' (default) with unchanged behavior.

-- 1. clients.business_type + website integration API key ----------------------
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'trades'
    CHECK (business_type IN ('trades', 'real_estate'));

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS website_integration_api_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_website_integration_api_key
  ON clients (website_integration_api_key)
  WHERE website_integration_api_key IS NOT NULL;

COMMENT ON COLUMN clients.business_type IS
  'Product vertical: trades (default) | real_estate. Gates terminology and RE-only modules.';

COMMENT ON COLUMN clients.website_integration_api_key IS
  'Per-client secret for POST /api/external-leads/submit. Nullable until generated.';

-- 2. developments -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS developments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  total_units integer,
  completion_date date,
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_developments_client_id ON developments (client_id);

ALTER TABLE developments ENABLE ROW LEVEL SECURITY;

-- 3. listings -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  development_id uuid REFERENCES developments(id) ON DELETE SET NULL,
  transaction_type text NOT NULL
    CHECK (transaction_type IN ('sale', 'rental', 'new_development')),
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'under_offer', 'reserved', 'sold', 'let')),
  price numeric,
  bedrooms integer,
  bathrooms integer,
  size_sqm numeric,
  address text,
  suburb text,
  description text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  mandate_type text
    CHECK (mandate_type IS NULL OR mandate_type IN ('sole', 'joint', 'open')),
  mandate_expiry_date date,
  lease_term_months integer,
  external_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_client_id ON listings (client_id);
CREATE INDEX IF NOT EXISTS idx_listings_client_status ON listings (client_id, status);
CREATE INDEX IF NOT EXISTS idx_listings_development_id ON listings (development_id);
CREATE INDEX IF NOT EXISTS idx_listings_agent_id ON listings (agent_id);
CREATE INDEX IF NOT EXISTS idx_listings_client_suburb ON listings (client_id, suburb);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- 4. contacts — buyer preference + interested listings (RE only, nullable) ----
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS buyer_budget_min numeric,
  ADD COLUMN IF NOT EXISTS buyer_budget_max numeric,
  ADD COLUMN IF NOT EXISTS buyer_bedrooms_wanted integer,
  ADD COLUMN IF NOT EXISTS buyer_area_preference text,
  ADD COLUMN IF NOT EXISTS buyer_timeline text,
  ADD COLUMN IF NOT EXISTS interested_listing_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN contacts.interested_listing_ids IS
  'JSON array of listing UUIDs. Append-only interest list; never overwrite wholesale from app logic.';

-- 5. leads — RE deal extensions (additive; trades leave null) -----------------
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS deal_side text
    CHECK (deal_side IS NULL OR deal_side IN (
      'buy_side', 'sell_side', 'landlord_side', 'tenant_side'
    )),
  ADD COLUMN IF NOT EXISTS linked_listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_amount numeric,
  ADD COLUMN IF NOT EXISTS offer_status text
    CHECK (offer_status IS NULL OR offer_status IN (
      'submitted', 'countered', 'accepted', 'rejected'
    )),
  ADD COLUMN IF NOT EXISTS listing_agent_commission_pct numeric,
  ADD COLUMN IF NOT EXISTS selling_agent_commission_pct numeric;

CREATE INDEX IF NOT EXISTS idx_leads_linked_listing_id
  ON leads (linked_listing_id)
  WHERE linked_listing_id IS NOT NULL;

-- 6. viewings -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS viewings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  feedback_text text,
  feedback_sentiment text
    CHECK (feedback_sentiment IS NULL OR feedback_sentiment IN (
      'positive', 'neutral', 'negative'
    )),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_viewings_contact_id ON viewings (contact_id);
CREATE INDEX IF NOT EXISTS idx_viewings_listing_id ON viewings (listing_id);
CREATE INDEX IF NOT EXISTS idx_viewings_agent_id ON viewings (agent_id);
CREATE INDEX IF NOT EXISTS idx_viewings_scheduled_at ON viewings (scheduled_at);

ALTER TABLE viewings ENABLE ROW LEVEL SECURITY;

-- 7. lead source: website / facebook_ad for external ingestion ----------------
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;

ALTER TABLE leads
  ADD CONSTRAINT leads_source_check
  CHECK (source IN (
    'LANDING_PAGE',
    'FACEBOOK',
    'MANUAL',
    'REFERRAL',
    'WHATSAPP_INBOUND',
    'WEBSITE',
    'FACEBOOK_AD'
  ));
