# Agent listing pages — implementation

## Implemented

- Opaque per-agent share links, including one default link and optional campaign labels, with reuse and a campaign cap.
- Revocation by the owning agent or an organisation manager. Inactive, archived, or removed members stop new attribution. History remains.
- Public page at `/property/[slug]` with agency branding, agent identity, gallery, enquiry, viewing request, WhatsApp when configured, and related agency listings.
- Enquiries and viewing requests create SegmiQ leads through `createLead`, preserve an existing assignee, and store marketing attribution separately.
- Agent dashboard, link analytics, manager overview, and company settings.
- Bearer-compatible APIs for the Android app.
- Bot classification, daily aggregates, and tests for the policy rules.

## Files

Policy and services:

- `lib/real-estate/agent-listing-pages/policy.ts`
- `lib/real-estate/agent-listing-pages/analytics.ts`
- `lib/real-estate/agent-listing-pages/service.ts`
- `lib/real-estate/private-listing-images.ts` (`readPrivateListingImage`)

Migration:

- `supabase/migrations/20261102183000_agent_listing_pages.sql`

Public UI:

- `app/property/[slug]/page.tsx`
- `app/property/[slug]/opengraph-image.tsx`
- `components/real-estate/public-listing/`

Workspace UI:

- `app/sales/shared-listings/`
- `app/sales/listings/[listingId]/page.tsx`
- `app/client/listing-pages/`
- `components/real-estate/listing-pages/`
- `components/dashboard/company/settings/ListingPagesSettingsSection.tsx`

APIs under `app/api/clients/[clientId]/listing-shares`, `listing-pages/settings`, and `app/api/public/listing-pages`.

Navigation: `lib/sales/navigation/sales-nav-config.ts`, `company-nav-config.ts`. Middleware allows `/property/` and sets a first-party visitor cookie.

## Tests

`tests/agent-listing-pages.test.ts` covers eligibility, token opacity, cross-tenant denial, revoked and suspended agents, public projection, catalogue URL safety, assignment, duplicate replay, viewing timestamps, bot exclusion, WhatsApp click versus confirmed lead, timezone bounds, and media URLs. All 19 tests passed.

The full suite (`tsx --test tests/*.test.ts`) was 1501 passed and 3 failed. The failures are outside this feature:

- `tests/demo-guest-foundation.test.ts` fails `assert.throws` because `DemoAccessDenied` is loaded as two prototypes. The thrown error is still `DemoAccessDenied: Not found`.
- `tests/weekly-team-report.test.ts` fails while rendering a PDF because the Roboto font is not registered in this environment.

`tsc --noEmit` completed with no errors after the sales navigation item was given an explicit `SalesNavItemConfig` type.

`next lint` exits 0. Remaining warnings are existing hook-dependency warnings in other screens. Public listing images stay as `<img>` because agency logos and proxied photographs are not on a fixed Next image host. CSS module selectors are scoped to local classes.

Engaged views and WhatsApp taps are recorded from the httpOnly `sq_lp` cookie. The browser does not send a visitor id.

Database concurrency is enforced by unique indexes on the default link, campaign label, submission idempotency key, and phone hash. Those constraints are not executed in the unit test process.

## Known limitations

- The migration is prepared and not applied here. Production migration and deploy were not run.
- Open Graph does not use listing photographs. A durable public derivative is not approved, so the card is a branded text image.
- Confirmed WhatsApp conversations are not inferred from the public button. Nothing writes `whatsapp_conversation_confirmed` until an inbound provider message is already stored and linked.
- Organisation-level unique visitors are not claimed. Unique visitors are returned for one link only, and only under 5,000 human page-view rows.
- Related cards link to the verified catalogue URL when that URL is https on the verified website host. Per-listing website URLs are not invented.
- Amenities are not shown. The listing table does not store them.
- Daily chart buckets are UTC. The selected range is converted from the requested IANA timezone.
- Raw events are intended to be kept about 180 days. No scheduler was added. Daily counts remain for reporting.
- A public enquiry does not create a confirmed `viewings` row.

## Deployment

1. Apply `20261102183000_agent_listing_pages.sql` in a reviewed migration step.
2. Confirm private listing storage if photographs should appear. Without it, pages still render with a placeholder.
3. Managers set the verified website, catalogue URL, contact policy, and routing under Company settings → Agent listing pages.
4. Do not put service-role keys in the client.

## Security review

- Public responses omit seller, mandate, acquisition, and internal identifiers.
- Share tokens are 32-byte random values, not account credentials.
- Form assignment ignores any client-supplied agent id. The token is resolved on the server.
- Cross-organisation reads and revokes are denied.
- Analytics queries are scoped to the caller’s own links unless the caller is a manager of that organisation.
- Submissions store a phone hash, not the phone, and events do not store the phone or raw IP.
- Media requires an eligible listing and, when a token is present, an active share. Bytes are proxied. Signed URLs are not returned.
- External catalogue links must match the verified website host and use https.
- Public posts check browser origin, body size, a honeypot, and rate limits.
- Revoked links and inactive agents return an unavailable page without property details.
