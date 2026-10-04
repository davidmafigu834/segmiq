-- Trades operations phase 1: delivery projects.
-- Additive. Does not alter Cloud portfolio public.projects, deals, quotations, or billing.

CREATE TABLE IF NOT EXISTS public.work_project_counters (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  next_number integer NOT NULL DEFAULT 1 CHECK (next_number > 0)
);

CREATE OR REPLACE FUNCTION public.allocate_work_project_number(p_client_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO public.work_project_counters (client_id, next_number)
  VALUES (p_client_id, 2)
  ON CONFLICT (client_id) DO UPDATE
    SET next_number = public.work_project_counters.next_number + 1
  RETURNING public.work_project_counters.next_number - 1 INTO n;

  RETURN 'PRJ-' || lpad(n::text, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_work_project_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_work_project_number(uuid) TO service_role;

CREATE TABLE IF NOT EXISTS public.work_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_number text NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  project_type text,
  workflow_key text NOT NULL DEFAULT 'GENERAL_TRADES'
    CHECK (workflow_key IN ('GENERAL_TRADES', 'SOLAR_INSTALLATION')),
  status text NOT NULL DEFAULT 'PLANNING'
    CHECK (status IN (
      'PLANNING',
      'SITE_ASSESSMENT',
      'AWAITING_CUSTOMER',
      'READY_TO_SCHEDULE',
      'SCHEDULED',
      'IN_PROGRESS',
      'QUALITY_CHECK',
      'HANDOVER',
      'COMPLETED',
      'ON_HOLD',
      'CANCELLED'
    )),
  project_value numeric CHECK (project_value IS NULL OR project_value >= 0),
  currency text NOT NULL DEFAULT 'USD',
  site_name text,
  site_address text,
  site_city text,
  site_notes text,
  project_owner_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  planned_start_date date,
  scheduled_start_at timestamptz,
  actual_start_at timestamptz,
  target_completion_date date,
  actual_completion_at timestamptz,
  priority text NOT NULL DEFAULT 'NORMAL'
    CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  customer_requirements text,
  internal_notes text,
  next_step text,
  cancellation_reason text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  UNIQUE (client_id, project_number)
);

COMMENT ON TABLE public.work_projects IS
  'Operational delivery projects for trades companies. Not the Cloud portfolio projects table.';

CREATE UNIQUE INDEX IF NOT EXISTS work_projects_client_deal_uidx
  ON public.work_projects (client_id, deal_id)
  WHERE deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS work_projects_client_status_idx
  ON public.work_projects (client_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS work_projects_client_owner_idx
  ON public.work_projects (client_id, project_owner_id);

CREATE INDEX IF NOT EXISTS work_projects_client_target_idx
  ON public.work_projects (client_id, target_completion_date);

CREATE TABLE IF NOT EXISTS public.work_project_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.work_projects(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_project_events_project_idx
  ON public.work_project_events (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS work_project_events_client_idx
  ON public.work_project_events (client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.work_project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.work_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_role text NOT NULL DEFAULT 'MEMBER'
    CHECK (project_role IN ('OWNER', 'MEMBER')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS work_project_members_user_idx
  ON public.work_project_members (client_id, user_id);

COMMENT ON TABLE public.work_project_members IS
  'Project membership. Phase 1 roles are OWNER and MEMBER. Field roles can be added later without a new relationship.';

ALTER TABLE public.work_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_counters ENABLE ROW LEVEL SECURITY;

-- Nullable link so a later phase can attach a support case to delivery.
-- Existing support cases stay valid. No application behaviour changes in this migration.
ALTER TABLE public.support_cases
  ADD COLUMN IF NOT EXISTS work_project_id uuid REFERENCES public.work_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS support_cases_work_project_idx
  ON public.support_cases (work_project_id)
  WHERE work_project_id IS NOT NULL;

-- PROJECT remains the Cloud portfolio link. WORK_PROJECT is the delivery project.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'document_entity_links'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%entity_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.document_entity_links DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.document_entity_links
  ADD CONSTRAINT document_entity_links_entity_type_check
  CHECK (entity_type IN (
    'CUSTOMER', 'LEAD', 'DEAL', 'QUOTATION',
    'PRODUCT', 'PACKAGE', 'PROJECT', 'USER', 'TEAM', 'SUPPORT_CASE',
    'WORK_PROJECT'
  ));

CREATE OR REPLACE FUNCTION public.insert_work_project(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_client_id uuid := (p_payload->>'client_id')::uuid;
  v_deal_id uuid := NULLIF(p_payload->>'deal_id', '')::uuid;
  v_existing uuid;
  v_id uuid;
  v_number text;
  v_owner uuid := NULLIF(p_payload->>'project_owner_id', '')::uuid;
BEGIN
  IF v_deal_id IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.work_projects
    WHERE client_id = v_client_id AND deal_id = v_deal_id
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('id', v_existing, 'created', false);
    END IF;
  END IF;

  v_number := public.allocate_work_project_number(v_client_id);

  INSERT INTO public.work_projects (
    client_id, project_number, contact_id, lead_id, deal_id, quotation_id,
    title, description, project_type, workflow_key, status,
    project_value, currency,
    site_name, site_address, site_city, site_notes,
    project_owner_id,
    planned_start_date, scheduled_start_at, target_completion_date,
    priority, customer_requirements, internal_notes, next_step,
    created_by
  ) VALUES (
    v_client_id,
    v_number,
    NULLIF(p_payload->>'contact_id', '')::uuid,
    NULLIF(p_payload->>'lead_id', '')::uuid,
    v_deal_id,
    NULLIF(p_payload->>'quotation_id', '')::uuid,
    p_payload->>'title',
    NULLIF(p_payload->>'description', ''),
    NULLIF(p_payload->>'project_type', ''),
    COALESCE(NULLIF(p_payload->>'workflow_key', ''), 'GENERAL_TRADES'),
    'PLANNING',
    NULLIF(p_payload->>'project_value', '')::numeric,
    COALESCE(NULLIF(p_payload->>'currency', ''), 'USD'),
    NULLIF(p_payload->>'site_name', ''),
    NULLIF(p_payload->>'site_address', ''),
    NULLIF(p_payload->>'site_city', ''),
    NULLIF(p_payload->>'site_notes', ''),
    v_owner,
    NULLIF(p_payload->>'planned_start_date', '')::date,
    NULLIF(p_payload->>'scheduled_start_at', '')::timestamptz,
    NULLIF(p_payload->>'target_completion_date', '')::date,
    COALESCE(NULLIF(p_payload->>'priority', ''), 'NORMAL'),
    NULLIF(p_payload->>'customer_requirements', ''),
    NULLIF(p_payload->>'internal_notes', ''),
    NULLIF(p_payload->>'next_step', ''),
    NULLIF(p_payload->>'created_by', '')::uuid
  )
  RETURNING id INTO v_id;

  INSERT INTO public.work_project_events (
    client_id, project_id, event_type, title, description, actor_user_id, metadata
  ) VALUES (
    v_client_id,
    v_id,
    'PROJECT_CREATED',
    'Project created',
    NULLIF(p_payload->>'title', ''),
    NULLIF(p_payload->>'created_by', '')::uuid,
    jsonb_build_object(
      'project_number', v_number,
      'deal_id', v_deal_id,
      'workflow_key', COALESCE(NULLIF(p_payload->>'workflow_key', ''), 'GENERAL_TRADES')
    )
  );

  IF v_owner IS NOT NULL THEN
    INSERT INTO public.work_project_members (client_id, project_id, user_id, project_role)
    VALUES (v_client_id, v_id, v_owner, 'OWNER')
    ON CONFLICT (project_id, user_id) DO UPDATE SET project_role = 'OWNER';
  END IF;

  RETURN jsonb_build_object('id', v_id, 'created', true, 'project_number', v_number);
EXCEPTION
  WHEN unique_violation THEN
    IF v_deal_id IS NOT NULL THEN
      SELECT id INTO v_existing
      FROM public.work_projects
      WHERE client_id = v_client_id AND deal_id = v_deal_id
      LIMIT 1;
      IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('id', v_existing, 'created', false);
      END IF;
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_work_project(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_work_project(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.set_work_project_status(
  p_client_id uuid,
  p_project_id uuid,
  p_status text,
  p_actor_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_prev text;
  v_event text;
  v_title text;
BEGIN
  SELECT status INTO v_prev
  FROM public.work_projects
  WHERE id = p_project_id AND client_id = p_client_id
  FOR UPDATE;

  IF v_prev IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_prev = p_status THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true, 'status', v_prev);
  END IF;

  UPDATE public.work_projects
  SET
    status = p_status,
    updated_at = now(),
    actual_start_at = CASE
      WHEN p_status = 'IN_PROGRESS' AND actual_start_at IS NULL THEN now()
      ELSE actual_start_at
    END,
    actual_completion_at = CASE
      WHEN p_status = 'COMPLETED' AND actual_completion_at IS NULL THEN now()
      ELSE actual_completion_at
    END,
    completed_at = CASE
      WHEN p_status = 'COMPLETED' AND completed_at IS NULL THEN now()
      ELSE completed_at
    END,
    cancelled_at = CASE
      WHEN p_status = 'CANCELLED' AND cancelled_at IS NULL THEN now()
      ELSE cancelled_at
    END,
    cancellation_reason = CASE
      WHEN p_status = 'CANCELLED' THEN NULLIF(btrim(COALESCE(p_reason, '')), '')
      ELSE cancellation_reason
    END
  WHERE id = p_project_id AND client_id = p_client_id;

  IF p_status = 'COMPLETED' THEN
    v_event := 'PROJECT_COMPLETED';
    v_title := 'Project completed';
  ELSIF p_status = 'CANCELLED' THEN
    v_event := 'PROJECT_CANCELLED';
    v_title := 'Project cancelled';
  ELSIF v_prev IN ('COMPLETED', 'CANCELLED') THEN
    v_event := 'PROJECT_REOPENED';
    v_title := 'Project reopened';
  ELSE
    v_event := 'STATUS_CHANGED';
    v_title := 'Status changed';
  END IF;

  INSERT INTO public.work_project_events (
    client_id, project_id, event_type, title, description, actor_user_id, metadata
  ) VALUES (
    p_client_id,
    p_project_id,
    v_event,
    v_title,
    NULLIF(btrim(COALESCE(p_reason, '')), ''),
    p_actor_id,
    jsonb_build_object('from_status', v_prev, 'to_status', p_status, 'reason', NULLIF(btrim(COALESCE(p_reason, '')), ''))
  );

  RETURN jsonb_build_object('ok', true, 'status', p_status, 'event_type', v_event);
END;
$$;

REVOKE ALL ON FUNCTION public.set_work_project_status(uuid, uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_work_project_status(uuid, uuid, text, uuid, text) TO service_role;
