# Real Estate mobile backend gaps — Cursor handoff

> **Phase 4 update (2026-10-31):** The historical source findings below describe `2d4e71d`, not the current deployment. The completed contracts 03/04 and backend HEAD `ebe1a5807fbaa5c2dd125f6fa779751b5031e0c0` now provide Bearer-aware module routes. An authorised authentication/bootstrap probe confirmed that revision at www.segmiq.com, but the server still reports NOT_ATTESTED and privateListingImageDelivery=false. No new-module customer read or business write was attempted. Do not ask the backend team to reimplement already-completed Bearer support. Current blockers are deployed privacy/concurrency acceptance, private storage/migration, financial wrapper rollout, and the Android work explicitly listed in the [Phase 4 report](phase-4-real-estate-live-integration.md) and [matrix](phase-4-integration-matrix.md).

Date: 2026-10-30. Android sprint: Phase 3C–F.
Source inspected: backend HEAD `2d4e71d`, following `b3e5e69`.
The new `docs/android-integration/02-real-estate-properties-buyers.md` explicitly says local implementation, not deployed. No deployment, private bucket, migration or production security certification is inferred from Git.

Android now provides native live inquiry/task-calendar screens and an explicitly fictional connected workflow preview. None of the gated operations below is sent by the app. Existing authenticated inquiry/task/Copilot APIs remain separate.

## P0 — Deployed Milestone B attestation and property/buyer privacy

**Routes**

- GET /api/clients/{clientId}/listings
- GET /api/clients/{clientId}/listings/{listingId}
- GET /api/clients/{clientId}/buyer-searches
- GET /api/clients/{clientId}/buyer-searches/{searchId}
- GET /api/clients/{clientId}/matching?searchId=… or listingId=…

**What exists:** New source implements Bearer-aware guards, ownership-aware reads, role-specific listing visibility, relationship-fallback scoping, buyer redaction and additive bootstrap flags. This supersedes the original Phase 3A listing-source findings. Do not reopen already-fixed source logic unnecessarily.

**Missing release evidence:** independently verified deployed revision, two-agent/two-tenant access tests, private buyer disclosure/reassignment tests and confirmation that mobile read flags are served by that same deployment. Flags advertise support; they are not security certification.

**Required contract:** retain documented snake_case Property and BuyerSearch DTOs; nullable numeric fields; permittedActions; paging counts; redacted cross-agent matching; stable 401/403/404/409/503 envelopes. Add a safe deployment/capability revision identifier or equivalent release evidence. Match explanations must remain server-provided, not AI probability.

**Android blocked:** real property/buyer directories, gallery data, requirements mutation, authoritative matching and cross-links from inquiries to real listings/searches.

**Tests:** own draft vs other-agent draft/pending/rejected; approved legacy-null cases; fallback preserves exact filters/count/visibility; malicious agentId; reassignment; stale/pending/declined introductions; contact identity and full-search bundle denial; cross-tenant id/path mismatch; MFA, billing, revoked session; paging beyond 25/80 and broad contact queries.

## P0 — Private image delivery rollout

**Route:** GET /api/clients/{clientId}/listings/{listingId}/images/{index}.

**What exists:** Bearer metadata endpoint returns a short-lived URL after listing authorization. Only registered same-tenant/property private keys are eligible. Legacy images are gated.

**Missing:** verified distinct private bucket, disabled public domains/access, photo migration and removal/revocation of old public copies. New upload and transformations remain follow-up work. Do not send existing public photo URLs to Android as a shortcut.

**Required contract:** ordered images with index/cover/endpoint; url plus expiresAt; IMAGE_UNAVAILABLE/409; MIME and supported download size/limits. Confirm permitted host/redirect policy. Download signed URLs without the Sales JWT. Expiry and revocation limitations must be explicit.

**Android blocked:** genuine listing photography, secure remote gallery/cache, photo upload. Current preview uses labelled architectural illustrations, never fabricated listing photos.

**Tests:** cross-tenant/property key, traversal, owner-document key, arbitrary URL, expiry/re-sign, permission revocation, unavailable legacy object, oversized/malformed image, no credential forwarding, no public bucket fallback.

## P0 — Viewings: distinguish legacy feed from owned-search actions

**Legacy route:** GET/POST/PATCH /api/clients/{clientId}/viewings.
The inspected route still uses getServerSession. POST looks up contact and listing by tenant and calls createScheduledViewing with notifyCustomer=true. This is not a verified mobile contract.

**Existing Bearer alternative:** POST /api/clients/{clientId}/buyer-sales/actions:
- action=viewing, searchId, listingId, scheduledAt, confirmationStatus?, instructions?, confirmOverlap?
- reschedule_viewing: viewingId, scheduledAt, confirmOverlap?
- viewing_outcome: viewingId, outcome, note?

The inspected scheduleSearchViewing service calls loadOwnedSearch, checks same-tenant listing, checks agent scope and overlap, handles duplicates, accepts Idempotency-Key, and passes notifyCustomer=false. Preserve and review this path rather than creating a second booking service. Its deployed behavior and complete lifecycle read contract are not independently verified here.

**Required contract:** Bearer list/detail feed with authorised participants, address, server timestamps/time zone, status, permitted actions and completeness/paging. The legacy create schema has no meeting-location/notes fields; the owned-search action has instructions. Define authoritative location/notes field names and persistence so Android never silently drops form input. Document which path notifies, through which provider, and at which confirmed step. Provide a notification-effects field if behavior is conditional. Define idempotency and 409 overlap retry semantics and accepted viewing outcomes. Do not ask Android to guess whether WhatsApp was sent.

**Android blocked:** live agenda/detail, schedule/reschedule/complete/cancel and real map navigation from an authorised address. Demo scheduling is local only.

**Tests:** private buyer booked through both paths; other-agent search/contact; same tenant but private/draft listing; revoked introduction; reassigned search; duplicate key/retry; overlap confirmation; malformed/expired time; actual notification counts (no pre-authorisation send); read/list/detail privacy separately.

## P0 — Offers and negotiation

**Routes:** /api/clients/{clientId}/offers and /offers/{offerId}.
Inspected list/create and detail/action surfaces use cookie-only getServerSession. List scopeOwn for SALESPERSON alone does not prove detail/history/document privacy or selling-manager scope.

**Required contract:** Bearer actor/session resolution; Real Estate entitlement; consistent ownership/participant policy for list, detail, events and documents. Expose current status, revision, permitted actions, confirmed money/currency, dates and participants. Define create/submit/counter/accept/reject request schemas, idempotency keys and stale revision/409. Existing server workflow remains authoritative.

**Android blocked:** all real offer reads and financial mutations. Native fictional draft → submit → decision → transaction workflow is implemented with review dialogs.

**Tests:** competitor offer list/detail/history denied, agentId filter cannot widen scope, cross-tenant ids, unassigned/selling-manager behavior, hidden document fields, duplicate acceptance, stale counter, accepted-offer reservation conflict and no notifications/commitment before confirmation.

## P0 — Transactions and compliance entitlement

**Routes:** /api/clients/{clientId}/transactions and /transactions/{transactionId}.
GET/PATCH use cookie-only session resolution. Existing actions include start_progress, complete, fallen_through, cancel, record_deposit, sign_agreement, update_commission, update_notes, set_expected_completion and update_milestone.

**Required contract:** Bearer tenant/participant authorization; transaction summary/detail containing authoritative milestones, document requirements and permitted actions; mutation revision/idempotency/error contracts. Do not require Android to reconstruct completion rules. Keep verification/financial completion server-confirmed.

**Android blocked:** live transaction progress, notes, milestone updates and completion. Fictional milestones use published keys/labels and never create a real completed transaction.

**Tests:** buyer/seller/agent visibility across list/detail/events; competing transaction data; forged participant/offer ids; duplicate start-from-offer; milestone ownership; completion prerequisites; confidential commission fields.

## P0 — Compliance documents and private temporary files

**Routes**
- /api/clients/{clientId}/compliance/cases
- /compliance/cases/{caseId}
- /compliance/cases/{caseId}/documents/{docId}

Inspected cases and document GET/POST require cookie sessions, requireClientDataAccess(COMPLIANCE), loadComplianceActor and service-level signing/upload rules. Preserve those restrictions when adding Bearer support. Document GET currently returns {url} without an explicit expiresAt in that response.

**Required contract:** verified bootstrap compliance entitlement (none fabricated by Android); Bearer actor; case/transaction/participant linkage; requirement and review status; rejection reason; permitted upload/review/download actions; size/MIME limits; expiring signed URLs with expiresAt; retention/revocation policy; idempotent upload completion. Upload must not imply approval.

**Related existing service:** /company-documents/{documentId} has requireClientAccessFromRequest plus resolveDocumentActor/getDocumentForActor. This is not evidence that a salesperson can read every compliance document. Verify business-domain and actor compatibility before reuse.

**Android blocked:** real compliance menu, upload/download, genuine PDF/image preview and private cache lifecycle. Current example-document screen contains fictional metadata only; no personal file, signed URL or public gallery copy is produced.

**Tests:** non-reviewer approval denied; self-approval rules; guessed case/doc ids; reused foreign storage key; signed URL expiry/revocation; unauthorised category; MIME/size spoof; restricted support access; account switching; upload remains submitted/under-review until verified.

## P1 — Introductions and collaboration

**Existing routes:** GET /api/clients/{clientId}/buyer-sales/introductions and POST /buyer-sales/actions with action=introduction or review_introduction.
These use request-aware Bearer-capable tenant guards and existing introduction services. They are not blanket cookie-only blockers.

**Required evidence/contract:** complete mobile list/detail projection, decision permissions, revision/409, single-decision behavior and property-specific disclosure after accepted decision. Confirm Real Estate entitlement and ownership on every branch, including failure paths, and prove deployed behavior.

**Android blocked:** live request/approve/decline and live buyer disclosure. Demo invariants deny self-decision, repeated decision and reassigned reviewer, but are not substitutes for server checks.

**Tests:** requester self-approval, old assignee after reassignment, duplicate and concurrent decisions, ended/unavailable listing, revoked acceptance, unrelated property/requester/search, tenant crossing, notification effects only after accepted server operation.

## P1 — Inquiry enrichment and calendar coverage

**Reused:** GET /api/sales/leads; /api/leads/{id}; /timeline; /internal-note; PATCH follow_up_date/status; GET /api/sales/tasks?view=mine; existing Copilot work-item endpoints.

**Required additive fields/filter contract:** property/search ids and permitted context links, assigned agent identity, authoritative source/last interaction, status transitions and sort/assigned-to-me filters. The current Android directory sort is labelled local-to-loaded-results; no unsupported query parameter is sent.

**Existing manager calendar route:** PATCH /api/client/calendar/activities uses getAuthFromRequest but explicitly permits CLIENT_MANAGER/SUPER_ADMIN and updates lead follow-up/owner. It is not a salesperson appointment-read feed; do not loosen its role guard as a mobile workaround.

**Calendar:** Android now has genuine date navigation, day/week selection and event detail over authorised tasks/upcoming. It is labelled PARTIAL CALENDAR. Provide a Bearer appointment/event feed, all-day vs timed semantics, paging/completeness, source entity permissions and org timezone before claiming complete appointments.

**Tests:** timezone midnight and DST; date-only tasks; reassigned inquiries; revoked access; cross-tenant response rejection; follow-up failure/retry and no duplicate notes. Unified calendar events must not reveal private viewing/buyer context.

## P1 — Release acceptance

1. Deploy reviewed routes without Android cookies or Supabase credentials.
2. Supply release revision, schema examples and two test agents in two isolated test tenants.
3. Run backend access/notification/idempotency tests against that deployment.
4. Verify storage migration and signed URLs separately.
5. Enable Android modules independently after evidence; keep blocked modules truthful.
6. Then run Android API contract/image/document/offline and physical-device release checks.

No backend file was changed, no production mutation was attempted, and no unsafe proxy or web-cookie bridge was added by this Android sprint.
