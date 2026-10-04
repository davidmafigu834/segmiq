-- Phase 6: operations and portal intelligence flags, action audit, usage.

ALTER TABLE public.agent_company_settings
  ADD COLUMN IF NOT EXISTS operations_ai_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.agent_company_settings
  ADD COLUMN IF NOT EXISTS agent_actions_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.customer_portal_settings
  ADD COLUMN IF NOT EXISTS portal_ai_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.ai_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  conversation_id uuid,
  tool_name text NOT NULL,
  risk_level text NOT NULL,
  arguments_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary text,
  approval_required boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  status text NOT NULL DEFAULT 'COMPLETED',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  feature text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  estimated_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
