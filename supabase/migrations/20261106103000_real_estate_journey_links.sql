-- Journey links for viewing acknowledgements and seller-link offers.
-- Manual offers stay on acceptance_channel = 'manual'.

ALTER TABLE real_estate_offers
  ADD COLUMN IF NOT EXISTS acceptance_channel text NOT NULL DEFAULT 'manual';

ALTER TABLE real_estate_offers
  DROP CONSTRAINT IF EXISTS real_estate_offers_acceptance_channel_check;

ALTER TABLE real_estate_offers
  ADD CONSTRAINT real_estate_offers_acceptance_channel_check
  CHECK (acceptance_channel IN ('manual', 'seller_link'));

ALTER TABLE real_estate_offers
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE real_estate_offers
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;

ALTER TABLE real_estate_offers
  ADD COLUMN IF NOT EXISTS revision_status text;

CREATE TABLE IF NOT EXISTS re_journey_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('viewing_acknowledgement', 'offer_buyer', 'offer_seller', 'lawyer_invitation')),
  listing_id uuid REFERENCES listings(id) ON DELETE RESTRICT,
  buyer_search_id uuid,
  offer_id uuid REFERENCES real_estate_offers(id) ON DELETE RESTRICT,
  transaction_id uuid REFERENCES real_estate_transactions(id) ON DELETE RESTRICT,
  viewing_id uuid REFERENCES viewings(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  revision text NOT NULL DEFAULT '1',
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  recipient_id text,
  authorised_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  template_key text NOT NULL,
  synthetic boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS re_journey_links_token_hash ON re_journey_links (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS re_journey_links_one_viewing ON re_journey_links (viewing_id) WHERE viewing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS re_journey_links_listing ON re_journey_links (client_id, listing_id, purpose);

CREATE TABLE IF NOT EXISTS re_journey_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES re_journey_links(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('request', 'booking', 'buyer_signed', 'seller_accepted', 'seller_declined')),
  revision text NOT NULL,
  signer_name text,
  signed_at timestamptz,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  storage_key text,
  content_sha256 text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS re_journey_submissions_key
  ON re_journey_submissions (client_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE re_journey_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_journey_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON re_journey_links, re_journey_submissions FROM PUBLIC, anon, authenticated;
