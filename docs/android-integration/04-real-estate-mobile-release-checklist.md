# Native Real Estate release checklist

Date: 2026-10-31 (Africa/Harare). Base HEAD: 2d4e71d59a4fa0adc40cb3d5d9a4ed4890130672.
The tested target is the working tree, not that base commit alone. Git delivery on main is authorized; the delivery report identifies the resulting commit. Prior compliance safety edits/migration were
already present at sprint start and are dependencies; unrelated UI work is not part of this sprint.
No production migration, deployment, customer-data mutation, photograph deletion or bucket-policy
change is authorized or performed. No production build is run, per the owner's standing instruction.

## Module acceptance matrix

“Source” describes implemented operations, not database/storage deployment evidence.
“Privacy tested” describes synthetic local tests, never live customer tests.
“Android ready” means contract/source development is possible; enabling real customers requires
an independent deployed acceptance record. Every deployed/verified entry is NO until signed off.

| Module | Endpoint | Bearer | Privacy tested | Source implementation | Deployed and verified | Android integration ready | Remaining blocker |
|---|---|---|---|---|---|---|---|
| Properties | P/listings, P/listings/{id} | Yes | Local Milestone B | Yes | No | Source contract | Deployed two-agent/two-tenant attestation |
| Buyers/matching | P/buyer-searches, P/matching | Yes | Local Milestone B | Yes | No | Source contract | Deployed privacy and paging attestation |
| Property photography | P/listings/{id}/images/{index} | Yes | Key/metadata policy | Yes, private delivery | No | Gated | Private bucket, validated/migrated objects, public-copy revocation |
| Viewing reads | P/viewings, P/viewings/{id} | Yes | Access/DTO tests | Yes, bounded | No | Source contract | Deployed feed authorization and source ceiling checks |
| Viewing writes | P/buyer-sales/actions | Yes | Owned-search/replay tests | Schedule/reschedule/outcome | No | Source contract, limited lifecycle | Verify unique index; mobile cancellation remains gated |
| Offers | P/offers, P/offers/{id} | Yes | Two-agent sibling/detail tests | Yes, existing transitions | No | Source contract | Atomic RPCs/indexes; no generic create replay guarantee |
| Transactions | P/transactions, P/transactions/{id}, /workspace | Yes | Participant/revision/redaction tests | Reads and edits; financial wrapper prepared | No | Reads/edits source, progression gated | Reviewed revision-wrapper migration and concurrent DB tests |
| Introductions | P/buyer-sales/introductions, /{id}; buyer-sales/actions | Yes | Current-owner/self/decision tests | Yes | No | Source contract | Deployed simultaneous decision and notification tests |
| Compliance | P/compliance/cases, /{id} | Yes | Existing permission/gate tests | Yes with privileged scope | No | Source contract | Compliance safety schema/RPCs, policy and scope grants |
| Documents | P/compliance/cases/{id}/documents/{doc}; P/transactions/{id}/documents | Yes | Access/key/MIME/storage policy | Yes, gated private storage | No | Gated | Distinct private document bucket; migrate and revoke public copies |
| Calendar | /api/sales/calendar | Yes | Projection/date/deduplication tests | Bounded authorized feed | No | Partial calendar | Standalone meetings/appointments have no backing model; existing task caps |

P is /api/clients/{clientId}. Read 03-real-estate-mobile-complete-contracts.md for exact DTOs.

## Deployment inputs and approval boundary

1. Review the exact Git diff and the existing uncommitted compliance baseline separately.
   Commit only intended integration files/hunks. Record resulting commit and source fingerprint.
2. Run the source checks listed below. The production build is intentionally NOT certified;
   run it later only after the owner authorizes it. Do not equate typecheck with build success.
3. In an isolated staging database, inspect already-applied migration history. Required existing
   foundations include real_estate_phase3_buyer_sales, real_estate_final_corrections, transactions,
   agency operations and compliance_phase1_safety_baseline. Never blindly replay migrations.
4. The CLI is not installed in this execution environment. The financial revision wrapper is a
   REVIEW PROPOSAL, not a migration-history entry or applied migration:
   sql/mobile-transaction-revision-proposal.sql. After explicit approval, use the approved CLI:
   `supabase migration new re_mobile_transaction_revision`, copy the reviewed proposal into
   that generated file, and test/apply it in staging using the normal project workflow.
5. Verify the wrapper's schema column/function names and SECURITY INVOKER behavior under the
   service role. PUBLIC/anon/authenticated must have no execution grant. It must lock before
   comparing the revision and delegate existing state/compliance functions. Test both races:
   two callers using the same revision; two offers competing for one property's reservation.
   No new permissive RLS policy, user-editable JWT role or Android DB credential is introduced.
6. Apply production migrations/deploy only after separate explicit approval. Capture release
   SHA from the actual platform, compare bootstrap release.revision, and archive staging and
   production acceptance evidence. Bootstrap returns NOT_ATTESTED until independent signoff;
   there is no magic source flag that certifies a release.

## Environment and private storage

Server-only existing R2 credentials: CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID,
CLOUDFLARE_R2_SECRET_ACCESS_KEY. Never put credentials in NEXT_PUBLIC variables or responses.
New/required private buckets:
- CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME, distinct from CLOUDFLARE_R2_BUCKET_NAME.
- CLOUDFLARE_R2_PRIVATE_DOCUMENT_BUCKET_NAME, distinct from CLOUDFLARE_R2_BUCKET_NAME.
Release identity: VERCEL_GIT_COMMIT_SHA, or explicitly set SEGMIQ_RELEASE_REVISION.
Existing NEXTAUTH/session/Supabase server configuration remains required. Do not print values.

Verify public bucket URLs, r2.dev and public custom domains are disabled for EACH private
bucket. A different bucket name alone is not evidence of privacy. Test anonymous object GET
fails before and after migration; verify an authorized 300-second signed URL succeeds and
expires. Verify account-switch/revocation caching behavior and private Content-Disposition.

## Photograph/document migration plan (no mutation performed)

1. Generate a read-only inventory in the approved staging/admin environment. Record tenant,
   property/case/transaction, original reference, MIME, size and content checksum in a private
   manifest. Never place the inventory in Git or include customer names in public logs.
2. Validate file signatures and sizes; quarantine unknown/malformed/oversized objects for
   owner review. Reject path traversal, other tenants/properties, owner-document photo keys,
   arbitrary source URLs and unexpected redirect hosts. Do not fetch arbitrary URLs on trust.
3. Copy eligible photos into private listing-specific photo keys; copy documents into the
   private document bucket retaining verified organisation/domain ownership. Copy before any
   reference update. Use the manifest/checksum to make retry safe. Do not delete originals.
4. Verify both objects and permission behavior with synthetic agents. Update references using
   a separately approved, reversible operation; preserve a rollback mapping. Recheck cover
   index/order and bytes/MIME. New mobile photo uploads remain outside this sprint.
5. Only after explicit deletion/revocation approval remove public originals and cached/CDN
   copies. A database reference update does not revoke an old public URL. Record this as a
   release blocker until independently tested. Stop if any source is not owned by the tenant.
6. Validate document retention policy independently; upload completion is received/awaiting
   review, never a compliance approval or verified financial milestone.

## Synthetic deployed acceptance requirements

Use two agents in tenant A, one in tenant B, one selling manager and one compliance reviewer,
all synthetic. Never mutate a real customer's property, offer, transaction, identity or files.

- Both agents: own vs other draft/pending/rejected/legacy-approved listing; FK fallback with
  every filter and page/count preserved. Wrong tenant path/body IDs must never disclose data.
- Buyer own/private/paused/review searches; current-owner changes; request/accept/decline/stale
  introduction, other property, self-approval and concurrent decisions. Compare visible fields,
  not merely HTTP status. Full search/directory does not unlock after an introduction.
- Viewing list/detail/full/listing-only projections; reassigned search; malformed/expired time;
  same-key replay, changed-payload replay, overlap confirmation, instructions persistence and
  missing-modern-schema failure. Count actual outbound messages: mobile create/reschedule/
  outcome must request zero customer messages. Verify legacy notification policy separately.
- Offer list/detail/sibling/events confidentiality; guessed IDs; counters with stale revision;
  repeated acceptance and competing reservations; explicit confirmation before real financial
  action. No automatic notify call should follow a successful mutation.
- Transaction start AND retry authorization; participant changes; commission redaction in read
  and mutation responses; milestone and transaction revisions; invalid prerequisites; two
  simultaneous completion/financial requests. Missing safe RPC must return 503, not fallback.
- Compliance read vs review vs support access; wrong case/document paths; foreign reused keys;
  20 MiB MIME/signature checks; secure private download/upload; evidence remains unapproved.
- Calendar org-local date-only events, timezone midnight and DST; timed instants; source IDs;
  bounds/caps; buyer context hidden in viewing events; manager role guard unchanged.
- Revoke session, bump session version, disable user, suspend organisation and billing; retry
  private reads/media. Signed URLs can survive later revocation only until their 300-second TTL.
- Device/network failures: replay only operations with documented keys/revisions. Financial
  create responses with unknown outcome must be reconciled before attempting a new submission.

## Local verification record

Final combined regression: 186 tests passed, 0 failed across 32 suites. Targeted lint passed without warnings/errors. The full-project lint attempt exposed an unused new parameter, corrected and rechecked; its other warnings were pre-existing React hook warnings outside this sprint. Final TypeScript `tsc --noEmit --pretty false` passed (exit 0). No build, database RPC proposal execution, live private-object verification or deployed acceptance is implied.

## Sprint source inventory

SHA-256 of the following UTF-8/LF files, ordered as listed, with NUL separators after each path and content:
`5786c140e31ad6fdc040e48aea5b997fcde1ee1b49c307446b88ac8d7e188422`

This identifies the local source/test/proposal snapshot; it is not a Git commit or build artifact.

- `lib/mobile/sales-app/bootstrap.ts`
- `lib/real-estate/mobile-contract.ts`
- `lib/real-estate/mobile-calendar.ts`
- `lib/real-estate/mobile-viewings.ts`
- `lib/real-estate/private-document-storage.ts`
- `lib/real-estate/private-listing-images.ts`
- `lib/real-estate/offer-service.ts`
- `lib/real-estate/transaction-service.ts`
- `lib/real-estate/viewing-service.ts`
- `lib/real-estate/buyer-sales-service.ts`
- `lib/real-estate/buyer-introduction-service.ts`
- `lib/real-estate/compliance-service.ts`
- `app/api/sales/calendar/route.ts`
- `app/api/clients/[clientId]/viewings/route.ts`
- `app/api/clients/[clientId]/viewings/[viewingId]/route.ts`
- `app/api/clients/[clientId]/buyer-sales/actions/route.ts`
- `app/api/clients/[clientId]/buyer-sales/introductions/[introductionId]/route.ts`
- `app/api/clients/[clientId]/offers/route.ts`
- `app/api/clients/[clientId]/offers/[offerId]/route.ts`
- `app/api/clients/[clientId]/transactions/route.ts`
- `app/api/clients/[clientId]/transactions/[transactionId]/route.ts`
- `app/api/clients/[clientId]/transactions/[transactionId]/workspace/route.ts`
- `app/api/clients/[clientId]/transactions/[transactionId]/documents/route.ts`
- `app/api/clients/[clientId]/compliance/cases/route.ts`
- `app/api/clients/[clientId]/compliance/cases/[caseId]/route.ts`
- `app/api/clients/[clientId]/compliance/cases/[caseId]/documents/[docId]/route.ts`
- `tests/real-estate-mobile-complete.test.ts`
- `tests/helpers/fake-postgrest.ts`
- `docs/android-integration/sql/mobile-transaction-revision-proposal.sql`

Contract/checklist deliverables: 03-real-estate-mobile-complete-contracts.md and this file.

Final verification: 186/186 tests passed; final targeted lint passed; TypeScript passed; credential-pattern scan and diff whitespace check passed. Build skipped by user instruction. No production deployment, applied migration, or storage mutation was performed during verification. Git delivery is tracked separately.

## Git delivery scope

Git delivery includes the reviewed sprint inventory and these necessary, previously uncommitted compliance safety dependencies. SQL is committed as source only; nothing is applied to a database. Unrelated UI and local files are excluded.

- `lib/real-estate/atomic-rpc.ts`
- `lib/real-estate/compliance.ts`
- `tests/real-estate-compliance.test.ts`
- `lib/auth/rbac/permissions.ts`
- `lib/auth/rbac/role-profiles.ts`
- `lib/security/support-access/scopes.ts`
- `lib/storage/r2.ts`
- `supabase/migrations/20261022113000_compliance_phase1_safety_baseline.sql`
- `app/api/clients/[clientId]/compliance/settings/route.ts`
- `app/api/clients/[clientId]/listings/[listingId]/route.ts`
- `app/api/leads/[leadId]/route.ts`
