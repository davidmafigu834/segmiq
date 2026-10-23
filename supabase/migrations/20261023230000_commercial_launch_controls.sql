-- Release 5A/5C: fail-closed commercial launch control and reconciliation evidence.
-- Additive only. This migration does not enable a feature, migrate a customer,
-- change an invoice, grant quota, or alter a subscription.

create table public.platform_commercial_release_controls (
  control_key text primary key check (control_key = 'commercial_v2'),
  mode text not null default 'OFF' check (mode in (
    'OFF','INTERNAL_ONLY','PILOT_ALLOWLIST','GENERAL_AVAILABILITY'
  )),
  version integer not null default 0 check (version >= 0),
  pilot_client_ids uuid[] not null default '{}',
  release_name text not null default 'release_5',
  schema_version text,
  deployed_revision text,
  environment_label text,
  decision_id uuid,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.platform_commercial_release_evidence (
  id uuid primary key default gen_random_uuid(),
  check_key text not null,
  release_name text not null,
  status text not null check (status in ('PASS','FAIL','BLOCKED','UNKNOWN')),
  evidence_ref text,
  detail text not null,
  environment_label text,
  observed_by uuid references public.users(id) on delete set null,
  observed_at timestamptz not null default now(),
  expires_at timestamptz,
  correlation_id text not null unique
);

create index platform_commercial_release_evidence_latest_idx
  on public.platform_commercial_release_evidence(check_key,observed_at desc);

create table public.platform_commercial_release_decisions (
  id uuid primary key default gen_random_uuid(),
  control_key text not null default 'commercial_v2',
  previous_mode text not null,
  requested_mode text not null,
  resulting_mode text not null,
  actor_user_id uuid not null references public.users(id) on delete restrict,
  reason text not null check (length(btrim(reason)) >= 10),
  evidence_refs text[] not null default '{}',
  decision_owner text not null check (length(btrim(decision_owner)) >= 3),
  rollback_owner text not null check (length(btrim(rollback_owner)) >= 3),
  pilot_client_ids uuid[] not null default '{}',
  idempotency_key text not null unique,
  recorded_at timestamptz not null default now()
);

alter table public.platform_commercial_release_controls
  add constraint platform_commercial_release_control_decision_fk
  foreign key (decision_id) references public.platform_commercial_release_decisions(id)
  on delete restrict;

create table public.platform_commercial_reconciliation_findings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete restrict,
  billing_period_start timestamptz,
  billing_period_end timestamptz,
  agreement_reference text,
  quote_revision_reference text,
  invoice_id uuid references public.invoices(id) on delete restrict,
  finding_type text not null,
  status text not null check (status in (
    'MATCHED','EXPECTED_TIMING_DIFFERENCE','MISSING_SOURCE','OVERCOUNT',
    'UNDERCOUNT','MISSING_AGREEMENT','PENDING_APPROVAL','REQUIRES_REVIEW'
  )),
  source_refs jsonb not null default '{}'::jsonb,
  actionable_detail text not null,
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  resolution_reference text,
  correlation_id text not null unique,
  created_at timestamptz not null default now()
);

create index platform_commercial_reconciliation_open_idx
  on public.platform_commercial_reconciliation_findings(status,created_at desc)
  where resolved_at is null;

create trigger platform_commercial_release_evidence_immutable
  before update or delete on public.platform_commercial_release_evidence
  for each row execute function public.platform_deny_history_modifications();
create trigger platform_commercial_release_decisions_immutable
  before update or delete on public.platform_commercial_release_decisions
  for each row execute function public.platform_deny_history_modifications();

alter table public.platform_commercial_release_controls enable row level security;
alter table public.platform_commercial_release_evidence enable row level security;
alter table public.platform_commercial_release_decisions enable row level security;
alter table public.platform_commercial_reconciliation_findings enable row level security;

revoke all on public.platform_commercial_release_controls,
  public.platform_commercial_release_evidence,
  public.platform_commercial_release_decisions,
  public.platform_commercial_reconciliation_findings from public,anon,authenticated;
grant all on public.platform_commercial_release_controls,
  public.platform_commercial_release_evidence,
  public.platform_commercial_release_decisions,
  public.platform_commercial_reconciliation_findings to service_role;

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
  if length(btrim(coalesce(p_reason,''))) < 10 then raise exception 'Release decision reason required'; end if;
  if length(btrim(coalesce(p_decision_owner,''))) < 3 or
     length(btrim(coalesce(p_rollback_owner,''))) < 3 then
    raise exception 'Decision and rollback owners required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('commercial_v2_release_control',0));
  select * into v_existing from public.platform_commercial_release_decisions
    where idempotency_key=p_idempotency_key;
  if found then
    return pg_catalog.jsonb_build_object('decisionId',v_existing.id,'mode',v_existing.resulting_mode,'replayed',true);
  end if;

  insert into public.platform_commercial_release_controls(control_key)
    values ('commercial_v2') on conflict (control_key) do nothing;
  select * into v_control from public.platform_commercial_release_controls
    where control_key='commercial_v2' for update;
  if v_control.version <> p_expected_version then raise exception 'Stale release-control version'; end if;
  if p_requested_mode='PILOT_ALLOWLIST' and cardinality(coalesce(p_pilot_client_ids,'{}'))=0 then
    raise exception 'Pilot mode requires an explicit client allowlist';
  end if;

  if p_requested_mode in ('PILOT_ALLOWLIST','GENERAL_AVAILABILITY') then
    select count(*) into v_missing from unnest(v_required) required(check_key)
    where not exists (
      select 1 from public.platform_commercial_release_evidence evidence
      where evidence.check_key=required.check_key and evidence.status='PASS'
        and (evidence.expires_at is null or evidence.expires_at > now())
        and evidence.observed_at=(
          select max(latest.observed_at)
          from public.platform_commercial_release_evidence latest
          where latest.check_key=required.check_key
        )
    );
    if v_missing > 0 then raise exception 'Required release evidence is missing, stale, or not passing'; end if;
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
    mode=p_requested_mode,version=version+1,pilot_client_ids=coalesce(p_pilot_client_ids,'{}'),
    decision_id=v_decision_id,updated_by=p_actor_user_id,updated_at=now()
  where control_key='commercial_v2';
  insert into public.platform_commercial_audit_events(
    actor_user_id,event_type,subject_table,subject_id,details
  ) values (
    p_actor_user_id,'commercial_release_mode_changed','platform_commercial_release_controls',
    'commercial_v2',pg_catalog.jsonb_build_object(
      'previous_mode',v_control.mode,'resulting_mode',p_requested_mode,
      'decision_id',v_decision_id,'decision_owner',p_decision_owner,
      'rollback_owner',p_rollback_owner,'pilot_count',cardinality(coalesce(p_pilot_client_ids,'{}'))
    )
  );
  return pg_catalog.jsonb_build_object('decisionId',v_decision_id,'mode',p_requested_mode,'replayed',false);
end $$;

revoke execute on function public.platform_set_commercial_release_mode(uuid,text,integer,text,text[],text,text,uuid[],text)
  from public,anon,authenticated;
grant execute on function public.platform_set_commercial_release_mode(uuid,text,integer,text,text[],text,text,uuid[],text)
  to service_role;
