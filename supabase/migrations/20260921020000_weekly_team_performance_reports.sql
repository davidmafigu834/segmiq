-- Weekly Team Performance Report
-- Tenant key is client_id. Service role bypasses RLS; anon/authenticated are denied.

-- ---------------------------------------------------------------------------
-- Optional pipeline-health knobs (client baseline / salesperson override)
-- ---------------------------------------------------------------------------
ALTER TABLE public.sales_execution_settings
  ADD COLUMN IF NOT EXISTS weekly_report_health_config jsonb;

COMMENT ON COLUMN public.sales_execution_settings.weekly_report_health_config IS
  'Optional Weekly Team Performance Report thresholds: needsAttentionDays, atRiskDays, stalledHoursByStage, quoteFollowupHours.';

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_team_performance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  report_type text NOT NULL DEFAULT 'weekly_sales'
    CHECK (report_type IN ('weekly_sales')),
  period_start_date date NOT NULL,
  period_end_date date NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  timezone text NOT NULL,
  generated_at timestamptz,
  generation_status text NOT NULL DEFAULT 'scheduled'
    CHECK (generation_status IN (
      'scheduled', 'collecting_data', 'analysing', 'generating', 'ready', 'failed'
    )),
  generated_by_kind text NOT NULL DEFAULT 'system'
    CHECK (generated_by_kind IN ('system', 'user')),
  generated_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  file_key text,
  report_version integer NOT NULL DEFAULT 1,
  currency text NOT NULL DEFAULT 'USD',
  summary_json jsonb,
  metrics_json jsonb,
  insights_json jsonb,
  recommendations_json jsonb,
  salesperson_analysis_json jsonb,
  pipeline_health_json jsonb,
  conversation_insights_json jsonb,
  lost_deal_analysis_json jsonb,
  attention_json jsonb,
  next_week_json jsonb,
  meeting_agenda_json jsonb,
  evidence_json jsonb,
  comparison_json jsonb,
  funnel_json jsonb,
  cover_json jsonb,
  ai_model_reference text,
  ai_status text CHECK (ai_status IS NULL OR ai_status IN ('ok', 'fallback', 'failed', 'skipped')),
  pdf_status text CHECK (pdf_status IS NULL OR pdf_status IN ('ok', 'failed', 'skipped')),
  generation_error text,
  retry_count integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.weekly_team_performance_reports IS
  'Organisation-scoped weekly sales-management reports. Structured JSON is the source of truth; PDFs are derived documents.';

CREATE UNIQUE INDEX IF NOT EXISTS weekly_team_performance_reports_period_uidx
  ON public.weekly_team_performance_reports (client_id, report_type, period_start_date);

CREATE INDEX IF NOT EXISTS weekly_team_performance_reports_client_generated_idx
  ON public.weekly_team_performance_reports (client_id, generated_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS weekly_team_performance_reports_client_status_idx
  ON public.weekly_team_performance_reports (client_id, generation_status);

ALTER TABLE public.weekly_team_performance_reports ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Notifications: deep-link to a weekly report
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS weekly_report_id uuid
    REFERENCES public.weekly_team_performance_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_weekly_report_id
  ON public.notifications (weekly_report_id)
  WHERE weekly_report_id IS NOT NULL;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'NEW_LEAD', 'WHATSAPP_MESSAGE', 'WHATSAPP_CONNECTION_ALERT', 'FOLLOW_UP_DUE', 'FOLLOW_UP_PREP',
    'DEAL_WON', 'LEAD_FLAG', 'UNCONTACTED_MANAGER_ALERT', 'FB_TOKEN_EXPIRED', 'BACKFILL_COMPLETE',
    'PHOTO_UPLOADED', 'STORAGE_WARNING', 'TEAM_MEMBER_JOINED', 'QUOTATION_ALERT', 'AGENT_ALERT',
    'INVENTORY_ALERT', 'COMMERCIAL_IMPORT', 'LEARNING_ALERT', 'COMPLIANCE_ALERT',
    'SALES_FOCUS_DIGEST', 'SOCIAL_INBOX', 'WEEKLY_TEAM_REPORT'
  ));
