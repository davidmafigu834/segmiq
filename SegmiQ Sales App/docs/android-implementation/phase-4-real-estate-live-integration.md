# Phase 4 — Real Estate Android integration

Date: 2026-10-31 (Africa/Harare). This is an implementation with explicit rollout gates, not a production-complete release. No Solar development or backend file edit was performed.

## Backend identity and preflight

Inspected all Android audit reports, Phase 3A/3C–F reports, backend-gap handoff, premium UI report/design/asset manifest, current authentication, HTTP client, bootstrap, repositories, feature ViewModels, navigation and tests. The historical audit describes the original offline prototype; current auth/session/shared live source supersedes it.

The completed integration contracts are in the **parent web checkout** at `../docs/android-integration/`, not the Android directory:
- 01-auth-and-bootstrap.md
- 02-real-estate-properties-buyers.md
- 03-real-estate-mobile-complete-contracts.md
- 04-real-estate-mobile-release-checklist.md

Backend Git HEAD: **ebe1a5807fbaa5c2dd125f6fa779751b5031e0c0**. Read the relevant bootstrap, mobile-contract, property/buyer/matching, viewing, offer and transaction source/projections. The tracked readiness code/contracts are not among the parent checkout's reported modified files. Unrelated web changes were left untouched. An additional deployment-report path appeared in that checkout but its IDE buffer was blank; it supplied no acceptance evidence.

An explicitly authorised test account successfully authenticated against **https://www.segmiq.com**. A temporary session fetched bootstrap only, and was revoked afterward. Bootstrap reported:
- contractVersion: **1**
- revision: **ebe1a5807fbaa5c2dd125f6fa779751b5031e0c0**
- deployedVerification: **NOT_ATTESTED**
- experience: **REAL_ESTATE**
- module read/write flags advertised
- privateListingImageDelivery: **false**

This independently verifies authentication/bootstrap and advertised deployment identity, **not deployed cross-agent/cross-tenant privacy, database concurrency or storage migration**. No new-module customer list/detail, business mutation, notification, upload or document request was made to production. No credential is included in source, fixtures or these reports.

Stack retained: AGP 9.0.1, Kotlin 2.3.20, Compose BOM 2026.03.01, Navigation Compose 2.9.0, lifecycle 2.10.0, OkHttp 4.12.0, serialization 1.9.0, SDK 36/min26, JVM17, manual container and StateFlow. No dependency added.

## Implementation inventory

### Source and models

- `core/bootstrap/BootstrapDtos.kt`: additive optional backend release metadata and documented Real Estate/calendar flags. Older schema-1 payloads remain compatible.
- `core/estate/EstateAccess.kt`: experience, subscription/sales gate, capability, contract version, exact origin and exact release acceptance checks. Independent accepted releases are deliberately empty. No local preference, demo flag or server feature flag can certify acceptance. Read/write/media approvals are distinct.
- `core/estate/EstateDtos.kt`: typed Property, BuyerSearch, matches, full/listing-only viewing, introductions, offers/events, transactions/milestones, calendar, image metadata and mutation projections. Money uses exact JSON decimal lexemes and BigDecimal; no Double money conversion. Null is not invented as zero. Booking creation has a separate minimal receipt DTO rather than reusing the permission-filtered viewing read projection; offer/transaction notes map the actual stored internal_notes field.
- `core/estate/EstateRepository.kt`: existing SegmiqHttp transport, one authenticated workspace prefix, documented query parameters, paging/completeness, scoped response validation and stable IDs. Rejects accidental demo IDs and unsafe path segments. No independent auth stack or direct database access.
- `core/estate/PrivateListingImageClient.kt`: separate token-free storage download client; exact HTTPS host, port, credentials/fragment and TTL validation, redirects/cookies/authenticator/disk cache disabled, MIME and streamed 20MiB cap. Downloaded bytes are decoded off-main with dimension and sampling bounds. There is no public/legacy URL fallback.
- `core/network/SegmiqHttp.kt`: optional validated Idempotency-Key, used only for the documented owned-search booking action. Existing error/session behavior and off-main response processing remain.
- `features/realestate/EstateServerViewModel.kt`: lifecycle StateFlow, refresh/search/paging/date navigation, stable server entity links, pending/confirmed/conflict state, no optimistic acceptance, private content cleared on failed reads/decisions, duplicate mutation tap guard.
- `features/realestate/EstateServerScreens.kt`: native read screens, gallery/neutral fallback, exact price context, requirements, match explanations, viewing privacy state, introduction review, offer decision confirmation, transaction notes/milestones and bounded calendar. No invented AI scores or workflow milestones.
- `features/live/LiveSalesApp.kt` and `core/live/LiveSalesApi.kt`: repository reuse and contextual native routes within existing navigation. Deterministic fingerprints of the authenticated scope, origin and bootstrap preserve ViewModels through rotation while invalidating state when access changes. Composition keys prevent a previous flow value appearing under another scope. Record routes retain separate back-stack entries; the public app wrapper uses the normal repository and an internal workspace composable supports explicit synthetic repository injection in tests.
- `features/realestate/RealEstateScreens.kt`: rollout status/release diagnostics in existing gated entries and Settings.
- `core/design/SegmiqWeekStrip.kt`: can distinguish unrequested days from known empty days for truthful accessibility labels.

### Read adapters and connected UI

Implemented guarded requests for listings list/detail, buyer-search list/detail, owned-search matching, viewing list/detail, introduction list/detail, offer list/detail, transaction list/detail and salesperson calendar. These adapters are wired into authenticated routes **behind acceptance**, not silently substituted with demo data.

Endpoint inventory (P = `/api/clients/{authenticated organisation ID}`):

| Module | Implemented read path | Implemented write path / limit |
|---|---|---|
| Properties | GET P/listings and P/listings/{listingId} | No listing-management adapter |
| Images | GET P/listings/{listingId}/images/{index}; separate approved storage host | No upload / public fallback |
| Buyers | GET P/buyer-searches and P/buyer-searches/{searchId} | PATCH detail requirements adapter; editor not enabled |
| Matching | GET P/matching?searchId=… | No separate algorithm or AI endpoint |
| Viewings | GET P/viewings and P/viewings/{viewingId} | POST P/buyer-sales/actions: viewing, reschedule_viewing, viewing_outcome |
| Introductions | GET P/buyer-sales/introductions and detail | POST P/buyer-sales/actions: review_introduction |
| Offers | GET P/offers and detail | PATCH detail with expected_updated_at; no create adapter |
| Transactions | GET P/transactions and detail | PATCH detail: update_notes with expected_updated_at |
| Calendar | GET /api/sales/calendar?from=…&to=…&page=…&limit=… | Read only |
| Compliance/documents | No new native live adapter | No transfer or review operation enabled |

All operations in this table remain rollout-gated; it is not a table of successful production requests.

Search is exposed only for documented query endpoints. Introductions have Received/Sent filters. Offset paging is supported where documented; bounded offer/transaction/introduction/calendar feeds are labelled partial rather than pretending to be exact global totals. The existing authorised task/follow-up calendar remains the production fallback; the new calendar retains its server partial-coverage warning and does not invent standalone meetings.

Cross-screen source links preserve IDs/context:
- Buyer requirements → backend matches → property detail → original buyer.
- Viewing → property / authorised owned-search detail.
- Calendar viewing → viewing detail; task/call/follow-up → shared inquiry detail.
- Introduction → property.
- Transaction → related offer / property.
- Existing inquiries/tasks/Copilot continue using shared services.

These are contract-connected native routes, not a claim that every requested production journey is complete. Booking selection/review, offer creation and offer-to-transaction reconciliation still need Android work listed below.

### Write adapters and safety

Guarded typed adapters implement buyer requirements PATCH; owned-search viewing schedule/reschedule/outcome; introduction decision; revision-protected offer submit/counter/accept/reject/withdraw/note; transaction notes. No accepted production write release exists.

Native reviewed UI is connected for introduction decisions, viewing outcomes, offer actions and transaction notes. All require resource/action policy, pending state and server confirmation. Offer and transaction updates send expected_updated_at. 409 clears stale detail for authoritative refresh. No generic write retry, financial offline queue or automatic notification request is added. Booking sends the caller's stable idempotency key and documents no requested customer notification.

Financial transaction progression/completion, private documents/compliance transfer and mobile viewing cancellation remain unavailable. The backend financial revision wrapper is an unapplied review proposal according to the inspected checklist. A successful source build cannot certify that database dependency.

## Feature classifications

See [integration matrix](phase-4-integration-matrix.md). **All newly added Real Estate module operations remain GATED in this APK.** They are contract-implemented and synthetic-tested; they are not LIVE-INTEGRATED or LIVE-VERIFIED under the sprint's production definition. Existing shared inquiries/tasks/Copilot integration is preserved. Only authentication/bootstrap received a new deployed verification request this sprint.

Source review confirms Bearer support now exists for these modules; the old blanket cookie-only findings are historical. Do not ask Cursor to rewrite those completed guards. Current rollout evidence is still missing independently of source support.

## Security and media lifecycle

- Every adapter checks acceptance before HTTP, binding evidence to the transport's actual origin, exact revision and bootstrap entitlement. Unknown native roles and unknown/non-ALLOWED access decisions fail closed. Dot-segment traversal and accidental demo IDs are rejected before URL construction.
- Client IDs come from authenticated workspace; IDs supplied by responses are checked when available. Unexpected cross-tenant property/search bodies or wrong detail IDs fail closed.
- Listing-only viewing payloads carrying private contact/search/instructions/feedback fields are rejected, not displayed. This is defence in depth, never a replacement for server policy.
- No permittedActions value authorises a user independently of the backend.
- Signed storage requests receive no Sales JWT, cookies or private API request tag. Metadata endpoint strings from JSON are never executed as arbitrary URLs.
- No durable new customer/image/document cache, private shared-gallery file, upload queue or broad offline replay was introduced. Private image state is confined to the authenticated composition; it is not put in the bundled artwork cache.
- The server documents that signed URLs can survive revocation until their 300-second expiry. No immediate storage revocation claim is made.
- Compliance UI/menu is not fabricated from a broad flag; actual permission and storage acceptance remain required.
- Shared session expiry/logout/bootstrap safeguards and General/Solar selection remain unchanged.

## Demo and premium UI

The pre-existing fictional ViewModel/fixtures remain separate and clearly labelled. New production adapters contain no fallback fixtures. Synthetic API fixtures exist only in tests and use a local MockWebServer. No generated photo is assigned to a live listing; the new read screens show neutral placeholders until private media is accepted.

Official SegmiQ artwork, ivory/forest/lime surfaces, typography, shared motion, primary five-tab navigation and existing premium screens are preserved. Private gallery decoding is bounded and has a finite fade. Calendar controls wrap for enlarged fonts and include a native date picker. Unavailable-photo panels are compact rather than occupying a full photographic hero; their minimum space grows with font scale. Listing cards reuse existing bedroom/bathroom/area attribute components. Review dialogs scroll and never mark an offer accepted before confirmation. Recorder capture and transcripts remain unavailable; no active-recording evidence is claimed.

At the end of Phase 4, the previous premium report's keyboard/action-clearance issue remained outstanding. The subsequent premium refinement resolved and recaptured login/draft keyboard clearance with native-boundary assertions; see phase-ui-premium-upgrade.md. That presentation change does not alter this report's live rollout gates.

## Automated verification and screenshots

- Baseline assembleDebug + testDebugUnitTest: **PASS**, 1m35s (tasks up to date).
- First integration checkpoint assembleDebug + unit + lint: **PASS**, 8m18s. A preceding compile caught and corrected an escaped Kotlin calendar-link string.
- Full combined assembleDebug + testDebugUnitTest + lintDebug + connectedDebugAndroidTest: **PASS**, all **16 emulator tests**, none skipped/failed, 7m05s (Studio shell-26). This includes the native Buyer → Matches → Property → Back → Back → Buyer directory journey and all 14 pre-existing tests.
- After compact placeholder/layout and deterministic state-key refinements, debug build + all unit tests + lint + both targeted EstateServerUiTest tests passed (4m16s, shell-27). The **final** run after raw booking-receipt/internal_notes mapping corrections and date-picker verification also passed debug build, all unit tests, lint and both targeted native tests: **BUILD SUCCESSFUL, 8m44s, exit 0, none skipped/failed** (shell-30). The 16 API-screen PNGs were replaced from this final run. These were focused reruns; no additional full 16-test run is claimed afterward.
- Meaningful intermediate fixes: corrected an escaped Kotlin link string; retained the original trailing-lambda week-strip API with a compatible overload; changed lazy-list tests to scroll the container before asserting a virtualised item; corrected same-pattern record navigation so parent records are not replaced. No assertion/test was disabled.
- The fingerprint regression verifies stable keys for identical scope/bootstrap and distinct keys for permission or tenant changes. This is not a physical-device rotation certification.
- New unit suites cover acceptance-before-request, General/Solar denial, exact origin/revision, decimal precision, paging/query/Bearer contracts, foreign bodies, private-field handling, revoked detail clearing, no self-decision, conflict/no retry, stable booking key, invalid budgets/time, date-only/timezone rules, image host/expiry/MIME/size/credential/redirect safety and non-optimistic duplicate-tap offer decisions.
- New native UI test renders typed HTTP fixtures through the actual adapters/screens, checks buyer→match→property context and private viewing/own-introduction restrictions, and captures list/detail/calendar/empty/error states. Existing navigation/session/organisation/General/Solar/demo regressions remain enabled.
- [Screenshot gallery](screenshots/phase-4/README.md): 53 real emulator PNGs exported, with the 16 changed typed-API captures replaced from the final focused passing run. Synthetic API and isolated fictional datasets are labelled separately. These are not evidence of live customer access. Pixel review covers data visibility, neutral photo fallbacks, property facts, match context, viewing privacy, offer/transaction states, calendar, empty/error states and the retained premium regression gallery.

### APK handoff

The final debug APK is `app/build/outputs/apk/debug/app-debug.apk`. ADB installation on emulator-5554 completed successfully (shell-32, exit 0), followed by MainActivity launch (shell-33, exit 0). Android Studio UI inspection confirmed com.segmiq.sales/.MainActivity focused and the official branded login rendered. Final calendar and error captures were also visually inspected. This is emulator launch verification, not physical-phone or live-module acceptance.

## Production readiness and remaining work

No new module is declared production-ready merely because it compiles. Physical-device verification: **none**. No frame-time/memory benchmark or real media/file test is claimed.

### Backend / rollout acceptance required

1. Archive two-agent/two-tenant deployed denial and field-projection tests for list/detail/matches/history/documents, reassignment and revoked introductions on the exact revision.
2. Verify viewing unique index and concurrent idempotency/overlap/zero-notification effects; offer acceptance RPC and competing reservations.
3. Review/apply the financial transaction revision wrapper through the separately authorised database process and run concurrent database tests. Android does not deploy or migrate.
4. Independently verify private listing/document buckets, object validation/migration and public-copy revocation; supply the exact approved signed host. privateListingImageDelivery is currently false.
5. Confirm compliance grants, document size/MIME/review rules and storage policy. Upload never means approval.
6. Supply reviewed acceptance evidence per origin/revision/module/operation. Populate acceptance only from that record; do not just flip a server/local flag.

### Android work still required

- Complete booking/rescheduling native forms and reconciliation UI around the implemented owned-search adapters.
- Complete requirements editor with a verified concurrency policy, richer filters and authored listing management where authorised.
- Offer creation/reconciliation (no generic create-idempotency guarantee), accepted-offer→transaction lookup, fuller buyer activity/enriched inquiry cross-links.
- Transaction workspace/document/compliance DTOs, protected file selection/transfer/preview/cleanup once storage is attested; server milestones remain authoritative.
- Expanded synthetic navigation/state-restoration/large-font checks for each new mutation form, keyboard correction, TalkBack, physical-phone dialing and offline/revocation checks.
- Performance profiling with representative authorised photos/data and final brand/release review.

No backend deployment, migration, web source change or production business mutation was performed.
