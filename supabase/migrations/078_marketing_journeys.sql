-- 078_marketing_journeys.sql
-- SegmiQ Journeys: automated CRM-triggered WhatsApp sequences.

CREATE TABLE IF NOT EXISTS marketing_journeys (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name                text NOT NULL,
  description         text,
  template_key        text NOT NULL,
  trigger_type        text NOT NULL,
  trigger_config      jsonb NOT NULL DEFAULT '{}',
  steps               jsonb NOT NULL DEFAULT '[]',
  template_name       text,
  template_language   text NOT NULL DEFAULT 'en',
  template_variables  jsonb NOT NULL DEFAULT '{"1": "{{first_name}}"}',
  is_active           boolean NOT NULL DEFAULT false,
  is_predefined       boolean NOT NULL DEFAULT false,
  stats               jsonb NOT NULL DEFAULT '{"enrolled": 0, "completed": 0, "cancelled": 0, "messages_sent": 0}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_marketing_journeys_client_active
  ON marketing_journeys (client_id, is_active);

ALTER TABLE marketing_journeys ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS marketing_journey_enrollments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id          uuid NOT NULL REFERENCES marketing_journeys(id) ON DELETE CASCADE,
  client_id           uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contact_id          uuid REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id             uuid REFERENCES leads(id) ON DELETE SET NULL,
  phone               text NOT NULL,
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'completed', 'cancelled', 'failed')),
  current_step_index  integer NOT NULL DEFAULT 0,
  next_run_at         timestamptz,
  enrolled_at         timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  context             jsonb NOT NULL DEFAULT '{}',
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_journey_enrollment_unique
  ON marketing_journey_enrollments (journey_id, contact_id)
  WHERE contact_id IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_journey_enrollments_next_run
  ON marketing_journey_enrollments (status, next_run_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_journey_enrollments_journey
  ON marketing_journey_enrollments (journey_id, status);

ALTER TABLE marketing_journey_enrollments ENABLE ROW LEVEL SECURITY;
