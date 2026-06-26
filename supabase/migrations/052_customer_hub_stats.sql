-- 052_customer_hub_stats.sql
-- Customer Hub manager dashboard aggregation (RPC only — no schema changes).

CREATE OR REPLACE FUNCTION normalize_contact_source(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(trim(COALESCE(raw, ''))) IN ('walk-in', 'walk_in') THEN 'walk_in'
    WHEN lower(trim(COALESCE(raw, ''))) IN ('whatsapp', 'whatsapp_inbound') THEN 'whatsapp_inbound'
    WHEN lower(trim(COALESCE(raw, ''))) = 'whatsapp_saved' THEN 'whatsapp_saved'
    WHEN lower(trim(COALESCE(raw, ''))) IN ('facebook', 'landing_page') THEN 'facebook'
    WHEN lower(trim(COALESCE(raw, ''))) IN ('referral', 'manual') THEN 'referral'
    WHEN lower(trim(COALESCE(raw, ''))) = '' THEN 'other'
    ELSE 'other'
  END;
$$;

CREATE OR REPLACE FUNCTION get_customer_hub_stats(p_client_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH
base_contacts AS (
  SELECT
    c.id,
    c.name,
    c.source,
    normalize_contact_source(c.source) AS src,
    c.lifecycle,
    c.created_at
  FROM contacts c
  WHERE c.client_id = p_client_id
),
contact_call_counts AS (
  SELECT
    bc.id AS contact_id,
    COUNT(cl.id)::int AS total_call_logs,
    MIN(cl.created_at) AS first_call_at
  FROM base_contacts bc
  LEFT JOIN leads l ON l.contact_id = bc.id
  LEFT JOIN call_logs cl ON cl.lead_id = l.id
  GROUP BY bc.id
),
contact_quoted AS (
  SELECT DISTINCT bc.id AS contact_id
  FROM base_contacts bc
  JOIN leads l ON l.contact_id = bc.id
  JOIN quotations q ON q.lead_id = l.id AND q.sent_at IS NOT NULL
),
contact_won AS (
  SELECT DISTINCT bc.id AS contact_id
  FROM base_contacts bc
  LEFT JOIN leads l ON l.contact_id = bc.id
  WHERE bc.lifecycle = 'customer'
     OR l.status = 'WON'
),
contact_followup_due AS (
  SELECT DISTINCT bc.id AS contact_id
  FROM base_contacts bc
  JOIN leads l ON l.contact_id = bc.id
  WHERE l.follow_up_date IS NOT NULL
    AND l.follow_up_date <= CURRENT_DATE
    AND l.status NOT IN ('WON', 'LOST', 'NOT_QUALIFIED')
),
month_bounds AS (
  SELECT
    date_trunc('month', now()) AS m0,
    date_trunc('month', now()) - interval '1 month' AS m1_start,
    date_trunc('month', now()) + interval '1 month' AS m0_end
),
pulse AS (
  SELECT jsonb_build_object(
    'added_today', (
      SELECT COUNT(*)::int FROM base_contacts
      WHERE created_at >= CURRENT_DATE
    ),
    'followups_due', (SELECT COUNT(*)::int FROM contact_followup_due),
    'quotations_sent_month', (
      SELECT COUNT(DISTINCT bc.id)::int
      FROM base_contacts bc
      JOIN leads l ON l.contact_id = bc.id
      JOIN quotations q ON q.lead_id = l.id
      CROSS JOIN month_bounds mb
      WHERE q.sent_at >= mb.m0 AND q.sent_at < mb.m0_end
    ),
    'never_contacted', (
      SELECT COUNT(*)::int
      FROM base_contacts bc
      JOIN contact_call_counts cc ON cc.contact_id = bc.id
      WHERE cc.total_call_logs = 0
    )
  ) AS data
),
source_stats AS (
  SELECT
    bc.src AS source,
    COUNT(*) FILTER (
      WHERE bc.created_at >= (SELECT m0 FROM month_bounds)
        AND bc.created_at < (SELECT m0_end FROM month_bounds)
    )::int AS this_month,
    COUNT(*) FILTER (
      WHERE bc.created_at >= (SELECT m1_start FROM month_bounds)
        AND bc.created_at < (SELECT m0 FROM month_bounds)
    )::int AS last_month,
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE cc.total_call_logs > 0)::int AS followed_up,
    COUNT(*) FILTER (WHERE cq.contact_id IS NOT NULL)::int AS quoted,
    COUNT(*) FILTER (WHERE cw.contact_id IS NOT NULL)::int AS converted
  FROM base_contacts bc
  JOIN contact_call_counts cc ON cc.contact_id = bc.id
  LEFT JOIN contact_quoted cq ON cq.contact_id = bc.id
  LEFT JOIN contact_won cw ON cw.contact_id = bc.id
  GROUP BY bc.src
),
sources_json AS (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'source', ss.source,
      'this_month', ss.this_month,
      'last_month', ss.last_month,
      'followed_up_pct', CASE WHEN ss.total > 0 THEN ROUND(100.0 * ss.followed_up / ss.total)::int ELSE 0 END,
      'quoted_pct', CASE WHEN ss.total > 0 THEN ROUND(100.0 * ss.quoted / ss.total)::int ELSE 0 END,
      'converted_pct', CASE WHEN ss.total > 0 THEN ROUND(100.0 * ss.converted / ss.total)::int ELSE 0 END,
      'health', CASE
        WHEN ss.total = 0 THEN 'healthy'
        WHEN (100.0 * ss.followed_up / ss.total) >= 80 THEN 'healthy'
        WHEN (100.0 * ss.followed_up / ss.total) >= 60 THEN 'needs_attention'
        ELSE 'at_risk'
      END
    )
    ORDER BY ss.source
  ), '[]'::jsonb) AS data
  FROM source_stats ss
),
trend_months AS (
  SELECT generate_series(
    date_trunc('month', now()) - interval '5 months',
    date_trunc('month', now()),
    interval '1 month'
  ) AS month_start
),
trend_json AS (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'month', EXTRACT(MONTH FROM tm.month_start)::int,
      'year', EXTRACT(YEAR FROM tm.month_start)::int,
      'count', COALESCE((
        SELECT COUNT(*)::int FROM base_contacts bc
        WHERE bc.created_at >= tm.month_start
          AND bc.created_at < tm.month_start + interval '1 month'
      ), 0),
      'prior_count', COALESCE((
        SELECT COUNT(*)::int FROM base_contacts bc
        WHERE bc.created_at >= tm.month_start - interval '1 year'
          AND bc.created_at < tm.month_start - interval '1 year' + interval '1 month'
      ), 0)
    )
    ORDER BY tm.month_start
  ), '[]'::jsonb) AS data
  FROM trend_months tm
),
recent_rows AS (
  SELECT
    bc.id,
    COALESCE(bc.name, 'Unnamed') AS name,
    bc.src AS source,
    bc.created_at,
    (
      SELECT u.name
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_to_id
      WHERE l.contact_id = bc.id
      ORDER BY l.created_at DESC
      LIMIT 1
    ) AS salesperson_name,
    CASE
      WHEN cw.contact_id IS NOT NULL THEN 'won'
      WHEN cfd.contact_id IS NOT NULL THEN 'follow_up_due'
      WHEN cq.contact_id IS NOT NULL THEN 'quoted'
      ELSE 'no_contact'
    END AS status
  FROM base_contacts bc
  LEFT JOIN contact_won cw ON cw.contact_id = bc.id
  LEFT JOIN contact_followup_due cfd ON cfd.contact_id = bc.id
  LEFT JOIN contact_quoted cq ON cq.contact_id = bc.id
  ORDER BY bc.created_at DESC
  LIMIT 10
),
recent_json AS (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'initials', upper(left(regexp_replace(COALESCE(r.name, '?'), '[^A-Za-z ]', '', 'g'), 1)
        || COALESCE(nullif(substring(regexp_replace(COALESCE(r.name, '?'), '[^A-Za-z ]', '', 'g') from '\s(\S)'), ''), '')),
      'source', r.source,
      'created_at', r.created_at,
      'salesperson_name', r.salesperson_name,
      'status', r.status
    )
    ORDER BY r.created_at DESC
  ), '[]'::jsonb) AS data
  FROM recent_rows r
),
observation_meta AS (
  SELECT jsonb_build_object(
    'walk_in_no_logs', (
      SELECT COUNT(*)::int
      FROM base_contacts bc
      JOIN contact_call_counts cc ON cc.contact_id = bc.id
      CROSS JOIN month_bounds mb
      WHERE bc.src = 'walk_in'
        AND cc.total_call_logs = 0
        AND bc.created_at >= mb.m0
        AND bc.created_at < mb.m0_end
    ),
    'whatsapp_saved_avg_days', (
      SELECT COALESCE(ROUND(AVG(
        EXTRACT(EPOCH FROM (cc.first_call_at - bc.created_at)) / 86400.0
      ))::int, 0)
      FROM base_contacts bc
      JOIN contact_call_counts cc ON cc.contact_id = bc.id
      WHERE bc.src = 'whatsapp_saved'
        AND cc.first_call_at IS NOT NULL
    ),
    'whatsapp_inbound_avg_hours', (
      SELECT COALESCE(ROUND(AVG(
        EXTRACT(EPOCH FROM (cc.first_call_at - bc.created_at)) / 3600.0
      ))::int, 0)
      FROM base_contacts bc
      JOIN contact_call_counts cc ON cc.contact_id = bc.id
      WHERE bc.src = 'whatsapp_inbound'
        AND cc.first_call_at IS NOT NULL
    ),
    'out_of_budget_single', (
      SELECT COUNT(DISTINCT bc.id)::int
      FROM base_contacts bc
      JOIN leads l ON l.contact_id = bc.id
      JOIN call_logs cl ON cl.lead_id = l.id
      JOIN contact_call_counts cc ON cc.contact_id = bc.id
      WHERE cc.total_call_logs = 1
        AND (
          (cl.outcome = 'NOT_QUALIFIED' AND cl.reason ILIKE '%budget%')
          OR cl.reason IN ('Budget too small', 'Can''t afford now', 'Waiting on money')
        )
    ),
    'referral_converted_pct', (
      SELECT CASE WHEN COUNT(*) > 0
        THEN ROUND(100.0 * COUNT(*) FILTER (WHERE cw.contact_id IS NOT NULL) / COUNT(*))::int
        ELSE 0 END
      FROM base_contacts bc
      LEFT JOIN contact_won cw ON cw.contact_id = bc.id
      WHERE bc.src = 'referral'
    ),
    'facebook_converted_pct', (
      SELECT CASE WHEN COUNT(*) > 0
        THEN ROUND(100.0 * COUNT(*) FILTER (WHERE cw.contact_id IS NOT NULL) / COUNT(*))::int
        ELSE 0 END
      FROM base_contacts bc
      LEFT JOIN contact_won cw ON cw.contact_id = bc.id
      WHERE bc.src = 'facebook'
    ),
    'never_contacted', (
      SELECT COUNT(*)::int
      FROM base_contacts bc
      JOIN contact_call_counts cc ON cc.contact_id = bc.id
      WHERE cc.total_call_logs = 0
    )
  ) AS data
)
SELECT jsonb_build_object(
  'pulse', (SELECT data FROM pulse),
  'sources', (SELECT data FROM sources_json),
  'trend', (SELECT data FROM trend_json),
  'recent', (SELECT data FROM recent_json),
  'observation_meta', (SELECT data FROM observation_meta)
);
$$;
