-- Phase 5: customer portal identities, sessions, and customer-safe document visibility.
-- Portal users are not staff. Default document visibility stays INTERNAL.

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_source_check
  CHECK (source IN (
    'LANDING_PAGE', 'FACEBOOK', 'MANUAL', 'REFERRAL', 'WHATSAPP_INBOUND',
    'WEBSITE', 'FACEBOOK_AD', 'INSTAGRAM', 'CUSTOMER_PORTAL'
  ));

ALTER TABLE public.support_cases
  ALTER COLUMN lead_id DROP NOT NULL;

ALTER TABLE public.support_cases
  ADD COLUMN IF NOT EXISTS customer_message text;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.support_cases'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%reason_category%'
  LOOP
    EXECUTE format('ALTER TABLE public.support_cases DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.support_cases
  ADD CONSTRAINT support_cases_reason_category_check
  CHECK (reason_category IS NULL OR reason_category IN (
    'TECHNICAL', 'INSTALLATION', 'WARRANTY', 'CUSTOMER_SERVICE', 'MAINTENANCE', 'OTHER'
  ));

ALTER TABLE public.document_entity_links
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'INTERNAL';

ALTER TABLE public.document_entity_links DROP CONSTRAINT IF EXISTS document_entity_links_visibility_check;
ALTER TABLE public.document_entity_links
  ADD CONSTRAINT document_entity_links_visibility_check
  CHECK (visibility IN ('INTERNAL', 'CUSTOMER_VISIBLE'));

CREATE TABLE IF NOT EXISTS public.customer_portal_settings (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  show_project_financials boolean NOT NULL DEFAULT true,
  allow_payment_proof_upload boolean NOT NULL DEFAULT true,
  show_assets boolean NOT NULL DEFAULT true,
  show_serial_numbers boolean NOT NULL DEFAULT true,
  show_warranties boolean NOT NULL DEFAULT true,
  allow_support boolean NOT NULL DEFAULT true,
  allow_upgrade_requests boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_portal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  invited_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, contact_id)
);

CREATE INDEX IF NOT EXISTS customer_portal_access_phone_idx
  ON public.customer_portal_access (client_id, phone_e164)
  WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS public.customer_portal_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  access_id uuid NOT NULL REFERENCES public.customer_portal_access(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_portal_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  access_id uuid NOT NULL REFERENCES public.customer_portal_access(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_portal_challenges_phone_idx
  ON public.customer_portal_challenges (client_id, phone_e164, created_at DESC);

CREATE TABLE IF NOT EXISTS public.customer_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  access_id uuid NOT NULL REFERENCES public.customer_portal_access(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_portal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.portal_contact_owns_project(
  p_client_id uuid,
  p_contact_id uuid,
  p_project_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.work_projects
    WHERE id = p_project_id
      AND client_id = p_client_id
      AND contact_id = p_contact_id
  );
$$;

REVOKE ALL ON FUNCTION public.portal_contact_owns_project(uuid, uuid, uuid) FROM PUBLIC;
