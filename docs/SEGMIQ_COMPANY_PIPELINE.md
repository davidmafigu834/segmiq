# SegmiQ Company Pipeline

Route: `/client/leads/pipeline`  
Deal workspace: `/client/deals/[dealId]`  
Deep link: `/client/leads/pipeline?deal=<dealId>`  
At-risk filter: `/client/leads/pipeline?health=at_risk`  
Aggregator: `getCompanyPipelinePageData()` in `lib/sales/get-company-pipeline-page-data.ts`  
Detail: `getCompanyPipelineDealDetail()`  
UI: `components/dashboard/company/pipeline/*`  
API: `GET /api/client/pipeline`, `GET|PATCH /api/client/pipeline/[dealId]`  
Pure metrics: `lib/sales/company-pipeline-metrics.ts`

## Purpose

This is the **Company / Manager Pipeline**, not the salesperson’s personal board.

The salesperson Pipeline (`/sales/pipeline`) answers: *What Deals am I personally trying to win?*  
The Company Pipeline answers: *What Deals are being worked across the company, who owns them, where are they, what are they worth, and which need attention?*

The **table** is company-wide Deal oversight. The **right panel** is quick Deal context. The **full Deal Workspace** (`/client/deals/[id]`) is deep management.

This page is table-first on purpose. It is not a Kanban. There are no funnel, revenue, or source charts under the table — those belong in Reports.

## Shell

Reuses the approved Company Dashboard / Team shell (`CompanyWorkspaceShell`): same white sidebar, SegmiQ logo, account identity, width (228px expanded), nav order, soft-lime active item, top search, notifications, profile, page background, typography, and dark-mode tokens.

Calendar and Tasks are not in Company navigation until those company-scoped pages exist. The lime header action is **Create Deal**, which opens qualified Leads (`/client/leads?status=QUALIFIED`) because Deals are created from Leads — there is no standalone “Add Deal” bypass.

## Scope and permissions

- Tenant: `deals.client_id = session.clientId` (SUPER_ADMIN may preview a client).
- There is no branch / region org model. Visibility is the full company tenant for `CLIENT_MANAGER`.
- **Read:** any company Deal.
- **Stage / activity / Won / Lost / next action:** `canModifyDeal` — salesperson capability and Deal owner (or SUPER_ADMIN). Pure managers are read-only here, matching existing Deal authorization.
- **Owner reassignment:** `canReassignLeads` (company manager of the tenant). Source on the originating Lead does not change.

## Deal stages

Canonical stages from `lib/sales/deals/display.ts`:

`Qualified` · `Scoping` · `Proposal sent` · `Negotiating` · `Won` · `Lost`

There is no Closing stage. Tabs:

| Tab | Logic |
|-----|--------|
| All Deals | Active stages only (not Won/Lost) |
| Qualified / Scoping / Proposal sent / Negotiating | That stage |
| Won | Closed Won |
| Lost | Closed Lost |

## KPIs (exactly six)

All use real Deal data. Unknown commercial value is **never** `$0`.

1. **Total Pipeline Value** — sum of `getDealCommercialValue()` on **active** Deals only. Pending/unknown excluded. Optional supporting: `N Deals awaiting estimate`. Won Deals are not included.
2. **Active Deals** — count in QUALIFIED / SCOPING / PROPOSAL_SENT / NEGOTIATING. Not Leads, not Won/Lost.
3. **Won This Month** — Won Deals with `won_at` in the current calendar month (not accepted Quotes). Trend vs last month when the previous count exists (`formatTrend` never shows Infinity%).
4. **Avg. Deal Value** — mean of **known** active Deal commercial amounts only. Pending omitted. Display `—` when none are known.
5. **Deals at Risk** — `getDealAttentionState()` with the same rule as Company Dashboard: `atRisk` or urgency ≥ 70. Card links to `?health=at_risk`. Zero is real: “No active Deals currently need risk attention.”
6. **Next Actions Due** — Deal `next_action_at` due today or overdue. No “View tasks” link (Company Tasks page does not exist).

## Search, filters, group, sort

Toolbar sits **inside** the Pipeline card, below the tabs.

- Search (300ms debounce): Deal name, customer, location, phone, owner, stage.
- Filters: Owner, Deal health, Next action (overdue / today / week / none), Source, numeric value min/max (pending values are not coerced into range matches).
- Group by: Stage (default) · Owner · None. Stays a table (group header rows). Does not become a board.
- Sort: Next action (default) · Deal value · Expected decision · Newest · Last activity · Attention. Internal numeric urgency is not shown as a column.

## Table columns (desktop)

1. Deal (name + category/`service_summary`)
2. Customer (name + location if present)
3. Stage (small badge)
4. Deal Value (`getDealCommercialValue` — “Value not estimated” when pending)
5. Expected Decision (`expected_decision_at`, labeled **Expected Decision** not Expected Close; missing → “Not set”)
6. Next Action (label + urgency)
7. Owner (avatar; short name at 2xl)
8. More (kebab; `stopPropagation`)

Won/Lost tabs swap Expected Decision / Next Action for Closed Date, Lost Reason, or Source where those fields are meaningful.

Row height ~56px. Hover `#FAFBFC` / dark `#171B17`. Selected `rgba(212,255,79,.16)` light / `.08` dark. Separators `divide-sales-border-subtle`. No zebra.

Row body click selects the Deal and opens the right panel. It does not navigate or open a modal.

## Right Deal panel (section order)

1. Deal name + close
2. Stage control + Deal Value
3. Customer (name, location, phone, WhatsApp when a real href exists)
4. Expected Decision + Deal Owner
5. Next Action (or “No next action scheduled”)
6. View Deal + Log Activity (Log Activity only when `canModify`)
7. Deal Health — **On track / Needs attention / At risk** from attention rules. The bar is categorical, **not** a 72% win probability.
8. Deal Summary — Customer need, Decision maker, Products / Services
9. View full details → `/client/deals/[id]`

No recent activity feed and no charts in this panel.

Initial load does not auto-select a Deal. `?deal=` restores selection. Browser back clears the query and closes the panel. Search/filter that removes the selected Deal closes the panel.

## Deal Health

Same source as Dashboard, Team, salesperson Pipeline, and Picks: `getDealAttentionState()`.

| State | Meaning |
|-------|---------|
| On track | Next action exists, activity is recent enough, not overdue |
| Needs attention | Follow-up due soon, decision soon, pending estimate, etc. |
| At risk | No next action, overdue, stale inactivity (`atRisk` or urgency ≥ 70) |

## Performance

Active + recent closed Deals are loaded in one tenant query (cap 2000) with batched leads, owners, and quote totals (`loadQuoteTotalsByDealId`). Detail is fetched separately on row click. Won-this-month counts use dedicated `count` queries.

## Responsive

| Breakpoint | Layout |
|------------|--------|
| ≥1280 | Table ~70% + panel ~360–410px / 30%, tops aligned |
| <1280 | Overlay drawer; table stays usable |
| <768 | 2-column KPIs, chip tabs, Deal cards, full-height sheet with the same panel section order |

## Dark mode

Page `#0B0D0C` · surface `#111411` · borders `#272C27` · selected row soft lime tint. Semantic tokens only.

## Empty / error

- No active Deals → “Qualified opportunities will appear here once your sales team creates Deals from Leads.” + View Leads
- No search/filter matches → clear actions
- Table failure → retry (no fake rows)
- Detail failure → “We couldn't load this Deal” + Retry; table stays up
