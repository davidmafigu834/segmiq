-- SegmiQ Agent — Proactive Event layer.
-- Schedules future *evaluations* (decisions), never guaranteed outbound messages.
-- Canonical CRM entities (leads follow-ups, call_logs callbacks, quotations, deals)
-- remain the source of operational work. These tables are the event engine.

-- ---------------------------------------------------------------------------
-- Company kill switches + nested proactive config (same settings row).
ALTER TABLE public.agent_company_settings
  ADD COLUMN IF NOT EXISTS proactive_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proactive_shadow_mode boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS proactive_customer_messaging boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proactive_internal_actions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS proactive_circuit_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proactive_circuit_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS proactive_circuit_reason text,
  ADD COLUMN IF NOT EXISTS proactive_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.agent_company_settings.proactive_enabled IS
  'Manager kill switch for the Proactive Agent. Off = evaluations skip autonomous action.';
COMMENT ON COLUMN public.agent_company_settings.proactive_customer_messaging IS
  'Allow the agent to initiate customer messages (distinct from responding to inbound). Default OFF.';
COMMENT ON COLUMN public.agent_company_settings.proactive_shadow_mode IS
  'Run real evaluations but do not execute customer-facing actions. Default ON.';

-- ---------------------------------------------------------------------------
-- Contact-level do-not-contact (sales/agent outreach). Marketing prefs remain separate.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS do_not_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS do_not_contact_reason text;

CREATE INDEX IF NOT EXISTS idx_contacts_do_not_contact
  ON public.contacts (client_id)
  WHERE do_not_contact = true;

-- Minimal metadata on the canonical follow-up date (not a parallel task table).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS follow_up_source text
    CHECK (follow_up_source IS NULL OR follow_up_source IN (
      'HUMAN_CREATED', 'CUSTOMER_COMMITMENT', 'AGENT_CREATED', 'SYSTEM_POLICY'
    )),
  ADD COLUMN IF NOT EXISTS follow_up_execution_mode text
    CHECK (follow_up_execution_mode IS NULL OR follow_up_execution_mode IN (
      'HUMAN_ONLY', 'AGENT_ALLOWED'
    ));

-- ---------------------------------------------------------------------------
-- Transactional outbox for domain events.
CREATE TABLE IF NOT EXISTS public.agent_domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  actor_type text NOT NULL
    CHECK (actor_type IN ('CUSTOMER', 'HUMAN', 'AGENT', 'SYSTEM')),
  actor_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id uuid,
  causation_id uuid,
  source text,
  version integer NOT NULL DEFAULT 1,
  processed_at timestamptz,
  process_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_agent_domain_events_unprocessed
  ON public.agent_domain_events (created_at)
  WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agent_domain_events_client_time
  ON public.agent_domain_events (client_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_domain_events_entity
  ON public.agent_domain_events (client_id, entity_type, entity_id);

COMMENT ON TABLE public.agent_domain_events IS
  'Outbox of normalized CRM/agent domain events. Idempotent via (client_id, fingerprint).';

-- ---------------------------------------------------------------------------
-- Scheduled evaluations (never scheduled guaranteed messages).
CREATE TABLE IF NOT EXISTS public.agent_proactive_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id uuid,
  quotation_id uuid,
  quotation_version integer,
  appointment_id uuid,
  conversation_id uuid,
  trigger_type text NOT NULL,
  trigger_event_id uuid REFERENCES public.agent_domain_events(id) ON DELETE SET NULL,
  policy_id text NOT NULL DEFAULT 'default',
  attempt_number integer NOT NULL DEFAULT 1,
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN (
      'SCHEDULED', 'EVALUATING', 'WAITING_FOR_POLICY', 'WAITING_FOR_HUMAN',
      'WAITING_FOR_CHANNEL', 'EXECUTING', 'COMPLETED', 'SKIPPED',
      'CANCELLED', 'FAILED', 'EXPIRED'
    )),
  scheduled_at timestamptz NOT NULL,
  stale_after timestamptz,
  evaluated_at timestamptz,
  executed_at timestamptz,
  decision text,
  reason_code text,
  action_type text,
  customer_message text,
  decision_summary text,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_origin text
    CHECK (actor_origin IS NULL OR actor_origin IN ('CUSTOMER', 'HUMAN', 'AGENT', 'SYSTEM')),
  correlation_id uuid,
  causation_id uuid,
  agent_execution_id uuid REFERENCES public.agent_executions(id) ON DELETE SET NULL,
  retry_count integer NOT NULL DEFAULT 0,
  cancelled_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  cancelled_reason text,
  skip_reason text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_agent_proactive_jobs_due
  ON public.agent_proactive_jobs (scheduled_at)
  WHERE status IN ('SCHEDULED', 'WAITING_FOR_CHANNEL');
CREATE INDEX IF NOT EXISTS idx_agent_proactive_jobs_client_status
  ON public.agent_proactive_jobs (client_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_agent_proactive_jobs_lead
  ON public.agent_proactive_jobs (lead_id, status, scheduled_at)
  WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_proactive_jobs_quotation
  ON public.agent_proactive_jobs (quotation_id, status)
  WHERE quotation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_proactive_jobs_appointment
  ON public.agent_proactive_jobs (appointment_id, status)
  WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_proactive_jobs_entity_trigger
  ON public.agent_proactive_jobs (client_id, trigger_type, lead_id);

COMMENT ON TABLE public.agent_proactive_jobs IS
  'Future Proactive Agent evaluations. SKIPPED is success when current state no longer needs action.';

-- ---------------------------------------------------------------------------
-- Execution audit extensions (reuse agent_executions — no second activity system).
ALTER TABLE public.agent_executions
  ADD COLUMN IF NOT EXISTS trigger_kind text NOT NULL DEFAULT 'INBOUND'
    CHECK (trigger_kind IN ('INBOUND', 'PROACTIVE', 'SIMULATION')),
  ADD COLUMN IF NOT EXISTS proactive_job_id uuid REFERENCES public.agent_proactive_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_executions_proactive_job
  ON public.agent_executions (proactive_job_id)
  WHERE proactive_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_executions_trigger_kind
  ON public.agent_executions (client_id, trigger_kind, created_at DESC);

-- ---------------------------------------------------------------------------
-- Structured feedback hook for a later Quality Center (do not build the center yet).
ALTER TABLE public.agent_executions
  ADD COLUMN IF NOT EXISTS quality_feedback text
    CHECK (quality_feedback IS NULL OR quality_feedback IN (
      'HELPFUL', 'NOT_HELPFUL', 'WRONG_TIMING', 'WRONG_MESSAGE', 'SHOULD_NOT_HAVE_CONTACTED'
    ));

ALTER TABLE public.agent_executions
  ADD COLUMN IF NOT EXISTS proactive_touched boolean NOT NULL DEFAULT false;

ALTER TABLE public.agent_domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_proactive_jobs ENABLE ROW LEVEL SECURITY;
