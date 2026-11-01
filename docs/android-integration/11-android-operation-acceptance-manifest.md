# Android operation acceptance manifest

Recorded 2026-11-01. Each row is independent. There is no combined Real Estate approval.

Contract version is **1** on every row. Allowed role for a future salesperson activation is `SALESPERSON` unless the row says the manager role is also required. Backend origin for a production call is `https://www.segmiq.com`. Prefix `P` is `/api/clients/{clientId}`.

Verified bootstrap revision: **not attested**. Unauthenticated `GET /api/sales/app/bootstrap` at 2026-11-01T13:41:25Z returned 401 `TOKEN_INVALID` and no `release.revision`. Vercel deployment `7472949276` records SHA `6d6600df9087bb193c29edf0cade06da292e5b93` for deployment id `dpl_DNKGQ8x4uEVNSZMokjnaA5gGTbWq`, and the live homepage referenced that same deployment id. That SHA is the candidate under test. It is not an `EstateAccess` revision.

The four isolated actors were not provisioned. Privacy and concurrency columns are **not executed** unless a row says a source constraint was read. Source unit tests passed (1485/1485) and are not acceptance.

## Operations

| Operation | Endpoint | Permission evidence | Privacy | Concurrency | Storage | Read / write | Acceptance |
|---|---|---|---|---|---|---|---|
| Properties read | `GET P/listings`, `GET P/listings/{listingId}` | Existing read pin for `SALESPERSON` on revision `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6` only. A descendant SHA does not inherit it. | Covered by the old pin. Not repeated on `6d6600d`. | None for this read. | Listing JSON may contain private image keys. Download is a separate row. | Read open on the old pin. Write closed. | PASS only for revision `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6`. FAIL for `6d6600d`. |
| Buyer read | `GET P/buyer-searches`, `GET P/buyer-searches/{searchId}` | Same old read pin. Agent list scope is assigned searches in source. | Phone redaction for a non-owner was not rerun with Salesperson B. | None for this read. | None. | Read open on the old pin. Write closed. | PASS only for revision `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6`. FAIL for `6d6600d`. |
| Matching read | `GET P/matching?listingId={listingId}` | Source returns matches only when the listing is approved and available. Draft and unavailable listings return an empty list. Score field is rules points (`scoreMeaning: "rules_points"`), location 40, budget 25, beds 20, baths 10, type 5. | Source card for `other_agent` exposes `request_introduction` and withholds name, phone, budget, locations, and features. Not run as Salesperson A against Salesperson B, and not run from organisation B. | Not executed. | None. | Read. | FAIL |
| Buyer create / update | `POST P/buyer-searches`, `PATCH P/buyer-searches/{searchId}` | Source creates the contact and search in the caller's organisation, assigns the actor, returns 409 with `duplicates` for a repeated phone unless `confirmNewContact`, and allows reassignment only for `CLIENT_MANAGER`. Cross-tenant access is 403 before the service. | Non-owner phone redaction was not executed with the four actors. | Not executed. | None. | Write. | FAIL |
| Listing create / update | `POST P/listings`, `PATCH P/listings/{listingId}` | Source keeps an agent on `draft` or `pending_approval`. An agent cannot approve, assign another agent, or edit an approved listing. Address is the heading. No title and no listing currency. Manager approval is a separate actor. | Draft visibility to the other agent was not executed. | Stale update race was not executed. | Bearer `photos` must be omitted or already-private keys. A public URL is 400 `USE_PRIVATE_IMAGE_UPLOAD`. | Write. | FAIL |
| Viewing scheduling | `POST P/buyer-sales/actions` with `action: "viewing"` | Source requires an owned search, an approved available listing, a future timestamp with a timezone offset, and `Idempotency-Key` of 8–200 characters for Bearer. Overlap is 409 until `confirmOverlap`. `notificationEffects.customerNotification` is `NOT_REQUESTED`. Legacy `POST P/viewings` is 405 `USE_OWNED_SEARCH_ACTION` for Bearer. | Cross-tenant call was not executed. | Not executed. Database predicate: unique index `idx_viewings_idempotency` on `(client_id, idempotency_key)`. A losing insert is not replayed as success in source. | None. | Write. | FAIL |
| Viewing reschedule / outcome | `POST P/buyer-sales/actions` with `reschedule_viewing` or `viewing_outcome` | Same owned-search action path. Outcomes stay the existing set (`interested`, `considering`, `second_viewing`, `wants_offer`, `too_expensive`, `location_unsuitable`, `condition`, `not_interested`, `no_show`). Customer WhatsApp remains `NOT_REQUESTED`. | Not executed. | Not executed. | None. | Write. | FAIL |
| Introduction create / review | `POST P/buyer-sales/actions` with `introduction` or `review_introduction`. `GET P/buyer-sales/introductions` and `GET P/buyer-sales/introductions/{introductionId}` | Source denies self-approval with 403, requires a decline reason, returns 409 when the row is no longer `requested`, and drops the previous owner's review right after reassignment. Requester requirement text is blank for a non-manager. No customer WhatsApp send is part of the action. | Property-specific contact disclosure and organisation B denial were not executed. | Not executed. The update is conditional on `status = requested`. | None. | Write for create, approve, decline, and reassignment. List/read on the new projection is also FAIL. | FAIL |
| Inquiry linking | `GET P/leads/{leadId}/real-estate`, `PATCH` on that path, action `link_enquiry` | Bearer client guard, then existing lead permission. Link sets `leads.buyer_search_id` only when the search belongs to the same contact. Response exposes buyer search id, linked listing id, viewing ids, and offer status text. It does not expose an offer id. | Not executed. | Not executed. | None. | Read and write. | FAIL |
| Conversation Copilot | `GET /api/sales/copilot/conversations/{leadId}`, `POST /api/sales/copilot/work-items/{itemId}` | Source scope is the assigned conversation. Work-item actions are approve, dismiss, snooze, retry, complete, and choose. Approve stores a follow-up or quotation draft. `sendsCustomerMessage` is false, `approvalRequired` is true, `suggestedResponsesAreDrafts` is true, and `customerDelivery` is `NOT_PERFORMED`. A simulated session changes nothing. A stale work item returns 409. | Another agent's conversation was not requested. | Stale-action race was not executed. | None. | Read and write. | FAIL |
| Private image upload | `POST P/listings/{listingId}/images` multipart field `file`, optional `cover=true`, `Idempotency-Key` | Edit permission is the listing edit check: own draft or pending listing. Unconfigured private storage returns 503 `STORAGE_UNAVAILABLE`. Wrong signature is 415. Over 20 MiB is 413. The 51st photo is 409. | No object was stored. Cross-tenant upload was not sent. | Repeated key maps to one object name. Concurrent uploads were not sent. | Private bucket required and unset. Public bucket is not a fallback. Sales JWT is not sent to R2. | Write. | FAIL |
| Private image download | `GET P/listings/{listingId}/images/{index}` | Read permission is the listing read check. Response shape is `{ url, expiresAt, expiresInSeconds: 300 }`. The acceptance packet must match origin, deployed SHA, contract 1, and role before `privateListingImageDelivery` is true. | No signed URL was fetched. | None. | Allowed signed hosts are the account R2 host and the private-bucket R2 host. No host is approved. `privateImageHost` stays null. | Read. | FAIL |

## Closed until their own checks pass

| Operation | Acceptance |
|---|---|
| Offer financial decisions | FAIL. Left closed. |
| Restricted transactions, including commission fields | FAIL. Left closed. |
| Calendar writes | FAIL. Calendar read stays on the `7e743eb` pin only. |
| Compliance documents | FAIL. Left closed. |

## EstateAccess

Android may keep the existing read entry and no other:

```text
origin = "https://www.segmiq.com:443"
revision = "7e743eb43fd2995636c8b2f7133d606a1d2c3cb6"
contractVersion = 1
role = "SALESPERSON"
reads = PROPERTIES, BUYERS, VIEWINGS, INTRODUCTIONS, OFFERS, TRANSACTIONS, CALENDAR
writes = empty
privateImageHost = null
```

`PROPERTIES`, `BUYERS`, `VIEWINGS`, and `INTRODUCTIONS` stay out of `writes`. Matching, inquiry linking, and conversation Copilot stay inactive. Private image upload and download stay inactive even if a later listing-metadata row passes on its own.
