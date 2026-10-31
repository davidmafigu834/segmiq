# Phase 6 — Production Real Estate activation

Date: 2026-10-31 (Africa/Harare). Android integration against the backend already deployed at `https://www.segmiq.com`. No backend service was rebuilt, no Supabase project or migration was created, and no Solar work was started. No customer record was created, edited, booked, or notified.

## Production revision observed

Authenticated read-only probe at `2026-10-31T19:04:50Z`.

| Field | Observed value |
|---|---|
| Origin | `https://www.segmiq.com` |
| `schemaVersion` | 1 |
| `release.contractVersion` | 1 |
| `release.revision` | `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6` |
| `release.deployedVerification` | `NOT_ATTESTED` |
| Experience | `REAL_ESTATE`, resolved by `BUSINESS_TYPE`, home `TEAM` |
| Role used for module reads | `SALESPERSON` |
| Organisation ID | `a1000001-e57a-4e00-8000-000000000001` |
| Workspace mode | `production` |
| `salesAccess` / `salesOperations` | `ALLOWED` / `ALLOWED` |
| Time zone | `America/New_York`, source `PLATFORM_DEFAULT` |
| Quotation currency | not configured |
| `privateListingImageDelivery` | `false` |

The historical revision `ebe1a5807fbaa5c2dd125f6fa779751b5031e0c0` is no longer the deployed revision. Local git HEAD is the same SHA as production. Uncommitted files in the web checkout were not treated as deployed.

`deployedVerification: NOT_ATTESTED` is the server's own constant. It does not mean the API is missing. It also does not certify two-agent privacy or storage migration. Android acceptance is the separate manifest in `EstateAccess.kt`.

## Verified deployed contracts

Safe calls only. The temporary salesperson session was logged out and the same token then received `401 SESSION_REVOKED`. An unauthenticated bootstrap received `401 TOKEN_INVALID`. A second demo identity received `403 INSUFFICIENT_ROLE` and was not a salesperson, so it could not be used as a second agent.

| Call | Result |
|---|---|
| `GET /api/sales/app/bootstrap` | 200, `Cache-Control: no-store` |
| `GET /api/clients/{org}/listings?page=1&limit=20` | 200, 10 listings, `total` 10, `no-store` |
| `GET /api/clients/{org}/listings/{id}` | 200, `listing` plus `matches` |
| `GET /api/clients/00000000-0000-4000-8000-000000000001/listings` | 403 `CROSS_TENANT_ACCESS` |
| `GET .../listings/{id}/images/0` | 409 `IMAGE_UNAVAILABLE` |
| `GET .../buyer-searches?page=1` | 200, 2 searches |
| `GET .../buyer-searches/{id}` | 200, requirements fields present |
| `GET .../matching?searchId=` | 200, `matches` empty, `incomplete`/`truncated`/`notice` present |
| `GET .../viewings?page=1&limit=40` | 200, 5 viewings, all `access=full` |
| `GET .../viewings/{id}` | 200 |
| `GET .../buyer-sales/introductions` | 200, body key `items` |
| `GET .../offers` | 200, 0 offers, `listCompleteness.bounded=true`, `exhaustive=false` |
| `GET .../transactions` | 200, 0 rows, same bounded completeness |
| `GET /api/sales/calendar` for a 21-day window | 200, 0 events in that window |

Listing bodies included status, price, description, suburb, bedrooms, bathrooms, size, agent, and empty `photos`. Seven of ten listings set `legacyImagesGated`. No listing included a currency field. No listing included a features field. Buyer searches included currency, locations, features, and contact fields for this salesperson's own searches. Matching returned no explanation rows, so no match percentage was invented.

Calendar source coverage in the deployed handler is `FOLLOW_UP`, `CALL`, `QUOTE_REVIEW`, and `VIEWING`, with `incomplete: true` and `standaloneMeetingsSupported: false`. The Android calendar keeps that partial-coverage wording. An empty day is not presented as proof that no viewings exist outside that day.

## Module acceptance

The reviewed manifest is `acceptedEstateReleases` in `app/src/main/kotlin/com/segmiq/sales/core/estate/EstateAccess.kt`.

Approved only when all of these match:

- Origin `https://www.segmiq.com:443`
- Revision `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6`
- Contract version 1
- Role `SALESPERSON`
- Read set: Properties, Buyers, Viewings, Introductions, Offers, Transactions, Calendar

Writes are empty. `privateImageHost` is null. Compliance is not included. `CLIENT_MANAGER` is not included, because that role was not exercised on this deployment. A changed revision, origin, or role fails closed before any module request.

## Screens activated

Live reads open inside the existing server screens, still behind the checks above:

- Real Estate home links for properties, viewings, introductions, and the partial calendar
- Property directory, status filters, search, paging, and detail
- Buyer directory and requirement detail, including features when the server sends them
- Matching from a buyer, using server reasons only
- Viewing list and detail
- Introduction list and detail
- Offer and transaction lists, labelled partial when the server says the feed is not exhaustive
- Calendar day/week navigation in the organisation time zone

Inquiry → buyer does not guess a search from a name or phone. The inquiry payload has no buyer-search id, so the link opens the buyer directory and says so.

Scheduling, rescheduling, outcomes, requirement edits, introduction decisions, offer decisions, and transaction notes stay behind write acceptance. The forms remain in the app and still refuse to call production.

## Image delivery

Not activated.

- Bootstrap `privateListingImageDelivery` is false.
- The first listing's image metadata returned `409 IMAGE_UNAVAILABLE`.
- No signed host, expiry, or storage response was available.
- Legacy photo values are gated on the listing DTO and are not fetched.
- The app still refuses to send the Sales token to a storage host, and it has no public-bucket fallback.

Storage requirement before photos can be approved: each photo must be a private object key `clients/{clientId}/listings/{listingId}/photos/{file}` in a bucket that is not the public marketing bucket, and the server must report `privateListingImageDelivery` for this origin, revision, and role. Until then the gallery stays on the neutral fallback.

## Privacy evidence and what it does not prove

Proven for this salesperson:

- Wrong organisation path returns `CROSS_TENANT_ACCESS` and no rows.
- Returned listings used this organisation id.
- Logout revokes the real session (`SESSION_REVOKED`), which is distinct from an invalid token.
- Listing-only viewing payloads that contain private fields are still rejected by the client. No listing-only row was returned in this probe, so that server behaviour was not observed live.
- Offer and transaction feeds were empty, so competing-offer redaction was not observed live.

Not proven:

- A second salesperson in the same organisation. The other demo identity cannot sign in to Sales.
- A second tenant's records, beyond the synthetic foreign path denial.
- Buyer or introduction `Cache-Control: public, must-revalidate, max-age=0`. Listings, viewings, offers, transactions, calendar, and bootstrap used `no-store`. The Android client does not install an HTTP disk cache. The `public` directive is still a server-side gap for those two responses.

## UI changes

The premium surfaces, logo, and five-tab navigation are unchanged. Copy on Home and inquiry related-work now matches the read release instead of saying every module is still disconnected. Property directories gained status filters for the statuses the API already accepts. Property detail shows transaction type and category when present. Buyer detail shows features and bathrooms when present. Prices keep the exact decimal text and say currency is not configured when the organisation has none.

## Tests

Existing suites still cover tenant mismatch, buyer null contact fields, viewing privacy, offer conflicts, image host/expiry/token rules, session `SESSION_REVOKED`, Solar and General denial, and General Sales navigation. New unit coverage:

- The production manifest is exactly the observed origin, revision, salesperson role, and read set.
- Writes, compliance, images, manager role, the previous revision, another host, Solar, and General stay closed.
- A non-production origin still makes zero module requests.
- Property `status` is sent only when a filter is selected.

Results, Android 11 emulator `SolarCare_API_30`:

- `assembleDebug` and `lintDebug`: BUILD SUCCESSFUL in 14m 9s.
- `testDebugUnitTest` and `connectedDebugAndroidTest`: BUILD SUCCESSFUL in 6m 38s. All 20 instrumented tests passed, none skipped or failed. `EstateContractTest` ran 30 tests, including the production-manifest and status-filter cases.
- Debug APK installed on that emulator and `MainActivity` launched.

## Emulator screenshots

Shareable captures stay on synthetic fixtures from the Android 11 instrumented run. Live customer records were not opened on the emulator. See [screenshots/phase-6](screenshots/phase-6/README.md).

## Remaining release blockers

1. Private listing images: `IMAGE_UNAVAILABLE`, delivery flag false, legacy objects not migrated.
2. All writes: requirements, bookings, introduction decisions, offers, and transaction notes. No production mutation was performed, and no concurrency or notification evidence was collected.
3. `CLIENT_MANAGER` is not in the manifest.
4. Cross-agent buyer, viewing, introduction, and offer redaction was not observed with two salesperson sessions.
5. Buyer and introduction responses are not `no-store`.
6. Offer and transaction feeds are bounded. An empty result does not prove there is no linked transaction.
7. Calendar is partial and does not include standalone meetings.
8. Compliance and documents stay gated.
9. Physical-device verification was not part of this run.
