-- Permit a deliberately allowlisted single-customer pilot without claiming
-- that the full General Availability evidence pack has passed.
-- GA remains fail-closed on every required readiness check.

create or replace function public.platform_set_commercial_release_mode(
  p_actor_user_id uuid,
  p_requested_mode text,
  p_expected_version integer,
  p_reason text,
  p_evidence_refs text[],
  p_decision_owner text,
  p_rollback_owner text,
  p_pilot_client_ids uuid[],
  p_idempotency_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_control public.platform_commercial_release_controls%rowtype;
  v_existing public.platform_commercial_release_decisions%rowtype;
  v_decision_id uuid := pg_catalog.gen_random_uuid();
  v_required text[] := array[
    'r2_end_to_end','r3_signing_end_to_end','r4_shadow_reconciled',
    'legacy_classified','invoice_idempotency','tenant_isolation',
    'private_documents','rollback_runbook','support_owner'
  ];
  v_missing integer;
begin
  if not exists(
    select 1 from public.users
    where id=p_actor_user_id and role='SUPER_ADMIN' and is_active=true
  ) then raise exception 'Active SUPER_ADMIN required'; end if;
  if p_requested_mode not in ('OFF','INTERNAL_ONLY','PILOT_ALLOWLIST','GENERAL_AVAILABILITY') then
    raise exception 'Invalid release mode';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_reason,''))) < 10 then
    raise exception 'Release decision reason required';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_decision_owner,''))) < 3 or
     pg_catalog.length(pg_catalog.btrim(coalesce(p_rollback_owner,''))) < 3 then
    raise exception 'Decision and rollback owners required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('commercial_v2_release_control',0)
  );
  select * into v_existing from public.platform_commercial_release_decisions
    where idempotency_key=p_idempotency_key;
  if found then
    return pg_catalog.jsonb_build_object(
      'decisionId',v_existing.id,'mode',v_existing.resulting_mode,'replayed',true
    );
  end if;

  insert into public.platform_commercial_release_controls(control_key)
    values ('commercial_v2') on conflict (control_key) do nothing;
  select * into v_control from public.platform_commercial_release_controls
    where control_key='commercial_v2' for update;
  if v_control.version <> p_expected_version then
    raise exception 'Stale release-control version';
  end if;
  if p_requested_mode='PILOT_ALLOWLIST' and
     pg_catalog.cardinality(coalesce(p_pilot_client_ids,'{}'))=0 then
    raise exception 'Pilot mode requires an explicit client allowlist';
  end if;

  -- A named pilot is intentionally allowed before the complete GA evidence
  -- pack exists. General Availability remains blocked unless every latest
  -- required check is current and passing.
  if p_requested_mode='GENERAL_AVAILABILITY' then
    select count(*) into v_missing from pg_catalog.unnest(v_required) required(check_key)
    where not exists (
      select 1 from public.platform_commercial_release_evidence evidence
      where evidence.check_key=required.check_key and evidence.status='PASS'
        and (evidence.expires_at is null or evidence.expires_at > pg_catalog.now())
        and evidence.observed_at=(
          select max(latest.observed_at)
          from public.platform_commercial_release_evidence latest
          where latest.check_key=required.check_key
        )
    );
    if v_missing > 0 then
      raise exception 'Required GA evidence is missing, stale, or not passing';
    end if;
  end if;

  insert into public.platform_commercial_release_decisions(
    id,previous_mode,requested_mode,resulting_mode,actor_user_id,reason,
    evidence_refs,decision_owner,rollback_owner,pilot_client_ids,idempotency_key
  ) values (
    v_decision_id,v_control.mode,p_requested_mode,p_requested_mode,p_actor_user_id,p_reason,
    coalesce(p_evidence_refs,'{}'),p_decision_owner,p_rollback_owner,
    coalesce(p_pilot_client_ids,'{}'),p_idempotency_key
  );
  update public.platform_commercial_release_controls set
    mode=p_requested_mode,version=version+1,
    pilot_client_ids=coalesce(p_pilot_client_ids,'{}'),decision_id=v_decision_id,
    updated_by=p_actor_user_id,updated_at=pg_catalog.now()
  where control_key='commercial_v2';
  insert into public.platform_commercial_audit_events(
    actor_user_id,event_type,subject_table,subject_id,details
  ) values (
    p_actor_user_id,'commercial_release_mode_changed',
    'platform_commercial_release_controls','commercial_v2',
    pg_catalog.jsonb_build_object(
      'previous_mode',v_control.mode,'resulting_mode',p_requested_mode,
      'decision_id',v_decision_id,'decision_owner',p_decision_owner,
      'rollback_owner',p_rollback_owner,
      'pilot_count',pg_catalog.cardinality(coalesce(p_pilot_client_ids,'{}'))
    )
  );
  return pg_catalog.jsonb_build_object(
    'decisionId',v_decision_id,'mode',p_requested_mode,'replayed',false
  );
end $$;

revoke execute on function public.platform_set_commercial_release_mode(
  uuid,text,integer,text,text[],text,text,uuid[],text
) from public,anon,authenticated;
grant execute on function public.platform_set_commercial_release_mode(
  uuid,text,integer,text,text[],text,text,uuid[],text
) to service_role;
