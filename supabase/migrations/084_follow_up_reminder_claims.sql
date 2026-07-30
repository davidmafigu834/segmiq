-- Idempotent claims for follow-up WhatsApp reminders (stops duplicate cron sends).

create table if not exists public.follow_up_reminder_claims (
  lead_id uuid not null references public.leads(id) on delete cascade,
  kind text not null check (kind in ('due', 'prep', 'callback')),
  period_key text not null,
  created_at timestamptz not null default now(),
  primary key (lead_id, kind, period_key)
);

create index if not exists idx_follow_up_reminder_claims_created
  on public.follow_up_reminder_claims (created_at desc);

comment on table public.follow_up_reminder_claims is
  'Atomic send claims for follow-up WhatsApp crons. period_key is local date (due/prep) or callback_at ISO (callback).';
