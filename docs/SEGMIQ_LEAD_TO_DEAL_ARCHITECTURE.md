# SegmiQ Lead → Deal Architecture

## Definitions

### Lead

Someone or a company that **may** have an opportunity to buy. Captures acquisition history:

- Source (Facebook, WhatsApp, website, referral, walk-in, outbound, …)
- Campaign / Instant Form answers (when present)
- Original lead score and first-response timing
- Qualification / discovery notes
- Ownership

A Lead answers: **“Is there a genuine opportunity here?”**

### Deal

A confirmed commercial opportunity a salesperson is actively trying to win.

A Deal answers: **“How do we win this opportunity?”**

## Journey

```
LEAD → FIRST CONTACT → DISCOVERY / QUALIFICATION → DEAL READY
  → DEAL CREATED → SCOPING → PROPOSAL → NEGOTIATION → WON / LOST
```

Facebook / WhatsApp enquiries are **not** Deals until qualified and explicitly created.

## Lead lifecycle (MVP)

| Status | Meaning |
|--------|---------|
| NEW | Fresh enquiry |
| CONTACTED | Actual customer contact occurred |
| QUALIFIED | Commercial opportunity confirmed; Deal may be created |
| CONVERTED_TO_DEAL | Deal exists; Lead preserved for attribution |
| NOT_QUALIFIED | No genuine Deal to pursue |

Legacy commercial statuses (`NEGOTIATING`, `PROPOSAL_SENT`, `WON`, `LOST`) remain in the DB CHECK for migrated/historical rows and are **not** written by new UX.

Call attempts (`no_answer`, `call_back`) do **not** mark Contacted.

## Deal stages

Active: Qualified → Scoping → Proposal sent → Negotiating  
Terminal: Won · Lost

Scoping is intentionally broad (site assessment, measurement, requirements, BOQ, etc.).

## Lead → Deal relationship

- `deals.originating_lead_id` (required)
- `leads.active_deal_id` (convenience for active deal)
- Lead is **never deleted** on conversion
- MVP: one **active** deal per originating lead (unique partial index)
- One customer (`contacts`) may have many deals over time

## Deal Readiness

Centralized in `getDealReadiness()`. Required for Create Deal:

1. Customer requirement understood  
2. Service / project identified  
3. Customer interest confirmed  
4. Next step agreed  

Value estimate is **optional** (may be pending assessment).

## Deal value architecture

Centralized in `getDealCommercialValue()`:

- `KNOWN` / `RANGE` / `PENDING_ESTIMATE`
- Basis: Customer budget · Sales estimate · Latest quote · Won value
- Distinct fields: `customer_budget`, `sales_estimate`, quote totals, `won_value`
- Unknown never displays as `$0`; coverage excludes pending values

## Quotations

- `quotations.lead_id` remains NOT NULL (transition)
- `quotations.deal_id` nullable; set on new Deal-originated quotes
- Multiple quotes per deal supported
- Quote accepted ≠ auto Won; declined ≠ auto Lost

## Tasks / Daily Sales Intelligence

- Pre-conversion: Lead actions (contact, qualify, follow up)
- Post-conversion: Deal actions; no duplicate “contact new lead” for converted leads
- `source_entity_type` includes `deal`
- Pipeline coverage uses **active Deal** commercial values

## Won / Lost vs Not Qualified

| Outcome | Entity |
|---------|--------|
| Not qualified | **Lead** — never became a Deal |
| Won / Lost | **Deal** — genuine opportunity closed |

Win rate = Won / (Won + Lost). Not Qualified is measured separately.

## Legacy migration (`088_deals_lead_to_deal_architecture.sql`)

| Category | Behavior |
|----------|----------|
| NEW / CONTACTED / NOT_QUALIFIED | Remain leads only |
| NEGOTIATING / PROPOSAL_SENT | Create Deal; map stage; lead → CONVERTED_TO_DEAL; copy value only if present |
| WON / LOST | Create closed Deal; attach quotes / win_analysis / call_logs |
| Missing value | `PENDING_ESTIMATE` — never invent |

## Permissions

Same tenant + owner/manager rules as leads. Salespeople cannot create deals from leads they cannot modify.

## Transaction / idempotency

`create_deal_from_lead` Postgres RPC creates deal + updates lead + writes `DEAL_CREATED` event in one transaction. Active-deal unique index prevents duplicates.

## Intentionally deferred

- Configurable discovery templates / industry field builders
- Deal blockers analytics dashboards
- Sales velocity charts (timestamps captured)
- Making `quotations.lead_id` nullable
- Fake stage close-probability forecasting changes

## Salesperson Dashboard semantics

The Dashboard shows **both** Leads and Deals, but never mixes their commercial meaning:

- **Leads** power acquisition: new enquiries, source mix, first-response, qualification funnel top.
- **Deals** power revenue: active deal count, pipeline value (`getDealCommercialValue`), pipeline snapshot stages, won outcomes, deals requiring attention.
- **Today's Focus / plan** come from Daily Sales Intelligence (`fetchDailySalesPlan`) — the same engine as Tasks.
- A new Lead must **not** inflate Active Deals or Pipeline Value until a Deal is created.
- Unknown Deal value displays as “Value not estimated” / awaiting estimate — never `$0`.

See also [SEGMIQ_SALES_DESIGN_SYSTEM.md](./SEGMIQ_SALES_DESIGN_SYSTEM.md) §16 and [SEGMIQ_DAILY_SALES_INTELLIGENCE.md](./SEGMIQ_DAILY_SALES_INTELLIGENCE.md).

## My Pipeline (salesperson)

Route: `/sales/pipeline` · label **My Pipeline**.

Legacy `/sales/leads` redirects to `/sales/pipeline` (or to `/sales/call-now` when `?lead=` is present).

**My Pipeline = my active Deals** — not raw Leads. Cards represent Deals and may reference customer, originating Lead (source / intent score), Quotes, next action, and attention state.

### Stages on the board

Active Kanban columns (source of truth — never Lead-era New/Contacted):

1. Qualified  
2. Scoping  
3. Proposal sent  
4. Negotiating  

Closed tab: Won / Lost list (not Kanban columns). Closing requires deliberate Won/Lost flows (`closeDealWon` / `closeDealLost`).

### Card semantics

- Primary identity: customer name; secondary: Deal name  
- Commercial value via `getDealCommercialValue()` — never show `$0` for unknown  
- Hot/Warm/Cold = originating Lead intent, not Deal stage  
- Source = originating Lead source  
- Attention badges from shared `getDealAttentionState()` (same rules as Daily Sales Intelligence)

### Board / Picks / Closed

| Mode | Behavior |
|------|----------|
| **Board** | Deal Kanban; drag/drop between active stages → `updateDealStage` |
| **Picks** | Ranked Deals needing attention (overdue, at risk, no next action, late-stage, etc.) — same priority engine, not a separate AI ranker |
| **Closed** | Outcome list: Won / Lost filters |

### Deal Detail Drawer

Selecting a card opens a right-side `DealDetailDrawer` (`?deal=<id>`). Full Deal Workspace remains at `/sales/deals/[dealId]`. Drawer sections: intelligence, discovery details, stage progress, next action, quotation status, recent activity.

### Stage changes

One persistence path: `PATCH /api/deals/[id]` → `updateDealStage()`. Drag/drop and drawer stage confirm share it. Rollback + toast on failure.
