-- Release 5.1 safety workflows. Additive and default-off at the application
-- layer. This migration does not migrate a customer, issue/send an invoice,
-- confirm a payment, activate a top-up, or enable financial metering by itself.

create or replace function public.platform_ensure_ai_billing_period(
  p_client_id uuid,
  p_actor_user_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_account public.platform_commercial_accounts%rowtype;
  v_existing uuid;
  v_id uuid := pg_catalog.gen_random_uuid();
  v_conversations integer;
  v_actions integer;
begin
  if not exists(
    select 1 from public.users
    where id=p_actor_user_id and role='SUPER_ADMIN' and is_active=true
  ) then raise exception 'Active SUPER_ADMIN required'; end if;
  if p_period_end <= p_period_start then raise exception 'Invalid billing period'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_client_id::text || ':' || p_period_start::text,0)
  );
  select id into v_existing from public.platform_ai_billing_periods
    where client_id=p_client_id and period_start=p_period_start and period_end=p_period_end;
  if v_existing is not null then return v_existing; end if;
  select * into v_account from public.platform_commercial_accounts
    where client_id=p_client_id for update;
  if not found or v_account.status<>'active' or v_account.ai_sku is null then
    raise exception 'Active contracted Agentic account required';
  end if;
  if length(pg_catalog.btrim(coalesce(v_account.agreement_ref,''))) < 3 then
    raise exception 'Executed agreement reference required';
  end if;
  if v_account.ai_sku='agentic_business' then
    v_conversations := 500; v_actions := 100;
  elsif v_account.ai_sku='agentic_scale' then
    v_conversations := 2000; v_actions := 500;
  else raise exception 'Unsupported Agentic SKU'; end if;
  insert into public.platform_ai_billing_periods(
    id,client_id,period_start,period_end,price_version,ai_sku,
    included_conversations,included_ai_actions,agreement_ref,state
  ) values(
    v_id,p_client_id,p_period_start,p_period_end,v_account.price_version,v_account.ai_sku,
    v_conversations,v_actions,v_account.agreement_ref,'open'
  );
  insert into public.platform_commercial_audit_events(
    client_id,actor_user_id,event_type,subject_table,subject_id,details
  ) values(
    p_client_id,p_actor_user_id,'ai_billing_period_created','platform_ai_billing_periods',
    v_id::text,pg_catalog.jsonb_build_object(
      'period_start',p_period_start,'period_end',p_period_end,'ai_sku',v_account.ai_sku,
      'included_conversations',v_conversations,'included_ai_actions',v_actions
    )
  );
  return v_id;
end $$;

create or replace function public.platform_prepare_ai_topup_invoice(
  p_topup_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_topup public.platform_ai_topup_requests%rowtype;
  v_period public.platform_ai_billing_periods%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_existing_line public.platform_invoice_lines%rowtype;
  v_invoice_id uuid := pg_catalog.gen_random_uuid();
  v_year integer;
  v_next integer;
  v_number text;
begin
  if not exists(
    select 1 from public.users
    where id=p_actor_user_id and role='SUPER_ADMIN' and is_active=true
  ) then raise exception 'Active SUPER_ADMIN required'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_idempotency_key,''))) < 8 then
    raise exception 'Stable idempotency key required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_topup_id::text,0));
  select * into v_topup from public.platform_ai_topup_requests
    where id=p_topup_id for update;
  if not found then raise exception 'Top-up request not found'; end if;
  select * into v_existing_line from public.platform_invoice_lines
    where topup_id=p_topup_id;
  if found then
    return pg_catalog.jsonb_build_object(
      'invoiceId',v_existing_line.invoice_id,'invoiceLineId',v_existing_line.id,'replayed',true
    );
  end if;
  if v_topup.status<>'customer_approved' or v_topup.approved_at is null or
     pg_catalog.length(pg_catalog.btrim(coalesce(v_topup.approval_evidence_ref,''))) < 3 then
    raise exception 'Explicit customer-approved top-up required';
  end if;
  select * into v_period from public.platform_ai_billing_periods
    where id=v_topup.billing_period_id and client_id=v_topup.client_id and state='open'
      and pg_catalog.now() < period_end;
  if not found then raise exception 'Active billing period required'; end if;
  select * into v_subscription from public.subscriptions
    where client_id=v_topup.client_id and product='crm'
    order by created_at desc limit 1;
  if not found then raise exception 'CRM subscription required for invoice ownership'; end if;

  v_year := extract(year from pg_catalog.now())::integer;
  insert into public.billing_document_counters(doc_type,year,last_number)
    values('invoice',v_year,0) on conflict(doc_type,year) do nothing;
  select last_number into v_next from public.billing_document_counters
    where doc_type='invoice' and year=v_year for update;
  v_next := v_next + 1;
  update public.billing_document_counters set last_number=v_next
    where doc_type='invoice' and year=v_year;
  v_number := 'SEG-' || v_year::text || '-' || pg_catalog.lpad(v_next::text,4,'0');

  insert into public.invoices(
    id,subscription_id,client_id,invoice_number,amount,currency,status,
    period_start,period_end,due_at
  ) values(
    v_invoice_id,v_subscription.id,v_topup.client_id,v_number,
    v_topup.total_price_usd_cents::numeric/100,'USD','draft',
    v_period.period_start,v_period.period_end,pg_catalog.now()
  );
  insert into public.platform_invoice_lines(
    invoice_id,client_id,category,sku,price_version,description,contract_reference,
    unit_price_usd_cents,quantity,total_usd_cents,currency,period_start,period_end,
    source_idempotency_key,topup_id
  ) values(
    v_invoice_id,v_topup.client_id,'ai_topup',v_topup.sku,v_topup.price_version,
    'Approved AI conversation top-up',v_period.agreement_ref,
    v_topup.unit_price_usd_cents,v_topup.pack_quantity,v_topup.total_price_usd_cents,
    'USD',v_period.period_start,v_period.period_end,p_idempotency_key,v_topup.id
  );
  update public.platform_ai_topup_requests set
    status='awaiting_payment',invoice_id=v_invoice_id,updated_at=pg_catalog.now()
  where id=v_topup.id;
  insert into public.platform_ai_topup_events(
    topup_id,client_id,actor_user_id,action,from_status,to_status,evidence_ref,correlation_id
  ) values(
    v_topup.id,v_topup.client_id,p_actor_user_id,'draft_invoice_prepared',
    v_topup.status,'awaiting_payment',v_number,p_idempotency_key
  );
  return pg_catalog.jsonb_build_object(
    'invoiceId',v_invoice_id,'invoiceNumber',v_number,'replayed',false
  );
end $$;

create or replace function public.platform_activate_paid_ai_topup(
  p_topup_id uuid,
  p_payment_id uuid,
  p_actor_user_id uuid,
  p_correlation_id text
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_topup public.platform_ai_topup_requests%rowtype;
  v_period public.platform_ai_billing_periods%rowtype;
  v_invoice public.invoices%rowtype;
  v_payment public.payments%rowtype;
begin
  if not exists(
    select 1 from public.users
    where id=p_actor_user_id and role='SUPER_ADMIN' and is_active=true
  ) then raise exception 'Active SUPER_ADMIN required'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_correlation_id,''))) < 8 then
    raise exception 'Stable correlation id required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_topup_id::text,0));
  select * into v_topup from public.platform_ai_topup_requests
    where id=p_topup_id for update;
  if not found then raise exception 'Top-up request not found'; end if;
  if v_topup.status='active' then
    if v_topup.payment_id=p_payment_id then return v_topup.id; end if;
    raise exception 'Top-up is already linked to another payment';
  end if;
  if v_topup.status not in ('awaiting_payment','payment_confirmed') or v_topup.invoice_id is null then
    raise exception 'Prepared top-up invoice required';
  end if;
  select * into v_period from public.platform_ai_billing_periods
    where id=v_topup.billing_period_id and client_id=v_topup.client_id and state='open'
      and pg_catalog.now() < period_end;
  if not found then raise exception 'Top-up billing period has ended'; end if;
  select * into v_invoice from public.invoices
    where id=v_topup.invoice_id and client_id=v_topup.client_id;
  if not found or v_invoice.status<>'paid' or v_invoice.currency<>'USD' or
     pg_catalog.round(v_invoice.amount*100)::integer<>v_topup.total_price_usd_cents then
    raise exception 'Exact paid top-up invoice required';
  end if;
  select * into v_payment from public.payments
    where id=p_payment_id and invoice_id=v_invoice.id and client_id=v_topup.client_id;
  if not found or v_payment.status<>'confirmed' or v_payment.currency<>'USD' or
     pg_catalog.round(v_payment.amount*100)::integer<>v_topup.total_price_usd_cents then
    raise exception 'Exact confirmed payment required';
  end if;
  update public.platform_ai_topup_requests set
    status='active',payment_id=v_payment.id,activated_at=pg_catalog.now(),updated_at=pg_catalog.now()
  where id=v_topup.id;
  insert into public.platform_ai_topup_events(
    topup_id,client_id,actor_user_id,action,from_status,to_status,evidence_ref,correlation_id
  ) values(
    v_topup.id,v_topup.client_id,p_actor_user_id,'paid_topup_activated',
    v_topup.status,'active','payment:'||v_payment.id::text,p_correlation_id
  );
  insert into public.platform_commercial_audit_events(
    client_id,actor_user_id,event_type,subject_table,subject_id,details
  ) values(
    v_topup.client_id,p_actor_user_id,'ai_topup_activated','platform_ai_topup_requests',
    v_topup.id::text,pg_catalog.jsonb_build_object(
      'invoice_id',v_invoice.id,'payment_id',v_payment.id,
      'billing_period_id',v_period.id,'granted_conversations',v_topup.pack_quantity*250
    )
  );
  return v_topup.id;
end $$;

revoke execute on function public.platform_ensure_ai_billing_period(uuid,uuid,timestamptz,timestamptz)
  from public,anon,authenticated;
revoke execute on function public.platform_prepare_ai_topup_invoice(uuid,uuid,text)
  from public,anon,authenticated;
revoke execute on function public.platform_activate_paid_ai_topup(uuid,uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.platform_ensure_ai_billing_period(uuid,uuid,timestamptz,timestamptz)
  to service_role;
grant execute on function public.platform_prepare_ai_topup_invoice(uuid,uuid,text)
  to service_role;
grant execute on function public.platform_activate_paid_ai_topup(uuid,uuid,uuid,text)
  to service_role;
