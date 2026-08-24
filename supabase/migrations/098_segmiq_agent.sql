-- SegmiQ Agent MVP — agent-specific persistence only.
-- Business entities (leads, deals, quotations, tasks, calendar) stay canonical.
-- The agent runtime reads/writes those through existing services; these tables
-- hold configuration, execution audit, conversation agent-state, structured
-- customer memory, and human escalations.

-- ---------------------------------------------------------------------------
-- Company-level agent configuration (feature flag + autonomy policy).
CREATE TABLE IF NOT EXISTS public.agent_company_settings (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  autonomy_mode text NOT NULL DEFAULT 'COPILOT'
    CHECK (autonomy_mode IN ('ASSIST', 'COPILOT', 'AUTOPILOT')),

  -- Action-specific capabilities (server-enforced; UI toggles).
  respond_to_enquiries boolean NOT NULL DEFAULT true,
  qualify_leads boolean NOT NULL DEFAULT true,
  create_leads boolean NOT NULL DEFAULT true,
  create_deals boolean NOT NULL DEFAULT true,
  create_tasks boolean NOT NULL DEFAULT true,
  schedule_callbacks boolean NOT NULL DEFAULT true,
  schedule_appointments boolean NOT NULL DEFAULT true,
  reschedule_appointments boolean NOT NULL DEFAULT true,
  prepare_quotations boolean NOT NULL DEFAULT true,
  send_quotations boolean NOT NULL DEFAULT false,
  send_follow_ups boolean NOT NULL DEFAULT true,
  transfer_support boolean NOT NULL DEFAULT true,
  create_support_cases boolean NOT NULL DEFAULT true,
  negotiate_discounts boolean NOT NULL DEFAULT false,

  -- Commercial autonomy limit: max quotation total the agent may send
  -- autonomously (only meaningful when send_quotations = true). NULL = never.
  quote_auto_send_limit numeric,

  -- Business hours behaviour.
  business_hours_policy text NOT NULL DEFAULT 'ALWAYS'
    CHECK (business_hours_policy IN ('ALWAYS', 'BUSINESS_HOURS_ONLY', 'AFTER_HOURS_ACK')),

  -- Voice & tone (sanitized before prompt assembly; never raw prompt text).
  disclosure_text text,
  tone text NOT NULL DEFAULT 'professional'
    CHECK (tone IN ('professional', 'friendly', 'concise')),
  language_preference text,

  -- Escalation routing.
  escalation_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,

  -- Guardrails.
  max_questions_per_message integer NOT NULL DEFAULT 2
    CHECK (max_questions_per_message BETWEEN 1 AND 5),
  debounce_seconds integer NOT NULL DEFAULT 6
    CHECK (debounce_seconds BETWEEN 0 AND 60),
  daily_execution_limit integer NOT NULL DEFAULT 300,
  conversation_hourly_limit integer NOT NULL DEFAULT 12,
  test_mode boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_company_settings IS
  'Per-company SegmiQ Agent feature flag, autonomy mode, capability toggles and guardrails.';

-- ---------------------------------------------------------------------------
-- One row per agent run. No hidden chain-of-thought is ever stored here —
-- decision_summary/evidence are structured, audit-safe fields.
CREATE TABLE IF NOT EXISTS public.agent_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  trigger_message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  state text NOT NULL DEFAULT 'QUEUED'
    CHECK (state IN (
      'QUEUED', 'RUNNING', 'WAITING_FOR_TOOL', 'WAITING_FOR_HUMAN',
      'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED'
    )),
  autonomy_mode text,
  model text,
  prompt_version text,
  intents text[] NOT NULL DEFAULT '{}',
  confidence numeric,
  decision_summary text,
  evidence text,
  customer_reply text,
  reply_status text
    CHECK (reply_status IS NULL OR reply_status IN ('SENT', 'DRAFTED', 'SUPPRESSED', 'FAILED')),
  error_code text,
  error_message text,
  input_tokens integer,
  output_tokens integer,
  tool_call_count integer NOT NULL DEFAULT 0,
  latency_ms integer,
  -- Conversation version the run reasoned against (latest whatsapp_messages id
  -- at context-assembly time). Used to detect human-response races before send.
  context_version uuid,
  test_mode boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- One execution per inbound trigger message (webhook retry / replay guard).
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_executions_trigger_unique
  ON public.agent_executions (trigger_message_id)
  WHERE trigger_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_executions_client_created
  ON public.agent_executions (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_executions_client_state
  ON public.agent_executions (client_id, state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_executions_lead
  ON public.agent_executions (lead_id, created_at DESC);

COMMENT ON TABLE public.agent_executions IS
  'Audit record for each SegmiQ Agent run. Stores decision summaries and evidence only, never model chain-of-thought.';

-- ---------------------------------------------------------------------------
-- Tool-level audit for every action the model requested.
CREATE TABLE IF NOT EXISTS public.agent_execution_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.agent_executions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  risk_level text NOT NULL
    CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH')),
  status text NOT NULL
    CHECK (status IN ('EXECUTED', 'BLOCKED', 'FAILED', 'SIMULATED', 'INVALID')),
  input_summary jsonb,
  result_summary jsonb,
  blocked_reason text,
  error text,
  created_record_type text,
  created_record_id text,
  performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_execution_actions_execution
  ON public.agent_execution_actions (execution_id, performed_at);

CREATE INDEX IF NOT EXISTS idx_agent_execution_actions_client
  ON public.agent_execution_actions (client_id, performed_at DESC);

COMMENT ON TABLE public.agent_execution_actions IS
  'Per-tool audit: what the model requested, whether policy allowed it, and what happened. Secrets and protected commercial data are never persisted here.';

-- ---------------------------------------------------------------------------
-- Agent state for a conversation (the Lead-backed WhatsApp thread).
-- Deliberately separate from whatsapp_conversation_status (workflow) and
-- lead/deal lifecycle.
CREATE TABLE IF NOT EXISTS public.agent_conversation_state (
  lead_id uuid PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agent_enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'IDLE'
    CHECK (status IN (
      'IDLE', 'AI_HANDLING', 'HUMAN_NEEDED', 'PAUSED',
      'WAITING_ON_CUSTOMER', 'FOLLOW_UP_SCHEDULED', 'HUMAN_HANDLING'
    )),
  human_needed_reason text,
  paused_until timestamptz,
  paused_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  pause_reason text,
  human_takeover boolean NOT NULL DEFAULT false,
  last_agent_message_at timestamptz,
  last_human_message_at timestamptz,
  last_customer_message_at timestamptz,
  -- Execution lock: only one active run may own a conversation at a time.
  pending_execution_id uuid REFERENCES public.agent_executions(id) ON DELETE SET NULL,
  lock_acquired_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversation_state_client_status
  ON public.agent_conversation_state (client_id, status, updated_at DESC);

COMMENT ON TABLE public.agent_conversation_state IS
  'SegmiQ Agent state per WhatsApp conversation (Lead thread). Independent of conversation workflow status and Lead/Deal lifecycle.';

-- ---------------------------------------------------------------------------
-- Structured customer memory keyed by contact. Values carry source,
-- confidence, evidence and supersession history inside the jsonb document.
CREATE TABLE IF NOT EXISTS public.agent_customer_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  memory jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_customer_memory_contact
  ON public.agent_customer_memory (contact_id);

COMMENT ON TABLE public.agent_customer_memory IS
  'Structured, superseding customer memory (preferences, requirements, commercial, timing, concerns, commitments). Canonical CRM fields always take priority on conflict.';

-- ---------------------------------------------------------------------------
-- Human escalations raised by the agent.
CREATE TABLE IF NOT EXISTS public.agent_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  execution_id uuid REFERENCES public.agent_executions(id) ON DELETE SET NULL,
  reason text NOT NULL
    CHECK (reason IN (
      'LOW_CONFIDENCE', 'CUSTOMER_REQUESTED_HUMAN', 'PRICING_DISPUTE',
      'COMPLAINT', 'TECHNICAL_RISK', 'COMMERCIAL_APPROVAL',
      'UNSUPPORTED_REQUEST', 'POLICY_BLOCKED', 'CONFLICTING_CUSTOMER_DATA',
      'SYSTEM_FAILURE', 'RATE_LIMITED', 'ATTACHMENT_REVIEW'
    )),
  severity text NOT NULL DEFAULT 'MEDIUM'
    CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  summary text NOT NULL,
  briefing jsonb,
  assigned_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_escalations_client_status
  ON public.agent_escalations (client_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_escalations_lead
  ON public.agent_escalations (lead_id, created_at DESC);

COMMENT ON TABLE public.agent_escalations IS
  'Human-needed handoffs created by SegmiQ Agent, with structured briefing.';

-- ---------------------------------------------------------------------------
-- In-app notification type for agent events (human needed, quote ready, etc).
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'NEW_LEAD', 'WHATSAPP_MESSAGE', 'WHATSAPP_CONNECTION_ALERT', 'FOLLOW_UP_DUE', 'FOLLOW_UP_PREP',
    'DEAL_WON', 'LEAD_FLAG', 'UNCONTACTED_MANAGER_ALERT', 'FB_TOKEN_EXPIRED', 'BACKFILL_COMPLETE',
    'PHOTO_UPLOADED', 'STORAGE_WARNING', 'TEAM_MEMBER_JOINED', 'QUOTATION_ALERT', 'AGENT_ALERT'
  ));

-- ---------------------------------------------------------------------------
ALTER TABLE public.agent_company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_customer_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_escalations ENABLE ROW LEVEL SECURITY;
