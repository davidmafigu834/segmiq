-- Atomic mutation boundary used only by SUPER_ADMIN-guarded server routes.

-- R1 did not persist a consent reference on a scheduled change. R2 adds it so
-- a renewal-dated change can be applied later without parsing human text.
alter table public.platform_plan_change_requests
  add column if not exists agreement_ref text;

create or replace function public.platform_validate_price_snapshot(p_snapshot jsonb)
returns void language plpgsql set search_path=public,pg_catalog as $$
declare v_crm integer; v_ai integer := 0; v_seats integer; v_monthly integer; v_cycle integer; v_ai_sku text;
begin
  if p_snapshot->>'catalogueVersion' <> '2026-10-22' or p_snapshot->>'currency' <> 'USD' then raise exception 'Invalid catalogue version or currency'; end if;
  v_seats := (p_snapshot->>'purchasedSeats')::integer;
  if v_seats < 1 then raise exception 'Purchased seats must be positive'; end if;
  select price_usd_cents into strict v_crm from public.platform_price_catalog
    where sku=p_snapshot->>'crmSku' and version=p_snapshot->>'catalogueVersion' and is_available=true and effective_from <= current_date;
  v_ai_sku := nullif(p_snapshot->>'aiSku','');
  if v_ai_sku is not null then
    if p_snapshot->>'crmSku' <> 'crm_growth' then raise exception 'Agentic AI requires Growth'; end if;
    select price_usd_cents into strict v_ai from public.platform_price_catalog
      where sku=v_ai_sku and version=p_snapshot->>'catalogueVersion' and is_available=true and effective_from <= current_date;
  end if;
  v_monthly := v_crm*v_seats+v_ai;
  v_cycle := v_monthly * case when p_snapshot->>'billingCycle'='annual' then 12 when p_snapshot->>'billingCycle'='monthly' then 1 else 0 end;
  if (p_snapshot->>'seatUnitPriceUsdCents')::integer <> v_crm
    or (p_snapshot->>'crmMonthlyUsdCents')::integer <> v_crm*v_seats
    or (p_snapshot->>'aiMonthlyUsdCents')::integer <> v_ai
    or (p_snapshot->>'recurringMonthlyUsdCents')::integer <> v_monthly
    or (p_snapshot->>'recurringCycleUsdCents')::integer <> v_cycle then raise exception 'Price snapshot does not match canonical catalogue'; end if;
end $$;

create or replace function public.platform_apply_plan_change(
  p_client_id uuid, p_actor_user_id uuid, p_expected_snapshot jsonb, p_proposed_snapshot jsonb,
  p_effective_at timestamptz, p_charge_handling text, p_reason text, p_idempotency_key text, p_agreement_ref text
) returns uuid language plpgsql set search_path = public, pg_catalog as $$
declare
  v_account public.platform_commercial_accounts%rowtype;
  v_existing uuid;
  v_id uuid := gen_random_uuid();
  v_apply_now boolean;
begin
  if not exists(select 1 from public.users where id=p_actor_user_id and role='SUPER_ADMIN' and is_active=true) then raise exception 'SUPER_ADMIN required'; end if;
  select id into v_existing from public.platform_plan_change_requests where idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  select * into v_account from public.platform_commercial_accounts where client_id=p_client_id for update;
  if not found then raise exception 'Commercial account not found'; end if;
  if v_account.agreed_price_snapshot <> p_expected_snapshot then raise exception 'Stale commercial account snapshot'; end if;
  perform public.platform_validate_price_snapshot(p_proposed_snapshot);
  if coalesce((p_proposed_snapshot->>'recurringMonthlyUsdCents')::integer,0) > coalesce((p_expected_snapshot->>'recurringMonthlyUsdCents')::integer,0)
     and length(btrim(coalesce(p_agreement_ref,''))) < 3 then raise exception 'Customer consent evidence required'; end if;
  v_apply_now := p_charge_handling <> 'at_renewal' and p_effective_at <= now();
  insert into public.platform_plan_change_requests(
    id,client_id,requested_by,reviewed_by,status,current_snapshot,proposed_snapshot,
    effective_at,charge_handling,reason,idempotency_key,agreement_ref,review_note,
    reviewed_at,applied_at
  ) values(
    v_id,p_client_id,p_actor_user_id,p_actor_user_id,
    case when v_apply_now then 'applied' else 'approved' end,
    p_expected_snapshot,p_proposed_snapshot,p_effective_at,p_charge_handling,p_reason,
    p_idempotency_key,p_agreement_ref,
    'External consent reference: '||coalesce(p_agreement_ref,'not required'),now(),
    case when v_apply_now then now() else null end
  );
  if v_apply_now then
    update public.platform_commercial_accounts set
      crm_sku=p_proposed_snapshot->>'crmSku', ai_sku=nullif(p_proposed_snapshot->>'aiSku',''),
      price_version=p_proposed_snapshot->>'catalogueVersion', purchased_seats=(p_proposed_snapshot->>'purchasedSeats')::integer,
      billing_cycle=p_proposed_snapshot->>'billingCycle', agreed_price_snapshot=p_proposed_snapshot,
      agreement_ref=coalesce(p_agreement_ref,agreement_ref), updated_by=p_actor_user_id, updated_at=now()
    where client_id=p_client_id;
  end if;
  insert into public.platform_commercial_audit_events(client_id,actor_user_id,event_type,subject_table,subject_id,details)
  values(
    p_client_id,p_actor_user_id,
    case when v_apply_now then 'plan_change_applied' else 'plan_change_scheduled' end,
    'platform_plan_change_requests',v_id::text,
    jsonb_build_object('before',p_expected_snapshot,'after',p_proposed_snapshot,
      'effective_at',p_effective_at,'charge_handling',p_charge_handling,
      'consent_reference',p_agreement_ref)
  );
  return v_id;
end $$;

create or replace function public.platform_apply_approved_plan_change(
  p_request_id uuid,
  p_actor_user_id uuid
) returns uuid language plpgsql set search_path = public, pg_catalog as $$
declare
  v_request public.platform_plan_change_requests%rowtype;
  v_account public.platform_commercial_accounts%rowtype;
begin
  if not exists(
    select 1 from public.users
    where id=p_actor_user_id and role='SUPER_ADMIN' and is_active=true
  ) then raise exception 'SUPER_ADMIN required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_request from public.platform_plan_change_requests
    where id=p_request_id for update;
  if not found then raise exception 'Plan change request not found'; end if;
  if v_request.status='applied' then return v_request.id; end if;
  if v_request.status<>'approved' then raise exception 'Approved plan change required'; end if;
  if v_request.effective_at > now() then raise exception 'Plan change is not effective yet'; end if;
  select * into v_account from public.platform_commercial_accounts
    where client_id=v_request.client_id for update;
  if not found then raise exception 'Commercial account not found'; end if;
  if v_account.agreed_price_snapshot <> v_request.current_snapshot then
    raise exception 'Stale commercial account snapshot';
  end if;
  perform public.platform_validate_price_snapshot(v_request.proposed_snapshot);
  update public.platform_commercial_accounts set
    crm_sku=v_request.proposed_snapshot->>'crmSku',
    ai_sku=nullif(v_request.proposed_snapshot->>'aiSku',''),
    price_version=v_request.proposed_snapshot->>'catalogueVersion',
    purchased_seats=(v_request.proposed_snapshot->>'purchasedSeats')::integer,
    billing_cycle=v_request.proposed_snapshot->>'billingCycle',
    agreed_price_snapshot=v_request.proposed_snapshot,
    agreement_ref=coalesce(v_request.agreement_ref,agreement_ref),
    updated_by=p_actor_user_id,updated_at=now()
  where client_id=v_request.client_id;
  update public.platform_plan_change_requests set
    status='applied',applied_at=now(),reviewed_by=p_actor_user_id,reviewed_at=now()
  where id=v_request.id;
  insert into public.platform_commercial_audit_events(
    client_id,actor_user_id,event_type,subject_table,subject_id,details
  ) values(
    v_request.client_id,p_actor_user_id,'plan_change_applied',
    'platform_plan_change_requests',v_request.id::text,
    jsonb_build_object('before',v_request.current_snapshot,'after',v_request.proposed_snapshot,
      'effective_at',v_request.effective_at,'charge_handling',v_request.charge_handling,
      'consent_reference',v_request.agreement_ref)
  );
  return v_request.id;
end $$;

create or replace function public.platform_grant_grace_period(p_client_id uuid,p_actor_user_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_reason text,p_customer_notified boolean default false)
returns uuid language plpgsql set search_path=public,pg_catalog as $$
declare v_id uuid := gen_random_uuid();
begin
  if not exists(select 1 from public.users where id=p_actor_user_id and role='SUPER_ADMIN' and is_active=true) then raise exception 'SUPER_ADMIN required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text,0));
  if p_ends_at <= p_starts_at or p_ends_at > p_starts_at + interval '30 days' then raise exception 'Grace period must be between 0 and 30 days'; end if;
  if exists(select 1 from public.platform_grace_periods where client_id=p_client_id and ended_at is null and starts_at < p_ends_at and ends_at > p_starts_at) then raise exception 'Overlapping grace period'; end if;
  insert into public.platform_grace_periods(id,client_id,granted_by,starts_at,ends_at,reason,customer_notified) values(v_id,p_client_id,p_actor_user_id,p_starts_at,p_ends_at,p_reason,p_customer_notified);
  insert into public.platform_commercial_audit_events(client_id,actor_user_id,event_type,subject_table,subject_id,details)
  values(p_client_id,p_actor_user_id,'grace_period_granted','platform_grace_periods',v_id::text,jsonb_build_object('starts_at',p_starts_at,'ends_at',p_ends_at,'reason',p_reason,'customer_notified',p_customer_notified));
  return v_id;
end $$;

create or replace function public.platform_migrate_commercial_account(
  p_client_id uuid,p_actor_user_id uuid,p_legacy_subscription_id uuid,p_proposed_snapshot jsonb,
  p_effective_at timestamptz,p_charge_handling text,p_reason text,p_idempotency_key text,p_agreement_ref text
) returns uuid language plpgsql set search_path=public,pg_catalog as $$
declare v_id uuid := gen_random_uuid(); v_existing uuid;
begin
  if not exists(select 1 from public.users where id=p_actor_user_id and role='SUPER_ADMIN' and is_active=true) then raise exception 'SUPER_ADMIN required'; end if;
  if length(btrim(coalesce(p_agreement_ref,''))) < 3 then raise exception 'Customer consent evidence required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text,0));
  select id into v_existing from public.platform_plan_change_requests where idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  if exists(select 1 from public.platform_commercial_accounts where client_id=p_client_id) then raise exception 'Commercial account already exists'; end if;
  if not exists(select 1 from public.subscriptions where id=p_legacy_subscription_id and client_id=p_client_id and product='crm') then raise exception 'Legacy subscription mismatch'; end if;
  perform public.platform_validate_price_snapshot(p_proposed_snapshot);
  insert into public.platform_commercial_accounts(client_id,crm_sku,ai_sku,price_version,purchased_seats,status,billing_cycle,renewal_at,agreed_price_snapshot,agreement_ref,legacy_subscription_id,created_by,updated_by)
  values(p_client_id,p_proposed_snapshot->>'crmSku',nullif(p_proposed_snapshot->>'aiSku',''),p_proposed_snapshot->>'catalogueVersion',(p_proposed_snapshot->>'purchasedSeats')::integer,'active',p_proposed_snapshot->>'billingCycle',p_effective_at,p_proposed_snapshot,p_agreement_ref,p_legacy_subscription_id,p_actor_user_id,p_actor_user_id);
  insert into public.platform_plan_change_requests(id,client_id,requested_by,reviewed_by,status,current_snapshot,proposed_snapshot,effective_at,charge_handling,reason,idempotency_key,review_note,reviewed_at,applied_at)
  values(v_id,p_client_id,p_actor_user_id,p_actor_user_id,'applied',jsonb_build_object('legacy_subscription_id',p_legacy_subscription_id),p_proposed_snapshot,p_effective_at,p_charge_handling,p_reason,p_idempotency_key,'Controlled migration; external consent reference: '||p_agreement_ref,now(),now());
  insert into public.platform_commercial_audit_events(client_id,actor_user_id,event_type,subject_table,subject_id,details)
  values(p_client_id,p_actor_user_id,'commercial_account_migrated','platform_commercial_accounts',p_client_id::text,jsonb_build_object('legacy_subscription_id',p_legacy_subscription_id,'snapshot',p_proposed_snapshot,'effective_at',p_effective_at,'consent_reference',p_agreement_ref));
  return v_id;
end $$;

create or replace function public.platform_end_grace_period(p_client_id uuid,p_grace_id uuid,p_actor_user_id uuid,p_reason text)
returns uuid language plpgsql set search_path=public,pg_catalog as $$
begin
  if not exists(select 1 from public.users where id=p_actor_user_id and role='SUPER_ADMIN' and is_active=true) then raise exception 'SUPER_ADMIN required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text,0));
  update public.platform_grace_periods set ended_at=now(),ended_by=p_actor_user_id where id=p_grace_id and client_id=p_client_id and ended_at is null;
  if not found then raise exception 'Active grace period not found'; end if;
  insert into public.platform_commercial_audit_events(client_id,actor_user_id,event_type,subject_table,subject_id,details)
  values(p_client_id,p_actor_user_id,'grace_period_ended','platform_grace_periods',p_grace_id::text,jsonb_build_object('ended_at',now(),'reason',p_reason));
  return p_grace_id;
end $$;

revoke all on function public.platform_apply_plan_change(uuid,uuid,jsonb,jsonb,timestamptz,text,text,text,text) from public,anon,authenticated;
revoke all on function public.platform_apply_approved_plan_change(uuid,uuid) from public,anon,authenticated;
revoke all on function public.platform_validate_price_snapshot(jsonb) from public,anon,authenticated;
revoke all on function public.platform_migrate_commercial_account(uuid,uuid,uuid,jsonb,timestamptz,text,text,text,text) from public,anon,authenticated;
revoke all on function public.platform_grant_grace_period(uuid,uuid,timestamptz,timestamptz,text,boolean) from public,anon,authenticated;
revoke all on function public.platform_end_grace_period(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.platform_apply_plan_change(uuid,uuid,jsonb,jsonb,timestamptz,text,text,text,text) to service_role;
grant execute on function public.platform_apply_approved_plan_change(uuid,uuid) to service_role;
grant execute on function public.platform_validate_price_snapshot(jsonb) to service_role;
grant execute on function public.platform_migrate_commercial_account(uuid,uuid,uuid,jsonb,timestamptz,text,text,text,text) to service_role;
grant execute on function public.platform_grant_grace_period(uuid,uuid,timestamptz,timestamptz,text,boolean) to service_role;
grant execute on function public.platform_end_grace_period(uuid,uuid,uuid,text) to service_role;
