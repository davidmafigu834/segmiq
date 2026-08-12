# SegmiQ Daily Sales Intelligence

Deterministic sales execution layer that answers: **what should I do next to move or create deals?**

Core principle:

> If there are deals to move, help the salesperson move them.  
> If there are not enough deals to move, help them create them.

This is **not** generative AI. Priority is explainable business logic over SegmiQ’s existing data.

---

## Product philosophy

SegmiQ is evolving from a CRM that records activity into a sales execution system that ranks attention.

Flow:

```
Goals → Pipeline coverage → Deal condition → Daily Sales Plan
  → Next Best Action → Tasks / Calls / WhatsApp / Follow-ups / Outreach
  → Outcomes → Pipeline / Goals / Reports
```

**Lead score ≠ attention priority**

| Concept | Meaning |
|---------|---------|
| Lead score / Hot·Warm·Cold | How strong / high-intent is this opportunity? |
| Attention priority | How important is it to act **right now**? |

After a Hot lead is contacted and a follow-up is scheduled, score may stay high while attention priority drops.

Canonical pipeline stages are unchanged:

`NEW → CONTACTED → NEGOTIATING → PROPOSAL_SENT` (closed: `WON` / `LOST` / `NOT_QUALIFIED`)

Intent bands (unchanged): Hot ≥ 70, Warm ≥ 45, Cold &lt; 45.

---

## Architecture

| Module | Path |
|--------|------|
| Types | `lib/sales/intelligence/types.ts` |
| Defaults / weights | `lib/sales/intelligence/defaults.ts` |
| Priority engine | `lib/sales/intelligence/priority-engine.ts` |
| Daily plan service | `lib/sales/intelligence/daily-plan-service.ts` |
| Meaningful activity | `lib/sales/intelligence/meaningful-activity.ts` |
| Pipeline coverage | `lib/sales/intelligence/pipeline-coverage.ts` |
| Focus mode (BUILD/MOVE/CLOSE) | `lib/sales/intelligence/focus-mode.ts` |
| Valid prospect / anti-gaming | `lib/sales/intelligence/valid-prospect.ts` |
| Commitments | `lib/sales/intelligence/commitments.ts` |
| Timezone | `lib/sales/intelligence/timezone.ts` |
| Reason copy | `lib/sales/intelligence/reasons.ts` |

APIs:

- `GET /api/sales/daily-plan`
- `POST /api/sales/daily-plan/actions` (snooze / skip / complete / resolve)
- `GET|PATCH /api/sales/execution-settings`

UI:

- Tasks: `components/sales/intelligence/DailySalesIntelligencePanel.tsx` + Focus Mode overlay
- Goals: `components/sales/goals/GoalsIntelligenceSection.tsx`
- Dashboard: `TodaysPlanCard` + priorities mapped from the same engine

Traditional virtual Tasks (follow-up derived) are **preserved** below the intelligence layer. There is still no standalone tasks table.

---

## Database

Migration: `supabase/migrations/087_sales_execution_intelligence.sql`

1. **`sales_execution_settings`** — opt-in daily commitment targets (prospects/calls/follow-ups/quotes/appointments) + optional JSON overrides for inactivity / weights. Null targets mean “not configured” (never show `0/0`).
2. **`sales_action_states`** — idempotent per-day recommendation state (active / completed / snoozed / skipped / resolved). Does **not** duplicate lead data.

The Daily Sales Plan itself is **computed on read**.

---

## Priority signals

Engine evaluates salesperson-owned **active** leads using:

- lead score / manual priority
- source (inbound vs outbound)
- recency / freshness
- first response (from call logs, outbound WhatsApp, `CALL_LOGGED` / `MESSAGE_SENT` events — not `updatedAt`)
- customer waiting (last WhatsApp message inbound)
- pipeline stage
- last meaningful activity
- `follow_up_date` / `callback_at`
- open quotation (`sent` / `viewed`)
- deal value
- goal remaining + pipeline coverage
- ownership / closed filter

Weights live in `DEFAULT_PRIORITY_WEIGHTS` (overridable via settings JSON later).

### Priority ladder (default)

1. Fresh high-intent inbound  
2. Customer waiting  
3. Overdue / due follow-ups  
4. Late-stage needing action  
5. Quotation follow-up  
6. Stale active deals  
7. Today’s scheduled work  
8. Other tasks  
9. Prospecting (only when meaningful deal queue is clear)

### Action types (internal)

`CONTACT_NEW_LEAD`, `RESPOND_TO_CUSTOMER`, `COMPLETE_FOLLOW_UP`, `FOLLOW_UP_QUOTE`, `FOLLOW_UP_NEGOTIATION`, `REENGAGE_STALE_DEAL`, `COMPLETE_SCHEDULED_CALL`, `CREATE_QUOTE`, `SCHEDULE_NEXT_ACTION`, `PROSPECT_NEW_CUSTOMERS`, `LOG_OUTREACH`, `ADD_VALID_PROSPECT`, `MANUAL_TASK`, `MANAGER_ASSIGNED_TASK`

User-facing labels are humanized in `reasons.ts`. Never expose raw enums or attention scores in primary UI.

### Reason codes

Examples: `HIGH_INTENT_NEW_LEAD`, `CUSTOMER_WAITING`, `FOLLOWUP_OVERDUE`, `QUOTE_WAITING`, `DEAL_STALE`, `NO_NEXT_ACTION`, `GOAL_PIPELINE_LOW`, `PROSPECTING_COMMITMENT`.

Every recommendation includes `reasonCode` + human `reason`.

### Idempotency

Key: `salespersonId|planDate|actionType|sourceEntityId|reasonCode`

Duplicate page loads reuse / update state; conditions that clear (reply sent, follow-up set, deal closed) resolve recommendations.

---

## Focus mode: BUILD / MOVE / CLOSE

Derived (not manually selected by default):

| Mode | When |
|------|------|
| **MOVE** | Priority deal actions exist |
| **CLOSE** | Late-stage (Negotiating / Proposal sent) actions dominate |
| **BUILD** | Deal queue clear and pipeline/goal needs opportunities |

**Action queue always wins** — a Hot inbound still interrupts BUILD prospecting.

---

## Pipeline coverage

`activePipelineValue / remainingGoalValue` when reliable deal values exist.

- Remaining ≤ 0 → goal achieved (no divide-by-zero)
- Missing values → “Coverage unavailable”
- Never render NaN / Infinity

Language is cautious: coverage, not “you will hit your goal.”

---

## Daily commitments (opt-in)

Configured in Goals → Configure (or `PATCH /api/sales/execution-settings`).

Progress is **derived** from real data:

| Commitment | Source |
|------------|--------|
| New prospects | Valid prospecting leads created today |
| Calls | `call_logs` for user today |
| Follow-ups | Qualifying activities / events today |
| Quotes | Quotations created by user today |

Unconfigured commitments are omitted from UI.

---

## Valid prospect / anti-gaming

`isValidProspectingLead()` requires:

- meaningful identity
- usable phone or email
- salesperson ownership
- not archived / test
- not duplicate phone/email in the same day batch
- source in prospecting-eligible set (`MANUAL`, `REFERRAL`) — **not** Facebook / WhatsApp inbound / website by default
- MANUAL sources require outreach activity when the flag is known

Inbound acquisition leads do **not** count as salesperson prospecting.

---

## Timezone & working days

Plan date uses agency `default_timezone` with fallback `Africa/Harare` (existing CRM convention).

Working days fallback: Mon–Fri (`DEFAULT_SALES_EXECUTION.workingDays`). Custom calendars are deferred.

---

## Authorization

All APIs use `requireSalesActorFromRequest`. Engine only loads leads `assigned_to_id = salesperson` and `client_id = session.clientId`.

---

## UI surfaces

### Tasks

Today’s Focus → Today’s Plan → Next Best Action → Up Next → traditional My / Assigned / Created / All tasks.

Intelligence failure does not block traditional tasks.

### Focus Mode

Sequential full-screen / centered workflow; Call / WhatsApp / Open / Snooze / Skip (skip requires reason).

### Goals

Coverage, current focus, what needs attention, today’s commitments + opt-in settings.

### Dashboard

- **Today's Focus** card (BUILD / MOVE / CLOSE) from the same `focus` payload
- **New enquiries** + **Deals requiring attention** prefer engine queue categories (lead contact vs deal movement)
- Compact Today's Sales Plan strip + `/sales/tasks` continuation
- Commercial KPIs and Pipeline snapshot use Deal commercial value — not raw Lead `deal_value`
- Graceful degradation if `/api/sales/daily-plan` fails; other Dashboard metrics remain

Active **Deal** rows are now converted into priority-engine signals (`dealId` on `LeadIntelligenceSignal`) so Tasks and Dashboard share one ranking path for commercial work after Lead→Deal conversion.

See `getSalesDashboardData()` and [SEGMIQ_SALES_DESIGN_SYSTEM.md](./SEGMIQ_SALES_DESIGN_SYSTEM.md) §16.

---

## Testing

`tests/sales-intelligence.test.ts` — ranking, resolution, valid prospect, coverage, timezone boundaries, focus mode.

Manual QA:

1. Hot Facebook lead → appears as NBA → log call → recommendation resolves  
2. Schedule follow-up → no “No next action”  
3. Quiet day + goal + low coverage → BUILD + prospecting  
4. Mid-prospecting + new Hot inbound → Hot becomes NBA  

---

## Deferred

- Manager Sales Command Center UI  
- Full Reports redesign  
- ML / conversion prediction  
- Custom working-day calendars  
- Capacitor `sales-app` parity  
- Full priority-weight settings UI (JSON storage ready)  

---

## Apply migration

```bash
# via Supabase CLI against your linked project
supabase db push
# or apply supabase/migrations/087_sales_execution_intelligence.sql in the SQL editor
```
