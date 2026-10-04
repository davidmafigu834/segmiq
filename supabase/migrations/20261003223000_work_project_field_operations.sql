-- Trades operations phase 2: project roles, tasks, field visits, assessments.
-- Additive. Does not alter Cloud portfolio projects, deals, quotations, billing, or inventory.

ALTER TABLE public.work_project_members
  DROP CONSTRAINT IF EXISTS work_project_members_project_role_check;

ALTER TABLE public.work_project_members
  ADD CONSTRAINT work_project_members_project_role_check
  CHECK (project_role IN (
    'OWNER',
    'PROJECT_MANAGER',
    'SALES_COORDINATOR',
    'ENGINEER',
    'TECHNICIAN',
    'INSTALLER',
    'FIELD_AGENT',
    'MEMBER'
  ));

COMMENT ON TABLE public.work_project_members IS
  'Project membership. project_role is a job role on this project, not a SegmiQ account role.';

CREATE TABLE IF NOT EXISTS public.work_project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.work_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  task_type text NOT NULL DEFAULT 'GENERAL'
    CHECK (task_type IN (
      'GENERAL', 'SITE_ASSESSMENT', 'CUSTOMER_ACTION', 'TECHNICAL',
      'INSTALLATION_PREP', 'DOCUMENTATION', 'QUALITY', 'OTHER'
    )),
  status text NOT NULL DEFAULT 'TODO'
    CHECK (status IN ('TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED')),
  priority text NOT NULL DEFAULT 'NORMAL'
    CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  assigned_to_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_project_tasks_project_idx
  ON public.work_project_tasks (project_id, status, due_at);

CREATE INDEX IF NOT EXISTS work_project_tasks_assignee_idx
  ON public.work_project_tasks (client_id, assigned_to_id, status);

CREATE TABLE IF NOT EXISTS public.work_project_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.work_projects(id) ON DELETE CASCADE,
  visit_type text NOT NULL
    CHECK (visit_type IN (
      'SITE_ASSESSMENT', 'INSTALLATION', 'INSPECTION', 'CUSTOMER_MEETING',
      'MAINTENANCE', 'SERVICE', 'OTHER'
    )),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN (
      'DRAFT', 'SCHEDULED', 'ON_SITE', 'COMPLETED', 'CANCELLED', 'NO_ACCESS', 'RESCHEDULED'
    )),
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  site_name text,
  site_address text,
  site_city text,
  assigned_lead_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  customer_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  instructions text,
  outcome_summary text,
  cancellation_reason text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

CREATE INDEX IF NOT EXISTS work_project_visits_project_idx
  ON public.work_project_visits (project_id, scheduled_start_at);

CREATE INDEX IF NOT EXISTS work_project_visits_client_start_idx
  ON public.work_project_visits (client_id, scheduled_start_at);

CREATE TABLE IF NOT EXISTS public.work_project_visit_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL REFERENCES public.work_project_visits(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.work_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visit_id, user_id)
);

CREATE INDEX IF NOT EXISTS work_project_visit_assignees_user_idx
  ON public.work_project_visit_assignees (client_id, user_id);

CREATE TABLE IF NOT EXISTS public.work_project_visit_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.work_projects(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL UNIQUE REFERENCES public.work_project_visits(id) ON DELETE CASCADE,
  assessment_type text NOT NULL DEFAULT 'SITE_ASSESSMENT',
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_project_visit_assessments_project_idx
  ON public.work_project_visit_assessments (project_id, status);

ALTER TABLE public.work_project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_visit_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_visit_assessments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.document_entity_links
  DROP CONSTRAINT IF EXISTS document_entity_links_entity_type_check;

ALTER TABLE public.document_entity_links
  ADD CONSTRAINT document_entity_links_entity_type_check
  CHECK (entity_type IN (
    'CUSTOMER', 'LEAD', 'DEAL', 'QUOTATION',
    'PRODUCT', 'PACKAGE', 'PROJECT', 'USER', 'TEAM', 'SUPPORT_CASE',
    'WORK_PROJECT', 'WORK_PROJECT_VISIT'
  ));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'NEW_LEAD', 'WHATSAPP_MESSAGE', 'WHATSAPP_CONNECTION_ALERT', 'FOLLOW_UP_DUE',
    'FOLLOW_UP_PREP', 'DEAL_WON', 'LEAD_FLAG', 'UNCONTACTED_MANAGER_ALERT',
    'FB_TOKEN_EXPIRED', 'BACKFILL_COMPLETE', 'PHOTO_UPLOADED', 'STORAGE_WARNING',
    'TEAM_MEMBER_JOINED', 'QUOTATION_ALERT', 'AGENT_ALERT', 'INVENTORY_ALERT',
    'COMMERCIAL_IMPORT', 'LEARNING_ALERT', 'COMPLIANCE_ALERT', 'SALES_FOCUS_DIGEST',
    'SOCIAL_INBOX', 'WEEKLY_TEAM_REPORT', 'WORK_PROJECT_ALERT'
  ]));

CREATE OR REPLACE FUNCTION public.complete_work_project_assessment(
  p_client_id uuid,
  p_visit_id uuid,
  p_actor_id uuid,
  p_summary text,
  p_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_project uuid;
  v_status text;
  v_type text;
  v_assessment uuid;
  v_assessment_status text;
BEGIN
  SELECT project_id, status, visit_type
    INTO v_project, v_status, v_type
  FROM public.work_project_visits
  WHERE id = p_visit_id AND client_id = p_client_id
  FOR UPDATE;

  IF v_project IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_status IN ('CANCELLED', 'NO_ACCESS') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'closed');
  END IF;

  SELECT id, status INTO v_assessment, v_assessment_status
  FROM public.work_project_visit_assessments
  WHERE visit_id = p_visit_id
  FOR UPDATE;

  IF v_status = 'COMPLETED' AND v_assessment_status = 'COMPLETED' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'project_id', v_project);
  END IF;

  IF v_assessment IS NULL THEN
    INSERT INTO public.work_project_visit_assessments (
      client_id, project_id, visit_id, assessment_type, schema_version, status,
      data, summary, completed_at, completed_by
    ) VALUES (
      p_client_id, v_project, p_visit_id, 'SITE_ASSESSMENT', 1, 'COMPLETED',
      COALESCE(p_data, '{}'::jsonb), NULLIF(btrim(COALESCE(p_summary, '')), ''),
      now(), p_actor_id
    );
  ELSE
    UPDATE public.work_project_visit_assessments
    SET status = 'COMPLETED',
        data = COALESCE(p_data, data),
        summary = NULLIF(btrim(COALESCE(p_summary, '')), ''),
        completed_at = COALESCE(completed_at, now()),
        completed_by = COALESCE(completed_by, p_actor_id),
        updated_at = now()
    WHERE id = v_assessment;
  END IF;

  UPDATE public.work_project_visits
  SET status = 'COMPLETED',
      actual_end_at = COALESCE(actual_end_at, now()),
      actual_start_at = COALESCE(actual_start_at, now()),
      outcome_summary = COALESCE(NULLIF(btrim(COALESCE(p_summary, '')), ''), outcome_summary),
      updated_at = now()
  WHERE id = p_visit_id;

  INSERT INTO public.work_project_events (
    client_id, project_id, event_type, title, description, actor_user_id, metadata
  ) VALUES
  (
    p_client_id, v_project, 'VISIT_COMPLETED', 'Visit completed',
    NULLIF(btrim(COALESCE(p_summary, '')), ''), p_actor_id,
    jsonb_build_object('visit_id', p_visit_id, 'visit_type', v_type)
  ),
  (
    p_client_id, v_project, 'SITE_ASSESSMENT_COMPLETED', 'Site assessment completed',
    NULLIF(btrim(COALESCE(p_summary, '')), ''), p_actor_id,
    jsonb_build_object('visit_id', p_visit_id)
  );

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'project_id', v_project);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_work_project_assessment(uuid, uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_work_project_assessment(uuid, uuid, uuid, text, jsonb) TO service_role;
