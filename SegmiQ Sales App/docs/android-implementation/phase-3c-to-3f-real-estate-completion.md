# Phase 3C–F — native Real Estate workflow delivery

Date: 2026-10-30. This report distinguishes live shared-service functionality, fictional working workflows, and gated production operations. It does not certify a production-complete Real Estate release.

## Reuse and gap check

- Reused the 12 Android audit reports and read the current Phase 3A implementation report, navigation, session/network foundations, repositories and feature ViewModels.
- No `phase-3b-properties-buyers-report.md` or Android property/buyer feature existed at the start. The app contained Agent Home and gated module entries only. No prior prompt was treated as delivered code.
- Backend source advanced to `2d4e71d`. Read `docs/android-integration/02-real-estate-properties-buyers.md` and relevant route/service source. That document expressly marks Milestone B as local, not deployed; private photo migration remains unverified.
- Source inspection found a Bearer-aware owned-search viewing action and introductions service in addition to the cookie-only legacy viewing/offer/transaction/compliance routes. These distinctions are captured in the backend handoff.
- Existing authenticated host/session, organisation-selected experience and General/Solar architecture are preserved. No Solar development, direct Supabase connection, backend rewrite, cookie bridge or new dependency was introduced.
- Baseline debug build, unit tests and Android lint passed before edits. The first implementation compile/unit/lint pass also succeeded; final results follow below.

## Screens and working workflows

### Live, using existing authorised services

**Inquiries:** native lazy directory; debounced server search and supported status filters; explicit sort of loaded results; paging; refresh/error/empty states; received/last-contact/follow-up metadata when supplied. The feed is described as authorised, without fabricating assigned-agent or property fields absent from the DTO.

**Inquiry detail:** customer header, phone dialer, Overview/Activity/Notes, requirements/budget from actual fields, internal notes, status and follow-up actions, timeline pagination, and capability-aware links to buyers/viewings/offers/shared Inbox/Copilot. Writes are shown only for an inquiry assigned to the authenticated user. Server errors remain visible; notes clear only after confirmed success.

**Privacy correction:** scoped Real Estate inquiry reads reject an unexpected tenant body before loading its timeline. Forbidden/not-found/session-ended refreshes clear the previous inquiry and timeline instead of retaining private content. Explicit access denials also evict scoped dashboard/task cache entries; ordinary network errors retain authorised cached data. This is defence in depth, not a substitute for backend authorisation.

**Activities/calendar:** real Day/Week selection, seven-day date strip, previous/next navigation, native date picker, organisation timezone, selected-event bottom sheet and links to the existing inquiry/task screens. Uses the existing authorised tasks/upcoming response and scoped cache. Explicitly labelled **PARTIAL CALENDAR · TASKS & FOLLOW-UPS**. No meetings/viewings or arbitrary appointment times are invented.

**Calling/communication/Copilot:** existing ACTION_DIAL, lead notes/follow-ups, Inbox capability entry and server work-item review routes remain shared. No separate WhatsApp service or generated local AI recommendations. Real call logging/recording was not invented; existing clearly simulated General call-review behavior is retained.

### Connected fictional preview — never substituted for live data

Reachable explicitly through supported gated modules and Real Estate Settings → **Explore fictional workflow**. Every screen shows **FICTIONAL PREVIEW · NO SERVER WRITES**. The preview receives no API client, token, real identity or production record identifier.

- Property directory/search and detail with swipeable concept gallery, price/attributes/location, related inquiries/buyers, viewing/offer actions and example activity.
- Buyer/inquiry directory and profiles: Overview, Requirements, Matches, Activity, Notes. Budget/location/bedroom editing, notes and date-only follow-ups are functional locally. Other-agent private buyers are not in the directory or accessible through a direct detail route.
- Viewings: Today/Upcoming/Completed/Cancelled agenda; property/buyer context; date/time/location/notes form; review before save; rescheduling; reviewed completion with feedback; cancellation and follow-up/offer links.
- Day/week fictional calendar reflects locally created viewings and commitments.
- Introductions: Received/Sent/Pending/Approved/Declined filters; property/purpose/agent context; private buyer notice; reviewed approval/decline with required decline reason; no self-decision, stale/repeated decision or old-reviewer approval.
- Offers: search/status views; draft form; explicit review before submission/counter/accept/decline; history; stale expected-state rejection; linked buyer/property/follow-up.
- Accepted fictional offer → transaction creation, preserving offer/property/buyer identifiers; duplicate transaction creation is rejected.
- Transactions: published example milestone keys/labels, progress, reviewed local milestone update, related offer/buyer, compliance and documents.
- Compliance/document screens: requirement/submitted/under-review/rejected states and rejection reasons; fictional metadata preview; example attachment remains **submitted**, never approved. No private file is selected, uploaded, downloaded, shared or stored.
- Failed-save scenario available under preview More; state changes only after the simulated result. Form fields remain on failure, repeated clicks while busy are ignored, and successful creation forms cannot be resubmitted.
- Native nested navigation/back preserves the current fictional customer/property context. Exiting the preview discards session-only fictional records.

The gallery uses clearly labelled architectural **illustrations**, not invented property photography. No match percentage or AI-generated insight is fabricated. The preview models and guards demonstrate UX only and are not used for production authorisation or business transitions.

## Reused code and new components

Reused:
- LiveSalesApi, SegmiqHttp, secure sessions/bootstrap, LeadDetailViewModel, LeadsViewModel, TasksViewModel, ScopedCache.
- SegmiqCard/Avatar/PrimaryButton/SearchField/FilterChips/ErrorCard/Skeleton, EstateModuleRow/Notice, shared date/time pickers and navigation.

Created:
- EstatePageHeader, EstateStatusBadge, EstatePropertyMiniCard, EstatePropertyIllustration, EstateTimeline, EstateMilestoneProgress, EstateDocumentRow, EstateContextRow, EstateGateNotice.
- EstateInquiries, EstateInquiryDetail, EstateCalendar.
- EstateDemoApp, connected directories/details/forms, EstateDemoDocument, DemoConfirmation.
- EstateDemoViewModel and explicit fictional immutable models/fixtures. No second production CRM or user database.

Files:
- features/realestate/EstateComponents.kt
- features/realestate/EstateLiveWorkspaces.kt
- features/realestate/EstateWorkflow.kt
- features/realestate/EstateDemoApp.kt
- features/realestate/EstateDemoDetails.kt
- features/realestate/EstateDemoForms.kt
- Updated RealEstateHome.kt and RealEstateScreens.kt.
- Updated features/live/LiveSalesApp.kt and LiveViewModels.kt.
- Updated core/bootstrap/LiveWorkspace.kt; Activities is Real Estate only and requires a granted TASKS/CALENDAR destination. Task data is not requested without task access.
- Tests: EstateWorkflowTest, EstateInquiryIsolationTest, EstateWorkflowUiTest, updated BootstrapTest.
- This report and real-estate-mobile-backend-gaps.md.

## Endpoints connected and gates

No gated Real Estate customer endpoint was newly enabled. Reused existing routes:

- GET /api/sales/leads with supported search/stage/page parameters.
- GET /api/leads/{id}, GET /api/leads/{id}/timeline.
- POST /api/leads/{id}/internal-note, PATCH /api/leads/{id} for supported status/follow-up.
- GET /api/sales/tasks?view=mine and existing Copilot work-item service through shared screens.
- Existing dashboard/workspace/bootstrap/authentication.

No unsupported assigned-to-me or global sort parameter is sent. Property/search linkage, richer ownership metadata and appointment feeds require additive contracts. Native previews do not make HTTP requests.

See [actionable backend gaps](real-estate-mobile-backend-gaps.md) for routes, contract requirements, precise blocked workflows, tests and priorities. In particular:
- Milestone B deployment/privacy attestation and private image migration.
- Legacy viewing read/lifecycle Bearer support; separately verify owned-search action and notification behavior.
- Offer/transaction list and detail privacy plus Bearer mutations.
- Introduction decision/disclosure and reassignment evidence.
- Compliance capability, document actor policy and expiring private file contract.
- Full calendar feed and inquiry enrichment.

Compliance is not fabricated as a production bootstrap capability/menu item. It is reachable only inside the fictional transaction preview. No client filtering is used to expose an unsafe production endpoint.

## Offline and security behavior

- Live tasks use existing organisation/user-scoped in-memory cache and retain explicit error/offline states.
- Live inquiry drafts use rememberSaveable; failed note submission does not clear the note. Denied reads clear sensitive state.
- Preview is entirely local/session-only, survives configuration changes through ViewModel state, and needs no network after entry. It is not durable customer storage; process death or exit discards it.
- No broad offline mutation queue, upload retry queue or automatic overwrite was added without server idempotency/conflict contracts.
- No private document or signed URL cache exists in this sprint; secure file download/upload remains unavailable. No public gallery storage, privileged key, contact upload, background location, covert recording or SIM recording was introduced.
- Existing General demo persistence/navigation/simulated-call tests are retained. Solar remains isolated by the existing server experience selection.
- All production financial/appointment/decision/document operations remain unavailable until their gates pass. Local demo validation is not presented as server security.

## Visual polish

- Compact Agent Home feature panel replaces the oversized two-line marketing headline. Date/context/primary action remain, while metrics move higher on small screens.
- Shared ivory/near-black/forest/lime styling, official artwork, consistent card radii, readable metadata and accessible controls.
- Contextual property/buyer cards connect the full preview rather than isolated static pages.
- Native reviewed forms, status badges, negotiation/activity timelines, progress indicators, bottom sheets, honest gallery fallback and error/empty/loading states.
- Login and existing shared design system are preserved.
- No approved visual concept attachment was available for a pixel comparison; brand assets remain the repository's official artwork.

## Automated verification

Planned/final run: assembleDebug, testDebugUnitTest, lintDebug, connectedDebugAndroidTest, offline Gradle dependencies.
Added meaningful coverage:
- Failed mutation leaves state unchanged; retry and duplicate-click guard.
- Private buyer cannot be booked/modified in preview.
- Non-finite money rejected.
- Self-approval, repeated decision and reassigned-reviewer denial.
- Stale offer decision and accepted-offer → transaction context/idempotency.
- Submitted attachment never means approved.
- Organisation timezone midnight and date-only calendar boundaries.
- Cross-tenant inquiry body rejected before timeline read.
- Revoked inquiry access clears prior private content.
- Native property → buyer → viewing → offer → transaction → compliance → document journey and back.
- Dark/150% font review-action reachability.
- Existing session restore, org isolation, API error/auth, General navigation, Solar isolation and gated no-request tests remain enabled.

Final command results and emulator screenshots are recorded below after execution. No physical-device verification is claimed. Remote image loading and genuine document-transfer tests cannot pass a production readiness gate while their APIs/storage are unverified.

## Feature classification

| Feature | Native UI | Functional fictional workflow | Existing live services | New live module API | Physical device |
|---|---|---|---|---|---|
| Home, inquiries/detail | Yes | Inquiry/buyer examples | Yes | No new endpoint | No |
| Activities/calendar | Yes | Viewings + commitments | Tasks only, partial coverage | No appointment feed | No |
| Properties/gallery | Yes | Search/detail/concept gallery | No | Gated | No |
| Buyers/requirements/matches | Yes | Editing and labelled candidates | No | Gated | No |
| Viewings | Yes | Schedule/reschedule/feedback/follow-up | No | Gated | No |
| Introductions | Yes | Reviewed local decisions | No | Gated | No |
| Offers | Yes | Reviewed draft/negotiation/history | No | Gated | No |
| Transactions | Yes | Linked milestones/context | No | Gated | No |
| Compliance/documents | Example UI | Fictional metadata only | No | Gated | No |
| Calling/Inbox/Copilot | Existing shared routes | No fake calls/messages/AI | Existing verified capabilities | No new provider | No |

## Release readiness

This is a coherent native workflow implementation and reviewable fictional experience, not a production-ready replacement for all Real Estate web operations.

Next: close P0 backend/deployment/storage gates, add typed production adapters against attested DTOs, independently enable modules, verify two-agent/two-tenant denials against the deployed version, implement secure photo/file handling, then test real-device dialing/back/rotation/offline/permission/access-revocation behavior. Document rendering, upload/download, real gallery caching, real appointment/offer/transaction mutations and complete calendar remain explicitly not production-ready.

## Final results and emulator evidence

First combined implementation run: **BUILD SUCCESSFUL**, 9m32s; all **11 emulator tests passed**, 0 skipped, 0 failed. The subsequent run also passed the denied-cache tests. The latest emulator run passed all 11 tests, including Document → Compliance → Transaction → Offer back navigation. Final combined build/unit/lint/instrumented run: **BUILD SUCCESSFUL**, exit 0, **5m49s**. All 11 emulator tests passed with 0 skipped and 0 failed, including the deeper context/back-stack assertions. No test was disabled and StrictMode was not relaxed.
