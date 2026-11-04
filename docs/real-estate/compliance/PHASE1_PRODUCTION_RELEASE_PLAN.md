# Phase 1 production release plan

Date: 4 November 2026
Status: do not deploy. Production is blocked.

This plan is the order to follow after an isolated run has passed. It is not authorisation to deploy.

## Required approval before production

A named owner must approve all of the following in writing:

1. The isolated buyer, seller, correction, scan, and transaction runs in `PHASE1_RELEASE_BLOCKER_VERIFICATION.md` have moved from NOT TESTED or BLOCKED to PASS, with database and browser evidence.
2. The private document bucket exists and is not the public marketing bucket.
3. ClamAV is reachable from the application, and a clean fixture and an EICAR fixture have been scanned there.
4. The two unapplied migrations have been applied to an isolated database first.
5. Production `listing_publication` and `allow_reuse` stay off. No compliance policy is activated as part of this release.
6. The existing production buyer case is left unchanged.

No production deployment, production migration, or production policy change was performed while preparing this plan.

## Environment variables

| Name | Purpose | Current local state |
| --- | --- | --- |
| `COMPLIANCE_CLAMAV_HOST` | Hostname of the ClamAV daemon. Required before any file can become clean. | Not set. |
| `COMPLIANCE_CLAMAV_PORT` | ClamAV port. Defaults to `3310`. | Not set. |
| `CRON_SECRET` | Bearer token for `POST /api/cron/compliance-scan`. | Set. Do not print it. |
| `CLOUDFLARE_R2_PRIVATE_DOCUMENT_BUCKET_NAME` | Private bucket for compliance objects. Must differ from `CLOUDFLARE_R2_BUCKET_NAME`. | Not set. |
| `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Private storage credentials. | Set. Do not print them. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Invitation and OTP mail. | Set. |
| `NEXTAUTH_SECRET` | Pepper for invitation tokens and OTP hashes. | Set. |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server database access. | Point at production `leadstaq`. An isolated project is required before test writes. |

Do not point a test run at `gnnqzboaeezzevlwwryp`.

## Scanner configuration

1. Run ClamAV where the Next.js server can open a TCP connection. This repository has no scanner container and no VirusTotal account.
2. Set `COMPLIANCE_CLAMAV_HOST` and, if needed, `COMPLIANCE_CLAMAV_PORT`.
3. Confirm the daemon answers `stream: OK` for a harmless file and `stream: … FOUND` for the EICAR test string.
4. Schedule `POST /api/cron/compliance-scan` with `Authorization: Bearer <CRON_SECRET>` only after that confirmation. The route is not in the Vercel cron schedule yet, so a deploy does not start scanning by itself.
5. Leave the host unset until then. Uploads remain `unscanned` and cannot be opened. The application does not mark a file clean to fill the gap.

The worker reads the stored object, hashes it, and compares that hash with `checksum_sha256`. A mismatch is `scan_failed` and stays blocked. The request body cannot set `scanStatus`.

## Private storage

`putPrivateDocument` and `readPrivateDocument` refuse a key unless it matches `clients/{id}/compliance/` or `clients/{id}/transactions/`, and they refuse the public bucket. Signed links expire after 300 seconds and are issued only after the scan status is `clean`, the caller can review, and the key belongs to that organisation and case.

Before release, create a dedicated private bucket, set `CLOUDFLARE_R2_PRIVATE_DOCUMENT_BUCKET_NAME`, and confirm it is not equal to `CLOUDFLARE_R2_BUCKET_NAME`. Do not store compliance files in the listing bucket.

## Email

Resend is already configured. Correction mail includes `What to correct:` followed by the customer instruction only. The internal note is not an argument to the mailer. OTP mail does not claim to verify legal identity.

Use a mailbox the test organisation controls. Do not send test invitations to real customers.

## Database migration order

Apply on the isolated database first, in this order:

1. `supabase/migrations/20261103195500_re_compliance_management_foundation.sql` if that database does not already have it. Production already has this foundation. Do not apply it again there.
2. `supabase/migrations/20261104013000_re_compliance_customer_message.sql` adds `compliance_invitations.customer_message`.
3. `supabase/migrations/20261104023000_re_compliance_scan_lifecycle.sql` adds `compliance_case_requirements.internal_note` and widens `scan_status` to `unscanned`, `scanning`, `clean`, `infected`, `scan_failed`, and `quarantined`.

Both new migrations are additive. Existing invitation and evidence rows stay valid. `customer_message` and `internal_note` are null until a correction is recorded.

Do not apply either new migration to production until the isolated run has passed and the approval above is recorded.

## Deployment order

1. Isolated database migrations.
2. Isolated environment variables, including the private bucket and ClamAV.
3. Deploy the application to the isolated host.
4. Run one synthetic buyer journey, one seller journey, one correction, one infected-file denial, and one concurrent review.
5. After written approval, apply the two new migrations to production.
6. Set the production scanner and private bucket variables.
7. Deploy the application.
8. Add the scan cron only after a production EICAR object, created solely for that test and then deleted, is classified as infected and cannot be opened.
9. Leave policy enforcement off.

## Rollback

Application rollback is a redeploy of the previous revision. New routes disappear. Files already stored stay in the private bucket and remain unreadable unless they were marked `clean`.

Database rollback, if it must be done before any infected or failed rows exist:

1. Stop the scan cron.
2. Update any `scanning`, `infected`, or `scan_failed` rows to `quarantined` before restoring the old check. Otherwise the old check will fail.
3. Restore `CHECK (scan_status IN ('unscanned', 'clean', 'quarantined'))`.
4. `customer_message` and `internal_note` may stay. Dropping them deletes correction text and reviewer notes. The application already tolerates a missing `customer_message` column. It stores the internal note in a confidential event if `internal_note` is missing.

Do not delete evidence rows. The evidence delete trigger remains.

## Policy activation exclusions

This release must not:

- set `enforcement.listing_publication` to true
- set `enforcement.allow_reuse` to true
- activate a policy version for an existing organisation
- change the production buyer case that is already present
- treat a payment receipt as cleared funds
- treat a handover milestone as registered title

## What is still required before anyone can call this ready

- An isolated Supabase project or local stack, with its own organisation, two agents, a manager, a reviewer, synthetic parties, and a private bucket.
- A controlled mailbox.
- A running ClamAV daemon.
- The two migrations applied there, then the buyer, seller, correction, scan, authorisation, and transaction journeys executed against that database.
- Typecheck, lint, and a production build on the release commit.
