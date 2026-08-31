-- SegmiQ Agentic AI Build 1 — Phase 0 foundation (real-estate WhatsApp agent).
-- RE company settings + per-conversation control modes.

ALTER TABLE public.agent_company_settings
  ADD COLUMN IF NOT EXISTS re_auto_respond_ad_inquiries boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS re_allow_property_search boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS re_allow_send_property_info boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS re_allow_offer_viewing_slots boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS re_allow_confirm_viewings boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS re_require_viewing_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS re_allow_update_buyer_requirements boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS re_allow_create_followups boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS re_default_conversation_mode text NOT NULL DEFAULT 'AI_HANDLING'
    CHECK (re_default_conversation_mode IN ('AI_HANDLING', 'AI_COPILOT', 'HUMAN_ONLY'));

COMMENT ON COLUMN public.agent_company_settings.re_auto_respond_ad_inquiries IS
  'Real-estate: auto-respond to new advertising / inbound WhatsApp inquiries when agent is enabled.';
COMMENT ON COLUMN public.agent_company_settings.re_default_conversation_mode IS
  'Real-estate: default SegmiQ Agent mode for new WhatsApp conversations.';

ALTER TABLE public.agent_conversation_state
  ADD COLUMN IF NOT EXISTS conversation_mode text NOT NULL DEFAULT 'AI_HANDLING'
    CHECK (conversation_mode IN ('AI_HANDLING', 'AI_COPILOT', 'HUMAN_ONLY'));

COMMENT ON COLUMN public.agent_conversation_state.conversation_mode IS
  'Product control mode: AI_HANDLING (auto-reply), AI_COPILOT (human sends, agent assists), HUMAN_ONLY (no agent replies).';

-- Backfill from legacy human_takeover / pause flags.
UPDATE public.agent_conversation_state
SET conversation_mode = CASE
  WHEN agent_enabled = false OR status = 'PAUSED' THEN 'HUMAN_ONLY'
  WHEN human_takeover = true THEN 'AI_COPILOT'
  ELSE 'AI_HANDLING'
END
WHERE conversation_mode = 'AI_HANDLING'
  AND (human_takeover = true OR agent_enabled = false OR status = 'PAUSED');
