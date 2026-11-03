-- Real-estate compliance management foundation.
-- Additive. Does not activate legal gates for existing organisations.
-- Do not apply to production without a reviewed deployment.

ALTER TABLE public.compliance_cases
  ADD COLUMN IF NOT EXISTS context text NOT NULL DEFAULT 'transaction',
  ADD COLUMN IF NOT EXISTS policy_version_id uuid,
  ADD COLUMN IF NOT EXISTS policy_enforced boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legal_route text,
  ADD COLUMN IF NOT EXISTS readiness text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS seller_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reused_from_case_id uuid,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.compliance_case_events
  ADD COLUMN IF NOT EXISTS confidential boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.compliance_cases
    ADD CONSTRAINT compliance_cases_context_check
    CHECK (context IN ('buyer', 'seller', 'property', 'transaction'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.compliance_cases
    ADD CONSTRAINT compliance_cases_readiness_check
    CHECK (readiness IN ('not_started', 'incomplete', 'under_review', 'action_required', 'approved', 'escalated'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.compliance_cases
    ADD CONSTRAINT compliance_cases_legal_route_check
    CHECK (legal_route IS NULL OR legal_route IN ('title_deed', 'cession', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_compliance_buyer_open
  ON public.compliance_cases (client_id, contact_id)
  WHERE context = 'buyer' AND status NOT IN ('closed', 'rejected');

CREATE UNIQUE INDEX IF NOT EXISTS uq_compliance_seller_open
  ON public.compliance_cases (client_id, contact_id)
  WHERE context = 'seller' AND status NOT IN ('closed', 'rejected');

CREATE UNIQUE INDEX IF NOT EXISTS uq_compliance_property_open
  ON public.compliance_cases (client_id, listing_id)
  WHERE context = 'property' AND listing_id IS NOT NULL AND status NOT IN ('closed', 'rejected');

ALTER TABLE public.real_estate_transactions
  ADD COLUMN IF NOT EXISTS legal_route text,
  ADD COLUMN IF NOT EXISTS compliance_readiness text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS legal_transfer_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS payment_evidence_status text NOT NULL DEFAULT 'reported',
  ADD COLUMN IF NOT EXISTS conveyancer_name text,
  ADD COLUMN IF NOT EXISTS conveyancer_reference text;

DO $$ BEGIN
  ALTER TABLE public.real_estate_transactions
    ADD CONSTRAINT re_txn_legal_route_check
    CHECK (legal_route IS NULL OR legal_route IN ('title_deed', 'cession', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.real_estate_transactions
    ADD CONSTRAINT re_txn_compliance_readiness_check
    CHECK (compliance_readiness IN ('not_started', 'incomplete', 'under_review', 'action_required', 'approved', 'escalated'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.real_estate_transactions
    ADD CONSTRAINT re_txn_legal_transfer_check
    CHECK (legal_transfer_status IN ('not_started', 'in_progress', 'clearance_outstanding', 'lodged', 'registered', 'not_applicable'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.real_estate_transactions
    ADD CONSTRAINT re_txn_payment_evidence_check
    CHECK (payment_evidence_status IN ('reported', 'proof_uploaded', 'under_verification', 'independently_confirmed', 'disputed', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.real_estate_transaction_milestones
  DROP CONSTRAINT IF EXISTS real_estate_transaction_milestones_milestone_key_check;

ALTER TABLE public.real_estate_transaction_milestones
  ADD CONSTRAINT real_estate_transaction_milestones_milestone_key_check
  CHECK (milestone_key IN (
    'agreement_drafted', 'agreement_signed', 'deposit_received', 'balance_received',
    'conveyancing_started', 'conveyancing_complete', 'inspection_booked', 'inspection_complete',
    'keys_handed_over', 'commission_invoiced', 'commission_settled', 'other',
    'conveyancer_instructed', 'title_or_rights_check', 'rates_clearance', 'tax_assessment',
    'cgt_clearance', 'deeds_or_cession_lodged', 'registration_confirmed', 'handover_authorised'
  ));

CREATE TABLE IF NOT EXISTS public.compliance_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'active', 'retired')),
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  enforcement jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_from date,
  review_note text,
  activated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  activated_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, template_key, version)
);

CREATE INDEX IF NOT EXISTS idx_compliance_policy_client ON public.compliance_policy_versions (client_id, status);

CREATE TABLE IF NOT EXISTS public.compliance_case_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  compliance_case_id uuid NOT NULL REFERENCES public.compliance_cases(id) ON DELETE CASCADE,
  requirement_key text NOT NULL,
  label text NOT NULL,
  state text NOT NULL DEFAULT 'not_started' CHECK (state IN (
    'not_started', 'awaiting_information', 'submitted', 'under_review',
    'more_information_required', 'verified', 'rejected', 'waived', 'not_applicable'
  )),
  mandatory boolean NOT NULL DEFAULT false,
  waiver_permitted boolean NOT NULL DEFAULT false,
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('field', 'document', 'party', 'milestone', 'payment')),
  field_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  document_type text,
  sort_order integer NOT NULL DEFAULT 0,
  waiver_reason text,
  decision_reason text,
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  policy_version_id uuid REFERENCES public.compliance_policy_versions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (compliance_case_id, requirement_key)
);

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_case ON public.compliance_case_requirements (client_id, compliance_case_id);

CREATE TABLE IF NOT EXISTS public.compliance_evidence_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  compliance_case_id uuid NOT NULL REFERENCES public.compliance_cases(id) ON DELETE CASCADE,
  requirement_id uuid REFERENCES public.compliance_case_requirements(id) ON DELETE SET NULL,
  document_requirement_id uuid REFERENCES public.compliance_document_requirements(id) ON DELETE SET NULL,
  invitation_id uuid,
  storage_key text NOT NULL,
  checksum_sha256 text NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 10000000),
  original_filename text,
  version_number integer NOT NULL CHECK (version_number > 0),
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  scan_status text NOT NULL DEFAULT 'unscanned' CHECK (scan_status IN ('unscanned', 'clean', 'quarantined')),
  legal_hold boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_evidence_case ON public.compliance_evidence_versions (client_id, compliance_case_id, created_at);

CREATE TABLE IF NOT EXISTS public.compliance_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  compliance_case_id uuid NOT NULL REFERENCES public.compliance_cases(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  purpose text NOT NULL CHECK (purpose IN ('submission', 'correction')),
  requirement_keys text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'created' CHECK (status IN (
    'created', 'sent', 'opened', 'in_progress', 'submitted', 'changes_requested', 'expired', 'revoked'
  )),
  expires_at timestamptz NOT NULL,
  recipient_email text,
  recipient_phone text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sent_at timestamptz,
  opened_at timestamptz,
  submitted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_invites_case ON public.compliance_invitations (client_id, compliance_case_id);

CREATE TABLE IF NOT EXISTS public.compliance_invitation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invitation_id uuid NOT NULL REFERENCES public.compliance_invitations(id) ON DELETE CASCADE,
  otp_hash text,
  otp_expires_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  verified_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_invite_sessions ON public.compliance_invitation_sessions (invitation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.compliance_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  compliance_case_id uuid NOT NULL REFERENCES public.compliance_cases(id) ON DELETE CASCADE,
  requirement_id uuid REFERENCES public.compliance_case_requirements(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  due_at timestamptz,
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_work_client ON public.compliance_work_items (client_id, status, due_at);

ALTER TABLE public.compliance_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_case_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_evidence_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_invitation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_work_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.compliance_policy_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.compliance_case_requirements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.compliance_evidence_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.compliance_invitations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.compliance_invitation_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.compliance_work_items FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compliance_policy_versions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compliance_case_requirements TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.compliance_evidence_versions TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.compliance_invitations TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.compliance_invitation_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compliance_work_items TO service_role;

DROP TRIGGER IF EXISTS compliance_policy_set_updated_at ON public.compliance_policy_versions;
CREATE TRIGGER compliance_policy_set_updated_at
  BEFORE UPDATE ON public.compliance_policy_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS compliance_requirements_set_updated_at ON public.compliance_case_requirements;
CREATE TRIGGER compliance_requirements_set_updated_at
  BEFORE UPDATE ON public.compliance_case_requirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS compliance_work_set_updated_at ON public.compliance_work_items;
CREATE TRIGGER compliance_work_set_updated_at
  BEFORE UPDATE ON public.compliance_work_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.compliance_prevent_evidence_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'RE403: Compliance evidence versions are retained.';
  END IF;
  IF NEW.storage_key IS DISTINCT FROM OLD.storage_key OR NEW.checksum_sha256 IS DISTINCT FROM OLD.checksum_sha256 THEN
    RAISE EXCEPTION 'RE403: Evidence content cannot be replaced in place.';
  END IF;
  IF OLD.legal_hold AND NEW.legal_hold = false THEN
    RAISE EXCEPTION 'RE403: Legal hold cannot be cleared here.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS compliance_evidence_retain ON public.compliance_evidence_versions;
CREATE TRIGGER compliance_evidence_retain
  BEFORE UPDATE OR DELETE ON public.compliance_evidence_versions
  FOR EACH ROW EXECUTE FUNCTION public.compliance_prevent_evidence_delete();

CREATE OR REPLACE FUNCTION public.compliance_requirement_decide_atomic(
  p_client_id uuid,
  p_requirement_id uuid,
  p_expected_state text,
  p_actor_id uuid,
  p_next_state text,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_req public.compliance_case_requirements%ROWTYPE;
  v_case public.compliance_cases%ROWTYPE;
  v_readiness text;
  v_open integer;
BEGIN
  SELECT * INTO v_req FROM public.compliance_case_requirements
    WHERE id = p_requirement_id AND client_id = p_client_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RE404: Requirement not found.'; END IF;
  IF v_req.state IS DISTINCT FROM p_expected_state THEN
    RAISE EXCEPTION 'RE409: This requirement changed. Refresh and try again.';
  END IF;
  IF p_next_state NOT IN ('under_review', 'more_information_required', 'verified', 'rejected', 'waived', 'not_applicable') THEN
    RAISE EXCEPTION 'RE400: Invalid requirement decision.';
  END IF;
  IF NOT (
    (v_req.state = 'submitted' AND p_next_state IN ('under_review', 'more_information_required', 'rejected', 'verified')) OR
    (v_req.state = 'under_review' AND p_next_state IN ('verified', 'more_information_required', 'rejected', 'waived')) OR
    (v_req.state = 'not_started' AND p_next_state = 'not_applicable') OR
    (v_req.state = 'awaiting_information' AND p_next_state = 'not_applicable') OR
    (v_req.state = p_next_state)
  ) THEN RAISE EXCEPTION 'RE409: That decision is not available.'; END IF;

  SELECT * INTO v_case FROM public.compliance_cases WHERE id = v_req.compliance_case_id AND client_id = p_client_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RE404: Compliance case not found.'; END IF;
  IF p_next_state IN ('verified', 'waived', 'rejected') AND (
    p_actor_id = v_case.created_by OR p_actor_id = v_case.buyer_agent_id OR p_actor_id = v_case.submitted_by
  ) THEN RAISE EXCEPTION 'RE409: Independent review is required.'; END IF;
  IF p_next_state = 'waived' AND (v_req.waiver_permitted IS NOT TRUE OR length(btrim(coalesce(p_reason, ''))) < 8) THEN
    RAISE EXCEPTION 'RE409: A waiver needs policy permission and a reason.';
  END IF;
  IF p_next_state IN ('rejected', 'more_information_required') AND length(btrim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'RE400: A reason is required.';
  END IF;

  UPDATE public.compliance_case_requirements SET
    state = p_next_state,
    decision_reason = NULLIF(btrim(coalesce(p_reason, '')), ''),
    waiver_reason = CASE WHEN p_next_state = 'waived' THEN NULLIF(btrim(coalesce(p_reason, '')), '') ELSE waiver_reason END,
    decided_by = p_actor_id,
    decided_at = now()
  WHERE id = v_req.id;

  SELECT count(*) INTO v_open FROM public.compliance_case_requirements
    WHERE compliance_case_id = v_case.id AND client_id = p_client_id AND mandatory = true
      AND state NOT IN ('verified', 'waived', 'not_applicable');
  v_readiness := CASE
    WHEN v_case.status IN ('edd_required', 'restricted') THEN 'escalated'
    WHEN EXISTS (
      SELECT 1 FROM public.compliance_case_requirements r
      WHERE r.compliance_case_id = v_case.id AND r.mandatory AND r.state IN ('rejected', 'more_information_required')
    ) THEN 'action_required'
    WHEN v_case.status = 'approved' AND v_open = 0 THEN 'approved'
    WHEN EXISTS (
      SELECT 1 FROM public.compliance_case_requirements r
      WHERE r.compliance_case_id = v_case.id AND r.state IN ('submitted', 'under_review')
    ) OR v_case.status IN ('under_review', 'ready_for_review') THEN 'under_review'
    ELSE 'incomplete'
  END;
  UPDATE public.compliance_cases SET readiness = v_readiness WHERE id = v_case.id;

  INSERT INTO public.compliance_case_events (
    client_id, compliance_case_id, event_type, summary, before_value, after_value, created_by, confidential
  ) VALUES (
    p_client_id, v_case.id, 'REQUIREMENT_DECIDED', 'A requirement decision was recorded.',
    v_req.state, p_next_state, p_actor_id, v_case.status = 'edd_required'
  );
  RETURN jsonb_build_object('requirement_id', v_req.id, 'state', p_next_state, 'readiness', v_readiness);
END;
$$;

REVOKE ALL ON FUNCTION public.compliance_requirement_decide_atomic(uuid, uuid, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compliance_requirement_decide_atomic(uuid, uuid, text, uuid, text, text) TO service_role;

COMMENT ON TABLE public.compliance_policy_versions IS
  'Organisation policy versions. Enforcement flags default off. Templates are not legal determinations.';
COMMENT ON TABLE public.compliance_work_items IS
  'Compliance follow-ups. Marking an item done does not verify the underlying requirement.';
COMMENT ON COLUMN public.compliance_evidence_versions.scan_status IS
  'unscanned until a malware scanner is connected. Phase 1 does not claim a file is clean.';

DO $$ BEGIN
  ALTER TABLE public.compliance_evidence_versions
    ADD CONSTRAINT compliance_evidence_invitation_fk
    FOREIGN KEY (invitation_id) REFERENCES public.compliance_invitations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
