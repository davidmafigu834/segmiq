-- 075_marketing_hub_foundation.sql
-- SegmiQ Marketing Hub Phase 1: consent, WhatsApp campaigns, recipients.

-- ============================================
-- COMMUNICATION PREFERENCES (Consent Centre)
-- ============================================

CREATE TABLE IF NOT EXISTS contact_communication_prefs (
  contact_id              uuid PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  client_id               uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  whatsapp_marketing      text NOT NULL DEFAULT 'unknown'
                            CHECK (whatsapp_marketing IN ('opted_in', 'opted_out', 'unknown')),
  service_updates         text NOT NULL DEFAULT 'opted_in'
                            CHECK (service_updates IN ('opted_in', 'opted_out', 'unknown')),
  consent_source          text,
  consent_date            timestamptz,
  consent_wording_version text,
  consent_evidence        jsonb DEFAULT '{}',
  opt_out_at              timestamptz,
  opt_out_reason          text,
  suppressed              boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_comm_prefs_client
  ON contact_communication_prefs (client_id);

CREATE INDEX IF NOT EXISTS idx_contact_comm_prefs_marketing
  ON contact_communication_prefs (client_id, whatsapp_marketing)
  WHERE suppressed = false;

ALTER TABLE contact_communication_prefs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- WHATSAPP CAMPAIGNS
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  objective             text NOT NULL DEFAULT 'generate_sales'
                          CHECK (objective IN (
                            'generate_sales',
                            'reactivate_leads',
                            'promote_offer',
                            'upsell_customers',
                            'request_referrals',
                            'announce_product',
                            'invite_event',
                            'follow_up_quotations'
                          )),
  audience_segment_id   uuid REFERENCES audience_segments(id) ON DELETE SET NULL,
  template_name         text NOT NULL,
  template_language     text NOT NULL DEFAULT 'en',
  template_variables    jsonb NOT NULL DEFAULT '{}',
  template_components   jsonb NOT NULL DEFAULT '[]',
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN (
                            'draft',
                            'scheduled',
                            'sending',
                            'completed',
                            'paused',
                            'cancelled'
                          )),
  scheduled_at          timestamptz,
  started_at            timestamptz,
  completed_at          timestamptz,
  created_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  stats                 jsonb NOT NULL DEFAULT '{
    "total": 0,
    "sent": 0,
    "delivered": 0,
    "read": 0,
    "failed": 0,
    "skipped": 0,
    "replied": 0,
    "opt_out": 0
  }',
  estimated_recipients  integer,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_client_status
  ON whatsapp_campaigns (client_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_sending
  ON whatsapp_campaigns (status, scheduled_at)
  WHERE status IN ('scheduled', 'sending');

ALTER TABLE whatsapp_campaigns ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CAMPAIGN RECIPIENTS
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_campaign_recipients (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id             uuid NOT NULL REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
  client_id               uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contact_id              uuid REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id                 uuid REFERENCES leads(id) ON DELETE SET NULL,
  phone                   text NOT NULL,
  status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                              'pending',
                              'sent',
                              'delivered',
                              'read',
                              'failed',
                              'skipped'
                            )),
  skip_reason             text,
  provider_message_id     text,
  error_message           text,
  sent_at                 timestamptz,
  delivered_at            timestamptz,
  read_at                 timestamptz,
  replied_at              timestamptz,
  response_classification text
                            CHECK (response_classification IS NULL OR response_classification IN (
                              'interested',
                              'later',
                              'not_interested',
                              'opt_out'
                            )),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_status
  ON whatsapp_campaign_recipients (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_phone_client
  ON whatsapp_campaign_recipients (client_id, phone, sent_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_recipients_provider_id
  ON whatsapp_campaign_recipients (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- Link outbound campaign messages to campaigns
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES whatsapp_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_campaign
  ON whatsapp_messages (campaign_id)
  WHERE campaign_id IS NOT NULL;
