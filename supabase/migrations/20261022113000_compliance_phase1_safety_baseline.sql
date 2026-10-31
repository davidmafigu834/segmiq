-- Compliance Phase 1 safety baseline (additive; do not auto-apply).
-- Server-only tables/functions. Application calls use the service role.

-- Metadata-only preflight queries for deployment review:
-- SELECT client_id, offer_id, count(*) FROM compliance_cases WHERE offer_id IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1;
-- SELECT d.id FROM compliance_document_requirements d JOIN compliance_cases c ON c.id=d.compliance_case_id WHERE d.client_id<>c.client_id;
-- SELECT p.id FROM compliance_related_parties p JOIN compliance_cases c ON c.id=p.compliance_case_id WHERE p.client_id<>c.client_id;
-- SELECT e.id FROM compliance_case_events e JOIN compliance_cases c ON c.id=e.compliance_case_id WHERE e.client_id<>c.client_id;
-- SELECT t.id FROM real_estate_transactions t JOIN compliance_cases c ON c.id=t.compliance_case_id
--   WHERE t.compliance_case_id IS NOT NULL AND (t.client_id<>c.client_id OR t.contact_id<>c.contact_id OR t.offer_id IS DISTINCT FROM c.offer_id OR t.listing_id IS DISTINCT FROM c.listing_id);

ALTER TABLE public.compliance_cases
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.compliance_case_events
  ADD COLUMN IF NOT EXISTS before_state jsonb,
  ADD COLUMN IF NOT EXISTS after_state jsonb,
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS confidential boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_compliance_cases_client_id_id
  ON public.compliance_cases (client_id, id);

DO $$ BEGIN
  ALTER TABLE public.compliance_document_requirements
    ADD CONSTRAINT compliance_docs_case_tenant_fk
    FOREIGN KEY (client_id, compliance_case_id)
    REFERENCES public.compliance_cases(client_id, id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.real_estate_transactions
    ADD CONSTRAINT real_estate_transactions_compliance_case_tenant_fk
    FOREIGN KEY (client_id, compliance_case_id)
    REFERENCES public.compliance_cases(client_id, id) ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.compliance_validate_context_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME='compliance_cases' THEN
    IF NOT EXISTS(SELECT 1 FROM public.contacts x WHERE x.id=NEW.contact_id AND x.client_id=NEW.client_id) THEN
      RAISE EXCEPTION 'RE409: Compliance contact belongs to another organisation.';
    END IF;
    IF NEW.lead_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.leads x WHERE x.id=NEW.lead_id AND x.client_id=NEW.client_id AND (x.contact_id IS NULL OR x.contact_id=NEW.contact_id)) THEN
      RAISE EXCEPTION 'RE409: Compliance inquiry belongs to another organisation.';
    END IF;
    IF NEW.offer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.real_estate_offers x WHERE x.id=NEW.offer_id AND x.client_id=NEW.client_id AND x.contact_id=NEW.contact_id AND x.listing_id IS NOT DISTINCT FROM NEW.listing_id) THEN
      RAISE EXCEPTION 'RE409: Compliance offer context is invalid.';
    END IF;
    IF NEW.listing_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.listings x WHERE x.id=NEW.listing_id AND x.client_id=NEW.client_id) THEN
      RAISE EXCEPTION 'RE409: Compliance listing belongs to another organisation.';
    END IF;
  ELSIF TG_TABLE_NAME='real_estate_transactions' AND NEW.compliance_case_id IS NOT NULL THEN
    IF NOT EXISTS(
      SELECT 1 FROM public.compliance_cases c WHERE c.id=NEW.compliance_case_id AND c.client_id=NEW.client_id
        AND c.contact_id=NEW.contact_id AND c.offer_id IS NOT DISTINCT FROM NEW.offer_id
        AND c.listing_id IS NOT DISTINCT FROM NEW.listing_id
        AND (NEW.lead_id IS NULL OR c.lead_id IS NOT DISTINCT FROM NEW.lead_id)
    ) THEN RAISE EXCEPTION 'RE409: Transaction compliance case context is invalid.'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS compliance_cases_validate_context ON public.compliance_cases;
CREATE TRIGGER compliance_cases_validate_context BEFORE INSERT OR UPDATE OF client_id,contact_id,lead_id,offer_id,listing_id
  ON public.compliance_cases FOR EACH ROW EXECUTE FUNCTION public.compliance_validate_context_tenant();
DROP TRIGGER IF EXISTS real_estate_transactions_validate_compliance_context ON public.real_estate_transactions;
CREATE TRIGGER real_estate_transactions_validate_compliance_context BEFORE INSERT OR UPDATE OF client_id,contact_id,lead_id,offer_id,listing_id,compliance_case_id
  ON public.real_estate_transactions FOR EACH ROW EXECUTE FUNCTION public.compliance_validate_context_tenant();

DO $$ BEGIN
  ALTER TABLE public.compliance_related_parties
    ADD CONSTRAINT compliance_parties_case_tenant_fk
    FOREIGN KEY (client_id, compliance_case_id)
    REFERENCES public.compliance_cases(client_id, id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.compliance_case_events
    ADD CONSTRAINT compliance_events_case_tenant_fk
    FOREIGN KEY (client_id, compliance_case_id)
    REFERENCES public.compliance_cases(client_id, id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Data API clients have no direct compliance-table access. RLS remains enabled as defence in depth.
ALTER TABLE public.compliance_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_related_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_case_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.compliance_cases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.compliance_document_requirements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.compliance_related_parties FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.compliance_case_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compliance_cases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compliance_document_requirements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compliance_related_parties TO service_role;
GRANT SELECT, INSERT ON TABLE public.compliance_case_events TO service_role;

CREATE OR REPLACE FUNCTION public.compliance_prevent_event_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'RE403: Compliance audit events are append-only.';
END;
$$;

DROP TRIGGER IF EXISTS compliance_events_append_only ON public.compliance_case_events;
CREATE TRIGGER compliance_events_append_only
  BEFORE UPDATE OR DELETE ON public.compliance_case_events
  FOR EACH ROW EXECUTE FUNCTION public.compliance_prevent_event_mutation();

CREATE OR REPLACE FUNCTION public.compliance_apply_mutation_atomic(
  p_client_id uuid,
  p_case_id uuid,
  p_expected_status text,
  p_actor_id uuid,
  p_event_type text,
  p_safe_summary text,
  p_before_value text DEFAULT NULL,
  p_after_value text DEFAULT NULL,
  p_case_patch jsonb DEFAULT '{}'::jsonb,
  p_document_id uuid DEFAULT NULL,
  p_document_status text DEFAULT NULL,
  p_document_review_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_case public.compliance_cases%ROWTYPE;
  v_status text;
  v_required integer;
  v_accepted integer;
  v_directors integer;
  v_owners integer;
  v_profile jsonb;
  v_old_case jsonb;
BEGIN
  SELECT * INTO v_case FROM public.compliance_cases
  WHERE id=p_case_id AND client_id=p_client_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RE404: Compliance case not found.'; END IF;
  IF v_case.status IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'RE409: This compliance case changed while you were working. Refresh and try again.';
  END IF;
  v_old_case := to_jsonb(v_case);

  v_status := coalesce(p_case_patch->>'status', v_case.status);
  IF p_event_type = 'APPROVED' THEN
    IF p_actor_id=v_case.created_by OR p_actor_id=v_case.buyer_agent_id OR p_actor_id=v_case.submitted_by THEN
      RAISE EXCEPTION 'RE409: Independent review is required.';
    END IF;
    IF v_case.status <> 'under_review' THEN RAISE EXCEPTION 'RE409: This case is not ready for approval.'; END IF;
    IF v_case.edd_reason IS NOT NULL THEN RAISE EXCEPTION 'RE409: Enhanced review closure is not implemented; approval is blocked.'; END IF;
    IF v_case.risk_level='unclassified' THEN RAISE EXCEPTION 'RE409: Complete the risk assessment before approval.'; END IF;
    SELECT count(*), count(*) FILTER (WHERE status='accepted' AND (expiry_date IS NULL OR expiry_date >= current_date))
      INTO v_required, v_accepted FROM public.compliance_document_requirements
      WHERE client_id=p_client_id AND compliance_case_id=p_case_id AND required=true;
    IF v_required=0 OR v_accepted<>v_required THEN RAISE EXCEPTION 'RE409: Required accepted evidence is incomplete or expired.'; END IF;
    v_profile := coalesce(v_case.cdd_profile, '{}'::jsonb);
    IF v_case.entity_type='individual' AND (
      nullif(btrim(v_profile->>'legal_name'),'') IS NULL OR nullif(btrim(v_profile->>'date_of_birth'),'') IS NULL OR
      nullif(btrim(v_profile->>'nationality'),'') IS NULL OR nullif(btrim(v_profile->>'identification_type'),'') IS NULL OR
      nullif(btrim(v_profile->>'identification_reference'),'') IS NULL OR nullif(btrim(v_profile->>'residential_address'),'') IS NULL OR
      nullif(btrim(v_profile->>'source_of_funds_status'),'') IS NULL
    ) THEN RAISE EXCEPTION 'RE409: Required customer information is incomplete.'; END IF;
    IF v_case.entity_type='corporate' THEN
      SELECT count(*) FILTER (WHERE relationship_type='director'), count(*) FILTER (WHERE relationship_type='beneficial_owner')
        INTO v_directors, v_owners FROM public.compliance_related_parties
        WHERE client_id=p_client_id AND compliance_case_id=p_case_id;
      IF nullif(btrim(v_profile->>'registered_name'),'') IS NULL OR nullif(btrim(v_profile->>'registration_number'),'') IS NULL OR
         nullif(btrim(v_profile->>'jurisdiction'),'') IS NULL OR nullif(btrim(v_profile->>'registered_address'),'') IS NULL OR
         v_directors<1 OR v_owners<1 THEN RAISE EXCEPTION 'RE409: Required company or beneficial-ownership information is incomplete.'; END IF;
    END IF;
  END IF;

  IF p_document_id IS NOT NULL THEN
    IF p_document_status NOT IN ('accepted','rejected') THEN RAISE EXCEPTION 'RE400: Invalid document decision.'; END IF;
    UPDATE public.compliance_document_requirements SET
      status=p_document_status, reviewed_at=now(), reviewed_by=p_actor_id,
      review_notes=p_document_review_notes, updated_at=now()
    WHERE id=p_document_id AND client_id=p_client_id AND compliance_case_id=p_case_id
      AND storage_key IS NOT NULL AND status IN ('received','under_review','accepted','rejected');
    IF NOT FOUND THEN RAISE EXCEPTION 'RE409: The document is not available for review.'; END IF;
  END IF;

  UPDATE public.compliance_cases SET
    status=v_status,
    submitted_for_review_at=CASE WHEN p_case_patch?'submitted_for_review_at' THEN (p_case_patch->>'submitted_for_review_at')::timestamptz ELSE submitted_for_review_at END,
    submitted_by=CASE WHEN p_case_patch?'submitted_by' THEN (p_case_patch->>'submitted_by')::uuid ELSE submitted_by END,
    review_started_at=CASE WHEN p_case_patch?'review_started_at' THEN (p_case_patch->>'review_started_at')::timestamptz ELSE review_started_at END,
    assigned_compliance_user_id=CASE WHEN p_case_patch?'assigned_compliance_user_id' THEN (p_case_patch->>'assigned_compliance_user_id')::uuid ELSE assigned_compliance_user_id END,
    last_reviewed_at=CASE WHEN p_case_patch?'last_reviewed_at' THEN (p_case_patch->>'last_reviewed_at')::timestamptz ELSE last_reviewed_at END,
    agent_request_message=CASE WHEN p_case_patch?'agent_request_message' THEN p_case_patch->>'agent_request_message' ELSE agent_request_message END,
    edd_reason=CASE WHEN p_case_patch?'edd_reason' THEN p_case_patch->>'edd_reason' ELSE edd_reason END,
    risk_level=CASE WHEN p_case_patch?'risk_level' THEN p_case_patch->>'risk_level' ELSE risk_level END,
    risk_factors=CASE WHEN p_case_patch?'risk_factors' THEN p_case_patch->'risk_factors' ELSE risk_factors END,
    approved_at=CASE WHEN p_case_patch?'approved_at' THEN (p_case_patch->>'approved_at')::timestamptz ELSE approved_at END,
    approved_by=CASE WHEN p_case_patch?'approved_by' THEN (p_case_patch->>'approved_by')::uuid ELSE approved_by END,
    restricted_at=CASE WHEN p_case_patch?'restricted_at' THEN (p_case_patch->>'restricted_at')::timestamptz ELSE restricted_at END,
    restricted_by=CASE WHEN p_case_patch?'restricted_by' THEN (p_case_patch->>'restricted_by')::uuid ELSE restricted_by END,
    restriction_reason=CASE WHEN p_case_patch?'restriction_reason' THEN p_case_patch->>'restriction_reason' ELSE restriction_reason END,
    rejected_at=CASE WHEN p_case_patch?'rejected_at' THEN (p_case_patch->>'rejected_at')::timestamptz ELSE rejected_at END,
    rejected_by=CASE WHEN p_case_patch?'rejected_by' THEN (p_case_patch->>'rejected_by')::uuid ELSE rejected_by END,
    rejection_reason=CASE WHEN p_case_patch?'rejection_reason' THEN p_case_patch->>'rejection_reason' ELSE rejection_reason END,
    internal_notes=CASE WHEN p_case_patch?'internal_notes' THEN p_case_patch->>'internal_notes' ELSE internal_notes END,
    updated_at=now()
  WHERE id=p_case_id AND client_id=p_client_id
  RETURNING * INTO v_case;

  INSERT INTO public.compliance_case_events(
    client_id, compliance_case_id, event_type, summary, before_value, after_value,
    before_state, after_state, request_id, created_by, confidential
  ) VALUES (
    p_client_id, p_case_id, p_event_type, p_safe_summary, p_before_value, p_after_value,
    jsonb_strip_nulls(jsonb_build_object('status',v_old_case->>'status','risk_level',v_old_case->>'risk_level','value',p_before_value)),
    jsonb_strip_nulls(jsonb_build_object('status',v_case.status,'risk_level',v_case.risk_level,'value',p_after_value)),
    gen_random_uuid(), p_actor_id, p_event_type IN ('NOTE_ADDED','RISK_CHANGED','EDD_REQUIRED','RESTRICTED','REJECTED')
  );
  RETURN jsonb_build_object('case',to_jsonb(v_case));
END;
$$;

CREATE OR REPLACE FUNCTION public.re_assert_transaction_compliance(
  p_client_id uuid,
  p_transaction_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_txn public.real_estate_transactions%ROWTYPE;
  v_case public.compliance_cases%ROWTYPE;
  v_business text;
  v_policy jsonb;
  v_require_cdd boolean;
  v_require_approval boolean;
BEGIN
  SELECT * INTO v_txn FROM public.real_estate_transactions
    WHERE id=p_transaction_id AND client_id=p_client_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RE404: Transaction not found.'; END IF;
  SELECT business_type, coalesce(compliance_settings,'{}'::jsonb) INTO v_business,v_policy
    FROM public.clients WHERE id=p_client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RE503: Compliance policy could not be verified.'; END IF;
  IF coalesce(v_business,'') <> 'real_estate' THEN RETURN; END IF;
  IF jsonb_typeof(v_policy) <> 'object' THEN
    RAISE EXCEPTION 'RE503: Compliance policy could not be verified.';
  END IF;
  IF (v_policy?'require_cdd_after_accepted_offer' AND jsonb_typeof(v_policy->'require_cdd_after_accepted_offer')<>'boolean') OR
     (v_policy?'require_approval_before_progression' AND jsonb_typeof(v_policy->'require_approval_before_progression')<>'boolean') THEN
    RAISE EXCEPTION 'RE503: Compliance policy could not be verified.';
  END IF;
  v_require_cdd := coalesce((v_policy->>'require_cdd_after_accepted_offer')::boolean,true);
  v_require_approval := coalesce((v_policy->>'require_approval_before_progression')::boolean,true);
  IF NOT v_require_cdd OR NOT v_require_approval THEN RETURN; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.real_estate_offers o WHERE o.id=v_txn.offer_id AND o.client_id=p_client_id AND o.status='accepted') THEN
    RAISE EXCEPTION 'RE409: Compliance approval for this transaction could not be verified.';
  END IF;
  IF v_txn.compliance_case_id IS NULL THEN RAISE EXCEPTION 'RE409: Compliance approval is required before this transaction can move forward.'; END IF;
  SELECT * INTO v_case FROM public.compliance_cases
    WHERE id=v_txn.compliance_case_id AND client_id=p_client_id FOR SHARE;
  IF NOT FOUND OR v_case.contact_id<>v_txn.contact_id OR v_case.offer_id IS DISTINCT FROM v_txn.offer_id OR
     v_case.listing_id IS DISTINCT FROM v_txn.listing_id OR
     (v_txn.lead_id IS NOT NULL AND v_case.lead_id IS DISTINCT FROM v_txn.lead_id) THEN
    RAISE EXCEPTION 'RE409: Compliance approval for this transaction could not be verified.';
  END IF;
  IF v_case.status IN ('restricted','rejected') THEN RAISE EXCEPTION 'RE409: Compliance review required before this transaction can proceed.'; END IF;
  IF v_case.status<>'approved' THEN RAISE EXCEPTION 'RE409: Compliance approval is required before this transaction can move forward.'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.re_start_transaction_progress_compliance_safe(
  p_client_id uuid, p_transaction_id uuid, p_actor_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_txn public.real_estate_transactions%ROWTYPE;
BEGIN
  PERFORM public.re_assert_transaction_compliance(p_client_id,p_transaction_id);
  UPDATE public.real_estate_transactions SET status='in_progress',updated_at=now()
    WHERE id=p_transaction_id AND client_id=p_client_id AND status IN ('draft','pending_compliance')
    RETURNING * INTO v_txn;
  IF NOT FOUND THEN RAISE EXCEPTION 'RE409: This transaction changed while you were working.'; END IF;
  INSERT INTO public.real_estate_transaction_events(transaction_id,client_id,event_type,note,created_by)
    VALUES(p_transaction_id,p_client_id,'STATUS_CHANGED','Moved to in progress',p_actor_id);
  RETURN jsonb_build_object('transaction',to_jsonb(v_txn));
END;
$$;

CREATE OR REPLACE FUNCTION public.re_complete_transaction_compliance_safe(
  p_client_id uuid, p_transaction_id uuid, p_action text, p_reason text, p_actor_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_action<>'complete' THEN RAISE EXCEPTION 'RE400: Unknown action.'; END IF;
  PERFORM public.re_assert_transaction_compliance(p_client_id,p_transaction_id);
  RETURN public.re_finish_transaction(p_client_id,p_transaction_id,p_action,p_reason,p_actor_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.compliance_prevent_event_mutation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compliance_validate_context_tenant() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compliance_apply_mutation_atomic(uuid,uuid,text,uuid,text,text,text,text,jsonb,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.re_assert_transaction_compliance(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.re_start_transaction_progress_compliance_safe(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.re_complete_transaction_compliance_safe(uuid,uuid,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compliance_apply_mutation_atomic(uuid,uuid,text,uuid,text,text,text,text,jsonb,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.re_start_transaction_progress_compliance_safe(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.re_complete_transaction_compliance_safe(uuid,uuid,text,text,uuid) TO service_role;

COMMENT ON COLUMN public.support_access_grants.scopes IS
  'Data categories: CUSTOMER_PROFILES, LEADS, DEALS, CONVERSATIONS, QUOTATIONS, DOCUMENTS, FILES, AGENT_ACTIVITY, COMPLIANCE.';
