-- SegmiQ Agent Learning
-- Observation creates evidence. Approval establishes knowledge.
-- Learning is tenant-scoped, asynchronous, and independent of Customer Agent.

-- ---------------------------------------------------------------------------
-- Company settings: Learning is a separate capability from Customer / Proactive.
-- ---------------------------------------------------------------------------
ALTER TABLE public.agent_company_settings
  ADD COLUMN IF NOT EXISTS learning_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suggest_replies boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS learning_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.agent_company_settings.learning_enabled IS
  'Independent of Customer Agent. When true, SegmiQ observes eligible human conversations.';
COMMENT ON COLUMN public.agent_company_settings.suggest_replies IS
  'Copilot / suggest-reply. May be on while Customer Agent is off. Never sends to customers by itself.';
COMMENT ON COLUMN public.agent_company_settings.learning_config IS
  'Learning sources, idle window, budgets. Never trusted as model-produced JSON.';

-- Knowledge used on a completed agent run (audit-safe IDs only).
ALTER TABLE public.agent_executions
  ADD COLUMN IF NOT EXISTS knowledge_used jsonb;

-- ---------------------------------------------------------------------------
-- Conversation exclusions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_learning_exclusions (
  conversation_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  excluded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  excluded_at timestamptz NOT NULL DEFAULT now(),
  reason text CHECK (
    reason IS NULL OR reason IN (
      'SENSITIVE_CUSTOMER', 'LEGAL_MATTER', 'UNUSUAL_EXCEPTION',
      'CONFIDENTIAL_NEGOTIATION', 'OTHER'
    )
  ),
  note text,
  PRIMARY KEY (client_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS agent_learning_exclusions_client_idx
  ON public.agent_learning_exclusions (client_id);

-- Per-conversation analysis cursor (segment, not every message).
CREATE TABLE IF NOT EXISTS public.agent_learning_cursors (
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  last_analyzed_message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  last_analyzed_at timestamptz,
  last_job_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, conversation_id)
);

-- ---------------------------------------------------------------------------
-- Jobs — same claim/retry pattern as proactive, dedicated table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_learning_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN (
    'CONVERSATION_SEGMENT', 'HUMAN_CORRECTION', 'TEACH_SEGMIQ',
    'MANAGER_FEEDBACK', 'DEAL_PROGRESS', 'QUOTATION_EVENT',
    'APPOINTMENT_EVENT', 'HUMAN_TAKEOVER', 'DAILY_BATCH', 'BRAIN_UPDATED'
  )),
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN (
    'QUEUED', 'PROCESSING', 'COMPLETED', 'SKIPPED', 'FAILED'
  )),
  skip_reason text,
  failure_reason text,
  retry_count integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  extractor_version text,
  model_provider text,
  model_version text,
  prompt_version text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS agent_learning_jobs_due_idx
  ON public.agent_learning_jobs (scheduled_at)
  WHERE status = 'QUEUED';
CREATE INDEX IF NOT EXISTS agent_learning_jobs_client_status_idx
  ON public.agent_learning_jobs (client_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Candidates, evidence, approved knowledge
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_learning_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'NEW_KNOWLEDGE', 'REINFORCEMENT', 'CONFLICT', 'CORRECTION',
    'TERMINOLOGY', 'BEHAVIOR_PATTERN'
  )),
  category text NOT NULL CHECK (category IN (
    'TONE', 'QUALIFICATION', 'FAQ', 'OBJECTION_HANDLING', 'PRODUCT_EXPLANATION',
    'SALES_PROCESS', 'ESCALATION', 'FOLLOW_UP', 'CUSTOMER_LANGUAGE',
    'CLOSING_PATTERN', 'APPOINTMENT_PATTERN', 'SUPPORT_PATTERN', 'COMMERCIAL_PATTERN'
  )),
  title text NOT NULL,
  summary text NOT NULL,
  proposed_learning text NOT NULL,
  original_proposed_learning text,
  confidence_level text NOT NULL DEFAULT 'LOW' CHECK (confidence_level IN ('LOW', 'MEDIUM', 'HIGH')),
  confidence_score numeric,
  evidence_count integer NOT NULL DEFAULT 0,
  conversation_count integer NOT NULL DEFAULT 0,
  salesperson_count integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'MEDIUM' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH')),
  comparison_state text NOT NULL DEFAULT 'NEW' CHECK (comparison_state IN (
    'NEW', 'SUPPORTS_EXISTING', 'CONFLICTS', 'DUPLICATES'
  )),
  existing_knowledge_type text,
  existing_knowledge_id uuid,
  existing_knowledge_summary text,
  status text NOT NULL DEFAULT 'DETECTED' CHECK (status IN (
    'DETECTED', 'REVIEWING', 'APPROVED', 'REJECTED', 'MERGED', 'EXPIRED'
  )),
  semantic_key text NOT NULL,
  previously_rejected boolean NOT NULL DEFAULT false,
  resurfaced_at timestamptz,
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  rejection_reason text,
  manager_feedback text CHECK (
    manager_feedback IS NULL OR manager_feedback IN (
      'USEFUL', 'INCORRECT', 'TOO_SPECIFIC', 'ONE_OFF_EXCEPTION', 'ALREADY_KNOWN', 'UNSAFE'
    )
  ),
  manager_comment text,
  source text NOT NULL DEFAULT 'CONVERSATION_SEGMENT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_learning_candidates_client_status_idx
  ON public.agent_learning_candidates (client_id, status, last_observed_at DESC);
CREATE INDEX IF NOT EXISTS agent_learning_candidates_semantic_idx
  ON public.agent_learning_candidates (client_id, semantic_key, status);
CREATE INDEX IF NOT EXISTS agent_learning_candidates_conflict_idx
  ON public.agent_learning_candidates (client_id, comparison_state)
  WHERE comparison_state = 'CONFLICTS';

CREATE TABLE IF NOT EXISTS public.agent_learning_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.agent_learning_candidates(id) ON DELETE CASCADE,
  knowledge_id uuid,
  conversation_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  message_ids uuid[] NOT NULL DEFAULT '{}',
  segment_start_message_id uuid,
  segment_end_message_id uuid,
  salesperson_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  customer_id uuid,
  deal_id uuid,
  source_type text NOT NULL,
  excerpt text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  fingerprint text NOT NULL,
  outcome_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS agent_learning_evidence_candidate_idx
  ON public.agent_learning_evidence (candidate_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS agent_learning_evidence_conversation_idx
  ON public.agent_learning_evidence (client_id, conversation_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_learning_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.agent_learning_candidates(id) ON DELETE SET NULL,
  category text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  original_content text,
  source text NOT NULL CHECK (source IN (
    'SALES_TEAM_LEARNING', 'MANAGER_TAUGHT', 'HUMAN_CORRECTION'
  )),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN (
    'ACTIVE', 'INACTIVE', 'SUPERSEDED', 'NEEDS_REVIEW'
  )),
  confidence_level text NOT NULL DEFAULT 'MEDIUM',
  evidence_count integer NOT NULL DEFAULT 0,
  conversation_count integer NOT NULL DEFAULT 0,
  salesperson_count integer NOT NULL DEFAULT 0,
  usage_count integer NOT NULL DEFAULT 0,
  approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  first_observed_at timestamptz,
  last_observed_at timestamptz,
  last_reinforced_at timestamptz,
  destination_type text,
  destination_id uuid,
  superseded_by uuid REFERENCES public.agent_learning_knowledge(id) ON DELETE SET NULL,
  intent_hints text[] NOT NULL DEFAULT '{}',
  semantic_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_learning_knowledge_active_idx
  ON public.agent_learning_knowledge (client_id, status, category)
  WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS agent_learning_knowledge_semantic_idx
  ON public.agent_learning_knowledge (client_id, semantic_key);

CREATE TABLE IF NOT EXISTS public.agent_learning_knowledge_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id uuid NOT NULL REFERENCES public.agent_learning_knowledge(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  content text NOT NULL,
  title text NOT NULL,
  changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  change_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_learning_terminology (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  phrase text NOT NULL,
  canonical_meaning text NOT NULL,
  confidence_level text NOT NULL DEFAULT 'LOW',
  source text NOT NULL DEFAULT 'SALES_TEAM_LEARNING',
  approved boolean NOT NULL DEFAULT false,
  evidence_count integer NOT NULL DEFAULT 0,
  candidate_id uuid REFERENCES public.agent_learning_candidates(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, phrase)
);

CREATE TABLE IF NOT EXISTS public.agent_learning_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  semantic_key text NOT NULL,
  rejected_candidate_id uuid REFERENCES public.agent_learning_candidates(id) ON DELETE SET NULL,
  rejected_at timestamptz NOT NULL DEFAULT now(),
  rejected_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  evidence_at_rejection integer NOT NULL DEFAULT 0,
  UNIQUE (client_id, semantic_key)
);

CREATE TABLE IF NOT EXISTS public.agent_learning_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  summary text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_learning_audit_client_idx
  ON public.agent_learning_audit (client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_learning_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  knowledge_id uuid NOT NULL REFERENCES public.agent_learning_knowledge(id) ON DELETE CASCADE,
  execution_id uuid,
  conversation_id uuid,
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_learning_usage_knowledge_idx
  ON public.agent_learning_usage (knowledge_id, used_at DESC);

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
    'INVENTORY_ALERT', 'COMMERCIAL_IMPORT', 'LEARNING_ALERT'
  ));

-- ---------------------------------------------------------------------------
-- RLS (service role bypasses; no anon/authenticated policies)
-- ---------------------------------------------------------------------------
ALTER TABLE public.agent_learning_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_learning_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_learning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_learning_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_learning_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_learning_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_learning_knowledge_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_learning_terminology ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_learning_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_learning_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_learning_usage ENABLE ROW LEVEL SECURITY;
