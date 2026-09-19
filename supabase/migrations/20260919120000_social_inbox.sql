-- Social Inbox: Facebook / Instagram sales workspace.
-- Tenant key is client_id (SegmiQ organisation boundary).
-- Service role bypasses RLS; anon/authenticated are denied.

-- ---------------------------------------------------------------------------
-- Lead source: Instagram conversions
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_source_check
  CHECK (source IN (
    'LANDING_PAGE',
    'FACEBOOK',
    'MANUAL',
    'REFERRAL',
    'WHATSAPP_INBOUND',
    'WEBSITE',
    'FACEBOOK_AD',
    'INSTAGRAM'
  ));

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'NEW_LEAD', 'WHATSAPP_MESSAGE', 'WHATSAPP_CONNECTION_ALERT', 'FOLLOW_UP_DUE', 'FOLLOW_UP_PREP',
    'DEAL_WON', 'LEAD_FLAG', 'UNCONTACTED_MANAGER_ALERT', 'FB_TOKEN_EXPIRED', 'BACKFILL_COMPLETE',
    'PHOTO_UPLOADED', 'STORAGE_WARNING', 'TEAM_MEMBER_JOINED', 'QUOTATION_ALERT', 'AGENT_ALERT',
    'INVENTORY_ALERT', 'COMMERCIAL_IMPORT', 'LEARNING_ALERT', 'COMPLIANCE_ALERT',
    'SALES_FOCUS_DIGEST', 'SOCIAL_INBOX'
  ));

-- ---------------------------------------------------------------------------
-- Connections (Settings → Channels)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('facebook', 'instagram')),
  channel_kind text NOT NULL CHECK (channel_kind IN ('page', 'ig_business')),
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN (
    'connected', 'attention_required', 'disconnected', 'auth_expired', 'sync_issue'
  )),
  external_account_id text NOT NULL,
  display_name text,
  username text,
  page_id text,
  ig_account_id text,
  scopes text[] NOT NULL DEFAULT '{}',
  token_sealed text,
  is_demo boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  last_event_at timestamptz,
  last_error text,
  connected_at timestamptz,
  connected_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, provider, external_account_id)
);

CREATE INDEX IF NOT EXISTS social_channel_connections_client_idx
  ON public.social_channel_connections (client_id, status);

CREATE INDEX IF NOT EXISTS social_channel_connections_external_idx
  ON public.social_channel_connections (provider, external_account_id);

-- ---------------------------------------------------------------------------
-- Social identities (not CRM contacts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('facebook', 'instagram')),
  provider_user_id text NOT NULL,
  display_name text,
  username text,
  avatar_url text,
  locale text,
  match_status text NOT NULL DEFAULT 'unlinked' CHECK (match_status IN (
    'unlinked', 'suggested', 'linked', 'rejected'
  )),
  match_confidence integer,
  suggested_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS social_identities_client_idx
  ON public.social_identities (client_id, match_status);

-- ---------------------------------------------------------------------------
-- Conversations (DMs and comment threads)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.social_channel_connections(id) ON DELETE SET NULL,
  identity_id uuid NOT NULL REFERENCES public.social_identities(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider IN ('facebook', 'instagram')),
  channel text NOT NULL CHECK (channel IN (
    'facebook_messenger',
    'facebook_comment',
    'facebook_ad_comment',
    'instagram_dm',
    'instagram_comment',
    'instagram_ad_comment'
  )),
  conversation_kind text NOT NULL CHECK (conversation_kind IN ('dm', 'comment')),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'waiting_for_customer', 'needs_reply', 'follow_up_required', 'resolved', 'archived'
  )),
  provider_thread_id text,
  unread boolean NOT NULL DEFAULT true,
  assigned_to_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  last_customer_message_at timestamptz,
  last_business_message_at timestamptz,
  last_message_preview text,
  origin_kind text CHECK (origin_kind IS NULL OR origin_kind IN (
    'organic', 'advertisement', 'post', 'reel', 'story', 'unknown'
  )),
  origin_campaign_id text,
  origin_campaign_name text,
  origin_ad_id text,
  origin_ad_name text,
  origin_post_id text,
  origin_permalink text,
  origin_caption text,
  origin_customer_quote text,
  linked_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  linked_deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  linked_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS social_conversations_thread_uidx
  ON public.social_conversations (client_id, provider, provider_thread_id)
  WHERE provider_thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS social_conversations_queue_idx
  ON public.social_conversations (client_id, assigned_to_id, last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS social_conversations_status_idx
  ON public.social_conversations (client_id, status, last_customer_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS social_conversations_kind_idx
  ON public.social_conversations (client_id, conversation_kind, last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS social_conversations_identity_idx
  ON public.social_conversations (client_id, identity_id);

CREATE INDEX IF NOT EXISTS social_conversations_unread_idx
  ON public.social_conversations (client_id, assigned_to_id)
  WHERE unread = true AND status <> 'archived';

-- ---------------------------------------------------------------------------
-- Messages (DM lines and comment replies)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.social_conversations(id) ON DELETE CASCADE,
  identity_id uuid REFERENCES public.social_identities(id) ON DELETE SET NULL,
  provider_message_id text,
  client_idempotency_key text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  body text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_internal_note boolean NOT NULL DEFAULT false,
  reply_to_id uuid REFERENCES public.social_messages(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  send_status text NOT NULL DEFAULT 'sent' CHECK (send_status IN (
    'pending', 'sending', 'sent', 'delivered', 'failed'
  )),
  send_error text,
  ai_draft boolean NOT NULL DEFAULT false,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS social_messages_provider_uidx
  ON public.social_messages (client_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS social_messages_idempotency_uidx
  ON public.social_messages (client_id, client_idempotency_key)
  WHERE client_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS social_messages_conversation_idx
  ON public.social_messages (conversation_id, sent_at);

-- ---------------------------------------------------------------------------
-- Social opportunities (not CRM leads)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.social_conversations(id) ON DELETE CASCADE,
  identity_id uuid NOT NULL REFERENCES public.social_identities(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'reviewing', 'contacted', 'qualified', 'converted', 'not_a_lead', 'disqualified'
  )),
  intent_score integer NOT NULL DEFAULT 0 CHECK (intent_score >= 0 AND intent_score <= 100),
  intent_band text NOT NULL DEFAULT 'cold' CHECK (intent_band IN ('hot', 'warm', 'cold')),
  intent_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  detected_product text,
  detected_location text,
  recommended_action text,
  recommended_action_code text,
  assigned_to_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  follow_up_at timestamptz,
  follow_up_reason text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  last_interaction_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS social_opportunities_client_score_idx
  ON public.social_opportunities (client_id, intent_score DESC, last_interaction_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS social_opportunities_status_idx
  ON public.social_opportunities (client_id, status);

CREATE INDEX IF NOT EXISTS social_opportunities_assignee_idx
  ON public.social_opportunities (client_id, assigned_to_id, follow_up_at);

CREATE INDEX IF NOT EXISTS social_opportunities_follow_up_idx
  ON public.social_opportunities (client_id, follow_up_at)
  WHERE follow_up_at IS NOT NULL AND status NOT IN ('converted', 'not_a_lead', 'disqualified');

-- ---------------------------------------------------------------------------
-- Intent signals (explainable, multi-label)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_intent_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.social_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.social_messages(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.social_opportunities(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  confidence numeric(4,3) NOT NULL DEFAULT 0.5,
  evidence_excerpt text,
  source text NOT NULL DEFAULT 'rules' CHECK (source IN ('rules', 'ai', 'human')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_intent_signals_conversation_idx
  ON public.social_intent_signals (conversation_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- CRM identity links (never silent-merge)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_identity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  identity_id uuid NOT NULL REFERENCES public.social_identities(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  match_kind text NOT NULL CHECK (match_kind IN (
    'manual', 'phone', 'email', 'suggested', 'rejected'
  )),
  confidence integer,
  linked_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, identity_id, contact_id)
);

CREATE INDEX IF NOT EXISTS social_identity_links_contact_idx
  ON public.social_identity_links (client_id, contact_id);

-- ---------------------------------------------------------------------------
-- Webhook idempotency
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  object_type text,
  payload_hash text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN (
    'received', 'processed', 'ignored', 'failed'
  )),
  error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS social_webhook_events_status_idx
  ON public.social_webhook_events (status, created_at)
  WHERE status = 'failed';

-- ---------------------------------------------------------------------------
-- Social audit (no tokens)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name text,
  event_type text NOT NULL,
  conversation_id uuid,
  opportunity_id uuid,
  identity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_audit_events_client_idx
  ON public.social_audit_events (client_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: default deny for anon/authenticated. App uses service role + client_id filters.
-- ---------------------------------------------------------------------------
ALTER TABLE public.social_channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_intent_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.social_channel_connections FROM anon, authenticated;
REVOKE ALL ON public.social_identities FROM anon, authenticated;
REVOKE ALL ON public.social_conversations FROM anon, authenticated;
REVOKE ALL ON public.social_messages FROM anon, authenticated;
REVOKE ALL ON public.social_opportunities FROM anon, authenticated;
REVOKE ALL ON public.social_intent_signals FROM anon, authenticated;
REVOKE ALL ON public.social_identity_links FROM anon, authenticated;
REVOKE ALL ON public.social_webhook_events FROM anon, authenticated;
REVOKE ALL ON public.social_audit_events FROM anon, authenticated;

COMMENT ON TABLE public.social_opportunities IS
  'Sales opportunities from social interactions. Not CRM leads until converted.';
COMMENT ON TABLE public.social_conversations IS
  'Facebook/Instagram DM threads and comment threads scoped to client_id.';
