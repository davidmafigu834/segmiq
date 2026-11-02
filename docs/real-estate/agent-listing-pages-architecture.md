# Agent listing pages

SegmiQ Agent Listing Pages let an authorised agent market an approved company listing with a personal link. The agency keeps one listing record. The link records marketing attribution. Enquiries enter the existing lead and contact system.

`/p/[slug]` is already the public company profile, so these pages live at `/property/[slug]`.

## Existing services reused

- `listings` remains the inventory record. `public_slug` is only a stable public path, not a title and not a copy of the listing.
- Approval and availability use `approval_status` and `status`. There is no separate private-publication flag. Unapproved listings are not marketed.
- `createLead` deduplicates open enquiries by phone and creates or reuses the contact. It sends the existing new-lead notification once.
- `findOpenLeadByPhone` decides whether an owner already exists. An existing assignee is not replaced.
- `marketing_attributions` still stores first-touch website attribution. `re_listing_lead_attributions` stores the marketing agent separately from `leads.assigned_to_id`.
- `quotation_settings.default_currency` is the only currency shown. If that row is missing, the amount is shown without a code.
- Listing photographs stay in the private listing bucket. The public page proxies bytes through `/api/public/listing-pages/media` after a share or canonical eligibility check. Signed storage URLs are not placed in HTML or `og:image`.
- WhatsApp destination uses `clients.meta_whatsapp_display_number` or the agent phone only when the agency policy allows it. No new WhatsApp provider is added. A button tap is not a sent message.
- Authenticated routes use `requireClientAccessFromRequest`, so cookie sessions and Android Bearer tokens share one implementation.
- Rate limits use `security_rate_limits`.

## Database

Migration: `supabase/migrations/20261102183000_agent_listing_pages.sql`.

- `re_agency_listing_page_settings` — one row per organisation.
- `re_agent_listing_shares` — organisation, listing, agent, opaque token, optional campaign label, status.
- `re_listing_marketing_events` — event type, link, listing, hashed visitor label, bot class. No phone numbers and no raw IP.
- `re_listing_marketing_daily` — increment on insert so dashboards do not scan every event.
- `re_listing_lead_attributions` — marketing agent and operational owner.
- `re_listing_public_submissions` — idempotency key and phone hash.

The default link is unique per organisation, listing, and agent where `campaign_label` is null. Campaign labels are unique per agent and listing, up to the configured limit (default 8).

Deactivated users stay referenced (`ON DELETE RESTRICT`). New attribution stops when the user is inactive, archived, or no longer in the organisation. Historical rows remain.

## Routes

Public:

- `GET /property/[slug]?ref=<token>`
- `POST /api/public/listing-pages/enquiry`
- `POST /api/public/listing-pages/viewing`
- `POST /api/public/listing-pages/events`
- `GET /api/public/listing-pages/media`

Authenticated, also valid with `Authorization: Bearer`:

- `GET/POST /api/clients/{clientId}/listing-shares`
- `GET /api/clients/{clientId}/listing-shares/{shareId}`
- `POST /api/clients/{clientId}/listing-shares/{shareId}/revoke`
- `GET /api/clients/{clientId}/listing-shares/{shareId}/analytics`
- `GET /api/clients/{clientId}/listing-shares/{shareId}/qr`
- `GET /api/clients/{clientId}/listing-shares/summary`
- `GET /api/clients/{clientId}/listing-shares/leads`
- `GET/PATCH /api/clients/{clientId}/listing-pages/settings`

Workspace pages: `/sales/shared-listings`, `/sales/listings/[listingId]`, `/client/listing-pages`, Company settings → Agent listing pages.

## Permissions

Agents generate and read only their own links. Managers in the same organisation read every link, revoke any link, and edit settings. A client id in the URL is not proof of membership. Android cannot submit another agent's id as proof of ownership. The server uses the Bearer or cookie user.

## Public data

The page shows address or suburb, price with quotation-currency context, transaction type, category, beds, baths, size, description, and status. It does not show seller, mandate, acquisition, notes, rejection reasons, or internal ids. Amenities are omitted because listings do not store them.

Agent name, role, and https avatar are shown only when settings allow. The phone is hidden unless the contact policy and `show_agent_phone` both allow it.

## Lead attribution

Default routing assigns a new unowned enquiry to the marketing agent when that agent is an eligible salesperson. If an open lead already has an owner, that owner stays and the marketing agent is recorded on `re_listing_lead_attributions`.

`agency_assignment` never overrides `createLead`.

A viewing request creates a lead and a follow-up time. It does not insert a `viewings` row and the response says the viewing is not confirmed.

The same phone and kind for one organisation returns the original enquiry and does not notify again. Precedence is documented as `ATTRIBUTION_PRECEDENCE` in `lib/real-estate/agent-listing-pages/policy.ts`. The default attribution window is 30 days and is configuration, not a claim of identity.

## Analytics

Human `page_view` counts are visits. Preview user agents (WhatsApp, Facebook, Slack, and similar) are `preview` and are excluded. `whatsapp_click` is a tap. `whatsapp_conversation_confirmed` is never written from the tap. Unique visitors are distinct hashed cookie labels, capped at 5,000 rows; above that the API returns null rather than a guessed number. Chart days in the daily table are UTC. Range filters accept an IANA `timeZone`.

## Storage

Private listing keys may be streamed for an eligible public page. Legacy public URLs in `photos` are not reused. Open Graph uses a generated card with suburb and agency name, not an expiring signed URL and not a private photograph. If private storage is not configured, the page shows a placeholder and media returns 404.

## SEO

Canonical URL is `/property/{slug}` without `ref`. Share parameters stay out of the canonical. Unavailable, revoked, and unapproved responses are `noindex` and do not include property details when the ref is invalid or revoked. A valid canonical page can still describe an approved listing the agency is marketing.

## Android

The same authenticated routes are the mobile contract. See `docs/android-integration/12-agent-listing-pages-mobile-contracts.md`. The Android app is not part of this change.
