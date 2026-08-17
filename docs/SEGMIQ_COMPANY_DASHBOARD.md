# SegmiQ Company Dashboard

Route: `/client/dashboard`  
Aggregator: `getCompanySalesDashboard()` in `lib/sales/get-company-sales-dashboard-data.ts`  
UI: `components/dashboard/company/*`  
API: `GET /api/client/dashboard` (tenant-scoped; managers may only request their own `clientId`)

## Philosophy

The **salesperson** dashboard answers: *What should I do next?*  
The **Company dashboard** answers: *What is happening across the sales operation — and where should management intervene?*

It is an operating view for company-scoped visibility: team performance, sales health, pipeline, and attention signals — not a personal task queue with company totals bolted on.

## Company vs salesperson scope

| Dimension | Salesperson (`/sales/dashboard`) | Company (`/client/dashboard`) |
|-----------|----------------------------------|-------------------------------|
| Role | `SALESPERSON` (or manager with `alsoSells` in sales portal) | `CLIENT_MANAGER` (tenant = `clients`) |
| Leads | `assigned_to_id = user` | All leads for `client_id` |
| Deals | `owner_id = user` | All deals for `client_id` |
| Focus | Today's personal plan / NBA | Aggregated operational alerts |
| Goals | Own goal | Per-salesperson progress in Team table |

## Authorization

- Session `clientId` is the tenant boundary. Managers cannot pass another company's `clientId`.
- Super admins may preview with an explicit `clientId` (API).
- There is **no branch/region org model** today — scope is the full client tenant.
- Non-selling managers stay read-oriented for Deal workspaces; deep links use Customer Hub (`/client/leads/pipeline`) unless `alsoSells` enables `/sales/deals/[id]`.

## Information hierarchy

1. Header — **Company / Dashboard**, title **Company dashboard**
2. KPI row (6 commercial metrics)
3. Focus areas that need attention + Lead → Deal Funnel
4. Team performance + Top Lead Sources
5. Pipeline Snapshot (Deals only)
6. Deals at Risk + Revenue trend + Recent team activity

**Mobile order:** Focus Areas → KPIs → Team cards → At risk → Pipeline empty/snapshot → Funnel → Sources → Revenue → Activity.

## KPI definitions

| KPI | Definition | Period |
|-----|------------|--------|
| **New enquiries** | Non-archived Leads created | Last 30 days (vs prior 30) |
| **Qualified Leads** | Leads created in period whose status is QUALIFIED, CONVERTED_TO_DEAL, or legacy commercial (PROPOSAL_SENT / NEGOTIATING / WON) | Last 30 days |
| **Active Deals** | Deal rows in QUALIFIED / SCOPING / PROPOSAL_SENT / NEGOTIATING | Current |
| **Pipeline Value** | Sum of known values via `getDealCommercialValue()` on active Deals; pending never counted as `$0` | Current |
| **Deals Won** | Deals with `stage = WON` and `won_at` in month | This calendar month |
| **Team response time** | Average minutes from Lead `created_at` → first qualifying contact (`firstQualifyingResponseMinutes`: call logs, outbound WhatsApp, CALL_LOGGED / MESSAGE_SENT events). **Not** `updatedAt`. | Last 30 days |

Lower response time is treated as improvement in trend display.

## Focus Areas

Aggregated company signals (max ~3), prioritized:

1. Overdue follow-ups (Lead `follow_up_date` + Deal `next_action_at` overdue)
2. Deals at risk (`getDealAttentionState().atRisk` / high urgency)
3. Hot enquiries awaiting contact (NEW + score ≥ 70 or WhatsApp source)
4. No next action / Unassigned / Awaiting estimate (when significant)

Empty new company shows onboarding CTA (Add salesperson / Add Lead) — not a broken zero grid.

## Team performance

- Eligible users: `ROUND_ROBIN_ELIGIBLE_OR` (salespeople + managers with `also_sells`), active only.
- Preview: up to **5** members; footer → `/client/team`.
- Sort: attention (follow-ups due) → Deals Won → Pipeline value → name.
- Columns: Active Deals, Pipeline Value (canonical commercial value), Deals Won (this month), Follow-ups due, Goal progress.
- **Goal:** active `sales_goals` for current month. If none → **No Goal** (never `0%`).
- Batched queries — no per-salesperson N+1 for deals/goals/wins.

## Lead → Deal Funnel

Period counts for **this calendar month** (not cohort conversion between stages):

Enquiries → Contacted → Qualified Leads → Deals created → Proposal sent → Won.

**Overall conversion** = Won Deals this month ÷ Enquiries created this month. Documented in UI. Stage-to-stage % omitted to avoid misleading non-cohort math.

## Top Lead Sources

Lead volume by source this month (WhatsApp / Facebook / Referral / Website / Walk-in / Other). Bars only on the dashboard; deeper revenue-by-source belongs in Reports.

## Pipeline Snapshot

Active Deal stages only. Values via `getDealCommercialValue()`. Links to `/client/leads/pipeline`.

## Deals at Risk

Top ~5 by urgency then known value. Reason from `getDealAttentionState` / `reasonText`. Empty calm state when none.

## Revenue trend

**Won Deal `won_value`** over last 6 months (Recharts area, SegmiQ lime). Not Pipeline, not Quote totals. Comparison vs previous 6 months when valid.

## Recent team activity

Human-readable `lead_events` (Deal Won/Created/Stage, Quote sent, follow-up completed, assignments, calls). Actor name resolved from users. Max ~5–8 items.

## Empty / error states

| Condition | Behaviour |
|-----------|-----------|
| New company | Focus onboarding; KPIs show 0 / — |
| No Deals | Pipeline empty card + calm at-risk empty |
| No Goals | Team cell **No Goal** |
| No sources | “No Lead source data yet” |
| No revenue | “Revenue history will appear after Deals are Won.” |

Partial module failures should not blank the page (modules are computed in one aggregator today; API returns 500 only on hard failure).

## Query architecture

Single server function `getCompanySalesDashboard({ clientId, alsoSells })`:

1. Parallel fetch: client, team, leads, deals, wins, goals, events  
2. Quotations for active Deal IDs (commercial value)  
3. Response-time signal batch for 30d / prior 30d lead IDs  
4. In-memory aggregates for KPIs, focus, team, funnel, sources, pipeline, risk, revenue, activity  

Tenant filter: every query uses `client_id = clientId`.

## Design

Uses SegmiQ 2.0 sales tokens via `.sales-dashboard-premium` (light `#EEEFE8` / dark `#0B0D0C` page hierarchy). Company shell remains `ClientManagerLayout` / `AppShell` with company-oriented nav labels.

## Loading skeletons

Company Manager routes must look like the live page while data is in flight — same chrome, same grid steps, inner KPI bones. Do not invent loading numbers.

| Rule | Detail |
|------|--------|
| Chrome | `CompanyWorkspaceShell` paints immediately (no empty `mounted` gate) |
| Primitives | `components/dashboard/company/skeletons/CompanySkeletonPrimitives.tsx` — header, KPI card, surface card, table card |
| Grids | `lib/sales/company-skeleton-grids.ts` — must match live page class names |
| Tokens | `Skeleton` from `@/components/sales/ui` (`--sales-skeleton-base`) so dark mode stays correct |
| Routes | `loading.tsx` on dashboard, leads, pipeline, team, customers, quotations, calendar, billing, reports, settings, inbox |

Inbox uses the immersive shell + three-pane skeleton. Calendar must not assume the old AppShell `pl-[252px]` offset.

See also `docs/SEGMIQ_SALES_DESIGN_SYSTEM.md` § Company Dashboard.
