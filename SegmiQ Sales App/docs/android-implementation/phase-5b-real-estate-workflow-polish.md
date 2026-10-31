# Phase 5B — Real Estate workflows and release preparation

Date: 2026-10-31, Africa/Harare. Android implementation; no Solar development, backend changes, deployment, production migration or customer-data mutation.

## Inspected state and acceptance boundary

Read Phase 4 implementation/matrix, premium UI implementation/design/asset documentation and actual repositories, DTOs, StateFlow ViewModels, demo workflow, native navigation and tests. Reused existing architecture and official artwork. Source API schemas were checked in the parent backend checkout to resolve actual supported fields; the backend was not modified.

Neither 05-real-estate-production-acceptance.md nor 06-real-estate-android-rollout-manifest.md was found in the backend integration documentation. No new independent acceptance was supplied. acceptedEstateReleases stays empty. All new production module read/write/media gates remain fail-closed. Flags or this report are not acceptance evidence.

## Implemented forms

| Workflow | Android implementation | Current classification |
|---|---|---|
| Buyer requirements | Budget min/max, up to 12 preferred locations, property type, bedrooms, bathrooms, features and notes; validation, cancellation and reviewed save. Optional blanks remain null/unspecified. | Functional isolated demo; guarded live sheet/adapters await acceptance |
| Viewing creation | Authorised property/search selectors, paged/searchable live choices, native date/time selection, instructions, review, pending response and confirmed-viewing navigation. Same intended request retains its key across retries/restoration. | Functional isolated demo; guarded live sheet/adapters await acceptance |
| Rescheduling | Original date/time shown; property/buyer fixed; proposed time reviewed. Demo rejects stale original appointments. Live adapter uses the existing action and does not invent a revision token. | Functional demo; guarded live form awaits acceptance |
| Overlaps / outcomes | Demo overlap warning requires explicit acknowledgement; supported outcome selection and feedback. Live 409 is treated as a conflict requiring refresh; no generic automatic override. | Demo review functional; live outcome already guarded |
| Offers | Guided property/buyer selection, exact-decimal amount/terms, review, once-only local draft, existing reviewed submission/counter/accept/decline and history. | Demo-only creation; production create remains unavailable |
| Accepted offer → transaction | Explicit lookup in existing authorised transaction list using actual offerId; open actual returned transaction ID. A bounded empty result is inconclusive, never a request to manufacture a transaction. | Guarded native read flow; synthetic verification only |
| Production availability | Existing gate messages and preview access preserved. No local production edits are represented as saved. Private photos/documents/recorder remain gated or unavailable. | No production activation |

### Contracts and precision

Buyer PATCH reuses budgetMin, budgetMax, locations, bedrooms, propertyType, bathrooms, features and notes. Actual stored notes arrive as other_requirements; the DTO now maps that field and preserves features. No expected_updated_at value is invented for requirements because this endpoint does not document one. The editor warns that the latest record must be reviewed; failed writes are not automatically replayed.

All newly editable demo budgets and offer amounts use BigDecimal and plain-decimal validation. The production DTOs already use exact JSON decimals. No financial input passes through Double. New offer draft replay prevention is strictly fictional; it does not assert production offer-create idempotency.

Booking continues using POST buyer-sales/actions, the caller's stable Idempotency-Key and no generic write retry. Rescheduling uses its documented action; unsupported location/instruction edits are not sent. The receipt is not fabricated from a timer. Notification text distinguishes documented NOT_REQUESTED from an unknown response; no provider delivery is claimed.

## Navigation and state

- Fictional Buyer → Matches → Property retains the buyer ID for scheduling/offer preparation.
- Cancel pops the current form rather than navigating to an unrelated page.
- Record routes keep separate back-stack entries; primary Home / Properties / Buyers / Inbox / More remain unchanged.
- Missing or reassigned example selections show unavailable; they do not silently substitute another buyer.
- Scoped live ViewModels/repository fingerprints are reused. Refresh and denied mutations cancel and clear related selection/transaction lookup state.
- Accepted-offer lookup never POSTs a transaction. Inquiry → Buyer enrichment in production still requires actual backend search linkage; no contact/name-to-search-ID guess was added.
- No unsupported external deep-link contract was introduced. Draft restoration is saveable within the existing navigation/session policy; process loss can discard fictional session records.

## Presentation, keyboard and accessibility

Reused the premium ivory/forest/lime system, official logo/Q, generated decorative assets and existing photo-security adapter. No replacement branding, customer portraits or fake listing photographs were generated.

Forms have clear headings, native field labels/types, spoken selected chips, field-error announcements, named overlap acknowledgement and wrapping/scrollable review content. Page now applies IME padding to scrollable forms. Review clears text focus; form sheets open fully expanded with explicit navigation-bar and IME padding, so their scroll viewport matches the visible content. Time-picker content scrolls. Availability copy uses plain agent-facing language rather than API tokens. Date selection uses a viewing-specific title, and ambiguous/nonexistent wall-clock times cannot silently shift into another booking.

The prior login/draft keyboard issue was already fixed by the premium refinement and its geometry tests are retained. Large-text bottom navigation still wraps long labels at 200%; this remains a layout tradeoff, not a claim of exhaustive accessibility approval.

## Files

- features/realestate/EstateFormModels.kt — decimal validation, requirements draft, booking identity/time validation.
- features/realestate/EstateDemoForms.kt — complete fictional form/review interactions and shared requirements fields.
- features/realestate/EstateLiveForms.kt — guarded requirements and booking sheets.
- features/realestate/EstateWorkflow.kt — exact editable amounts, demo outcomes, stable intent receipts, overlap/stale checks.
- features/realestate/EstateDemoApp.kt / EstateDemoDetails.kt — contextual routes, cancellation, requirement/history/outcome presentation.
- features/realestate/EstateServerViewModel.kt / EstateServerScreens.kt — scoped selection loading, confirmed writes, transaction discovery and gated entry points.
- core/estate/EstateDtos.kt / EstateRepository.kt — actual requirements fields and validation; existing HTTP/session/acceptance reused.
- app/SalesApp.kt / features/live/LiveCommon.kt — shared form IME handling and time-picker validation.
- Unit and instrumented test additions plus [physical device checklist](phase-5b-device-checklist.md).

## Verification and emulator evidence

- **Full checkpoint:** assembleDebug, all JVM unit tests, lintDebug and all **20 instrumented tests PASS**, none skipped/failed, BUILD SUCCESSFUL in **10m20s**, exit 0 (Studio shell-41). This retains the 16 prior General/auth/session/industry/privacy/navigation regressions and adds four form/context/confirmed-result checks.
- **Final affected-flow verification:** after the final decimal formatting, expanded-sheet and boundary-check refinements, all four EstateFormsUiTest tests PASS, none skipped/failed, BUILD SUCCESSFUL in **4m**, exit 0 (shell-46). This was a focused rerun; no second full 20-test run is claimed afterward.
- **Final source/test checks and APK handoff:** assembleDebug + testDebugUnitTest + lintDebug PASS, BUILD SUCCESSFUL in **1m**, exit 0 (shell-47; unchanged build/unit tasks up to date). The final production source's JVM suite also passed during the preceding combined run. No tests were disabled and StrictMode was not relaxed.
- New unit coverage: nullable requirements, bounds/ranges, exact decimal parsing and full fractional review formatting, unchanged-intent keys, retries/duplicate drafts, overlapping bookings, stale reschedules, real requirements response mappings, authorised transaction lookup and revoked-state clearing. Existing stale-offer/revision/scope/no-unsafe-request tests remain.
- New native coverage: 360dp baseline, 393dp/150% requirements, 412dp/200% offer review, native date/time selection, overlap acknowledgement, same-record rescheduling, buyer→matches→property→booking cancellation/back navigation, and a confirmed synthetic API reschedule surviving a failed refresh.
- Geometry assertions measure the complete action against the actual visible window boundary. Native IME transitions settle before scroll/measurement because they are independent of the Compose test clock. The review asserts were retained; they were not replaced with weaker semantic-visibility checks.
- Meaningful intermediate failures fixed: a blank bedroom count incorrectly became zero; a screenshot helper assumed one Compose root when a review sheet creates another window; partial sheet expansion let actions enter the navigation area; and an early keyboard measurement ran before native resizing settled. Final captures confirm full button clearance.
- Animator duration was set to zero for the emulator runs and restored to its original absent/default value. Final ADB verification returned null. No unrelated device setting changed.
- [Screenshot gallery](screenshots/phase-5b/README.md): **62 actual PNGs**, including the nine final form captures replaced from the passing focused run. The other 53 shared/synthetic captures are from the full passing checkpoint. No live customer data, generated screen mockup or active-recording capture.
- Pixel review of the final requirements/offer/booking/reschedule captures confirmed readable amounts and controls above IME/system bars. These are density/font constraints on one Android 11 emulator, not three physical phones. No frame-time/memory benchmark or comprehensive TalkBack certification is claimed.

### APK and physical-device status

Latest debug APK: app/build/outputs/apk/debug/app-debug.apk. Final ADB install returned Success and MainActivity launch completed, exit 0 (shell-47). Android Studio UI inspection confirmed com.segmiq.sales/.MainActivity focused and the official branded login rendered.

Only emulator-5554 was attached. Physical-device verification: **none**. The [device checklist](phase-5b-device-checklist.md) deliberately leaves real calls, headset, lifecycle, revocation and real-keyboard results untested.

## Activation and remaining release work

No new production feature is declared activated or production-ready. Requirements, scheduling/rescheduling and transaction-discovery UI can be evaluated against synthetic HTTP responses; enabling their real operations requires exact origin/revision/module/operation acceptance, deployed privacy tests and the relevant database prerequisites.

Production offer creation remains blocked because replay/reconciliation guarantees are unverified. Financial progression, compliance/document transfer and private photo delivery remain blocked by the Phase 4 dependencies. Generic 409 responses do not supply enough structured overlap/concurrency information to safely assume an override. Obtain the Phase 5A evidence separately; do not populate approved releases from this report.

Use the physical-device checklist before release. No emulator result substitutes for actual SIM calling, Bluetooth, real IME, lifecycle or device-performance verification.
