-- Additive: deep-link quotation notifications. Does not rewrite historical rows.

alter table public.notifications
  add column if not exists quotation_id uuid references public.quotations(id) on delete set null;

create index if not exists idx_notifications_quotation_id
  on public.notifications(quotation_id)
  where quotation_id is not null;
