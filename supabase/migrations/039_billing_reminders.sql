-- 039_billing_reminders.sql
-- Idempotency timestamps for billing reminder notifications (cron-safe).
-- Additive only — no existing column is altered or dropped.

alter table public.invoices
  add column if not exists overdue_notified_at timestamptz,
  add column if not exists suspension_warning_notified_at timestamptz;
