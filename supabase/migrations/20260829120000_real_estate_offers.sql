-- Additive real-estate offer + negotiation records.
-- Does NOT alter leads.offer_amount / leads.offer_status (legacy pipeline snapshot).
-- Does NOT backfill events from historical lead offer fields.
-- Trades quotations and deal tables are untouched.

CREATE TABLE IF NOT EXISTS real_estate_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  buyer_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  listing_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'USD',
  original_offer_amount numeric NOT NULL,
  current_offer_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'submitted',
      'countered',
      'negotiating',
      'accepted',
      'rejected',
      'withdrawn',
      'expired'
    )),
  conditions text,
  expiry_date date,
  submitted_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  withdrawn_at timestamptz,
  rejected_reason text,
  withdrawn_reason text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT real_estate_offers_amount_positive
    CHECK (original_offer_amount > 0 AND current_offer_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_re_offers_client_id ON real_estate_offers (client_id);
CREATE INDEX IF NOT EXISTS idx_re_offers_client_status ON real_estate_offers (client_id, status);
CREATE INDEX IF NOT EXISTS idx_re_offers_listing_id ON real_estate_offers (listing_id);
CREATE INDEX IF NOT EXISTS idx_re_offers_contact_id ON real_estate_offers (contact_id);
CREATE INDEX IF NOT EXISTS idx_re_offers_lead_id ON real_estate_offers (lead_id);
CREATE INDEX IF NOT EXISTS idx_re_offers_buyer_agent_id ON real_estate_offers (buyer_agent_id);
CREATE INDEX IF NOT EXISTS idx_re_offers_created_at ON real_estate_offers (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_offers_updated_at ON real_estate_offers (client_id, updated_at DESC);

COMMENT ON TABLE real_estate_offers IS
  'Dedicated RE offer records. One buyer may have many offers; one listing may receive many offers. Legacy leads.offer_amount is a pipeline snapshot only.';

CREATE TABLE IF NOT EXISTS real_estate_offer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES real_estate_offers(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN (
      'OFFER_CREATED',
      'OFFER_SUBMITTED',
      'SELLER_COUNTER',
      'BUYER_REVISED',
      'OFFER_ACCEPTED',
      'OFFER_REJECTED',
      'OFFER_WITHDRAWN',
      'OFFER_EXPIRED',
      'NOTE_ADDED'
    )),
  amount numeric,
  note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_offer_events_offer_id ON real_estate_offer_events (offer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_re_offer_events_client_id ON real_estate_offer_events (client_id);

COMMENT ON TABLE real_estate_offer_events IS
  'Immutable negotiation history for real_estate_offers. Never overwrite; append only.';

ALTER TABLE real_estate_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_offer_events ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS real_estate_offers_set_updated_at ON real_estate_offers;
CREATE TRIGGER real_estate_offers_set_updated_at
  BEFORE UPDATE ON real_estate_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
