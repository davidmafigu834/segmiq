# SegMiQ 2.0 — Company Calendar

Route: `/client/calendar`

## Purpose and scope

The Company Calendar is the manager planning view for permitted company sales activity. It uses the approved Company workspace shell and shows activity for the selected company, not only activity owned by the signed-in manager. Every query is scoped by `client_id`; real-estate viewings are scoped through their canonical contact.

The Calendar is a read model over existing business sources rather than a separate event table:

- Lead follow-ups from `leads.follow_up_date`.
- Timed callbacks from the latest scheduled `call_logs.callback_at` for those Leads.
- Deal next actions from `deals.next_action_at` and `next_action_label`.
- Real-estate site visits from canonical `viewings.scheduled_at`.

This preserves one source of truth. Completing or rescheduling an editable Lead follow-up uses the canonical Lead API. Deal next actions and viewings remain read-only from Calendar until their existing mutation flows expose equivalent scoped APIs.

## Views and navigation

Day, Week, Month, and Agenda views share one Calendar card and one selected-date state. Day arrows move one day, Week arrows move one week, and Month/Agenda arrows move one month. Today uses the configured sales timezone. View and weekend preferences are stored locally, while `date`, `view`, and selected `event` are represented in URL state.

The Week view uses Monday as the established SegMiQ week start. Untimed Lead follow-ups appear in the all-day row. Timed callbacks, Deal actions, and viewings appear in the hourly grid. Overlapping activities use deterministic side-by-side layout. The current-time indicator appears only when today is visible and the time falls within the 08:00–18:00 fallback working window.

## Event semantics

Event color represents activity type, never salesperson:

- WhatsApp follow-up: green.
- Call: orange.
- Lead follow-up: blue.
- Quote review: amber.
- Deal next action: teal.
- Site visit: violet.

Cards prioritize time, title, and related Lead/Deal/Customer. Selecting a card keeps the Calendar visible and switches the right rail into Event Detail mode. The detail order is type/status, date/time/timezone, related entity, owner, location, description, contextual actions, and edit/reschedule where authorized.

## Right agenda rail

The default right rail is one bordered container with three internal sections:

1. Mini month calendar with Today, selected date, outside-month, and activity-dot states.
2. Selected-date agenda using the same active filters as the grid.
3. A limited Upcoming list that excludes completed and cancelled activity.

On tablet the rail becomes a drawer. Mobile is agenda-first with a horizontal date strip and full-width activity rows; Event Detail uses the same rail content in a full-height sheet.

## Filters, permissions, and actions

Managers can filter by permitted company owner, real activity type, and completed state. New Activity reuses the canonical Lead follow-up sheet. `SUPER_ADMIN` can schedule any company Lead. A sales-capable manager can schedule only their own assigned Leads, matching existing `canModifyLead` authorization. Other managers receive a view-only Calendar.

Call, WhatsApp, and entity links use existing routes. Mark Complete clears the canonical Lead follow-up and logs the existing follow-up completion event. Destructive controls are not exposed because no Calendar-specific record exists to delete.

## Performance, timezone, and themes

The server queries a bounded month-centered window with a future buffer, caps every source, batches owner/contact/quote/callback enrichment, and avoids per-event reads. Navigation updates URL state through Next.js without a browser reload and obtains a new bounded range.

Display and date-key calculations use the configured agency sales timezone with the existing SegMiQ fallback. Light and dark modes use Sales semantic tokens; dark event cards use low-opacity semantic tints instead of unchanged light pastels.
