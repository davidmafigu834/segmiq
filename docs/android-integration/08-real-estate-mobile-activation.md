# Real Estate mobile activation

Decision: **writes, private images, and the new workflow projections are not accepted for the Android release pin.** Reads that were previously pinned stay pinned only to revision `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6`. That pin does not move to a newer deployment in this record.

Contract version remains **1**. `deployedVerification` remains `NOT_ATTESTED`. No `EstateAccess` write set was enabled. No production row, storage object, migration, or deployment was changed.

Candidate revision for the source in this working tree: `PENDING_COMMIT`. It is the commit that contains this activation record, on top of `082ea3cf5198b3cda8639afd870238f6fd79507f`. It is not a deployed revision. Do not copy `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6` onto it.

## Origin and revision

| Fact | Evidence | What it does not prove |
|---|---|---|
| API origin | `https://www.segmiq.com` | — |
| Unauthenticated bootstrap, 2026-11-01T10:59:37Z | `GET /api/sales/app/bootstrap` returned 401 `TOKEN_INVALID`, `Cache-Control: no-store`, `Server: Vercel`, `X-Matched-Path: /api/sales/app/bootstrap` | No session, no `release.revision`, no role |
| Git `origin/main` before this candidate | `082ea3cf5198b3cda8639afd870238f6fd79507f` | The candidate is not that commit |
| GitHub commit status for `082ea3cf` | Vercel `success` at 2026-10-31T23:45:09Z, description "Deployment has completed" | The live bootstrap did not echo the SHA |
| Android read pin | `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6` is an ancestor of `082ea3cf` | A descendant does not inherit acceptance |
| Verified deployed revision of this candidate | none | `PENDING_COMMIT` has not been deployed |

## Accepted reads

No change. The only reviewed read pin remains:

```text
origin: https://www.segmiq.com:443
revision: 7e743eb43fd2995636c8b2f7133d606a1d2c3cb6
contractVersion: 1
role: SALESPERSON
reads: PROPERTIES, BUYERS, VIEWINGS, INTRODUCTIONS, OFFERS, TRANSACTIONS, CALENDAR
writes: empty
privateImageHost: null
```

If an authenticated bootstrap on a salesperson account returns a newer SHA, those reads stay closed until a new read-only walk is recorded against that exact SHA. Do not copy the old pin forward.

## Operation acceptance

Prefix `P` is `/api/clients/{clientId}`. Contract version is 1 for every row. Candidate revision is `PENDING_COMMIT`. Verified deployed revision is empty for every row. Acceptance is **FAIL** because the actor, privacy, and concurrency columns were not executed against an isolated database.

| Endpoint | Actor permission in source | Privacy tests | Concurrency tests | Database prerequisites | Storage prerequisites | Acceptance | Android activation requirement |
|---|---|---|---|---|---|---|---|
| `POST P/buyer-searches`, `GET P/buyer-searches`, `GET/PATCH P/buyer-searches/{searchId}` | Own organisation. Create assigns the actor. An agent lists and reads only assigned searches. Reassignment is manager-only. Duplicate phone is 409 unless `confirmNewContact`. | Source projection omits phone and contact name for a non-owner. Not run with Salesperson A, Salesperson B, a manager, and an organisation B salesperson | Not run | Existing `contacts` and `real_estate_buyer_searches`. No new migration | None | FAIL | Keep `BUYERS` out of `EstateAccess.writes` until this row is PASS on the deployed SHA |
| `POST P/listings`, `PATCH P/listings/{listingId}` | Agent create stays `draft` or `pending_approval`. An agent cannot approve, assign another agent, or edit an approved listing. Address is the heading. No title or listing currency | Source permission checks only. Draft visibility across agents was not executed | Not run | Existing `listings` | Bearer `photos` must be omitted or already-private keys. Public URLs return 400 `USE_PRIVATE_IMAGE_UPLOAD` | FAIL | Keep `PROPERTIES` out of writes. Do not treat a metadata PASS as a photograph PASS |
| `POST P/listings/{listingId}/images` and `GET P/listings/{listingId}/images/{index}` | Caller needs listing edit permission. Signature must be JPEG, PNG, WebP, or AVIF. Max 20 MiB. Max 50 photos. Signed URL lifetime 300 seconds | Source refuses the public bucket, a non-photo key, HTML, and oversize bytes. No object was stored | Idempotency key is hashed into the object name. Not raced | None | `CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME` must differ from `CLOUDFLARE_R2_BUCKET_NAME`, with account id and keys. `SEGMIQ_RE_PRIVATE_IMAGE_ACCEPTANCE_JSON` must match the deployed revision before `privateListingImageDelivery` is true | FAIL | `privateImageHost` stays null. Do not enable `privateListingImageDelivery` |
| `GET P/matching?listingId={listingId}` | Listing must be approved and available. Caller must be allowed to read it. Other-agent buyers expose `request_introduction` only | Source card omits name, phone, budget figures, locations, and features for another agent. Not run cross-tenant | Not run | Existing searches and listings | None | FAIL | Do not activate matched buyers on the new projection until this SHA is deployed and the redaction walk passes |
| `POST P/buyer-sales/actions` `introduction` and `review_introduction`; `GET P/buyer-sales/introductions` and `/{introductionId}` | No self-approval. Decline reason required. Repeat decision is 409. Reassignment removes the previous owner's review right. Requester does not receive requirement text. No customer WhatsApp | Source checks for self-approval, reassignment, and blank requirements. Not run with the four identities | Update is conditional on `status = requested`, so a second decision updates zero rows. The race was not executed | `real_estate_buyer_introductions` plus `decided_by`, `decided_at`, `decision_reason` from `20261018130000_buyer_introduction_decisions.sql` | None | FAIL | Keep `INTRODUCTIONS` out of writes |
| `POST P/buyer-sales/actions` `viewing`, `reschedule_viewing`, `viewing_outcome` | Owned search. Live listing. Bearer requires `Idempotency-Key` of 8–200 characters. Future timestamp with an offset. Overlap is 409 until `confirmOverlap`. `notificationEffects.customerNotification` is `NOT_REQUESTED`. Legacy `POST P/viewings` is 405 `USE_OWNED_SEARCH_ACTION` for Bearer | Source replay equality only. No second-tenant call | Unique index `idx_viewings_idempotency` on `(client_id, idempotency_key)` exists in `20261016120000_real_estate_phase3_buyer_sales.sql`. A losing insert is not replayed as success in source. The race was not executed | That unique index must already be applied. No new migration in this candidate | None | FAIL | Keep `VIEWINGS` out of writes. Do not call the legacy viewing route |
| `GET/PATCH P/leads/{leadId}/real-estate`; action `link_enquiry` | Bearer client guard, then existing lead read or modify permission. Link requires the same contact | Not run | Not run | `leads.buyer_search_id` already written by search creation and link | None | FAIL | Do not treat inquiry linkage as accepted |
| `GET /api/sales/copilot/conversations/{leadId}`; `POST /api/sales/copilot/work-items/{itemId}` | Assigned conversation. Approve stores a follow-up or quotation draft. Suggested replies stay drafts. `customerDelivery` is `NOT_PERFORMED` | Source asserts the route does not call a WhatsApp send. Not run on a live conversation | Existing work-item service. Not raced | Existing copilot tables | None | FAIL | Do not activate conversation Copilot writes until this SHA is deployed and an assigned-conversation check passes |

`OFFERS`, `TRANSACTIONS`, `CALENDAR`, and `COMPLIANCE` stay out of writes. Calendar remains a read on the old pin only.

## Private image host

**Not approved.** `privateImageHost` stays null. `privateListingImageDelivery` stays false.

Local `.env.local` has the public R2 bucket, account, and keys. `CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME` is unset. `SEGMIQ_RE_PRIVATE_IMAGE_ACCEPTANCE_JSON` is unset. Source refuses a bucket that equals the public marketing bucket and refuses keys outside `clients/{clientId}/listings/{listingId}/photos/`. Signed URLs are 300 seconds. The acceptance helper allows only the account R2 host and the private-bucket R2 host, and only when the packet matches the deployed origin, revision, contract version 1, and role. No packet exists. Legacy public objects were not migrated and were not deleted. No signed URL, expiry, or redirect was fetched.

## Isolated security verification

**Blocked.** No isolated Salesperson A, Salesperson B, Manager, or organisation B identities were available. The configured database host is the hosted Supabase project, not localhost. No customer row was read or written for this check. Source tests are not a substitute for that walk. Acceptance stays FAIL.

What the source does specify, and what was not executed:

- Listing ownership and draft visibility: agent edit is limited to the agent's own draft or pending listing.
- Buyer-search ownership: create assigns the actor; another agent receives an id-only projection.
- Cross-tenant denial: client mismatch returns 403 before the service runs.
- Buyer contact redaction: phone and requirement values stay off the other-agent match card.
- Introduction review: self-approval 403, decline without a reason 400, repeat decision 409, reassignment drops the previous reviewer.
- Viewing authorisation: owned search, live listing, required idempotency key, overlap 409 until confirmed.
- Customer messages: viewing notification effect is `NOT_REQUESTED`; Copilot approval does not send WhatsApp.
- Database concurrency: viewing uniqueness is the partial unique index; introduction uniqueness is the `status = requested` update predicate. Neither was raced with two connections.

## Local verification

Recorded on 2026-11-01. Node was the editor helper binary because `node` is not on the shell PATH.

- `next lint`: exit 0. Existing react-hooks warnings remain in unrelated components.
- TypeScript `tsc --noEmit`: exit 0.
- `next build`: exit 0. `/opengraph-image` prerendered as static content. The Windows failure was `path.join(import.meta.url, "../…")` inside Next.js 14.2.35 `@vercel/og`, which produces an invalid URL on win32. `scripts/patch-vercel-og-windows.mjs` rewrites those three asset loads to `new URL("./…", import.meta.url)` only on Windows, and `npm run build` runs it first. Linux and Vercel keep the original Next file. Open Graph routes were not removed.
- Webpack still warns `module.createRequire failed parsing argument` from `lib/zoho-books/import-plan.ts`. The build completes. The phone parser already falls back when that require fails. It was not rewritten.
- `tsx --test tests/*.test.ts`: 1485 tests, 1485 passed, 0 failed. Duration 171613 ms.
- No Git push, production migration, or production write was performed.

## Remaining blockers

1. Do not deploy this candidate without an explicit release decision. Pushing `main` can auto-deploy production. `vercel.json` disables Git deployment only for `codex/real-estate-phase5a-acceptance`.
2. After an authorised deploy, authenticate against production, confirm bootstrap `release.revision` equals the deployed SHA, and repeat one page each of listings, buyers, a listing's matches, viewings, introductions, offers, transactions, and calendar. Do not copy the old read pin.
3. On two isolated agents in one test organisation, a manager in that organisation, and one agent in a second organisation, exercise the writes in the table. Assert organisation B receives 403 or 404, the other agent does not receive phone or requirement text, and a declined introduction stays declined.
4. Race two bookings with one idempotency key and two introduction decisions. Expect one viewing row. The second introduction decision must be 409.
5. Approve a private listing host only after a signed URL is fetched, expires, and is not the public media host. Put that host in `EstateAcceptance.privateImageHost` for the same SHA. Until then the flag stays false.
6. Leave compliance documents, transaction progression, and `re_mobile_transition_transaction` closed. Those gates in `05-real-estate-production-acceptance.md` are unchanged.

## Android acceptance entry to add later

Do not add this until every blocker for that operation is closed. The shape, when a future record says PASS, is:

```text
EstateAcceptance(
  origin = "https://www.segmiq.com:443",
  revision = "<40-hex SHA that bootstrap returned>",
  reads = existing read set,
  writes = setOf(PROPERTIES, BUYERS, VIEWINGS, INTRODUCTIONS),
  privateImageHost = "<approved host or still null>",
  roles = setOf("SALESPERSON")
)
```

`OFFERS`, `TRANSACTIONS`, `CALENDAR`, and `COMPLIANCE` stay out of `writes` in that entry. `privateImageHost` stays null until blocker 5 passes, even if listing metadata writes pass.
