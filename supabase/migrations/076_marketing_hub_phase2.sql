-- 076_marketing_hub_phase2.sql
-- Template Manager, marketing settings, approval workflow, compliance fields.

-- ============================================
-- CLIENT MARKETING SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS client_marketing_settings (
  client_id                       uuid PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  quiet_hours_start               time,
  quiet_hours_end                 time,
  timezone                        text NOT NULL DEFAULT 'Africa/Harare',
  max_messages_per_contact_per_week integer NOT NULL DEFAULT 1,
  approval_threshold              integer NOT NULL DEFAULT 100,
  duplicate_campaign_days         integer NOT NULL DEFAULT 7,
  auto_pause_opt_out_rate         numeric(5, 4) NOT NULL DEFAULT 0.0500,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_marketing_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- WHATSAPP TEMPLATES (Template Manager)
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name                text NOT NULL,
  display_name        text,
  category            text NOT NULL DEFAULT 'MARKETING'
                        CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
  language            text NOT NULL DEFAULT 'en',
  body                text NOT NULL,
  header              text,
  footer              text,
  buttons             jsonb NOT NULL DEFAULT '[]',
  variable_examples   jsonb NOT NULL DEFAULT '[]',
  meta_status         text NOT NULL DEFAULT 'draft'
                        CHECK (meta_status IN ('draft', 'pending', 'approved', 'rejected', 'paused')),
  rejection_reason    text,
  meta_template_id    text,
  submitted_at        timestamptz,
  approved_at         timestamptz,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, name, language)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_client_status
  ON whatsapp_templates (client_id, meta_status);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CAMPAIGN APPROVAL + TEST SEND
-- ============================================

ALTER TABLE whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS test_sent_at timestamptz;

ALTER TABLE whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS test_sent_to text;

ALTER TABLE whatsapp_campaigns DROP CONSTRAINT IF EXISTS whatsapp_campaigns_status_check;

ALTER TABLE whatsapp_campaigns
  ADD CONSTRAINT whatsapp_campaigns_status_check
  CHECK (status IN (
    'draft',
    'pending_approval',
    'scheduled',
    'sending',
    'completed',
    'paused',
    'cancelled'
  ));

-- Track recent marketing sends for frequency cap
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_contact_sent
  ON whatsapp_campaign_recipients (contact_id, sent_at DESC)
  WHERE status IN ('sent', 'delivered', 'read') AND sent_at IS NOT NULL;
