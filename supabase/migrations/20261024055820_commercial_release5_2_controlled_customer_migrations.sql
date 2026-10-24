-- Release 5.2 controlled customer migration safety.
-- This migration only replaces a service-role RPC. It does not migrate any
-- customer, alter legacy subscription amounts, create invoices, confirm
-- payments, enable Agentic AI, or change commercial launch mode.

create or replace function public.platform_migrate_commercial_account(
  p_client_id uuid,
  p_actor_user_id uuid,
  p_legacy_subscription_id uuid,
  p_proposed_snapshot jsonb,
  p_effective_at timestamptz,
  p_charge_handling text,
  p_reason text,
  p_idempotency_key text,
  p_agreement_ref text
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := pg_catalog.gen_random_uuid();
  v_existing uuid;
  v_subscription public.subscriptions%rowtype;
  v_renewal_at timestamptz;
begin
  if not exists(
    select 1 from public.users
    where id=p_actor_user_id and role='SUPER_ADMIN' and is_active=true
  ) then raise exception 'Active SUPER_ADMIN required'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_idempotency_key,''))) < 8 then
    raise exception 'Stable idempotency key required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_client_id::text,0));
  select id into v_existing from public.platform_plan_change_requests
    where idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_agreement_ref,''))) < 3 then
    raise exception 'Signed agreement or amendment reference required';
  end if;
  if p_effective_at < pg_catalog.now() - interval '5 minutes' then
    raise exception 'Migration effective date cannot be backdated';
  end if;
  if p_effective_at > pg_catalog.now() + interval '5 minutes' then
    raise exception 'Migration can only be confirmed when its effective time arrives';
  end if;
  if exists(
    select 1 from public.platform_commercial_accounts where client_id=p_client_id
  ) then raise exception 'Commercial account already exists'; end if;
  select * into v_subscription from public.subscriptions
    where id=p_legacy_subscription_id and client_id=p_client_id and product='crm'
    for update;
  if not found then raise exception 'Legacy subscription mismatch'; end if;
  perform public.platform_validate_price_snapshot(p_proposed_snapshot);

  -- The old record remains authoritative history. Renewal is calculated from
  -- the effective instant when the legacy period has already ended.
  v_renewal_at := case
    when v_subscription.current_period_end > p_effective_at
      then v_subscription.current_period_end
    when p_proposed_snapshot->>'billingCycle'='annual'
      then p_effective_at + interval '1 year'
    else p_effective_at + interval '1 month'
  end;

  insert into public.platform_commercial_accounts(
    client_id,crm_sku,ai_sku,price_version,purchased_seats,status,billing_cycle,
    renewal_at,agreed_price_snapshot,agreement_ref,legacy_subscription_id,
    created_by,updated_by
  ) values(
    p_client_id,p_proposed_snapshot->>'crmSku',
    nullif(p_proposed_snapshot->>'aiSku',''),
    p_proposed_snapshot->>'catalogueVersion',
    (p_proposed_snapshot->>'purchasedSeats')::integer,'active',
    p_proposed_snapshot->>'billingCycle',v_renewal_at,p_proposed_snapshot,
    p_agreement_ref,p_legacy_subscription_id,p_actor_user_id,p_actor_user_id
  );
  insert into public.platform_plan_change_requests(
    id,client_id,requested_by,reviewed_by,status,current_snapshot,
    proposed_snapshot,effective_at,charge_handling,reason,idempotency_key,
    agreement_ref,review_note,reviewed_at,applied_at
  ) values(
    v_id,p_client_id,p_actor_user_id,p_actor_user_id,'applied',
    pg_catalog.jsonb_build_object(
      'legacy_subscription_id',p_legacy_subscription_id,
      'legacy_plan',v_subscription.plan,
      'legacy_amount',v_subscription.amount,
      'legacy_currency',v_subscription.currency,
      'legacy_billing_cycle',v_subscription.billing_cycle
    ),
    p_proposed_snapshot,p_effective_at,p_charge_handling,p_reason,
    p_idempotency_key,p_agreement_ref,
    'Controlled migration; legacy financial records preserved; external consent reference: '
      || p_agreement_ref,
    pg_catalog.now(),pg_catalog.now()
  );
  insert into public.platform_commercial_audit_events(
    client_id,actor_user_id,event_type,subject_table,subject_id,details
  ) values(
    p_client_id,p_actor_user_id,'commercial_account_migrated',
    'platform_commercial_accounts',p_client_id::text,
    pg_catalog.jsonb_build_object(
      'legacy_subscription_id',p_legacy_subscription_id,
      'snapshot',p_proposed_snapshot,
      'effective_at',p_effective_at,
      'renewal_at',v_renewal_at,
      'consent_reference',p_agreement_ref,
      'legacy_records_preserved',true
    )
  );
  return v_id;
end $$;

revoke execute on function public.platform_migrate_commercial_account(
  uuid,uuid,uuid,jsonb,timestamptz,text,text,text,text
) from public,anon,authenticated;
grant execute on function public.platform_migrate_commercial_account(
  uuid,uuid,uuid,jsonb,timestamptz,text,text,text,text
) to service_role;
