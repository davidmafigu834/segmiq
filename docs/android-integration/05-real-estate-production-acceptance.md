# Phase 5A: production security and deployment acceptance

Decision: **NOT ACCEPTED FOR PRODUCTION MOBILE UNLOCK**. No module or signed-image host is approved.

Source HEAD inspected: `ebe1a5807fbaa5c2dd125f6fa779751b5031e0c0`, branch main.
Phase 5A fixes described below are working-tree changes, not a deployed revision.
Backend origin discovered from native Android configuration: `https://www.segmiq.com`.
Exact current deployed revision and authenticated live contract version: **not independently verified**.
The previous Android report is context, not a fresh acceptance record.

## Evidence actually collected

The redacted machine-readable observations are in evidence/phase5a-observations.json.
No credentials, customer records, names, signed object URLs or session tokens are recorded.

| Evidence | Environment | Result | What this proves / does not prove |
|---|---|---|---|
| GET bootstrap without credentials, 2026-10-31T15:00:05.827Z | https://www.segmiq.com | 401 TOKEN_INVALID, no-store, no redirect | Public unauthenticated denial only |
| GET bootstrap with a synthetic invalid token, 2026-10-31T15:00:06.405Z | Same origin | 401 TOKEN_INVALID, no-store, no redirect | Invalid-token denial, NOT real-session revocation |
| Migration history and PostgreSQL catalogs | Connected Supabase gnnqzboaeezzevlwwryp | Read-only metadata collected | Matches local Supabase origin; deployed API/database binding remains UNVERIFIED |
| re_accept_offer | Connected DB | Present, row lock and expected-revision argument; no anon/authenticated EXECUTE | Structure/grants only, not a concurrent financial execution test |
| re_finish_transaction | Connected DB | Present, row lock; no expected-revision argument, no anon/authenticated EXECUTE | Existing terminal transition structure only |
| Mobile/compliance-safe RPCs | Connected DB | re_mobile_transition_transaction, re_start_transaction_progress_compliance_safe and re_complete_transaction_compliance_safe ABSENT | Hard dependency blockers if this is the deployed API's DB |
| Compliance safety baseline history | Connected DB | No named safety-baseline migration recorded | Confirmed metadata gap; no migration applied here |
| Unique indexes | Connected DB | Viewing client/idempotency, one reserving offer, unique offer transaction and one active listing transaction present | Constraint definitions only; NOT simultaneous booking/decision acceptance |
| RLS flags | Connected DB | Enabled on inspected viewing/offer/transaction/compliance tables | RLS presence alone does not certify policies or service-role API authorization |
| Test/private storage config | Local checkout only | No isolated actor config, no private listing/document bucket variables, no Vercel read token | Does NOT prove production environment variables or policies are absent |
| Private object policies, expiry and redirect behavior | Live private storage | NOT TESTED | No approved bucket, object fixtures or host available |

SQL function definition fingerprints and exact index definitions are in the evidence JSON.
No live customer-table contents were inspected. No signup, seed, write action, notification,
production migration, deployment, public-object deletion or bucket-policy change was performed.

## Why NOT_ATTESTED remains

mobileReleaseEvidence deliberately returns NOT_ATTESTED. It is not a cached failed test or a
Vercel deployment status. No independently reviewed per-operation evidence was supplied for
this origin/revision. Capability flags advertise source support, not release acceptance.
The authenticated deployed revision, five independent synthetic identities, API/database binding,
private bucket state and database-level concurrency results are still missing.

The operator was asked for an isolated origin/fixture configuration; no such configuration was
identified. The instruction to use judgement was handled by avoiding customer records and
producing explicit missing-evidence results. There is no basis to manufacture successful actor tests.

## Per-module deployment acceptance

“Source tests” refers only to local synthetic/unit/API-client tests. Read/write readiness below
means deployed acceptance, not whether source handlers exist. No module is approved by this table.

| Module | Read ready | Write ready | Privacy verified | Storage verified | Deployed revision | Acceptance |
|---|---|---|---|---|---|---|
| Properties | Not verified | Not verified | Source tests; live missing | N/A for metadata | Unknown | BLOCKED: independent two-agent/two-tenant list/detail tests |
| Buyers and matching | Not verified | Not verified | Source tests; live missing | N/A | Unknown | BLOCKED: private buyer, reassignment and introduction disclosure tests |
| Property photos | Not verified | Upload out of scope | Source key/MIME/size tests | No | Unknown | BLOCKED: private policies, migrated fixture objects, approved host and expiry |
| Viewings | Not verified | Not verified | Source tests; live missing | N/A | Unknown | BLOCKED: actor reads, simultaneous booking and actual notification counts |
| Introductions | Not verified | Not verified | Source tests; live missing | N/A | Unknown | BLOCKED: concurrent review, current-owner and notification acceptance |
| Offers | Not verified | Not verified | Source tests; live missing | N/A | Unknown | BLOCKED: deployed actor confidentiality and acceptance/reservation race |
| Transactions | Not verified | Not verified | Source tests; live missing | Document storage unverified | Unknown | BLOCKED: compliance-safe RPCs and revision wrapper plus database races |
| Calendar | Not verified | Read-only | Source tests; live missing | N/A | Unknown | BLOCKED: deployed privacy/date tests; source remains bounded |
| Compliance | Not verified | Not verified | Source policy tests; live missing | No for documents | Unknown | BLOCKED: safety baseline, entitlements, independent reviewers and DB/API mapping |
| Private documents | Not verified | Not verified | Source guards/MIME tests | No | Unknown | BLOCKED: private bucket/policies, retention, upload review and expiring URLs |

The exhaustive operation-level matrix is evidence/phase5a-operation-matrix.json. Each record
contains origin, deployed revision (null until proven), contract/provenance, module, operation,
actor roles, tenant isolation, security result, migration/storage state, timestamps and acceptance.
A missing observation or timestamp is a blocker, never an implied pass.

## Verified source gaps fixed in Phase 5A

- A changed reschedule must now be in the future. An unchanged replay still does not create a new booking.
- Reschedule and outcome persistence condition on the observed status AND scheduled timestamp.
  A lost race returns 409 before subsequent search events/interest side effects. Modern-schema
  failures no longer retry by dropping modern viewing fields.
- Buyer-sales actions are restricted to agency roles; service-level viewing outcome checks also
  reject unsupported roles/other organisations.
- privateListingImageDelivery can no longer become true solely from R2 variables. It additionally
  requires trusted, operation-specific deployed acceptance evidence bound to origin, exact SHA,
  contract version, actor role, approved host, verified migration, checks, coverage and validity.
- The global NOT_ATTESTED status was NOT changed. No packet is installed or approved here.

These are source changes, not proof of the currently deployed behavior. Conditional viewing
updates do not create an agent/time-slot exclusion constraint: different simultaneous booking
keys and concurrent reassignment remain database acceptance blockers until isolated tests pass.

## Private image evidence policy

Trusted release operators may configure SEGMIQ_RE_PRIVATE_IMAGE_ACCEPTANCE_JSON only AFTER
retaining independent, deployed synthetic evidence and reviewing it. Android/request/JWT data
cannot provide this configuration. This is a declaration by the authorized release operator,
not cryptographic proof that an untrusted caller ran tests; artifact SHA-256 values bind retained
reports which must actually be inspected. Local fixtures never constitute this deployed evidence.

Required fields and validation are in lib/real-estate/private-image-acceptance.ts. The packet
requires schemaVersion=1, contractVersion=1, result=APPROVED, operation=property_images.sign,
evidenceEnvironment=DEPLOYED_SYNTHETIC, canonical HTTPS backendOrigin, deployedRevision (40 hex),
reviewedBy, verifiedAt, expiresAt, actorRoles, migrationState=VERIFIED, independent actor/tenant
coverage, approvedSignedImageHost and all required PASS checks with report SHA-256 references.
Missing, wrong-origin, wrong-revision, wrong-role, wrong-contract, expired, future-dated, mocked,
unreviewed or incomplete evidence fails closed. No default packet or approved hostname exists.

Binding uses trusted SEGMIQ_PUBLIC_API_ORIGIN or NEXTAUTH_URL, VERCEL_GIT_COMMIT_SHA or
SEGMIQ_RELEASE_REVISION, and configured private R2 account/bucket. Signed hosts must match the
actual validated R2 signed hostname (account host or bucket.account host); this report does not
approve either without a real authorized URL/redirect/expiry test. No Sales JWT is sent to media
hosts. Independently inspect public domains/CDN policies, object signature and size, ownership,
legacy copies and TTL revocation. Never publish raw signed URLs in an acceptance report.

## Financial migration preparation and tests

CLI 2.122.0 was downloaded from the official Supabase CLI release into ignored .tools only,
SHA-256 verified against the official checksum list:
60031fd5bf050fc12a0c6aef68997600d143870f944bf13109c7765dca329af8.
No project dependency or lockfile was changed. CLI migration new created:
`supabase/migrations/20261031151005_re_mobile_transaction_revision.sql`.
It contains the reviewed wrapper proposal; it locks the transaction, checks current actor and
participant scope/revision, then delegates existing business/compliance functions. It grants
execution only to service_role. It depends on the compliance safety baseline and final corrections.
The migration is PREPARED, NOT APPLIED, and NOT database-execution-certified.

`tests/database/phase5a-transaction-revision.sql` is also PREPARED, NOT RUN. It refuses execution
without explicit isolated fixture authorization and a fixture-manifest hash. It checks function
grants, stale revision rejection, cross-tenant actor rejection and absence of denied writes,
then rolls back. It is not a concurrent two-connection test.

For a real concurrency test, provision disposable authorized fixture records in a separate
approved DB first. Record source/origin/SHA/contract/schema and fixture manifest, and verify
all foreign-key/role relationships. In two independent authenticated DB connections:
1. Read the same fixture transaction revision.
2. Start A, invoke the wrapper with that revision, and hold the transaction open.
3. Start B against the SAME fixture/revision; confirm it blocks on A's row lock.
4. Commit A in the isolated environment only. B must return RE409 after A's commit.
5. Assert exactly one transition, one valid resulting state, expected audit entries and no
   duplicate side effects. Repeat for completion/cancel/progression and invalid prerequisites.
6. Independently race two offers reserving one fixture property; assert one winner and one
   conflict. Race same-key bookings; verify unique insert/replay semantics and zero unauthorized
   customer sends. Race two introduction reviewers; verify one decision/notification.
7. Clean up only the approved synthetic fixtures using the fixture manifest; never production rows.

No concurrent financial write is accepted until those actual database tests pass. Missing RPCs
must continue to return 503. Do not apply the new wrapper to production before the baseline,
preflight/rollback review and explicit migration approval.

## Deployment / push safety

The checkout is linked to Vercel project leadstaq and origin GitHub davidmafigu834/segmiq.
The current account has no local Vercel read token, so the automatic Git deployment policy and
exact current deployment could not be authenticated. Treat a branch/main push as potentially
automatically deploying; inspect Vercel Git integration and branch rules BEFORE any push.
No push, merge, deployment or production migration is performed by Phase 5A. Preserve unrelated
UI work. A source commit alone never updates the acceptance decision.

## Local verification

Results will be recorded below after the final checks. No production build runs because the
owner explicitly instructed this chat to skip builds. No mocked API result is labelled a
live actor/storage/concurrency result. A release build remains an explicit acceptance limitation.

## Final local verification record

- 139 tests passed, 0 failed across 21 suites, including 4 new evidence/viewing regression tests. These are local synthetic/mocked service tests, not deployment acceptance.
- Full TypeScript check passed, exit 0.
- Full project lint passed, exit 0; pre-existing React hook warnings remain outside Phase 5A.
- Diff whitespace check passed; source/evidence credential-pattern scan passed.
- Evidence JSON parsed successfully; approvedModules and approvedOperations remain empty.
- Production build intentionally skipped by the standing user instruction.
- Database race tests and private-object/expiry/host tests were NOT RUN: no authorised isolated fixtures, local PostgreSQL/Docker tooling, or verified private-object configuration was available.
- No Git commit/push, production deployment, applied migration, production account creation or data/storage mutation was performed.

Source/test/migration SHA-256, calculated over each UTF-8/LF path plus NUL and content plus NUL in the order below:
`ced6775c7a41af7cf334e218cd9b78d2a05c9f8c59c08bb4e16aee4e0bb5bc77`

- `app/api/clients/[clientId]/buyer-sales/actions/route.ts`
- `lib/mobile/sales-app/bootstrap.ts`
- `lib/real-estate/buyer-sales-service.ts`
- `lib/real-estate/private-image-acceptance.ts`
- `tests/real-estate-production-acceptance.test.ts`
- `tests/database/phase5a-transaction-revision.sql`
- `supabase/migrations/20261031151005_re_mobile_transaction_revision.sql`

Documentation/evidence: 05-real-estate-production-acceptance.md, 06-real-estate-android-rollout-manifest.md, and the three phase5a JSON files under evidence/.

## Git delivery after verification

GitHub public commit/deployment metadata confirmed that base ebe1a58 had a successful Vercel
Production deployment recorded at 2026-10-31T00:34:30Z. This does not authenticate the current
API revision or supply the missing actor/privacy evidence. A direct main push therefore risks
an automatic production deployment.

The authorized Git delivery uses codex/real-estate-phase5a-acceptance. vercel.json sets
`git.deploymentEnabled["codex/real-estate-phase5a-acceptance"] = false` according to Vercel's
branch-specific deployment configuration. Other branches and cron definitions are unchanged.
No merge to main or deployment is authorized by this delivery; SQL remains unapplied. The
post-push delivery report records the remote commit and deployment metadata check. Approval
lists remain empty. Historical no-push observations describe the verification run, not this
subsequent Git-only delivery.

Reference: https://vercel.com/docs/project-configuration/git-configuration
