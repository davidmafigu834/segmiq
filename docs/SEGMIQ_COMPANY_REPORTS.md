# SegmiQ Company Reports

Route: `/client/reports`  
Shell: `CompanyWorkspaceShell` (same Company sidebar and chrome as Dashboard, Pipeline, Team)  
Aggregator: `getCompanyReportData()` in `lib/sales/get-company-reports-data.ts`  
API: `GET /api/reports/company` · Export: `GET /api/reports/company/export`  
UI: `components/dashboard/company/reports/*`

## Purpose

The Company Reports page is a **management decision surface**. It answers:

- How much business did we actually win?
- How many Deals did we win?
- How many Leads entered the system?
- How effectively do Leads become real Deals?
- Where are active Deals in the Pipeline?
- Who is producing Won value?
- Which sources generate Leads?
- How fast is the team responding?

It is **not** an operational Deal/Lead editor. Overview has **no detail drawer**.

## Report tabs

| Tab | Content | Loaded when selected |
|-----|---------|----------------------|
| **Overview** | 6 KPIs + analytics grid (see layout) | Default |
| **Sales** | Won Deal results, win rate, salesperson ranking | On select |
| **Pipeline** | Active Deal count/value, stage donut, no-next-action | On select |
| **Leads** | Acquisition, cohort funnel, sources, first response | On select |
| **WhatsApp** | Conversations, first reply, needs-reply, by owner | On select |
| **Quotations** | Created / sent / viewed / accepted / quoted value | On select |
| **Team** | Revenue Won, Deals Won, pipeline, new Leads by person | On select |
| **Customers** | New customers, Won value by customer | On select |
| **Activities** | Calls, follow-ups, messages, quotes sent, Deals created | On select |

Tabs share the global date range, salesperson filter, and Export. Only the active tab is queried.

## Global date range

Presets: Today, Last 7 days, Last 30 days (default), This month, Last month, Last 90 days, Custom.

Boundaries: **`from` inclusive, `to` exclusive** (start of the day after the last included calendar day). Same convention as legacy Reports controls.

## Previous-period methodology

Previous range is the **immediately preceding window of the same millisecond duration**.

Example: current May 17 00:00 → Jun 16 00:00 (May 17–Jun 15 inclusive)  
Previous: Apr 17 00:00 → May 17 00:00 (Apr 17–May 16 inclusive).

Never compare a 30-day window to a calendar month. Previous `0` + current `> 0` displays **New**, never `Infinity%`.

## Filters

Global: **Salesperson** (Lead `assigned_to_id` and Deal `owner_id`).

Not exposed: Branch (no org model), Lead source on Overview (would silently distort Pipeline/Won metrics). Source analysis lives on the Leads tab.

## Export

CSV of the **active tab**, scoped to the selected date range, salesperson filter, and company tenant. Existing product export format is CSV (no PDF/XLSX pipeline).

## Metric definitions

### Revenue Won

Sum of **known** `deals.won_value` for Deals with `stage = WON` and `won_at` in range.

- Dated by **won_at**, not `created_at`, quote sent, or Lead created.
- Quotation totals, Pipeline value, and Lead budgets are **not** Revenue.
- An Accepted Quote does not increase Revenue Won until the Deal is Won.

### Deals Won

Count of Deals whose outcome became Won in the selected range (`won_at`). Not Accepted Quotes.

### New Leads

Non-archived Leads with `created_at` in range. Company `client_id` scope.

### Lead → Deal Conversion

**Cohort:** of Leads created in the selected range, the percentage that now have a Deal (`deals.originating_lead_id` or Lead status `CONVERTED_TO_DEAL`).

This is **not** Deal win rate and **not** `Deals created this month / Leads created this month` across unrelated cohorts.

### Avg. Won Deal Value

`Revenue Won / count of Won Deals with a known won_value`. If none: **—** (not `$0`).

### Avg. First Response

Canonical `firstQualifyingResponseMinutes`: Lead `created_at` → first qualifying salesperson response (call log, outbound WhatsApp, `CALL_LOGGED` / `MESSAGE_SENT`). Not `updatedAt`, assignment, or Lead view.

Lower response time is an improvement (green). Higher is negative (red).

### KPI sparklines

Real bucketed series for the selected current period. Empty/zero series render a flat muted line — no fabricated wiggles.

## Overview analytics grid

Desktop (1100px+):

```
Revenue Won Over Time | Deals by Pipeline Stage | Performance Summary
Leads Created Over Time | Lead Conversion Funnel  | Top Salespeople
                                                  | Leads by Source
```

Widths: `minmax(0, 1.15fr) minmax(0, 1fr) minmax(360px, 28%)`.  
Row 1 min-height ~275px; row 2 ~250px. Right rail spans both rows.

There is **no** third analytics row, Overview table, or detail drawer.

### Revenue Won Over Time

Line chart. Current period: SegmiQ lime. Previous period: muted dashed. Y-axis uses tenant currency (currently USD, same as Pipeline). Granularity Daily / Weekly / Monthly (auto from range, overridable).

Empty: “No Deals were Won during this period.”

### Deals by Pipeline Stage

Donut of **active Deal stages only**: Qualified, Scoping, Proposal sent, Negotiating (`DEAL_ACTIVE_STAGES`). Won/Lost are not in this chart.

Center: active Deal count. Modes: By Count / By Value (`getDealCommercialValue`). Pending estimates are excluded from value and never treated as `$0`; they remain in count mode.

### Performance Summary

| Row | Definition |
|-----|------------|
| Active Deals | Point-in-time active Pipeline count |
| Won Deals | Period `won_at` count |
| Lost Deals | Period `lost_at` count (not Not Qualified Leads). Decrease is positive. |
| Open Pipeline Value | Known commercial values of active Deals |
| Avg. Sales Cycle | Mean days from **Deal `created_at` → won_at/lost_at** for Deals closed in period. Lead created date is not included. Decrease is generally positive. |

### Leads Created Over Time

Lime vertical bars. Lead `created_at`. Integer Y-axis.

### Lead Conversion Funnel

Cohort stages:

1. New Leads  
2. Contacted Leads (status no longer `NEW`)  
3. Qualified Leads  
4. Deals Created  
5. Deals Won (that cohort’s originating Deal is Won)

Conversion % is relative to the initial Lead cohort. Funnel Won can differ from period Deals Won (older Leads won this period are period KPI, not this cohort).

### Top Salespeople

Top 5 with real Won results, ranked by **Revenue Won**. View all → Team tab. No zero-filled fake rows.

### Leads by Source

Canonical acquisition source (`normalizeLeadSource`, same mapping family as Dashboard). Percent = count / all eligible Leads in period. Unknown is kept in the denominator. View all → Leads tab.

## Scope, currency, timezone

- **Company owner / manager:** tenant `client_id`. No branch model.
- **Salesperson filter:** applied to every Overview query that can honor it.
- **Currency:** numeric Deal values are formatted as USD, matching Company Pipeline. SegmiQ does not store a company reporting currency or FX conversion; incompatible multi-currency totals are not invented.
- **Timezone:** date boundaries use the reporting process local calendar (same as Company Dashboard `startOfLocalDay`). No per-company timezone column exists yet.

## Responsive

- **Tablet (<1100px):** do not keep the 3-column desktop rail. KPIs 3×2. Cards stack.
- **Mobile:** vertical insight feed — Header → date/filter/export → scrollable tabs → KPIs (2-col) → Revenue → Performance Summary → Pipeline → Leads created → Funnel → Top Salespeople → Leads by Source → footer. No horizontal body overflow.

## Dark mode

Uses `.sales-dashboard-premium` tokens (page `#0B0D0C`, surface `#111411`, border `#272C27`, lime `#D4FF4F`). Chart grid/axis/tooltip come from `useSalesChartColors()`.

## Loading / empty / errors

Geometry is preserved with skeletons. Empty periods keep chart shells and truthful copy. A failed funnel/pipeline section shows Retry without blanking the whole Overview. Overview is one aggregate request; tab queries are separate.

## Performance

Queries are date-bounded aggregates (Won/Lost by `won_at`/`lost_at`, Leads by `created_at` in current+previous window, active Deals only for Pipeline). The browser does not receive raw historical Lead/Deal dumps.

Indexes reviewed (no new indexes added without measurement):

- `idx_leads_client`, `idx_leads_created`
- `idx_deals_client`, `idx_deals_owner_stage`, `idx_deals_stage`

A composite `(client_id, won_at)` would help Won-period reports if this becomes hot; not added blindly.

Cache: `Cache-Control: private, max-age=30` on the JSON API. Footer **Last updated** is the payload `generatedAt`. Refresh revalidates the active SWR key (no full page reload).

## Drill-down

Optional. Pipeline stage → `/client/leads/pipeline?stage=`. Top salesperson / View all → Team tab. Source View all → Leads tab. The right rail is never replaced by a detail panel.

## Intentionally deferred

- Per-company timezone and reporting currency / FX
- PDF / XLSX export
- True cohort timestamps per milestone (funnel uses current status of the created-in-range Lead cohort)
- Branch/team org model
- Isolated per-widget endpoints (Overview is one aggregator with section-level try/catch)
