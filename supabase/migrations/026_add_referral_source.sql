-- 026_add_referral_source.sql
-- Add REFERRAL as a valid lead source

alter table leads
  drop constraint if exists leads_source_check;

alter table leads
  add constraint leads_source_check
  check (source in ('LANDING_PAGE', 'FACEBOOK', 'MANUAL', 'REFERRAL'));
