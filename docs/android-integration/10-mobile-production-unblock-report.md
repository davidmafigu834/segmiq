# Mobile production unblock

Recorded 2026-11-01. The mobile-first runtime is already in git. This record checks that revision again, records what production is serving, and leaves every new write closed. No production row, storage object, migration, or new deployment was created for this check.

## Current candidate revision

| Revision | Role |
|---|---|
| `420579d3d5cb76e98182d2f092d8eca92e0a7315` | Runtime commit. Buyer search, listing, private image, matching, introduction, viewing, inquiry, and conversation Copilot contracts. |
| `6d6600df9087bb193c29edf0cade06da292e5b93` | `origin/main` at the time of this check. Docs-only child of `420579d`. This is the tree that was typechecked, linted, tested, and production-built. |
| This document | Docs only. It does not change runtime code. Android must not pin this document's commit. |

Contract version remains **1**. `mobileReleaseEvidence()` still returns `deployedVerification: "NOT_ATTESTED"`. `release.revision` is `VERCEL_GIT_COMMIT_SHA` or `SEGMIQ_RELEASE_REVISION`, otherwise null.

The working tree on the main checkout contains unrelated Android, solar, and web edits. The checks below ran in a separate worktree at `6d6600df9087bb193c29edf0cade06da292e5b93`, so those edits were outside the compiler and the test runner.

## Exact deployed revision verified

Authenticated bootstrap revision: **not attested**.

| Observation | Time | Result |
|---|---|---|
| `GET https://www.segmiq.com/api/sales/app/bootstrap` with no session | 2026-11-01T13:41:25Z | 401 `TOKEN_INVALID`, `Cache-Control: no-store`, `Server: Vercel`, `X-Matched-Path: /api/sales/app/bootstrap`. Body has no `release.revision`. |
| Same request on `https://leadstaq-6wlzqx59o-david-mafigus-projects.vercel.app` | 2026-11-01T13:47:11Z | Same 401 body. Extra `X-Robots-Tag: noindex`. |
| GitHub deployment `7472949276` | 2026-11-01T12:23:45Z | Environment name `Production`, state `success`, description "Deployment has completed", SHA `6d6600df9087bb193c29edf0cade06da292e5b93`. `production_environment` is false on the GitHub record. Environment URL is the deployment host above, not `www.segmiq.com`. |
| GitHub commit status, context `Vercel` | 2026-11-01T12:23:44Z | State `success`, target `https://vercel.com/david-mafigus-projects/leadstaq/DNKGQ8x4uEVNSZMokjnaA5gGTbWq`. |
| `https://www.segmiq.com/` HTML | 2026-11-01T13:47:13Z | Stylesheet query `dpl=dpl_DNKGQ8x4uEVNSZMokjnaA5gGTbWq`, the same deployment id as that Vercel target. |

A salesperson session that returns `release.revision` is still required before any Android pin can move. The deployment id match is evidence that the public alias is serving that Vercel deployment. It is not the revision field the app reads.

No new deploy was started. Pushing `main` auto-deploys production. `vercel.json` sets `git.deploymentEnabled` to false only for branch `codex/real-estate-phase5a-acceptance`.

## Verification method

Node was the editor helper binary. `node` is not on the shell PATH.

| Command | Exit | Result |
|---|---|---|
| `tsc --noEmit --pretty false` | 0 | No diagnostics. Elapsed 830283 ms. It shared the machine with the test suite. |
| `next lint` | 0 | 9 existing `react-hooks/exhaustive-deps` warnings, 0 errors. |
| `tsx --test tests/*.test.ts` | 0 | 1485 tests, 335 suites, 1485 passed, 0 failed, 0 skipped. `duration_ms` 420434.3674. |
| `node scripts/patch-vercel-og-windows.mjs` | 0 | Windows Open Graph asset patch, then the production compile. |
| `next build` (Next.js 14.2.35) | 0 | Completed. `/opengraph-image` is static (`○`). Blog and package Open Graph routes are dynamic. Webpack printed `module.createRequire failed parsing argument` from `lib/zoho-books/import-plan.ts` twice. The build still finished. |

The earlier `/opengraph-image` Windows failure and the four unrelated test failures are absent from this run. No assertion was weakened.

## Test identities and environment

**Not provisioned. The actor walk was not run.**

The local API host is `https://gnnqzboaeezzevlwwryp.supabase.co`. `DATABASE_URL` is a remote Supabase Postgres URL for that same hosted project, not localhost. `NEXTAUTH_URL` in the local file is `localhost:3000`. Creating users or rows there would write the production database. That was not authorised, so no account, contact, search, listing, viewing, introduction, or inquiry was created.

Provisioning required before any write, privacy, or concurrency row can be marked PASS:

1. Two organisations that are not existing customer tenants.
2. Salesperson A, role `SALESPERSON`, organisation A.
3. Salesperson B, role `SALESPERSON`, organisation A.
4. A manager, role `CLIENT_MANAGER`, organisation A.
5. A salesperson, role `SALESPERSON`, organisation B.
6. Synthetic contacts, buyer searches, listings, and viewing rows only.
7. No real customer phone numbers.
8. No offer, transaction, commission, invoice, or appointment mutation.
9. Repeat the walk against the SHA an authenticated `GET /api/sales/app/bootstrap` returns for Salesperson A.

Passwords are intentionally omitted.

## Read operations accepted

The only reviewed read pin is unchanged:

```text
origin: https://www.segmiq.com:443
revision: 7e743eb43fd2995636c8b2f7133d606a1d2c3cb6
contractVersion: 1
role: SALESPERSON
reads: PROPERTIES, BUYERS, VIEWINGS, INTRODUCTIONS, OFFERS, TRANSACTIONS, CALENDAR
writes: empty
privateImageHost: null
```

Properties read, buyer read, and the older viewing, introduction, offer, transaction, and calendar reads stay on that pin only. Matching read on `GET /api/clients/{clientId}/matching?listingId=` is a new projection and is **FAIL** until the four-actor walk passes on the SHA bootstrap returns.

## Write operations accepted

None.

Buyer create/update, listing create/update, viewing scheduling, viewing reschedule/outcome, introduction create/review, inquiry linking, and conversation Copilot writes are **FAIL**. Source permission checks and the passing unit suite are not a substitute for the isolated actors.

`OFFERS`, `TRANSACTIONS`, `CALENDAR` writes, and compliance stay closed. Their independent checks were not run.

## Image host acceptance

**Not approved.** Upload and download stay independent of listing metadata, and both are **FAIL**. Listing metadata is also FAIL.

Local environment, names and secrets omitted:

| Key | Present |
|---|---|
| `CLOUDFLARE_R2_BUCKET_NAME` | yes |
| `CLOUDFLARE_R2_ACCOUNT_ID` | yes |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | yes |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | yes |
| `CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME` | no |
| `SEGMIQ_RE_PRIVATE_IMAGE_ACCEPTANCE_JSON` | no |

`privateImagesAcceptedForCurrentRelease()` returns false when the packet, revision, origin, account, or private bucket is missing. `privateListingImageDelivery` therefore stays false. The upload route returns 503 `STORAGE_UNAVAILABLE` until private storage is configured. The object path is `clients/{clientId}/listings/{listingId}/photos/…`. Signature checks allow JPEG, PNG, WebP, and AVIF, and reject other bytes with 415. Over 20 MiB returns 413. More than 50 photos returns 409. Signed lifetime in the contract is 300 seconds. No signed URL was fetched, so expiry, host, and redirect behaviour were not observed. The Sales JWT is not part of the storage client; storage uses the R2 credentials. No public-bucket fallback was added. Legacy public objects were not migrated and were not deleted.

## Failed checks and remediation

| Check | Result | Remediation |
|---|---|---|
| TypeScript, lint, full suite, production build | Pass on `6d6600d` | None for this tree |
| Authenticated bootstrap revision | Not captured | Sign in as the isolated salesperson and record `release.revision` |
| Four-actor privacy walk | Not run | Provision the identities above on an isolated database |
| Duplicate idempotency key, concurrent bookings, competing introduction decisions, stale updates, duplicate photo uploads | Not executed against a database | Run them on the isolated database after provisioning |
| Private bucket, acceptance packet, signed host | Absent | Create a private bucket that differs from the public bucket, then complete the ten acceptance checks in `lib/real-estate/private-image-acceptance.ts` against the deployed SHA |

Source constraints that were read and were not raced:

- Viewing uniqueness is `idx_viewings_idempotency` on `(client_id, idempotency_key)` where both are non-null, in `supabase/migrations/20261016120000_real_estate_phase3_buyer_sales.sql`.
- Introduction decision update is conditional on `status = requested` in `lib/real-estate/buyer-introduction-service.ts`. A second decision is specified to return 409. Two connections were not used.
- A repeated photo idempotency key is hashed into the same object name. The upload route returns the existing image when that key is already on the listing. Two concurrent uploads were not sent.

## EstateAccess entries Android may use

One entry:

```text
EstateAcceptance(
  origin = "https://www.segmiq.com:443",
  revision = "7e743eb43fd2995636c8b2f7133d606a1d2c3cb6",
  contractVersion = 1,
  roles = setOf("SALESPERSON"),
  reads = setOf(PROPERTIES, BUYERS, VIEWINGS, INTRODUCTIONS, OFFERS, TRANSACTIONS, CALENDAR),
  writes = emptySet(),
  privateImageHost = null
)
```

No write entry is authorised. `6d6600df9087bb193c29edf0cade06da292e5b93` does not inherit the read pin. The future write shape in `08-real-estate-mobile-activation.md` stays unused.

## Remaining blockers

1. Capture `release.revision` from an authenticated salesperson bootstrap on `https://www.segmiq.com`.
2. Provision the four isolated actors on a database that is not the hosted customer project, then rerun every FAIL row in `11-android-operation-acceptance-manifest.md`.
3. Race one viewing idempotency key, two overlapping bookings, two introduction decisions, a stale listing update, and a repeated photo upload. Expect one viewing row for the shared key, 409 for the second introduction decision, and one object for the repeated photo key.
4. Approve a private image host only after a signed URL is fetched, expires, and is the private R2 host. Keep `privateImageHost` null until that packet matches the deployed SHA.
5. Leave offer decisions, restricted transactions, calendar writes, and compliance closed until those operations have their own actor evidence.
6. A push of `main` will start another production deployment. This evidence commit should stay local until that deploy is explicitly requested.
