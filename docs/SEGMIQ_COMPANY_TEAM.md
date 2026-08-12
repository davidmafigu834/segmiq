# SegmiQ Company Team

Route: `/client/team`  
Member profile: `/client/team/[memberId]`  
Member panel deep-link: `/client/team?member=<id>`  
Aggregator: `getCompanyTeamPageData()` in `lib/sales/get-company-team-page-data.ts`  
Member overview: `getCompanyTeamMemberOverview()` in `lib/sales/get-company-team-member-overview.ts`  
UI: `components/dashboard/company/team/*`  
API: `GET /api/client/team`, `GET /api/client/team/[memberId]`, `POST|PATCH /api/client/team/goals`

## Purpose

The Company Team page helps a manager answer:

- Who is on my sales team?
- Who has active Deals, and how much Pipeline does each person have?
- Who is winning Deals?
- Who has follow-ups slipping?
- Who is progressing toward their Goal?
- Who needs support?
- What is happening with a particular salesperson right now?

The **table** is the team overview. The **right member panel** is individual context. The **lower cards** are team-level insight. That split is intentional.

## Shell

Reuses the approved Company Dashboard shell (`CompanyWorkspaceShell`): same sidebar, search, notifications, Quick actions, page background, typography, and dark-mode tokens. Only the active nav item and main content change.

Calendar and Tasks are not in Company navigation until those company-scoped pages exist.

## Team table

One card containing tabs, search, filters, rows, and pagination.

### Tabs

| Tab | Logic |
|-----|--------|
| All team | Active `SALESPERSON` + `CLIENT_MANAGER` users on the tenant |
| Salespeople | Active `SALESPERSON` |
| Managers | Active `CLIENT_MANAGER` |
| Inactive | `is_active = false` among those roles |

There is no Support role in the product — composition does not invent one.

### Columns

1. **Team member** — avatar, name, title (not email)
2. **Role** — Salesperson / Sales Manager / Manager
3. **Active Deals** — Deals in QUALIFIED / SCOPING / PROPOSAL_SENT / NEGOTIATING owned by the person
4. **Pipeline Value** — `getDealCommercialValue()` on those Deals; pending values are never `$0`
5. **Deals Won** — Won Deals with `won_at` in the current calendar month
6. **Follow-ups Due** — Lead `follow_up_date` + Deal `next_action_at` due/overdue; overdue uses warning text
7. **Goal Progress** — active monthly `REVENUE_WON` Goal; **No Goal** when none (never `0%`)
8. **Attention** — coaching state (not employment status)
9. **More** — row actions (does not select the row)

Employment **Active / Inactive** lives on the member header and Inactive tab — it is not mixed into Attention.

### Attention

Deterministic coaching signals (`deriveCompanyTeamAttention`):

- **Needs attention** — several overdue follow-ups, multiple Deals at risk, or combined operational failures
- **Watch** — a single overdue / at-risk / hot-Lead signal, or Goal progress well behind expected month-to-date pace
- **On track** — otherwise

Goal below 50% alone does **not** mark someone at risk.

### Search and filters

Search matches name, email, role, and title (debounced). Filters: Attention, Has Goal / No Goal, Follow-ups due, Deals at risk.

### Pagination

Default **10 / page**. Inside the table card.

### Row interaction

Clicking the row body opens the right member panel and sets `?member=<id>`. The kebab menu stops propagation so it does not open the panel.

## Member detail panel

Desktop (≥1280px): sits to the right of the table (~400–440px), aligned to the table top, continuing beside the lower analytics cards.

Below 1280px: overlay drawer from the right. Mobile: full-height sheet; Needs attention and Recent activity stack vertically.

Section order (fixed):

1. Member header (avatar, name, title, Active/Inactive, close)
2. Goal progress (ring + monthly Goal / Achieved) or No Goal empty state
3. Six micro KPIs (2×3): Active Deals, Pipeline Value, Deals Won, Overdue follow-ups, Avg. response time, Win rate
4. Performance trend — **Won Deal `won_value`** over the last 6 months
5. Needs attention + Recent activity
6. Actions: View profile, Reassign Leads, Set / Edit Goal, **View pipeline** (primary)

There is no internal manager-to-salesperson messenger. The lime primary action is View pipeline — a real destination.

### Goal metrics

Same `sales_goals` source as the salesperson Goals page (`REVENUE_WON`, current month). Achieved = Won Deal value this month. Managers set/edit Goals via `POST|PATCH /api/client/team/goals` (reuses `createSalesGoal` / `updateSalesGoal`).

### Six performance KPIs

| Metric | Definition |
|--------|------------|
| Active Deals | Active Deal stages, owner = member |
| Pipeline Value | Canonical commercial value; unknown excluded |
| Deals Won | Won this calendar month |
| Overdue follow-ups | Lead follow-ups + Deal next actions past due |
| Avg. response time | `firstQualifyingResponseMinutes` on Leads assigned to the member (last 30 days). Not `updatedAt`. |
| Win rate | Won / (Won + Lost) over the last 6 months. Null / — when no closed Deals. Not Qualified Leads excluded. |

### Performance trend

Won Deal revenue by month (last 6 months). One series. Empty copy: “Not enough performance history yet.”

### Needs attention

Same operational signals as Company Dashboard Focus Areas, scoped to the member (overdue follow-ups, Deals at risk, Hot Leads awaiting contact, no next action). Empty: “No urgent issues need attention.”

### Recent activity

Human-readable `lead_events` for that actor (calls, Deal stage, Quote sent, Won, assignments). Not logins or dashboard views.

## Lower analytics

Sit **under the table only**, same left width as the table, three equal cards:

1. **Team composition** — donut of real role groups (Salespeople / Managers)
2. **Goal coverage** — team average of members who have a Goal (all Goals are monthly revenue, so the average is valid); buckets Above 80% / 50–80% / Below 50% / No Goal set
3. **People needing support** — up to 3 members with Watch or Needs attention, with an explainable reason

## Permissions and scope

All queries filter `client_id`. Managers cannot request another tenant. Opening `?member=` or `/client/team/[memberId]` still checks the member belongs to the company (404 otherwise).

- **Reassign Leads** — `canReassignLeads` → existing `/client/leads?assignedToId=`
- **Set Goal** — company managers
- **Invite / Deactivate** — `canManageClientTeam`

## Query optimization

Table load is one batched aggregator (users, leads, deals, wins, goals, quotations, response signals). The member panel loads independently via `getCompanyTeamMemberOverview` — no per-row Deal/Goal queries.

## Responsive

| Viewport | Behaviour |
|----------|-----------|
| Desktop ≥1280 | Table + inline member panel; 3 analytics columns |
| Compact desktop / tablet | Overlay member drawer; fewer table columns; analytics 2 then 1 column |
| Mobile | Member cards (not a squeezed table); full-height detail sheet; KPIs 2-column; analytics stacked |

## Dark mode

Same `.sales-dashboard-premium` tokens as Company Dashboard. Selected row: `rgba(212,255,79,.08)`. Panel surface `#111411`. Chart tooltips use `useSalesChartColors`.

## Empty / error

| Condition | UI |
|-----------|-----|
| No team | Invite CTA (if permitted) |
| Search miss | Clear search |
| Filter miss | Clear filters |
| No Goal | Empty state + Set Goal |
| No trend | “Not enough performance history yet.” |
| No activity | “No recent sales activity.” |
| Panel fetch fail | Retry; table stays usable |
| Loading | Table column skeleton; panel section skeletons |

## Intentionally deferred

- Company-scoped Calendar / Tasks nav items (not in the live Company app)
- Internal Message action (no messaging product)
- Round-robin reorder UI from the previous Team page (invite remains; roster drag-reorder is not on this operating view)
- Historical team-count trend (no reliable membership snapshot)
