-- Phase 5A: prepared locally with Supabase CLI 2.122.0; NOT APPLIED.
-- Requires approved compliance safety baseline and final-corrections migrations.
-- Validate in an authorised isolated database before requesting production approval.
CREATE OR REPLACE FUNCTION public.re_mobile_transition_transaction(
 p_client_id uuid,p_transaction_id uuid,p_action text,p_expected_updated_at timestamptz,p_actor_id uuid,p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v public.real_estate_transactions%ROWTYPE; result jsonb;
BEGIN
 SELECT * INTO v FROM public.real_estate_transactions WHERE id=p_transaction_id AND client_id=p_client_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'RE404: Transaction not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=p_actor_id AND u.client_id=p_client_id AND u.is_active AND u.role IN ('CLIENT_MANAGER','SALESPERSON')) THEN RAISE EXCEPTION 'RE403: Forbidden'; END IF;
 IF EXISTS(SELECT 1 FROM public.users u WHERE u.id=p_actor_id AND u.role='SALESPERSON') AND NOT (
   coalesce(v.buyer_agent_id=p_actor_id,false) OR coalesce(v.listing_agent_id=p_actor_id,false) OR
   EXISTS(SELECT 1 FROM public.listings l WHERE l.id=v.listing_id AND l.client_id=p_client_id AND l.agent_id=p_actor_id) OR
   EXISTS(SELECT 1 FROM public.real_estate_deal_participants p WHERE p.client_id=p_client_id AND p.transaction_id=p_transaction_id AND p.user_id=p_actor_id AND p.access_status='active' AND p.ended_at IS NULL)
 ) THEN RAISE EXCEPTION 'RE403: Forbidden'; END IF;
 IF p_expected_updated_at IS NULL OR v.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'RE409: Transaction changed; refresh before retrying'; END IF;
 IF p_action='start_progress' THEN
   RETURN public.re_start_transaction_progress_compliance_safe(p_client_id,p_transaction_id,p_actor_id);
 ELSIF p_action='complete' THEN
   RETURN public.re_complete_transaction_compliance_safe(p_client_id,p_transaction_id,p_action,p_reason,p_actor_id);
 ELSIF p_action IN ('cancel','fallen_through') THEN
   RETURN public.re_finish_transaction(p_client_id,p_transaction_id,p_action,p_reason,p_actor_id);
 ELSE RAISE EXCEPTION 'RE400: Unsupported transition'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.re_mobile_transition_transaction(uuid,uuid,text,timestamptz,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.re_mobile_transition_transaction(uuid,uuid,text,timestamptz,uuid,text) TO service_role;
