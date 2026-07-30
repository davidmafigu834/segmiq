-- Generic claim keys for reminder idempotency (user digests + lead T-30 sends).

create table if not exists public.reminder_send_claims (
  claim_key text primary key,
  created_at timestamptz not null default now()
);

comment on table public.reminder_send_claims is
  'Atomic WhatsApp reminder claims. Keys like morning:{userId}:{date}, t30_rep:{leadId}:{callbackAt}, t30_lead:{leadId}:{callbackAt}.';
