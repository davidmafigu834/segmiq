-- Agent listing pages: personal marketing links, events, and enquiry attribution.
-- Does not copy listing rows, photographs, contacts, or leads.
-- Access is through SegmiQ server routes (service role). RLS is enabled with no anon policies.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS public_slug text;

COMMENT ON COLUMN listings.public_slug IS
  'Stable public path segment for one listing. Not a title, not an internal id, and independent of agent attribution.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_public_slug
  ON listings (public_slug)
  WHERE public_slug IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_public_slug_format'
  ) THEN
    ALTER TABLE listings
      ADD CONSTRAINT listings_public_slug_format
      CHECK (public_slug IS NULL OR public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS re_agency_listing_page_settings (
  client_id uuid PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  agents_may_generate boolean NOT NULL DEFAULT true,
  public_agency_name text,
  show_agent_name boolean NOT NULL DEFAULT true,
  show_agent_photo boolean NOT NULL DEFAULT true,
  show_agent_phone boolean NOT NULL DEFAULT false,
  public_contact_policy text NOT NULL DEFAULT 'enquiry_form'
    CHECK (public_contact_policy IN ('enquiry_form', 'agency_whatsapp', 'agent_whatsapp_if_allowed')),
  enquiry_routing text NOT NULL DEFAULT 'assign_marketing_agent'
    CHECK (enquiry_routing IN ('assign_marketing_agent', 'agency_assignment')),
  catalogue_url text,
  verified_website text,
  attribution_window_days integer NOT NULL DEFAULT 30
    CHECK (attribution_window_days BETWEEN 7 AND 90),
  max_campaign_links integer NOT NULL DEFAULT 8
    CHECK (max_campaign_links BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE re_agency_listing_page_settings IS
  'Tenant-scoped publication policy for agent listing pages. Logo and legal company name stay on clients.';

CREATE TABLE IF NOT EXISTS re_agent_listing_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token text NOT NULL,
  campaign_label text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  revoke_reason text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT re_agent_listing_shares_token_format CHECK (token ~ '^[A-Za-z0-9_-]{32,80}$'),
  CONSTRAINT re_agent_listing_shares_campaign_len CHECK (campaign_label IS NULL OR char_length(campaign_label) BETWEEN 1 AND 40)
);

COMMENT ON TABLE re_agent_listing_shares IS
  'One marketing source for an organisation listing and agent. The token is not an authentication credential.';
COMMENT ON COLUMN re_agent_listing_shares.agent_id IS
  'Retained when an agent is deactivated. Users are deactivated rather than deleted so reporting history remains.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_re_shares_token ON re_agent_listing_shares (token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_re_shares_default
  ON re_agent_listing_shares (client_id, listing_id, agent_id)
  WHERE campaign_label IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_re_shares_campaign
  ON re_agent_listing_shares (client_id, listing_id, agent_id, lower(campaign_label))
  WHERE campaign_label IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_re_shares_client_agent
  ON re_agent_listing_shares (client_id, agent_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_shares_listing
  ON re_agent_listing_shares (client_id, listing_id, status);

CREATE TABLE IF NOT EXISTS re_listing_marketing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  share_id uuid REFERENCES re_agent_listing_shares(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN (
      'page_view',
      'engaged_view',
      'whatsapp_click',
      'enquiry_submit',
      'viewing_request',
      'share_link_created',
      'share_link_revoked',
      'whatsapp_conversation_confirmed'
    )),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  campaign_label text,
  visitor_label text,
  source_hint text,
  bot_class text NOT NULL DEFAULT 'unknown'
    CHECK (bot_class IN ('human', 'preview', 'automation', 'unknown')),
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE re_listing_marketing_events IS
  'Minimal marketing events. visitor_label is a hash, not a raw IP, cookie, or phone number. Retain raw events about 180 days; daily counts are the reporting source. whatsapp_conversation_confirmed is written only when an inbound provider message is already stored.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_re_mkt_events_idem
  ON re_listing_marketing_events (client_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_re_mkt_events_share_time
  ON re_listing_marketing_events (share_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_mkt_events_client_time
  ON re_listing_marketing_events (client_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_mkt_events_human_views
  ON re_listing_marketing_events (share_id, visitor_label, occurred_at)
  WHERE event_type = 'page_view' AND bot_class = 'human' AND visitor_label IS NOT NULL;

CREATE TABLE IF NOT EXISTS re_listing_marketing_daily (
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  share_id uuid REFERENCES re_agent_listing_shares(id) ON DELETE CASCADE,
  -- share_id when present; otherwise the nil UUID so canonical page views still aggregate.
  share_bucket uuid NOT NULL,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  day date NOT NULL,
  event_type text NOT NULL,
  bot_class text NOT NULL,
  event_count integer NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  PRIMARY KEY (client_id, listing_id, share_bucket, day, event_type, bot_class)
);

CREATE INDEX IF NOT EXISTS idx_re_mkt_daily_share
  ON re_listing_marketing_daily (share_id, day);
CREATE INDEX IF NOT EXISTS idx_re_mkt_daily_client
  ON re_listing_marketing_daily (client_id, day);

CREATE OR REPLACE FUNCTION re_listing_marketing_event_rollup()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO re_listing_marketing_daily (
    client_id, share_id, share_bucket, listing_id, day, event_type, bot_class, event_count
  ) VALUES (
    NEW.client_id,
    NEW.share_id,
    COALESCE(NEW.share_id, '00000000-0000-0000-0000-000000000000'::uuid),
    NEW.listing_id,
    (NEW.occurred_at AT TIME ZONE 'UTC')::date,
    NEW.event_type,
    NEW.bot_class,
    1
  )
  ON CONFLICT (client_id, listing_id, share_bucket, day, event_type, bot_class)
  DO UPDATE SET event_count = re_listing_marketing_daily.event_count + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_re_listing_marketing_event_rollup ON re_listing_marketing_events;
CREATE TRIGGER trg_re_listing_marketing_event_rollup
  AFTER INSERT ON re_listing_marketing_events
  FOR EACH ROW EXECUTE FUNCTION re_listing_marketing_event_rollup();

CREATE TABLE IF NOT EXISTS re_listing_lead_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  share_id uuid REFERENCES re_agent_listing_shares(id) ON DELETE SET NULL,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  marketing_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  operational_owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('enquiry', 'viewing_request')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE re_listing_lead_attributions IS
  'Marketing contribution for a lead. operational_owner_id is the CRM assignee and may differ from marketing_agent_id.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_re_listing_attr_touch
  ON re_listing_lead_attributions (client_id, lead_id, kind, share_id);
CREATE INDEX IF NOT EXISTS idx_re_listing_attr_share
  ON re_listing_lead_attributions (share_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_listing_attr_agent
  ON re_listing_lead_attributions (client_id, marketing_agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS re_listing_public_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  share_id uuid REFERENCES re_agent_listing_shares(id) ON DELETE SET NULL,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('enquiry', 'viewing_request')),
  idempotency_key text NOT NULL,
  phone_hash text NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT re_listing_public_submissions_key_len CHECK (char_length(idempotency_key) BETWEEN 8 AND 200)
);

COMMENT ON TABLE re_listing_public_submissions IS
  'Idempotency for public forms. phone_hash is not a phone number and is not copied into analytics events.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_re_listing_submissions_key
  ON re_listing_public_submissions (client_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_re_listing_submissions_phone
  ON re_listing_public_submissions (client_id, kind, phone_hash);

ALTER TABLE re_agency_listing_page_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_agent_listing_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_listing_marketing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_listing_marketing_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_listing_lead_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_listing_public_submissions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_re_agency_listing_page_settings_updated ON re_agency_listing_page_settings;
CREATE TRIGGER trg_re_agency_listing_page_settings_updated
  BEFORE UPDATE ON re_agency_listing_page_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_re_agent_listing_shares_updated ON re_agent_listing_shares;
CREATE TRIGGER trg_re_agent_listing_shares_updated
  BEFORE UPDATE ON re_agent_listing_shares
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_re_listing_public_submissions_updated ON re_listing_public_submissions;
CREATE TRIGGER trg_re_listing_public_submissions_updated
  BEFORE UPDATE ON re_listing_public_submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
