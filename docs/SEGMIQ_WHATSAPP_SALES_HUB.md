# SegmiQ 2.0 Salesperson WhatsApp Sales Hub

Route: `/sales/inbox`

The Salesperson WhatsApp Sales Hub is a focused selling workspace. It reuses the existing WhatsApp transport, session rules, assignments, quick replies, assets, notes, calls, quotations, Lead records, Deal records, and permission checks. The UI does not create a second messaging or CRM model.

## Workspace contract

On a large desktop the page is one full-height integrated surface directly below a compact header:

1. Conversation queue, normally 330-360px
2. Conversation and composer, always the largest pane
3. Lead or Deal intelligence, normally 390-430px

At narrower desktop widths the queue is approximately 300-320px and intelligence approximately 340-370px. The queue and intelligence panes can be resized on wide screens, and the intelligence pane can be collapsed. The saved preference is restored without changing the centre pane's priority.

Below 1280px, intelligence opens as an overlay drawer. Mobile keeps the existing single-pane progression: queue to conversation to intelligence. Only message history scrolls in the centre pane; the conversation header, action strip, session state, and composer remain anchored.

There is no KPI strip and no analytics content below the workspace.

## Conversation queue

Primary filters stay visible in the queue:

- All
- Mine, only when it adds a meaningful team scope
- Needs reply
- Follow-up due

Advanced filters live in one compact popover and use real stored data:

- Hot, Warm, and Cold use the shared Lead score thresholds
- Waiting on customer is mutually exclusive with Needs reply
- Quotes sent requires a real quotation
- Unassigned is available only when the user's permitted scope can contain unassigned conversations
- No Deal requires the absence of an active Deal
- Deal stage filters use the active Deal's canonical stage

Search includes contact identity, message content, Lead budget, Deal name, and Deal stage. Rows are flat, approximately 80px high, and communicate channel, lifecycle or Deal stage, commercial context, timestamp, and unread state. Before Deal creation the row shows Lead lifecycle and intent; after creation it shows Deal stage instead. Results render in a bounded batch with an explicit Load more control.

## Conversation pane

Before Deal creation, the header shows Lead lifecycle, intent, and budget. After Deal creation, it shows Deal stage and canonical Deal value. Lead lifecycle and Deal stage are never presented as interchangeable states.

The action strip sits immediately below the header and reuses authorized actions: quick replies, send asset, internal note, log call, Lead view, and the canonical create/open Deal flow. The composer includes attachments, session state, and the existing WhatsApp send rules. A closed or unavailable session becomes a compact read-only strip with the permitted recovery or claim action.

Message loading is paged and bounded. New-message polling merges into already loaded history and cannot overlap an in-flight request, so loading older messages is not discarded by a refresh.

## Conditional intelligence rail

The right rail is conditional on the selected record.

### Lead state

The order is fixed:

1. Lead identity and ownership
2. Lead score with persisted signal reasons
3. AI briefing, only when the real briefing service returns content
4. Qualification details
5. Deal readiness and canonical Create Deal action
6. Next follow-up
7. Ownership and handover

Lead score describes acquisition and qualification signals. It is not a Deal close probability. Deal readiness comes from the canonical readiness helper and does not invent missing facts. If the AI briefing fails, the rail remains usable and omits the briefing rather than replacing it with fabricated copy.

### Deal state

Once an active Deal exists, the order changes to:

1. Deal and customer identity
2. Commercial details and canonical value basis
3. Deterministic Deal health
4. Active pipeline stage controls
5. Next action
6. Quotation status and quotation action
7. Recent meaningful activity
8. Ownership and handover

Lead score is no longer the primary intelligence after conversion. Deal health is operational: on track, needs attention, or at risk. It is derived from stored stage, next-action, and activity data and is never a fake probability. Stage changes, next-action completion or rescheduling, quote work, and ownership changes call the existing authorized APIs.

## Data and security rules

- Use the existing salesperson-scoped conversation query and server-side permission checks.
- Batch-load active Deals for the queue; never issue one Deal query per row.
- Use `getDealCommercialValue()` for Deal value and preserve unknown value as unknown.
- Use canonical Lead score thresholds, Deal readiness, active Deal stages, and Deal health helpers.
- Never infer a quotation, owner, source, AI summary, probability, or commercial value that is not in the system.
- Keep WhatsApp session enforcement on the server as the final authority.

## Visual system

The hub uses the shared Sales tokens in light and dark themes. SegmiQ lime is reserved for primary actions, selected state, progress, and focus. WhatsApp green identifies the channel and WhatsApp actions. Incoming messages use a neutral bordered surface; outgoing messages use a restrained lime tint. Hover effects do not scale rows or controls.

Stable guided-learning targets include the conversation queue, conversation row, chat, quick replies, log call, Lead intelligence, Deal readiness, Create Deal, Deal stage, next action, and quotation surfaces.

## Failure isolation

Conversation messages, Lead or Deal detail, and AI briefing load independently. A slow briefing request cannot block identity, qualification, Deal, quote, follow-up, or ownership controls. Empty and error states preserve the rest of the workspace and expose only actions the user is permitted to perform.
