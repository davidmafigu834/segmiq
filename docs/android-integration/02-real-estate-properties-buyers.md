# Android Milestone B: Properties and Buyers

Status: local implementation; not deployed or independently verified in production.
Build intentionally skipped at the owner's request. No production data changed.
All example identifiers and hostnames are fictitious.

## Authentication and capabilities

Use `Authorization: Bearer <Sales JWT>` and the authenticated bootstrap organisation ID.
Existing cookie sessions remain supported. Session liveness, tenant membership and MFA use
`requireClientAccessFromRequest` and the existing `resolveApiAuth` flow. Suspended Sales
subscriptions are blocked by middleware; bootstrap and logout remain reachable.

Use `capabilities.featureFlags.realEstatePropertiesRead`, `realEstateBuyerSearchRead`, and
`privateListingImageDelivery`. These are additive schemaVersion 1 flags. Navigation modules
remain the existing Real Estate destinations. Flags describe supported access, not an
independent production security certification. Always obey endpoint authorization.

## Endpoints

Prefix below: `/api/clients/{clientId}`.

| Method/path | Contract | Android status |
|---|---|---|
| GET `/listings` | `{listings: Property[], page, limit, total}` | Read supported |
| GET `/listings/{listingId}` | `{listing: Property, matches: BuyerContactMatch[]}` | Read supported; matches separately privacy-filtered |
| POST `/listings` | `ListingCreate` -> 201 `{listing}` | Supported Bearer writes; agents create own draft/pending only |
| PATCH `/listings/{listingId}` | `ListingPatch` -> `{listing}` | Own draft/pending or manager |
| DELETE `/listings/{listingId}` | no body -> `{ok:true}` | Managers only |
| GET `/listings/{listingId}/images/{index}` | `{url, expiresAt}` | Gated on private storage and migrated reference |
| GET `/buyer-searches` | `{ok:true, searches, page, pageSize, total}` | Own searches for agents; manager organisation scope |
| GET `/buyer-searches/{searchId}` | `{ok:true, search, contact, roles, interests, events, viewings, offers, applications}` | Owner/manager only |
| POST `/buyer-searches` | `BuyerSearchCreate` -> 201 `{search}` | Existing Bearer-aware creation |
| PATCH `/buyer-searches/{searchId}` | `BuyerSearchPatch` -> `{search}` | Owner/manager; reassignment manager only |
| GET `/matching?searchId={searchId}` | `{ok:true, matches, incomplete, truncated, notice}` | Owned search; matches include listing and explanation |
| GET `/matching?listingId={listingId}` | `{ok:true, matches, incomplete, notice}` | Live properties only; buyer identities separately gated |

Listing register and marketing remain web support surfaces, with listing visibility checks.
This milestone does not introduce Viewings, Offers or Transactions operations. Existing buyer
bundle fields referencing those records are preserved for web compatibility.

## Properties DTO and filtering

Property uses stored snake_case fields: `id`, `client_id`, `agent_id`, `development_id`,
`transaction_type`, `status`, `approval_status`, `price`, `bedrooms`, `bathrooms`, `size_sqm`,
`address`, `suburb`, `description`, `photos`, `property_category`, `lease_term_months`,
`created_at`, `updated_at`. List embeds `agent:{id,name}` and `development:{id,name}` when
PostgREST relationships exist; these embeds may be absent on the relationship fallback.
The response includes `permittedActions:{read,edit,approve,delete}`.
Mandate metadata, external reference and rejection reason are owner/manager-only.
Owner identities, acquisition records and document columns are not in the read DTO.
There is no stored title or per-listing currency in this model: Android may display the address
as its heading and bootstrap quotation currency as context, but must not claim that context is
a stored property currency. Null bedrooms/bathrooms/size/price remain null.

Query: `page` (positive integer, default 1, maximum 100000), `limit` (1..1000, default 80),
`status`, `development_id`, `transaction_type`, `suburb`, `min_price`, `max_price`, `bedrooms`, `q`.
Filters, visibility, exact count and pagination run in PostgREST, ordered by created_at then id
descending. Relationship fallback preserves the complete query. Concurrent writes may shift
offset pages; this is not snapshot pagination. Numeric values must be finite.
Text queries search address/suburb/description/external reference with grammar characters
removed; wildcard matching uses literal sanitized terms.

### Listing writes

`ListingCreate`: required `transaction_type` = sale/rental/new_development/property_management.
Optional: `agent_id`, `development_id`, `status`, `approval_status`, `price`, `bedrooms`,
`bathrooms`, `size_sqm`, `address`, `suburb`, `description`, `photos:string[]` (max 50),
`mandate_type`, `mandate_expiry_date`, `lease_term_months`, `external_reference`, `property_category`.
`ListingPatch` is the partial form, plus `rejection_reason`. Existing schema limits still apply.
Assigned agents must be active and in this organisation. Agents cannot supply another agent
or clear ownership. Managers may assign; agent creations cannot self-approve.
New image upload is gated; do not reuse generic public media upload for private listing photos.

## Visibility policy

Managers/admins may read scoped listings. Company agents may read their own listings in all
approval states and other agents' approved listings. Legacy null approval states are treated
as published, matching the pre-existing isListingLive rule. Other-agent draft, pending and
rejected listings are private. Cross-tenant membership is rejected before reading resources.
Approval is separate from availability: sold/let records can remain published history;
matching uses only approved available listings. No fallback widens access.

## Image contract

The stored photos array defines order; index zero is cover. Bearer property reads return
`photos:[]`, `images:[{index,cover,endpoint}]`, and `legacyImagesGated:boolean`.
Only registered keys under `clients/{clientId}/listings/{listingId}/photos/{filename}` are
eligible, with a single safe filename and jpg/jpeg/png/webp/avif extension. Arbitrary URLs,
other tenants, other properties, traversal and owner document references cannot be signed.
The image endpoint repeats listing authorization then returns a 300-second signed URL.
It returns image MIME type; no resize transformations are implemented. Fetch the signed URL
without forwarding the Sales JWT. Re-request the endpoint after expiry. Cache metadata privately;
image metadata responses are no-store. A signed URL remains usable until expiry after revocation.

Set `CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME` to a distinct private R2 bucket, using the
existing server-only R2 account credentials. The existing public bucket is explicitly refused.
Deployment must independently verify that public access and custom public domains are disabled
on the private bucket. Existing images are NOT migrated by this change. Old public links may
remain reachable outside SegmiQ authorization: storage migration and removal/revocation of
old public copies are deployment blockers for a full privacy claim. Web legacy photos remain
for compatibility. Photo uploads and transformations are follow-up work.

## Buyer privacy and DTOs

Search list uses stored fields `id`, `contact_id`, `assigned_agent_id`, `intent`, `property_type`,
`budget_min`, `budget_max`, `currency`, `locations`, `bedrooms`, `bathrooms`, `pipeline_stage`,
`status`, `next_action_at`, `next_action_note`, `created_at`, `updated_at`; enrichment fields are
`contact_name`, `phone`, `agent_name`, `stage_label`. Agents are always restricted to their own
assigned searches; a supplied agentId cannot widen this. Managers may scope by `agentId`.
List filters: q, intent, stage, status, agentId, location, propertyType, followUp=due, contactId,
page (positive integer). Page size is 25. Contact text filtering happens before paging/count;
queries matching over 1000 contacts must be narrowed (400) rather than silently truncating.

BuyerSearchCreate: intent purchase/rental required. Optional contactId, name, phone,
confirmNewContact, propertyType, propertyCategories, locations, budgetMin, budgetMax, currency,
bedrooms, bathrooms, landSize, buildingSize, features, amenities, timeframe, readiness,
leaseMonths, moveInDate, notes, nextActionAt, nextActionNote, allowAboveBudget, leadId.
BuyerSearchPatch: pipelineStage, propertyType, propertyCategories, locations, budgetMin,
budgetMax, bedrooms, bathrooms, timeframe, readiness, notes, features, amenities, leaseMonths,
moveInDate, allowAboveBudget, nextActionAt, nextActionNote, closureReason, assignedAgentId.
The authoritative validation schemas remain in the buyer-search routes.

Private buyer searches include active, paused and needs_review states. Contact disclosure for
another agent requires an accepted introduction for this exact property/requester/search,
with the introduction owning agent still matching the current search assignee. The search
must remain matchable, and the property approved and available. Pending/declined/stale grants
do not unlock identity. An introduction does not grant full search bundle or directory access.
Privacy fact lookup failures fail closed. Only managers can reassign or clear search ownership.

Matches preserve the existing weighted, rules-based explanation attributes, not AI probability.
Listing-detail legacy matches carry id/name/phone/email and buyer requirements only when the
buyer contact policy permits disclosure. `/matching` returns redacted anonymous match facts
for other agents, with introduction status and managedBy; accepted introductions reveal only
the property-specific identity. No whole private search is returned by an introduction.

## Errors

Existing envelopes use `{error:string}` and route-specific `code` when supplied. HTTP 401 is
unauthenticated; 403 is forbidden/cross-tenant/private buyer; 404 is absent or not visible in
this tenant; 400 invalid input; 409 invalid operation/conflict; 503 temporary service failure.
New listing codes: FORBIDDEN, LISTING_PRIVATE, INVALID_REQUEST, SERVICE_UNAVAILABLE.
Image codes additionally: NOT_FOUND, IMAGE_UNAVAILABLE (409, migration required).
Tenant guards add CROSS_TENANT_ACCESS; buyer detail/search matching adds PRIVATE_BUYER for an ownership denial, NOT_FOUND, CONFLICT, INVALID_REQUEST or SERVICE_UNAVAILABLE where applicable. Existing buyer service failures preserve their established HTTP/error contract; Android must
handle status when code is absent. It must not infer existence across organisations from 404.
Authentication code handling remains in 01-auth-and-bootstrap.md. Never sign out on 503.

## Deployment checklist and remaining gates

Run the security tests, typecheck and lint before delivery. Build is skipped by explicit user
instruction. No automatic deployment, migration or production data mutation is performed.
Provision/verify the distinct private bucket, migrate photos and revoke old public copies;
then independently test two agents, two tenants, drafts, buyer introductions, revocation,
page boundaries, image expiry, MFA and billing gates against the deployed API. Do not claim
production security readiness from local tests. Commit identification is supplied separately;
Git delivery is now authorized; the delivery report provides the resulting commit identification.

## Implementation files

- app/api/clients/[clientId]/listings/route.ts
- app/api/clients/[clientId]/listings/[listingId]/route.ts
- app/api/clients/[clientId]/listings/[listingId]/images/[index]/route.ts (new)
- app/api/clients/[clientId]/listings/[listingId]/marketing/route.ts
- app/api/clients/[clientId]/listings/register/route.ts
- app/api/clients/[clientId]/matching/route.ts
- lib/real-estate/listing-access.ts (new)
- lib/real-estate/listing-read-service.ts (new)
- lib/real-estate/private-listing-images.ts (new)
- lib/real-estate/buyer-sales-service.ts
- lib/real-estate/buyer-contact-access.ts
- lib/real-estate/buyer-contact-access-service.ts
- lib/real-estate/buyer-introduction-service.ts
- lib/api-guards.ts
- app/api/clients/[clientId]/buyer-searches/[searchId]/route.ts
- lib/mobile/sales-app/bootstrap.ts
- tests/real-estate-mobile-readiness.test.ts (new)
- docs/android-integration/02-real-estate-properties-buyers.md (new)

Query syntax was checked against the official Supabase JavaScript OR-filter reference:
https://supabase.com/docs/reference/javascript/or

## Local verification results

- Combined regression run: 68 passed, 0 failed across real-estate-mobile-readiness,
  real-estate-buyer-access, real-estate-buyer-introduction-review, real-estate-phase3,
  and mobile-sales-bootstrap test files.
- After the final error-envelope additions: all 11 milestone-specific tests passed again.
- TypeScript: final `tsc --noEmit --pretty false` passed.
- Full project lint passed with existing React hook warnings outside this change.
- Final targeted lint passed without warnings or errors.
- Diff whitespace check passed with Windows CRLF handling.
- Production build skipped by explicit user instruction.
- Validation did not deploy or mutate production data or verify the live private bucket. Git delivery is tracked separately.
