-- Release 5.2 security hardening.
-- Removes destructive service-role privileges that are not required by the
-- commercial application. This migration changes privileges only; it does not
-- mutate commercial data, enable a feature, or change launch mode.

revoke truncate on table
  public.platform_price_catalog,
  public.platform_commercial_accounts,
  public.platform_plan_change_requests,
  public.platform_grace_periods,
  public.platform_commercial_audit_events,
  public.platform_ai_usage_ledger,
  public.platform_sales_prospects,
  public.platform_sales_quotes,
  public.platform_sales_quote_revisions,
  public.platform_sales_quote_events,
  public.platform_sales_quote_links,
  public.platform_agreement_templates,
  public.platform_customer_agreements,
  public.platform_agreement_signers,
  public.platform_agreement_signatures,
  public.platform_agreement_events,
  public.platform_agreement_access_tokens,
  public.platform_ai_billing_periods,
  public.platform_ai_conversation_windows,
  public.platform_ai_usage_source_events,
  public.platform_ai_topup_requests,
  public.platform_ai_topup_events,
  public.platform_invoice_lines,
  public.platform_ai_usage_notification_claims,
  public.platform_commercial_release_controls,
  public.platform_commercial_release_evidence,
  public.platform_commercial_release_decisions,
  public.platform_commercial_reconciliation_findings
from service_role;

-- These relations are append-only by design. Their existing triggers reject
-- row updates/deletes; the privilege restriction adds a second database-level
-- guard and prevents accidental bypass through ordinary service-role SQL.
revoke update, delete on table
  public.platform_price_catalog,
  public.platform_commercial_audit_events,
  public.platform_ai_usage_ledger,
  public.platform_sales_quote_events,
  public.platform_agreement_signatures,
  public.platform_agreement_events,
  public.platform_ai_billing_periods,
  public.platform_ai_conversation_windows,
  public.platform_ai_usage_source_events,
  public.platform_ai_topup_events,
  public.platform_invoice_lines,
  public.platform_commercial_release_evidence,
  public.platform_commercial_release_decisions
from service_role;
