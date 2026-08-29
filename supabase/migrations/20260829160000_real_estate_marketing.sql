-- Additive real-estate marketing attribution.
-- Does not alter WhatsApp marketing campaigns (whatsapp_campaigns) or trades ingest.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS website_integration_key_rotated_at timestamptz;

COMMENT ON COLUMN clients.website_integration_key_rotated_at IS
  'When the website integration API key was last generated or revoked.';

CREATE TABLE IF NOT EXISTS re_marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  platform text NOT NULL DEFAULT 'facebook'
    CHECK (platform IN ('facebook', 'instagram', 'website', 'other')),
  external_campaign_id text,
  form_id text,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  development_id uuid REFERENCES developments(id) ON DELETE SET NULL,
  default_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  start_date date,
  end_date date,
  reported_spend numeric,
  synced_spend numeric,
  spend_source text NOT NULL DEFAULT 'manual'
    CHECK (spend_source IN ('manual', 'synced')),
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_mkt_campaigns_client ON re_marketing_campaigns (client_id);
CREATE INDEX IF NOT EXISTS idx_re_mkt_campaigns_listing ON re_marketing_campaigns (listing_id)
  WHERE listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_re_mkt_campaigns_form ON re_marketing_campaigns (client_id, form_id)
  WHERE form_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_re_mkt_campaigns_ext ON re_marketing_campaigns (client_id, external_campaign_id)
  WHERE external_campaign_id IS NOT NULL;

COMMENT ON TABLE re_marketing_campaigns IS
  'Property acquisition campaigns for real-estate. Separate from WhatsApp outbound campaigns.';
COMMENT ON COLUMN re_marketing_campaigns.reported_spend IS
  'Manually entered spend. Never label as live Meta spend.';
COMMENT ON COLUMN re_marketing_campaigns.synced_spend IS
  'Spend from a verified ads API. Null until a sync exists.';

CREATE TABLE IF NOT EXISTS marketing_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  source_type text NOT NULL
    CHECK (source_type IN (
      'facebook_ads',
      'instagram_ads',
      'website',
      'property_portal',
      'referral',
      'walk_in',
      'phone',
      'whatsapp',
      'manual',
      'other'
    )),
  source_platform text,
  campaign_id uuid REFERENCES re_marketing_campaigns(id) ON DELETE SET NULL,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text,
  ad_name text,
  form_id text,
  form_name text,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_page text,
  referrer text,
  provider text,
  external_lead_id text,
  referral_source_name text,
  latest_source_type text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  form_prequalified boolean NOT NULL DEFAULT false,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_attr_lead_unique
  ON marketing_attributions (client_id, lead_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_attr_external_unique
  ON marketing_attributions (client_id, provider, external_lead_id)
  WHERE external_lead_id IS NOT NULL AND provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mkt_attr_client_captured ON marketing_attributions (client_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_attr_source ON marketing_attributions (client_id, source_type);
CREATE INDEX IF NOT EXISTS idx_mkt_attr_campaign ON marketing_attributions (campaign_id)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_attr_listing ON marketing_attributions (listing_id)
  WHERE listing_id IS NOT NULL;

COMMENT ON TABLE marketing_attributions IS
  'First-touch acquisition record per inquiry. Latest source may be stored but original source_type is never overwritten.';

ALTER TABLE re_marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_attributions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_re_marketing_campaigns_updated_at ON re_marketing_campaigns;
CREATE TRIGGER trg_re_marketing_campaigns_updated_at
  BEFORE UPDATE ON re_marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_marketing_attributions_updated_at ON marketing_attributions;
CREATE TRIGGER trg_marketing_attributions_updated_at
  BEFORE UPDATE ON marketing_attributions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
