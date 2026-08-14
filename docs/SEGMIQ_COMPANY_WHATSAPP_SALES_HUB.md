# SegmiQ Company WhatsApp Sales Hub

## Purpose and scope

The Company WhatsApp Sales Hub is the manager-facing shared sales inbox. It uses the same Lead-backed WhatsApp conversation and `whatsapp_messages` architecture as the salesperson Hub. A manager sees every WhatsApp conversation within their authenticated company, while a salesperson continues to see only the queue allowed by assignment mode and ownership.

`alsoSells` adds salesperson capabilities to a manager; it never narrows company oversight. All conversation, message, contact, Lead, Deal, Quote and activity reads remain tenant-scoped.

## Ownership and assignment

Conversation ownership continues to use `leads.assigned_to_id`. Managers assign or reassign through the canonical reassignment/transfer services, which validate that the destination is an active salesperson in the same company and write an auditable Lead event. Opening a conversation never claims it.

The Unassigned queue contains active WhatsApp conversations with no owner. Claim remains available to eligible salespeople; managers use Assign/Reassign.

## Conversation workflow

Conversation workflow is intentionally separate from Lead and Deal lifecycle:

- `OPEN` means messaging work remains active.
- `RESOLVED` means the current messaging work is complete.
- A new inbound message reopens the existing thread.
- Resolving a conversation never wins, loses, reopens or closes a Deal.

The workflow is stored on the existing Lead-backed thread by migration `090_company_whatsapp_conversation_state.sql`; it does not create a second messaging system.

Waiting states are deterministic:

- Waiting on Team: the latest meaningful message is inbound and the open conversation has no subsequent outbound reply.
- Waiting on Customer: the latest meaningful message is outbound and the conversation remains open.
- Unread is notification/read state. Reading an inbound message does not clear Waiting on Team.

## KPI definitions

The six Company KPIs are computed centrally from company-scoped conversation projections:

1. Active Conversations: open, non-archived WhatsApp threads.
2. New Conversations: threads whose first inbound contact falls within the last seven days.
3. Avg. First Response: average duration from first inbound message to first subsequent outbound message for new threads that have received a response.
4. Resolved: threads resolved within the last seven days.
5. Unassigned: active threads with no `assigned_to_id`.
6. Waiting on Team: active threads whose latest message is inbound.

The same first-contact and first-response timestamps feed the selected conversation insight rail.

## Desktop workspace

The desktop page ends with one three-column workspace:

- Left: Conversations, exact state tabs, conversation search, real filters/sort, dense rows and paginated results.
- Center: customer header and owner, management toolbar, chronological messages, session notice and composer.
- Right: Customer Overview, Conversation Insights, Related Records, Team Activity and Quick Actions, in that order.

The selected row uses a low-opacity lime wash and thin lime indicator. Incoming bubbles use a neutral bordered surface; outgoing bubbles use a very pale lime tint. WhatsApp green is reserved for channel identity and delivery context.

## Actions and related records

The center toolbar exposes only capabilities the signed-in user has:

- Assign/Reassign uses the canonical ownership service.
- Add Note writes an internal Lead note and never sends it to WhatsApp.
- Create Deal opens the approved `CreateDealSheet`; an existing Deal changes the action to View Deal.
- View Lead and related-record links open the canonical Company workspaces.
- Quote counts come from real non-draft quotations.
- Team Activity uses meaningful `lead_events`, not page views, presence or typing surveillance.

Broadcast Message links to the existing Marketing campaign wizard. That flow requires an approved WhatsApp template, eligible/consented recipients and the existing campaign send safeguards; the Hub does not implement free-form bulk messaging.

## Messaging behavior

Message sending, media rendering, secure media retrieval, delivery states, quick replies, sales assets, polling and the WhatsApp 24-hour service window remain in the existing Hub. When the session window is closed, the composer presents the existing template-aware restriction notice. Internal notes retain their distinct timeline treatment.

The selected thread polls incrementally through the existing client behavior, while the company conversation list refreshes without replacing the selected conversation.

## Responsive behavior

Below the desktop workspace breakpoint the Hub becomes a single-pane state machine:

1. Conversation list
2. Selected chat
3. Customer/sales intelligence

The Company mobile top and bottom navigation are hidden while chat or intelligence is open so the composer and information rail remain usable. Mobile shows the four highest-value manager KPIs (Active, Avg. First Response, Unassigned and Waiting on Team); New and Resolved remain available through filters.

Tablet does not squeeze all three panels. Dark mode uses Company sales tokens for the page, panels, text, bubbles and composer while preserving official WhatsApp green and restrained SegmiQ lime.

## Permissions and performance

Every API revalidates authentication and tenant/Lead access. Manager reassignment and conversation resolution are company-scoped; send permissions continue to require the salesperson capability and ownership. Related Deal/contact queries also include the Lead's client id.

Conversation list data is projected in batches for Leads, contacts, owners and quotes to avoid row-by-row N+1 queries. Migration 090 provides one indexed message aggregate for last-message state, first response and counts, so a large inbox does not transfer full message histories for list rows. A compatibility fallback preserves operation while that migration rolls out. The list renders eight rows per page. The selected conversation context loads separately, uses count/head and limited first/latest queries, and fetches only the three most recent meaningful team events.
