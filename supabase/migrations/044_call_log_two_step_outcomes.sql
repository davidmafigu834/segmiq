-- Two-step call log outcomes + convert-later picks
-- App-level constants in shared TS file; no Postgres enums.

alter table public.call_logs
  add column if not exists reach_outcome    text,
  add column if not exists result           text,
  add column if not exists reason           text,
  add column if not exists callback_at      timestamptz,
  add column if not exists assets_requested jsonb;

comment on column public.call_logs.reach_outcome is
  'Step 1: reached | no_answer | call_back';
comment on column public.call_logs.result is
  'Step 2 (when reached): won | follow_up | lost | not_qualified';
comment on column public.call_logs.reason is
  'Reason chip for non-win outcomes';
comment on column public.call_logs.callback_at is
  'Scheduled callback time (follow-up / call-back paths)';
comment on column public.call_logs.assets_requested is
  'JSON array of asset type strings requested during the call';

alter table public.call_logs
  drop constraint if exists call_logs_outcome_check;

alter table public.leads
  add column if not exists is_convert_later_pick boolean not null default false,
  add column if not exists convert_later_note    text;

comment on column public.leads.is_convert_later_pick is
  'Salesperson starred this lead from a Follow-up log-call';
comment on column public.leads.convert_later_note is
  'Free-text note captured with convert-later toggle';
