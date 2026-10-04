-- Phase 4: installation execution, equipment issue, commissioning, handover, installed assets.
-- Development database apply names: work_project_installation_tables, work_project_installation_issue,
-- work_project_installation_return, work_project_installation_commissioning, work_project_installation_qa_order.
-- Development database apply names: work_project_installation_tables, work_project_installation_issue,
-- work_project_installation_return, work_project_installation_commissioning, work_project_installation_qa_order.
-- Customer-site assets are not SegmiQ infrastructure. Assets are created only when commissioning confirms installation.

ALTER TABLE public.work_project_equipment
  ADD COLUMN IF NOT EXISTS quantity_installed numeric NOT NULL DEFAULT 0 CHECK (quantity_installed >= 0),
  ADD COLUMN IF NOT EXISTS requires_serial boolean;

ALTER TABLE public.support_cases
  ADD COLUMN IF NOT EXISTS installed_asset_id uuid;

CREATE INDEX IF NOT EXISTS support_cases_installed_asset_idx
  ON public.support_cases (installed_asset_id)
  WHERE installed_asset_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.work_project_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.work_projects(id) ON DELETE CASCADE,
  installation_number text NOT NULL,
  status text NOT NULL DEFAULT 'PLANNED' CHECK (status IN (
    'PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'WORK_COMPLETED',
    'QA_PENDING', 'COMMISSIONING_PENDING', 'HANDOVER_PENDING', 'COMPLETED', 'CANCELLED'
  )),
  installation_type text NOT NULL DEFAULT 'PRIMARY' CHECK (installation_type IN (
    'PRIMARY', 'PHASED', 'RETURN', 'EXPANSION', 'REMEDIAL'
  )),
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  site_name text,
  site_address text,
  lead_installer_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notes text,
  completion_summary text,
  readiness_exceptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  UNIQUE (client_id, installation_number)
);

CREATE INDEX IF NOT EXISTS work_project_installations_project_idx
  ON public.work_project_installations (project_id, created_at);
CREATE INDEX IF NOT EXISTS work_project_installations_client_status_idx
  ON public.work_project_installations (client_id, status, scheduled_start_at);

CREATE TABLE IF NOT EXISTS public.work_project_installation_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL REFERENCES public.work_project_installations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (installation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.work_project_installation_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL REFERENCES public.work_project_installations(id) ON DELETE CASCADE,
  checklist_key text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED')),
  completed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (installation_id, checklist_key)
);

CREATE TABLE IF NOT EXISTS public.work_project_equipment_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.work_projects(id) ON DELETE CASCADE,
  installation_id uuid REFERENCES public.work_project_installations(id) ON DELETE SET NULL,
  project_equipment_id uuid NOT NULL REFERENCES public.work_project_equipment(id) ON DELETE CASCADE,
  serial_number text,
  manufacturer text,
  model text,
  status text NOT NULL DEFAULT 'RECORDED' CHECK (status IN ('RECORDED', 'INSTALLED', 'RETURNED', 'REMOVED')),
  installed_at timestamptz,
  removed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS work_project_equipment_units_serial_uidx
  ON public.work_project_equipment_units (client_id, lower(btrim(serial_number)))
  WHERE serial_number IS NOT NULL
    AND btrim(serial_number) <> ''
    AND status IN ('RECORDED', 'INSTALLED');

CREATE INDEX IF NOT EXISTS work_project_equipment_units_equipment_idx
  ON public.work_project_equipment_units (project_equipment_id, status);

CREATE TABLE IF NOT EXISTS public.work_project_quality_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.work_projects(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL REFERENCES public.work_project_installations(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('PASS', 'PASS_WITH_NOTES', 'REQUIRES_REWORK')),
  schema_version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  internal_notes text,
  checked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_project_quality_checks_installation_idx
  ON public.work_project_quality_checks (installation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.work_project_commissioning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.work_projects(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL REFERENCES public.work_project_installations(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('DRAFT', 'READY', 'COMPLETED', 'FAILED')),
  outcome text,
  commissioned_at timestamptz,
  commissioned_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  schema_version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_summary text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_project_commissioning_installation_idx
  ON public.work_project_commissioning (installation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.work_project_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.work_projects(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL REFERENCES public.work_project_installations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED')),
  handover_at timestamptz,
  handed_over_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  customer_name text,
  acknowledged boolean NOT NULL DEFAULT false,
  training_completed boolean NOT NULL DEFAULT false,
  documents_provided boolean NOT NULL DEFAULT false,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  schema_version integer NOT NULL DEFAULT 1,
  customer_notes text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS work_project_handovers_completed_uidx
  ON public.work_project_handovers (installation_id)
  WHERE status = 'COMPLETED';

CREATE TABLE IF NOT EXISTS public.customer_installed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id uuid,
  work_project_id uuid REFERENCES public.work_projects(id) ON DELETE SET NULL,
  installation_id uuid REFERENCES public.work_project_installations(id) ON DELETE SET NULL,
  project_equipment_id uuid REFERENCES public.work_project_equipment(id) ON DELETE SET NULL,
  equipment_unit_id uuid REFERENCES public.work_project_equipment_units(id) ON DELETE SET NULL,
  parent_asset_id uuid REFERENCES public.customer_installed_assets(id) ON DELETE SET NULL,
  asset_type text NOT NULL,
  product_id uuid,
  name text NOT NULL,
  manufacturer text,
  model text,
  serial_number text,
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit text,
  installed_at timestamptz,
  site_name text,
  site_address text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REMOVED', 'REPLACED', 'FAILED', 'DECOMMISSIONED')),
  notes text,
  customer_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_installed_assets_unit_uidx
  ON public.customer_installed_assets (equipment_unit_id)
  WHERE equipment_unit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_installed_assets_line_uidx
  ON public.customer_installed_assets (installation_id, project_equipment_id)
  WHERE project_equipment_id IS NOT NULL AND equipment_unit_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_installed_assets_system_uidx
  ON public.customer_installed_assets (installation_id)
  WHERE asset_type = 'SYSTEM';

CREATE INDEX IF NOT EXISTS customer_installed_assets_contact_idx
  ON public.customer_installed_assets (client_id, contact_id, status);

CREATE TABLE IF NOT EXISTS public.installed_asset_warranties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  installed_asset_id uuid NOT NULL REFERENCES public.customer_installed_assets(id) ON DELETE CASCADE,
  warranty_type text NOT NULL CHECK (warranty_type IN ('MANUFACTURER', 'WORKMANSHIP', 'EXTENDED', 'OTHER')),
  provider_name text,
  starts_at timestamptz NOT NULL,
  expires_at timestamptz,
  duration_months integer,
  reference text,
  terms_summary text,
  document_id uuid,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS installed_asset_warranties_open_uidx
  ON public.installed_asset_warranties (installed_asset_id, warranty_type)
  WHERE voided_at IS NULL;

CREATE TABLE IF NOT EXISTS public.work_project_stock_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  action text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, idempotency_key)
);

ALTER TABLE public.document_entity_links
  DROP CONSTRAINT IF EXISTS document_entity_links_entity_type_check;

ALTER TABLE public.document_entity_links
  ADD CONSTRAINT document_entity_links_entity_type_check
  CHECK (entity_type IN (
    'CUSTOMER', 'LEAD', 'DEAL', 'QUOTATION',
    'PRODUCT', 'PACKAGE', 'PROJECT', 'USER', 'TEAM', 'SUPPORT_CASE',
    'WORK_PROJECT', 'WORK_PROJECT_VISIT', 'WORK_PROJECT_PAYMENT', 'WORK_PROJECT_INSTALLATION'
  ));

ALTER TABLE public.work_project_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_installation_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_installation_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_equipment_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_quality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_commissioning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_installed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installed_asset_warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_stock_actions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.issue_work_project_equipment(
  p_client_id uuid,
  p_installation_id uuid,
  p_equipment_id uuid,
  p_quantity numeric,
  p_actor_id uuid,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_prev jsonb;
  v_line public.work_project_equipment%ROWTYPE;
  v_inst public.work_project_installations%ROWTYPE;
  v_res record;
  v_bal record;
  v_reserved numeric := 0;
  v_left numeric;
  v_take numeric;
  v_before numeric;
  v_after numeric;
  v_result jsonb;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing issue request key.');
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter a quantity to issue.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_client_id::text || ':' || p_idempotency_key, 0));

  SELECT result INTO v_prev
  FROM public.work_project_stock_actions
  WHERE client_id = p_client_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_prev || jsonb_build_object('idempotent', true);
  END IF;

  SELECT * INTO v_line
  FROM public.work_project_equipment
  WHERE id = p_equipment_id AND client_id = p_client_id
  FOR UPDATE;
  IF NOT FOUND OR v_line.cancelled THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Equipment line was not found.');
  END IF;

  SELECT * INTO v_inst
  FROM public.work_project_installations
  WHERE id = p_installation_id AND client_id = p_client_id
  FOR UPDATE;
  IF NOT FOUND OR v_inst.project_id <> v_line.project_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Installation was not found on this project.');
  END IF;
  IF v_inst.status IN ('CANCELLED', 'COMPLETED') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This installation is closed.');
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_reserved
  FROM public.inventory_reservations
  WHERE client_id = p_client_id
    AND source_type = 'WORK_PROJECT'
    AND source_id = p_equipment_id
    AND status = 'ACTIVE';

  IF p_quantity > v_reserved OR p_quantity > v_line.quantity_reserved THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only reserved stock can be issued.', 'reserved', v_reserved);
  END IF;

  v_left := p_quantity;
  FOR v_res IN
    SELECT id, location_id, quantity
    FROM public.inventory_reservations
    WHERE client_id = p_client_id
      AND source_type = 'WORK_PROJECT'
      AND source_id = p_equipment_id
      AND status = 'ACTIVE'
      AND quantity > 0
    ORDER BY created_at
    FOR UPDATE
  LOOP
    EXIT WHEN v_left <= 0;
    v_take := LEAST(v_left, v_res.quantity);
    SELECT id, on_hand, reserved INTO v_bal
    FROM public.inventory_balances
    WHERE client_id = p_client_id
      AND location_id = v_res.location_id
      AND product_id = v_line.product_id
      AND variant_id IS NOT DISTINCT FROM v_line.variant_id
    FOR UPDATE;
    IF NOT FOUND OR v_bal.on_hand < v_take OR v_bal.reserved < v_take THEN
      RAISE EXCEPTION 'insufficient_stock';
    END IF;
    v_before := v_bal.on_hand;
    v_after := v_bal.on_hand - v_take;
    UPDATE public.inventory_balances
    SET on_hand = on_hand - v_take,
        reserved = reserved - v_take,
        version = version + 1,
        updated_at = now()
    WHERE id = v_bal.id;

    IF v_res.quantity = v_take THEN
      UPDATE public.inventory_reservations
      SET quantity = 0, status = 'CONSUMED', released_at = now()
      WHERE id = v_res.id;
    ELSE
      UPDATE public.inventory_reservations
      SET quantity = quantity - v_take
      WHERE id = v_res.id;
    END IF;

    INSERT INTO public.inventory_movements (
      client_id, location_id, product_id, variant_id, movement_type, quantity,
      balance_before, balance_after, reason, reference_type, reference_id, performed_by, source
    ) VALUES (
      p_client_id, v_res.location_id, v_line.product_id, v_line.variant_id, 'STOCK_ISSUED', -v_take,
      v_before, v_after, 'Issued to installation', 'WORK_PROJECT_EQUIPMENT', p_equipment_id, p_actor_id, 'USER'
    );
    v_left := v_left - v_take;
  END LOOP;

  IF v_left > 0 THEN
    RAISE EXCEPTION 'insufficient_stock';
  END IF;

  UPDATE public.work_project_equipment
  SET quantity_issued = quantity_issued + p_quantity,
      quantity_reserved = quantity_reserved - p_quantity,
      updated_at = now()
  WHERE id = p_equipment_id;

  INSERT INTO public.work_project_events (
    client_id, project_id, event_type, title, actor_user_id, metadata
  ) VALUES (
    p_client_id, v_line.project_id, 'EQUIPMENT_ISSUED', 'Equipment issued', p_actor_id,
    jsonb_build_object('equipment_id', p_equipment_id, 'installation_id', p_installation_id, 'quantity', p_quantity)
  );

  v_result := jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'issued', p_quantity,
    'equipment_id', p_equipment_id,
    'installation_id', p_installation_id
  );
  INSERT INTO public.work_project_stock_actions (client_id, idempotency_key, action, result)
  VALUES (p_client_id, p_idempotency_key, 'ISSUE', v_result);
  RETURN v_result;
EXCEPTION
  WHEN raise_exception THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough stock on hand to issue this quantity.');
END;
$$;

CREATE OR REPLACE FUNCTION public.return_work_project_equipment(
  p_client_id uuid,
  p_installation_id uuid,
  p_equipment_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_actor_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_unit_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_prev jsonb;
  v_line public.work_project_equipment%ROWTYPE;
  v_inst public.work_project_installations%ROWTYPE;
  v_bal record;
  v_net numeric := 0;
  v_returnable numeric;
  v_before numeric;
  v_unit_status text;
  v_result jsonb;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing return request key.');
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter a reason for the return.');
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter a quantity to return.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_client_id::text || ':' || p_idempotency_key, 0));
  SELECT result INTO v_prev
  FROM public.work_project_stock_actions
  WHERE client_id = p_client_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_prev || jsonb_build_object('idempotent', true);
  END IF;

  SELECT * INTO v_line
  FROM public.work_project_equipment
  WHERE id = p_equipment_id AND client_id = p_client_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Equipment line was not found.');
  END IF;

  SELECT * INTO v_inst
  FROM public.work_project_installations
  WHERE id = p_installation_id AND client_id = p_client_id AND project_id = v_line.project_id
  FOR UPDATE;
  IF NOT FOUND OR v_inst.status IN ('CANCELLED', 'COMPLETED') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Installation was not found or is closed.');
  END IF;

  v_returnable := v_line.quantity_issued - v_line.quantity_installed;
  IF p_quantity > v_returnable THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only unused issued equipment can be returned.', 'returnable', v_returnable);
  END IF;

  SELECT COALESCE(SUM(CASE WHEN movement_type = 'STOCK_ISSUED' THEN -quantity ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN movement_type = 'RETURN' THEN quantity ELSE 0 END), 0)
    INTO v_net
  FROM public.inventory_movements
  WHERE client_id = p_client_id
    AND location_id = p_location_id
    AND reference_type = 'WORK_PROJECT_EQUIPMENT'
    AND reference_id = p_equipment_id
    AND movement_type IN ('STOCK_ISSUED', 'RETURN');

  IF p_quantity > v_net THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That location did not issue this much equipment.');
  END IF;

  IF p_unit_id IS NOT NULL THEN
    SELECT status INTO v_unit_status
    FROM public.work_project_equipment_units
    WHERE id = p_unit_id AND client_id = p_client_id AND project_equipment_id = p_equipment_id
    FOR UPDATE;
    IF NOT FOUND OR v_unit_status <> 'RECORDED' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Only a recorded, uninstalled unit can be returned.');
    END IF;
  END IF;

  SELECT id, on_hand INTO v_bal
  FROM public.inventory_balances
  WHERE client_id = p_client_id
    AND location_id = p_location_id
    AND product_id = v_line.product_id
    AND variant_id IS NOT DISTINCT FROM v_line.variant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stock location was not found.');
  END IF;

  v_before := v_bal.on_hand;
  UPDATE public.inventory_balances
  SET on_hand = on_hand + p_quantity,
      version = version + 1,
      updated_at = now()
  WHERE id = v_bal.id;

  INSERT INTO public.inventory_movements (
    client_id, location_id, product_id, variant_id, movement_type, quantity,
    balance_before, balance_after, reason, reference_type, reference_id, performed_by, source
  ) VALUES (
    p_client_id, p_location_id, v_line.product_id, v_line.variant_id, 'RETURN', p_quantity,
    v_before, v_before + p_quantity, btrim(p_reason), 'WORK_PROJECT_EQUIPMENT', p_equipment_id, p_actor_id, 'USER'
  );

  UPDATE public.work_project_equipment
  SET quantity_issued = quantity_issued - p_quantity,
      updated_at = now()
  WHERE id = p_equipment_id;

  IF p_unit_id IS NOT NULL THEN
    UPDATE public.work_project_equipment_units
    SET status = 'RETURNED', removed_at = now(), updated_at = now()
    WHERE id = p_unit_id;
  END IF;

  INSERT INTO public.work_project_events (
    client_id, project_id, event_type, title, description, actor_user_id, metadata
  ) VALUES (
    p_client_id, v_line.project_id, 'EQUIPMENT_RETURNED', 'Equipment returned', btrim(p_reason), p_actor_id,
    jsonb_build_object('equipment_id', p_equipment_id, 'installation_id', p_installation_id, 'quantity', p_quantity, 'location_id', p_location_id)
  );

  v_result := jsonb_build_object('ok', true, 'idempotent', false, 'returned', p_quantity, 'equipment_id', p_equipment_id);
  INSERT INTO public.work_project_stock_actions (client_id, idempotency_key, action, result)
  VALUES (p_client_id, p_idempotency_key, 'RETURN', v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_work_project_commissioning(
  p_client_id uuid,
  p_installation_id uuid,
  p_actor_id uuid,
  p_outcome text,
  p_data jsonb,
  p_customer_summary text,
  p_internal_notes text,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_prev jsonb;
  v_inst public.work_project_installations%ROWTYPE;
  v_project public.work_projects%ROWTYPE;
  v_qa text;
  v_now timestamptz := now();
  v_system uuid;
  v_months int;
  v_workmanship int;
  v_created int := 0;
  v_result jsonb;
  v_unit record;
  v_line record;
  v_type text;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing commissioning request key.');
  END IF;
  IF p_outcome NOT IN ('PASSED', 'PASSED_WITH_NOTES', 'FAILED') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Choose a commissioning outcome.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_client_id::text || ':' || p_idempotency_key, 0));
  SELECT result INTO v_prev
  FROM public.work_project_stock_actions
  WHERE client_id = p_client_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_prev || jsonb_build_object('idempotent', true);
  END IF;

  SELECT * INTO v_inst
  FROM public.work_project_installations
  WHERE id = p_installation_id AND client_id = p_client_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Installation was not found.');
  END IF;

  SELECT * INTO v_project
  FROM public.work_projects
  WHERE id = v_inst.project_id AND client_id = p_client_id
  FOR UPDATE;

  SELECT outcome INTO v_qa
  FROM public.work_project_quality_checks
  WHERE installation_id = p_installation_id AND client_id = p_client_id
  ORDER BY created_at DESC, ctid DESC
  LIMIT 1;

  IF p_outcome = 'FAILED' THEN
    INSERT INTO public.work_project_commissioning (
      client_id, project_id, installation_id, status, outcome, schema_version, data,
      customer_summary, internal_notes, commissioned_by
    ) VALUES (
      p_client_id, v_inst.project_id, p_installation_id, 'FAILED', 'FAILED', 1, COALESCE(p_data, '{}'::jsonb),
      NULLIF(btrim(COALESCE(p_customer_summary, '')), ''), NULLIF(btrim(COALESCE(p_internal_notes, '')), ''), p_actor_id
    );
    INSERT INTO public.work_project_events (
      client_id, project_id, event_type, title, description, actor_user_id, metadata
    ) VALUES (
      p_client_id, v_inst.project_id, 'COMMISSIONING_FAILED', 'Commissioning failed',
      NULLIF(btrim(COALESCE(p_internal_notes, '')), ''), p_actor_id,
      jsonb_build_object('installation_id', p_installation_id)
    );
    v_result := jsonb_build_object('ok', true, 'idempotent', false, 'status', 'FAILED', 'assets_created', 0);
    INSERT INTO public.work_project_stock_actions (client_id, idempotency_key, action, result)
    VALUES (p_client_id, p_idempotency_key, 'COMMISSIONING', v_result);
    RETURN v_result;
  END IF;

  IF v_qa IS NULL OR v_qa NOT IN ('PASS', 'PASS_WITH_NOTES') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Commissioning needs a passed quality check.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.work_project_commissioning
    WHERE installation_id = p_installation_id AND status = 'COMPLETED'
  ) THEN
    v_result := jsonb_build_object('ok', true, 'idempotent', true, 'status', 'COMPLETED', 'assets_created', 0);
    INSERT INTO public.work_project_stock_actions (client_id, idempotency_key, action, result)
    VALUES (p_client_id, p_idempotency_key, 'COMMISSIONING', v_result);
    RETURN v_result;
  END IF;

  INSERT INTO public.work_project_commissioning (
    client_id, project_id, installation_id, status, outcome, commissioned_at, commissioned_by,
    schema_version, data, customer_summary, internal_notes
  ) VALUES (
    p_client_id, v_inst.project_id, p_installation_id, 'COMPLETED', p_outcome, v_now, p_actor_id,
    1, COALESCE(p_data, '{}'::jsonb),
    NULLIF(btrim(COALESCE(p_customer_summary, '')), ''),
    NULLIF(btrim(COALESCE(p_internal_notes, '')), '')
  );

  UPDATE public.work_project_installations
  SET status = 'HANDOVER_PENDING', updated_at = v_now
  WHERE id = p_installation_id;

  IF v_project.workflow_key = 'SOLAR_INSTALLATION' AND NOT EXISTS (
    SELECT 1 FROM public.customer_installed_assets
    WHERE installation_id = p_installation_id AND asset_type = 'SYSTEM'
  ) THEN
    INSERT INTO public.customer_installed_assets (
      client_id, contact_id, work_project_id, installation_id, asset_type, name,
      quantity, installed_at, site_name, site_address, status, customer_visible
    ) VALUES (
      p_client_id, v_project.contact_id, v_project.id, p_installation_id, 'SYSTEM',
      COALESCE(NULLIF(btrim(v_project.title), ''), 'Installed system'),
      1, v_now, v_inst.site_name, v_inst.site_address, 'ACTIVE', true
    )
    RETURNING id INTO v_system;
    v_created := v_created + 1;
  ELSE
    SELECT id INTO v_system
    FROM public.customer_installed_assets
    WHERE installation_id = p_installation_id AND asset_type = 'SYSTEM'
    LIMIT 1;
  END IF;

  FOR v_unit IN
    SELECT u.*, e.description, e.unit, e.product_id
    FROM public.work_project_equipment_units u
    JOIN public.work_project_equipment e ON e.id = u.project_equipment_id
    WHERE u.client_id = p_client_id
      AND u.installation_id = p_installation_id
      AND u.status = 'INSTALLED'
      AND NOT EXISTS (
        SELECT 1 FROM public.customer_installed_assets a WHERE a.equipment_unit_id = u.id
      )
  LOOP
    v_type := CASE
      WHEN v_unit.description ILIKE '%inverter%' THEN 'INVERTER'
      WHEN v_unit.description ILIKE '%battery%' THEN 'BATTERY'
      WHEN v_unit.description ILIKE '%panel%' OR v_unit.description ILIKE '%pv%' THEN 'PV_ARRAY'
      ELSE 'EQUIPMENT'
    END;
    INSERT INTO public.customer_installed_assets (
      client_id, contact_id, work_project_id, installation_id, project_equipment_id, equipment_unit_id,
      parent_asset_id, asset_type, product_id, name, manufacturer, model, serial_number,
      quantity, unit, installed_at, site_name, site_address, status, customer_visible
    ) VALUES (
      p_client_id, v_project.contact_id, v_project.id, p_installation_id, v_unit.project_equipment_id, v_unit.id,
      v_system, v_type, v_unit.product_id,
      v_unit.description || CASE WHEN v_unit.serial_number IS NOT NULL THEN ' · ' || v_unit.serial_number ELSE '' END,
      v_unit.manufacturer, v_unit.model, v_unit.serial_number,
      1, v_unit.unit, COALESCE(v_unit.installed_at, v_now), v_inst.site_name, v_inst.site_address, 'ACTIVE', true
    );
    v_created := v_created + 1;
  END LOOP;

  FOR v_line IN
    SELECT e.*,
      e.quantity_installed - COALESCE((
        SELECT COUNT(*) FROM public.work_project_equipment_units u
        WHERE u.project_equipment_id = e.id AND u.status = 'INSTALLED'
      ), 0) AS bulk_qty
    FROM public.work_project_equipment e
    WHERE e.client_id = p_client_id
      AND e.project_id = v_project.id
      AND e.cancelled = false
      AND e.quantity_installed > COALESCE((
        SELECT COUNT(*) FROM public.work_project_equipment_units u
        WHERE u.project_equipment_id = e.id AND u.status = 'INSTALLED'
      ), 0)
      AND NOT EXISTS (
        SELECT 1 FROM public.customer_installed_assets a
        WHERE a.installation_id = p_installation_id
          AND a.project_equipment_id = e.id
          AND a.equipment_unit_id IS NULL
      )
  LOOP
    v_type := CASE
      WHEN v_line.description ILIKE '%inverter%' THEN 'INVERTER'
      WHEN v_line.description ILIKE '%battery%' THEN 'BATTERY'
      WHEN v_line.description ILIKE '%panel%' OR v_line.description ILIKE '%pv%' THEN 'PV_ARRAY'
      ELSE 'EQUIPMENT'
    END;
    INSERT INTO public.customer_installed_assets (
      client_id, contact_id, work_project_id, installation_id, project_equipment_id,
      parent_asset_id, asset_type, product_id, name, quantity, unit, installed_at,
      site_name, site_address, status, customer_visible
    ) VALUES (
      p_client_id, v_project.contact_id, v_project.id, p_installation_id, v_line.id,
      v_system, v_type, v_line.product_id, v_line.description, v_line.bulk_qty, v_line.unit,
      v_now, v_inst.site_name, v_inst.site_address, 'ACTIVE', true
    );
    v_created := v_created + 1;
  END LOOP;

  v_months := NULLIF(p_data->>'manufacturerMonths', '')::int;
  v_workmanship := NULLIF(p_data->>'workmanshipMonths', '')::int;

  IF v_months IS NOT NULL AND v_months > 0 THEN
    INSERT INTO public.installed_asset_warranties (
      client_id, installed_asset_id, warranty_type, starts_at, expires_at, duration_months, terms_summary
    )
    SELECT p_client_id, a.id, 'MANUFACTURER', v_now, v_now + make_interval(months => v_months), v_months,
           NULLIF(p_data->>'warrantyReference', '')
    FROM public.customer_installed_assets a
    WHERE a.installation_id = p_installation_id AND a.asset_type <> 'SYSTEM'
      AND NOT EXISTS (
        SELECT 1 FROM public.installed_asset_warranties w
        WHERE w.installed_asset_id = a.id AND w.warranty_type = 'MANUFACTURER' AND w.voided_at IS NULL
      );
  END IF;

  IF v_workmanship IS NOT NULL AND v_workmanship > 0 THEN
    INSERT INTO public.installed_asset_warranties (
      client_id, installed_asset_id, warranty_type, starts_at, expires_at, duration_months
    )
    SELECT p_client_id, a.id, 'WORKMANSHIP', v_now, v_now + make_interval(months => v_workmanship), v_workmanship
    FROM public.customer_installed_assets a
    WHERE a.installation_id = p_installation_id
      AND a.asset_type = CASE WHEN v_system IS NULL THEN a.asset_type ELSE 'SYSTEM' END
      AND NOT EXISTS (
        SELECT 1 FROM public.installed_asset_warranties w
        WHERE w.installed_asset_id = a.id AND w.warranty_type = 'WORKMANSHIP' AND w.voided_at IS NULL
      );
  END IF;

  INSERT INTO public.work_project_events (
    client_id, project_id, event_type, title, actor_user_id, metadata
  ) VALUES (
    p_client_id, v_inst.project_id, 'COMMISSIONING_COMPLETED', 'Commissioning completed', p_actor_id,
    jsonb_build_object('installation_id', p_installation_id, 'assets_created', v_created)
  );
  INSERT INTO public.work_project_events (
    client_id, project_id, event_type, title, actor_user_id, metadata
  )
  SELECT p_client_id, v_inst.project_id, 'INSTALLED_ASSET_CREATED', 'Installed asset created', p_actor_id,
         jsonb_build_object('installation_id', p_installation_id, 'asset_id', a.id)
  FROM public.customer_installed_assets a
  WHERE a.installation_id = p_installation_id AND a.created_at >= v_now - interval '5 seconds';

  IF v_months IS NOT NULL OR v_workmanship IS NOT NULL THEN
    INSERT INTO public.work_project_events (
      client_id, project_id, event_type, title, actor_user_id, metadata
    ) VALUES (
      p_client_id, v_inst.project_id, 'WARRANTY_CREATED', 'Warranty recorded', p_actor_id,
      jsonb_build_object('installation_id', p_installation_id)
    );
  END IF;

  v_result := jsonb_build_object('ok', true, 'idempotent', false, 'status', 'COMPLETED', 'assets_created', v_created);
  INSERT INTO public.work_project_stock_actions (client_id, idempotency_key, action, result)
  VALUES (p_client_id, p_idempotency_key, 'COMMISSIONING', v_result);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_work_project_equipment(uuid, uuid, uuid, numeric, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.return_work_project_equipment(uuid, uuid, uuid, uuid, numeric, uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_work_project_commissioning(uuid, uuid, uuid, text, jsonb, text, text, text) FROM PUBLIC;
