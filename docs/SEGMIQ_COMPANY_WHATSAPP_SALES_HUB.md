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

## Desktop workspace

The page uses a compact header followed immediately by one continuous three-pane workspace. There is no KPI row or lower analytics region:

- Left (roughly 300â€“350px): Conversations, primary state tabs, search, one filter popover, sort, compact rows and paginated results.
- Center (flexible and dominant): customer header, consolidated owner control, compact actions, chronological messages, session notice and composer.
- Right (roughly 310â€“380px): Customer Overview, Conversation Insights, Related Records, Team Activity and Quick Actions, in that order.

On wide desktops the dividers are draggable and persist independently for this workspace. The conversation list cannot collapse; the customer context can collapse so the chat receives the reclaimed space. Between 1100px and 1279px the context opens as a drawer over the chat. Below 1100px the existing single-pane navigation remains in force.

The selected row uses a low-opacity lime wash and thin lime indicator. Incoming bubbles use a neutral bordered surface; outgoing bubbles use a very pale lime tint. WhatsApp green is reserved for channel identity and delivery context.

## Actions and related records

The center toolbar exposes only capabilities the signed-in user has:

- Assign/Reassign lives in the chat-header owner control and uses the canonical ownership service.
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

Below 1100px the Hub becomes a single-pane state machine:

1. Conversation list
2. Selected chat
3. Customer/sales intelligence

The Company mobile top and bottom navigation are hidden while chat or intelligence is open so the composer and information rail remain usable. Queue states remain available through the list tabs and filter popover.

Tablet does not squeeze all three panels. Dark mode uses Company sales tokens for the page, panels, text, bubbles and composer while preserving official WhatsApp green and restrained SegmiQ lime.

## Permissions and performance

Every API revalidates authentication and tenant/Lead access. Manager reassignment and conversation resolution are company-scoped; send permissions continue to require the salesperson capability and ownership. Related Deal/contact queries also include the Lead's client id.

Conversation list data is projected in batches for Leads, contacts, owners and quotes to avoid row-by-row N+1 queries. Migration 090 provides one indexed message aggregate for last-message state, first response and counts, so a large inbox does not transfer full message histories for list rows. A compatibility fallback preserves operation while that migration rolls out. The list renders eight rows per page. The selected conversation context loads separately, uses count/head and limited first/latest queries, and fetches only the three most recent meaningful team events. The last selected conversation is stored per tenant, and a valid `?conversation=<lead-id>` deep link takes precedence; the Hub never claims or randomly opens a thread.
