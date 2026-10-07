-- Solar pre-sale workflow.
-- Display stage is derived from leads, deals, sales visits, and quotations.
-- sales_commercial_intent stores only the manual states SITE_VISIT_REQUIRED and NEGOTIATING.
-- Existing deal stages are not rewritten. Solar companies opt in via sales_workflow_preset.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS sales_workflow_preset text NOT NULL DEFAULT 'GENERAL_TRADES';

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_sales_workflow_preset_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_sales_workflow_preset_check
  CHECK (sales_workflow_preset IN ('GENERAL_TRADES', 'SOLAR_INSTALLATION'));

COMMENT ON COLUMN public.clients.sales_workflow_preset IS
  'Sales pipeline preset. GENERAL_TRADES keeps the existing deal stages. SOLAR_INSTALLATION derives the solar pre-sale workflow. Not applied automatically.';

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS sales_commercial_intent text;

ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_sales_commercial_intent_check;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_sales_commercial_intent_check
  CHECK (
    sales_commercial_intent IS NULL
    OR sales_commercial_intent IN ('SITE_VISIT_REQUIRED', 'NEGOTIATING')
  );

COMMENT ON COLUMN public.deals.sales_commercial_intent IS
  'Narrow manual solar sales state. Quote sent, visit completion, proposal prepared, won, and lost are derived from their own records.';

CREATE TABLE IF NOT EXISTS public.sales_site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED', 'ON_SITE', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_ACCESS')),
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  site_address text,
  site_city text,
  assigned_to_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  instructions text,
  outcome_summary text,
  notify_customer boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sales_site_visits IS
  'Pre-sale site visits. These are not work_project_visits and do not create a work project.';

CREATE INDEX IF NOT EXISTS sales_site_visits_client_lead_idx
  ON public.sales_site_visits (client_id, lead_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS sales_site_visits_client_deal_idx
  ON public.sales_site_visits (client_id, deal_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.sales_site_visit_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL UNIQUE REFERENCES public.sales_site_visits(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sales_site_visit_assessments IS
  'Structured pre-sale site assessment. Completed rows are historical evidence and are not edited.';

CREATE INDEX IF NOT EXISTS sales_site_visit_assessments_client_idx
  ON public.sales_site_visit_assessments (client_id, status);

ALTER TABLE public.work_projects
  ADD COLUMN IF NOT EXISTS sales_site_visit_id uuid REFERENCES public.sales_site_visits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inherited_sales_assessment_id uuid REFERENCES public.sales_site_visit_assessments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inherited_sales_assessment_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS inherited_sales_assessment_snapshot jsonb;

COMMENT ON COLUMN public.work_projects.inherited_sales_assessment_id IS
  'Completed pre-sale assessment linked at project creation. The sales row stays immutable. A second operational assessment is not required.';

ALTER TABLE public.sales_site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_site_visit_assessments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.sales_site_visits FROM anon, authenticated;
REVOKE ALL ON TABLE public.sales_site_visit_assessments FROM anon, authenticated;
GRANT ALL ON TABLE public.sales_site_visits TO service_role;
GRANT ALL ON TABLE public.sales_site_visit_assessments TO service_role;
