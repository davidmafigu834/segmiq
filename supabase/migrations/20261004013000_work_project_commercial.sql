-- Trades operations phase 3: customer payments and project equipment.
-- Does not alter subscription billing, Cloud portfolio projects, deals, or quotations.

ALTER TABLE public.work_projects
  ADD COLUMN IF NOT EXISTS payment_required boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.work_project_payment_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.work_projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  term_type text NOT NULL CHECK (term_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
  percent numeric CHECK (percent IS NULL OR (percent >= 0 AND percent <= 100)),
  amount numeric CHECK (amount IS NULL OR amount >= 0),
  trigger_type text NOT NULL DEFAULT 'OTHER' CHECK (trigger_type IN (
    'ON_ACCEPTANCE', 'BEFORE_PROJECT_START', 'BEFORE_PROCUREMENT', 'EQUIPMENT_READY',
    'BEFORE_INSTALLATION', 'ON_INSTALLATION', 'ON_HANDOVER', 'ON_COMPLETION',
    'CUSTOM_DATE', 'OTHER'
  )),
  due_date date,
  sequence integer NOT NULL DEFAULT 0,
  customer_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_project_payment_terms_project_idx
  ON public.work_project_payment_terms (project_id, sequence);

CREATE TABLE IF NOT EXISTS public.work_project_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.work_projects(id) ON DELETE CASCADE,
  payment_term_id uuid REFERENCES public.work_project_payment_terms(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  payment_method text NOT NULL CHECK (payment_method IN (
    'BANK_TRANSFER', 'CASH', 'MOBILE_MONEY', 'CARD', 'CHEQUE', 'FINANCE', 'OTHER'
  )),
  reference text,
  paid_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'REVERSED', 'REFUNDED')),
  notes text,
  customer_visible boolean NOT NULL DEFAULT true,
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reversed_at timestamptz,
  reversed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reversal_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_project_payments_project_idx
  ON public.work_project_payments (project_id, paid_at DESC);

CREATE TABLE IF NOT EXISTS public.work_project_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.work_projects(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity_required numeric NOT NULL CHECK (quantity_required >= 0),
  quantity_reserved numeric NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  quantity_issued numeric NOT NULL DEFAULT 0 CHECK (quantity_issued >= 0),
  unit text,
  track_inventory boolean NOT NULL DEFAULT false,
  source_quotation_line_id uuid REFERENCES public.quotation_line_items(id) ON DELETE SET NULL,
  source_quantity numeric,
  notes text,
  cancelled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS work_project_equipment_quote_line_uidx
  ON public.work_project_equipment (project_id, source_quotation_line_id)
  WHERE source_quotation_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS work_project_equipment_project_idx
  ON public.work_project_equipment (project_id);

ALTER TABLE public.work_project_payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_equipment ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.document_entity_links
  DROP CONSTRAINT IF EXISTS document_entity_links_entity_type_check;

ALTER TABLE public.document_entity_links
  ADD CONSTRAINT document_entity_links_entity_type_check
  CHECK (entity_type IN (
    'CUSTOMER', 'LEAD', 'DEAL', 'QUOTATION',
    'PRODUCT', 'PACKAGE', 'PROJECT', 'USER', 'TEAM', 'SUPPORT_CASE',
    'WORK_PROJECT', 'WORK_PROJECT_VISIT', 'WORK_PROJECT_PAYMENT'
  ));

CREATE OR REPLACE FUNCTION public.confirm_work_project_payment(
  p_client_id uuid,
  p_payment_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_project uuid;
  v_status text;
  v_amount numeric;
  v_value numeric;
  v_received numeric;
  v_fully boolean;
BEGIN
  SELECT project_id, status, amount
    INTO v_project, v_status, v_amount
  FROM public.work_project_payments
  WHERE id = p_payment_id AND client_id = p_client_id
  FOR UPDATE;

  IF v_project IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_status = 'CONFIRMED' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'project_id', v_project);
  END IF;
  IF v_status <> 'PENDING' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  UPDATE public.work_project_payments
  SET status = 'CONFIRMED',
      confirmed_at = now(),
      confirmed_by = p_actor_id,
      updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO public.work_project_events (
    client_id, project_id, event_type, title, actor_user_id, metadata
  ) VALUES (
    p_client_id, v_project, 'PAYMENT_CONFIRMED', 'Payment confirmed', p_actor_id,
    jsonb_build_object('payment_id', p_payment_id, 'amount', v_amount)
  );

  SELECT project_value INTO v_value
  FROM public.work_projects
  WHERE id = v_project AND client_id = p_client_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_received
  FROM public.work_project_payments
  WHERE project_id = v_project AND client_id = p_client_id AND status = 'CONFIRMED';

  v_fully := v_value IS NOT NULL AND v_value > 0 AND v_received >= v_value;
  IF v_fully AND NOT EXISTS (
    SELECT 1 FROM public.work_project_events
    WHERE project_id = v_project AND event_type = 'PROJECT_FULLY_PAID'
  ) THEN
    INSERT INTO public.work_project_events (
      client_id, project_id, event_type, title, actor_user_id, metadata
    ) VALUES (
      p_client_id, v_project, 'PROJECT_FULLY_PAID', 'Project fully paid', p_actor_id,
      jsonb_build_object('received', v_received, 'project_value', v_value)
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'project_id', v_project, 'received', v_received, 'fully_paid', v_fully);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_work_project_payment(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_work_project_payment(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.reverse_work_project_payment(
  p_client_id uuid,
  p_payment_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_refund boolean
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_project uuid;
  v_status text;
  v_next text;
BEGIN
  SELECT project_id, status INTO v_project, v_status
  FROM public.work_project_payments
  WHERE id = p_payment_id AND client_id = p_client_id
  FOR UPDATE;

  IF v_project IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_status IN ('REVERSED', 'REFUNDED') THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'project_id', v_project);
  END IF;
  IF v_status <> 'CONFIRMED' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_confirmed');
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_required');
  END IF;

  v_next := CASE WHEN p_refund THEN 'REFUNDED' ELSE 'REVERSED' END;
  UPDATE public.work_project_payments
  SET status = v_next,
      reversed_at = now(),
      reversed_by = p_actor_id,
      reversal_reason = btrim(p_reason),
      updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO public.work_project_events (
    client_id, project_id, event_type, title, description, actor_user_id, metadata
  ) VALUES (
    p_client_id, v_project, 'PAYMENT_REVERSED',
    CASE WHEN p_refund THEN 'Payment refunded' ELSE 'Payment reversed' END,
    btrim(p_reason), p_actor_id,
    jsonb_build_object('payment_id', p_payment_id, 'status', v_next)
  );

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'project_id', v_project, 'status', v_next);
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_work_project_payment(uuid, uuid, uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_work_project_payment(uuid, uuid, uuid, text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_work_project_stock(
  p_client_id uuid,
  p_project_id uuid,
  p_location_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_line record;
  v_balance record;
  v_remaining numeric;
  v_available numeric;
  v_qty numeric;
  v_reserved_any boolean := false;
  v_partial boolean := false;
  v_missing numeric := 0;
  v_on_hand numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_locations
    WHERE id = p_location_id AND client_id = p_client_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location');
  END IF;

  FOR v_line IN
    SELECT * FROM public.work_project_equipment
    WHERE project_id = p_project_id AND client_id = p_client_id
      AND track_inventory = true AND cancelled = false AND product_id IS NOT NULL
    ORDER BY created_at
    FOR UPDATE
  LOOP
    v_remaining := v_line.quantity_required - v_line.quantity_reserved;
    IF v_remaining <= 0 THEN
      CONTINUE;
    END IF;

    SELECT id, on_hand, reserved, version
      INTO v_balance
    FROM public.inventory_balances
    WHERE client_id = p_client_id
      AND location_id = p_location_id
      AND product_id = v_line.product_id
      AND variant_id IS NOT DISTINCT FROM v_line.variant_id
    FOR UPDATE;

    IF v_balance.id IS NULL THEN
      v_missing := v_missing + v_remaining;
      v_partial := true;
      CONTINUE;
    END IF;

    v_on_hand := v_balance.on_hand;
    v_available := COALESCE(v_balance.on_hand, 0) - COALESCE(v_balance.reserved, 0);
    v_qty := LEAST(v_remaining, GREATEST(v_available, 0));
    IF v_qty <= 0 THEN
      v_missing := v_missing + v_remaining;
      v_partial := true;
      CONTINUE;
    END IF;

    UPDATE public.inventory_balances
    SET reserved = COALESCE(reserved, 0) + v_qty,
        version = COALESCE(version, 1) + 1,
        updated_at = now()
    WHERE id = v_balance.id;

    INSERT INTO public.inventory_reservations (
      client_id, location_id, product_id, variant_id, quantity,
      source_type, source_id, created_by
    ) VALUES (
      p_client_id, p_location_id, v_line.product_id, v_line.variant_id, v_qty,
      'WORK_PROJECT', v_line.id, p_actor_id
    );

    INSERT INTO public.inventory_movements (
      client_id, location_id, product_id, variant_id, movement_type, quantity,
      reason, reference_type, reference_id, performed_by, source
    ) VALUES (
      p_client_id, p_location_id, v_line.product_id, v_line.variant_id, 'RESERVATION', v_qty,
      'Project reservation', 'WORK_PROJECT', v_line.id, p_actor_id, 'USER'
    );

    UPDATE public.work_project_equipment
    SET quantity_reserved = quantity_reserved + v_qty,
        updated_at = now()
    WHERE id = v_line.id;

    v_reserved_any := true;
    IF v_qty < v_remaining THEN
      v_partial := true;
      v_missing := v_missing + (v_remaining - v_qty);
    END IF;

    IF v_on_hand IS DISTINCT FROM (
      SELECT on_hand FROM public.inventory_balances WHERE id = v_balance.id
    ) THEN
      RAISE EXCEPTION 'on_hand changed during reservation';
    END IF;
  END LOOP;

  IF NOT v_reserved_any AND NOT v_partial THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true, 'missing', 0);
  END IF;

  IF v_reserved_any THEN
    INSERT INTO public.work_project_events (
      client_id, project_id, event_type, title, actor_user_id, metadata
    ) VALUES (
      p_client_id, p_project_id,
      CASE WHEN v_partial THEN 'STOCK_PARTIALLY_RESERVED' ELSE 'STOCK_RESERVED' END,
      CASE WHEN v_partial THEN 'Stock partially reserved' ELSE 'Stock reserved' END,
      p_actor_id,
      jsonb_build_object('location_id', p_location_id, 'missing', v_missing)
    );
  END IF;

  IF v_missing > 0 THEN
    INSERT INTO public.work_project_events (
      client_id, project_id, event_type, title, actor_user_id, metadata
    ) VALUES (
      p_client_id, p_project_id, 'PROCUREMENT_REQUIRED', 'Procurement required', p_actor_id,
      jsonb_build_object('missing_quantity', v_missing, 'location_id', p_location_id)
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'unchanged', false, 'partial', v_partial, 'missing', v_missing);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_work_project_stock(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_work_project_stock(uuid, uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.release_work_project_stock(
  p_client_id uuid,
  p_project_id uuid,
  p_equipment_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_res record;
  v_released numeric := 0;
  v_on_hand numeric;
BEGIN
  FOR v_res IN
    SELECT r.*
    FROM public.inventory_reservations r
    JOIN public.work_project_equipment e ON e.id = r.source_id
    WHERE r.client_id = p_client_id
      AND r.source_type = 'WORK_PROJECT'
      AND r.status = 'ACTIVE'
      AND e.project_id = p_project_id
      AND e.client_id = p_client_id
      AND (p_equipment_id IS NULL OR e.id = p_equipment_id)
    FOR UPDATE OF r
  LOOP
    SELECT on_hand INTO v_on_hand
    FROM public.inventory_balances
    WHERE client_id = p_client_id
      AND location_id = v_res.location_id
      AND product_id = v_res.product_id
      AND variant_id IS NOT DISTINCT FROM v_res.variant_id
    FOR UPDATE;

    UPDATE public.inventory_balances
    SET reserved = GREATEST(0, COALESCE(reserved, 0) - v_res.quantity),
        version = COALESCE(version, 1) + 1,
        updated_at = now()
    WHERE client_id = p_client_id
      AND location_id = v_res.location_id
      AND product_id = v_res.product_id
      AND variant_id IS NOT DISTINCT FROM v_res.variant_id;

    UPDATE public.inventory_reservations
    SET status = 'RELEASED', released_at = now()
    WHERE id = v_res.id;

    INSERT INTO public.inventory_movements (
      client_id, location_id, product_id, variant_id, movement_type, quantity,
      reason, reference_type, reference_id, performed_by, source
    ) VALUES (
      p_client_id, v_res.location_id, v_res.product_id, v_res.variant_id, 'RESERVATION_RELEASED', v_res.quantity,
      'Project reservation released', 'WORK_PROJECT', v_res.source_id, p_actor_id, 'USER'
    );

    UPDATE public.work_project_equipment
    SET quantity_reserved = GREATEST(0, quantity_reserved - v_res.quantity),
        updated_at = now()
    WHERE id = v_res.source_id;

    v_released := v_released + v_res.quantity;
  END LOOP;

  IF v_released <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true);
  END IF;

  INSERT INTO public.work_project_events (
    client_id, project_id, event_type, title, actor_user_id, metadata
  ) VALUES (
    p_client_id, p_project_id, 'STOCK_RELEASED', 'Stock reservation released', p_actor_id,
    jsonb_build_object('quantity', v_released, 'equipment_id', p_equipment_id)
  );

  RETURN jsonb_build_object('ok', true, 'unchanged', false, 'released', v_released);
END;
$$;

REVOKE ALL ON FUNCTION public.release_work_project_stock(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_work_project_stock(uuid, uuid, uuid, uuid) TO service_role;
