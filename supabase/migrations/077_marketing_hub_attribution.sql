-- 077_marketing_hub_attribution.sql
-- Phase 3: cost tracking for ROCS calculations.

ALTER TABLE client_marketing_settings
  ADD COLUMN IF NOT EXISTS estimated_cost_per_message_usd numeric(10, 4);

COMMENT ON COLUMN client_marketing_settings.estimated_cost_per_message_usd IS
  'Estimated Meta WhatsApp marketing cost per message in USD, used for campaign ROCS.';

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_lead_replied
  ON whatsapp_campaign_recipients (lead_id, replied_at DESC)
  WHERE replied_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_events_campaign_response
  ON lead_events (client_id, event_type, created_at DESC)
  WHERE event_type = 'CAMPAIGN_RESPONSE';
