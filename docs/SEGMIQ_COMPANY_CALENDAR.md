# SegMiQ 2.0 — Company Team Sales Calendar

Route: `/client/calendar`

## Purpose and source of truth

The Company Calendar is a manager execution workspace for permitted company sales activity. It shows team ownership across the selected company, including team members with no activity and an Unassigned row when canonical records have no owner. Every read and write is scoped by `client_id`; real-estate viewings are scoped through their canonical contact.

The Calendar remains a read model over real product records:

- Lead follow-ups: `leads.follow_up_date`.
- Timed callbacks: latest scheduled `call_logs.callback_at` for the Lead.
- Deal next actions: `deals.next_action_at` and `next_action_label`.
- Site visits: canonical `viewings.scheduled_at`.
- Completed follow-ups: canonical Lead audit events with the completion marker.

There is no duplicate Calendar event table. Creating, reassigning, rescheduling, and completing editable activity updates the canonical Lead and writes the existing audit events.

## Information hierarchy

1. Company Calendar header and New Activity action.
2. Six execution KPIs: Upcoming Activities, Overdue Follow-ups, Today’s Activities, Completed (Week), Team Response Time, and At Risk Activities.
3. Calendar workspace with period controls, Team filter, Day/Week/Month/Agenda switcher, structured filters, and semantic legend.
4. Right agenda rail: mini month, selected-date team agenda, Upcoming, or selected Event Detail.

Selecting a salesperson scopes both KPI cards and Calendar content. Owner scope is represented by the `owner` URL parameter; date, view, and selected event are also URL state.

## Metric definitions

- **Upcoming Activities:** scheduled unresolved Lead follow-ups, Deal actions, or visits from the current company-local date through the next seven days.
- **Overdue Follow-ups:** canonical Lead follow-up due dates that have passed and remain unresolved.
- **Today’s Activities:** scheduled or completed activity on the current company-local date; cancelled records are excluded.
- **Completed (Week):** canonical follow-up completions and explicitly completed visits recorded in the current Sunday–Saturday company-local week.
- **Team Response Time:** average Lead captured → first qualifying response for Leads captured in the last 30 days. Qualifying responses reuse the Dashboard definition: first logged call, outbound WhatsApp message, or matching call/message audit event. Previous 30 days provide the comparison.
- **At Risk Activities:** unresolved overdue follow-ups, passed unresolved visits, or scheduled actions attached to deterministically at-risk Deals.

Counts are server-calculated from canonical sources. Empty results display zero or “No response data”; the UI never fabricates trends.

## Views and interaction

Week is the default desktop view and uses a Sunday–Saturday team-by-day matrix. The first column is sticky and contains avatar, name, role, and an execution-status dot. Day columns contain at most two compact event cards plus a `+ N more` action. Empty team cells expose a focused add affordance for authorized users. The matrix scrolls internally when the team is large.

Day groups the selected date by salesperson. Month gives a manager overview with activity-type totals, attention state, and participating owner avatars. Agenda is a chronological operational list. Mobile is agenda-first with a horizontal date strip and team grouping; tablet moves the right rail into a drawer.

Selecting an event keeps the Calendar visible and turns the right rail into Event Detail. Card hierarchy is time, semantic icon, concise activity title, and related Lead/Deal/Customer. Tooltips provide the full range, owner, entity, and attention reason.

## Event semantics

Color represents activity type, never salesperson:

- WhatsApp follow-up: green.
- Call: orange.
- Lead follow-up/meeting: blue.
- Quote review/task: amber.
- Deal/internal action: teal.
- Site visit: violet.

Overdue state overrides the type tint with a restrained red surface and edge. At-risk state adds an amber edge. Completed items receive a green edge and reduced emphasis. Hover changes border/shadow only; cards never scale or glow.

## Filters, permissions, and actions

Filters cover owner, activity type, status (including At risk), and related record type. KPI cards act as real quick filters and navigate to the relevant view. The Team selector and filter owner field share the same state.

Company managers and super admins can schedule and reassign activity only to eligible users in the same client. The dedicated Company Calendar activity endpoint validates both Lead scope and target owner before updating canonical fields. Event Detail exposes completion/reschedule only where the event source supports the action. Salesperson Calendar behavior is unchanged.

## Performance, timezone, accessibility, and themes

The server uses bounded, batched source queries with explicit limits, bulk callback/response enrichment, and no per-card requests. Historical unresolved follow-ups are retained for overdue KPI drill-down while views group only relevant dates.

Date keys, Today, week boundaries, and metric periods use the configured company timezone. Cards and controls have keyboard focus states, semantic labels, readable tooltips, and native select controls. Light and dark themes use Sales semantic tokens with purpose-built dark event tints. Loading skeletons preserve the six-KPI and team-matrix geometry.
