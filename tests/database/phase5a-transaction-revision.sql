-- ISOLATED SYNTHETIC DATABASE ONLY. Not executed by the application or ordinary unit tests.
-- Required session GUCs are supplied by an authorised fixture harness, never customer IDs:
-- segmiq.phase5a_isolated = authorised-synthetic-fixtures
-- segmiq.phase5a_fixture_manifest_sha256 = <64 hex characters>
-- segmiq.phase5a_client_a / transaction_a / actor_a / actor_b = <fixture UUIDs>
-- actor_a must be an active manager in A; actor_b an active salesperson in another tenant.
-- No fixture creation or production execution is performed by this file's preparation.
BEGIN;
DO $$
DECLARE c uuid; t uuid; a uuid; b uuid; rev timestamptz; expected_error boolean;
BEGIN
 IF current_setting('segmiq.phase5a_isolated',true) IS DISTINCT FROM 'authorised-synthetic-fixtures' OR
    coalesce(current_setting('segmiq.phase5a_fixture_manifest_sha256',true),'') !~ '^[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'Refusing execution without explicit isolated fixture authorization';
 END IF;
 c:=current_setting('segmiq.phase5a_client_a')::uuid;
 t:=current_setting('segmiq.phase5a_transaction_a')::uuid;
 a:=current_setting('segmiq.phase5a_actor_a')::uuid;
 b:=current_setting('segmiq.phase5a_actor_b')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=a AND client_id=c AND role='CLIENT_MANAGER' AND is_active) OR
    NOT EXISTS(SELECT 1 FROM public.users WHERE id=b AND client_id<>c AND role='SALESPERSON' AND is_active) THEN
   RAISE EXCEPTION 'Fixture role or tenant preconditions failed';
 END IF;
 SELECT updated_at INTO rev FROM public.real_estate_transactions WHERE id=t AND client_id=c;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing authorised transaction fixture'; END IF;
 IF has_function_privilege('anon','public.re_mobile_transition_transaction(uuid,uuid,text,timestamptz,uuid,text)','EXECUTE') OR
    has_function_privilege('authenticated','public.re_mobile_transition_transaction(uuid,uuid,text,timestamptz,uuid,text)','EXECUTE') THEN
   RAISE EXCEPTION 'Unsafe public execution grant';
 END IF;
 expected_error:=false;
 BEGIN
   PERFORM public.re_mobile_transition_transaction(c,t,'cancel',rev-interval '1 second',a,'synthetic stale-revision check');
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE 'RE409:%' THEN expected_error:=true; ELSE RAISE; END IF;
 END;
 IF NOT expected_error THEN RAISE EXCEPTION 'Expected stale revision rejection'; END IF;
 expected_error:=false;
 BEGIN
   PERFORM public.re_mobile_transition_transaction(c,t,'cancel',rev,b,'synthetic cross-tenant check');
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE 'RE403:%' THEN expected_error:=true; ELSE RAISE; END IF;
 END;
 IF NOT expected_error THEN RAISE EXCEPTION 'Expected cross-tenant rejection'; END IF;
 IF (SELECT updated_at FROM public.real_estate_transactions WHERE id=t AND client_id=c) IS DISTINCT FROM rev THEN
   RAISE EXCEPTION 'Denied operations mutated fixture state';
 END IF;
END $$;
ROLLBACK;
-- A separate two-connection COMMIT race on disposable fixtures remains mandatory.
-- See 05-real-estate-production-acceptance.md; this rollback check is NOT concurrency evidence.
