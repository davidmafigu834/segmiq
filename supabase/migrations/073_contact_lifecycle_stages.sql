-- 073_contact_lifecycle_stages.sql
-- Phase 2: extend contacts.lifecycle beyond lead|customer to relationship stages.
-- Stages: cold → aware → pipeline → customer (customer is sticky).

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_lifecycle_check;

-- Temporary: map legacy 'lead' so new CHECK can be applied before recompute.
UPDATE contacts SET lifecycle = 'cold' WHERE lifecycle = 'lead';

ALTER TABLE contacts
  ADD CONSTRAINT contacts_lifecycle_check
  CHECK (lifecycle IN ('cold', 'aware', 'pipeline', 'customer'));

ALTER TABLE contacts ALTER COLUMN lifecycle SET DEFAULT 'cold';

CREATE OR REPLACE FUNCTION recompute_contact_lifecycle(p_contact_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_lifecycle text;
  v_current text;
BEGIN
  SELECT lifecycle INTO v_current FROM contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Customer is sticky — won business stays in the relationship memory as customer.
  IF v_current = 'customer' THEN
    RETURN 'customer';
  END IF;

  IF EXISTS (
    SELECT 1 FROM leads l
    WHERE l.contact_id = p_contact_id AND l.status = 'WON'
  ) THEN
    v_new_lifecycle := 'customer';
  ELSIF EXISTS (
    SELECT 1 FROM leads l
    WHERE l.contact_id = p_contact_id
      AND l.status NOT IN ('WON', 'LOST', 'NOT_QUALIFIED')
  ) THEN
    v_new_lifecycle := 'pipeline';
  ELSIF EXISTS (
    SELECT 1 FROM call_logs cl
    JOIN leads l ON l.id = cl.lead_id
    WHERE l.contact_id = p_contact_id
  ) THEN
    v_new_lifecycle := 'aware';
  ELSE
    v_new_lifecycle := 'cold';
  END IF;

  IF v_new_lifecycle IS DISTINCT FROM v_current THEN
    UPDATE contacts
    SET lifecycle = v_new_lifecycle, updated_at = now()
    WHERE id = p_contact_id;
  END IF;

  RETURN v_new_lifecycle;
END;
$$;

CREATE OR REPLACE FUNCTION trg_leads_recompute_contact_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.contact_id IS NOT NULL THEN
      PERFORM recompute_contact_lifecycle(OLD.contact_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.contact_id IS DISTINCT FROM NEW.contact_id
    AND OLD.contact_id IS NOT NULL
  THEN
    PERFORM recompute_contact_lifecycle(OLD.contact_id);
  END IF;

  IF NEW.contact_id IS NOT NULL THEN
    PERFORM recompute_contact_lifecycle(NEW.contact_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_contact_lifecycle ON leads;
CREATE TRIGGER leads_contact_lifecycle
  AFTER INSERT OR UPDATE OF status, contact_id OR DELETE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trg_leads_recompute_contact_lifecycle();

CREATE OR REPLACE FUNCTION trg_call_logs_recompute_contact_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_contact_id uuid;
BEGIN
  SELECT l.contact_id INTO v_contact_id
  FROM leads l
  WHERE l.id = NEW.lead_id;

  IF v_contact_id IS NOT NULL THEN
    PERFORM recompute_contact_lifecycle(v_contact_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS call_logs_contact_lifecycle ON call_logs;
CREATE TRIGGER call_logs_contact_lifecycle
  AFTER INSERT ON call_logs
  FOR EACH ROW
  EXECUTE FUNCTION trg_call_logs_recompute_contact_lifecycle();

-- Backfill all contacts to correct stage from leads + call logs.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM contacts LOOP
    PERFORM recompute_contact_lifecycle(r.id);
  END LOOP;
END;
$$;
