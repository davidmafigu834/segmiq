# Phase 1 release-blocker verification

Date: 4 November 2026
Repository revision: `5392d03`, plus uncommitted compliance changes in the working tree. Those changes are not deployed.
Production project checked: Supabase `leadstaq` (`gnnqzboaeezzevlwwryp`). It is the only project on the connected account. No staging project exists.
Production customer cases were not modified. Neither migration below was applied. Listing publication and reuse enforcement were not activated.

This report separates unit proof from a real customer-to-reviewer run. A unit pass is not a journey pass.

## Verdict

| Journey | Result |
| --- | --- |
| Buyer KYC | NOT TESTED |
| Seller KYC | NOT TESTED |
| Correction journey | BLOCKED |
| Evidence scanning and review | BLOCKED |
| Cross-tenant security | NOT TESTED |
| Transaction compliance | NOT TESTED |
| Production release | BLOCKED |

The local dev server uses the production Supabase project. Creating an invitation, uploading a document, or recording a review there would write production. That was not done.

## What was implemented

- A ClamAV INSTREAM client. A file becomes `clean` only when that client parses `stream: OK` for the stored object and the stored checksum still matches. A client field, a PDF or JPEG type, or a missing scanner cannot produce `clean`.
- Worker route `POST /api/cron/compliance-scan`. It is behind the existing cron secret. A body that contains `scanStatus` is rejected with 400. If `COMPLIANCE_CLAMAV_HOST` is unset, the route returns 503 and does not write a scan result.
- Downloads stay fail-closed. `unscanned`, `scanning`, `infected`, `scan_failed`, and `quarantined` cannot be signed. Only `clean` can.
- Until the scan migration is applied, `infected` and `scan_failed` are stored as `quarantined` if the current database check rejects the new values. Those files remain blocked.
- Correction requests now require a customer instruction of at least 8 characters. That text is the only text placed on the invitation and in the email. An internal note is stored on the requirement when the column exists, or otherwise in the confidential event `after_value`. The event summary shown in the product does not contain the note. The public portal selects `customer_message` only.
- The Compliance Centre labels a file `Awaiting scan`, `Safe to open`, `Blocked`, or `Scan failed`. Open stays disabled unless the file is clean.

## Environment found

| Check | Result |
| --- | --- |
| Staging Supabase project | None. Only `leadstaq` is listed. |
| Local Supabase stack | No `supabase/config.toml`. |
| `COMPLIANCE_CLAMAV_HOST` | Not set. |
| `CLOUDFLARE_R2_PRIVATE_DOCUMENT_BUCKET_NAME` | Not set. Compliance objects cannot be stored. The listing bucket was not reused. |
| Resend | `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set. |
| `CRON_SECRET` | Set. |
| `NEXTAUTH_SECRET` | Set. Invitation tokens use it. |

## Automated tests

Command: `node .\node_modules\tsx\dist\cli.mjs --test` on the compliance test files.

Result: 62 passed, 0 failed. The previous remediation run was 55. The 7 new tests cover scanner verdicts, quarantine, the rejection of a client-supplied scan status, customer and internal text separation, evidence versioning, the SQL `RE409` guard, and the payment and handover rules.

These tests do not open a browser session, send an email, store an object, or call ClamAV.

Typecheck and lint are recorded at the end of this file after they finish.

## Capability record

### Secure document scanning

- Original blocker: uploads were stored as `unscanned`, and no scanner existed. Reviewers received 403 until a file was `clean`.
- Fix: `lib/real-estate/compliance-management/scanner.ts`, `scanStoredEvidence` in `service.ts`, `app/api/cron/compliance-scan/route.ts`, and `readPrivateDocument` in `lib/real-estate/private-document-storage.ts`.
- Migration, not applied: `supabase/migrations/20261104023000_re_compliance_scan_lifecycle.sql` adds `scanning`, `infected`, and `scan_failed`.
- Test environment: unit tests with a stubbed ClamAV response. No daemon was contacted.
- Runtime steps: none against storage. The worker was not called.
- Database evidence: none. The production check still allows only `unscanned`, `clean`, and `quarantined`.
- Security result: fail-closed path is in code. A genuine clean result was not produced.
- Result: BLOCKED.
- Remaining dependency: a private document bucket, a reachable ClamAV daemon, `COMPLIANCE_CLAMAV_HOST`, the unapplied scan migration on an isolated database, and a cron call that scans that database only.

### Customer session

- Original blocker: the verification cookie was not sent to the public API.
- Fix, from the prior remediation and still present: cookie `sq_cv`, path `/`, HttpOnly, SameSite `lax`, Secure in production, 30-minute max age. The public route strips the session id from JSON.
- Test environment: unit test of cookie path and options.
- Runtime steps: a live invitation, OTP email, save, reload, and submit were not performed.
- Result: NOT TESTED.
- Remaining dependency: an isolated organisation, a controlled mailbox, and a browser session that is not the production database.

### Buyer KYC

- Result: NOT TESTED.
- The form, upload, scan, reviewer open, approval, and audit chain was not executed. Doing it on `leadstaq` would create a production case.

### Correction loop and note separation

- Original blocker: the reviewer reason was the customer message.
- Fix: `correctionMessages` in `remediation.ts`; `decideRequirement` emails `customerInstruction` only; the centre dialog has two fields.
- Files: `service.ts`, `centre/route.ts`, `ComplianceCentre.tsx`, `copy.ts`, migration `20261104013000_re_compliance_customer_message.sql` (not applied) and the scan migration's `internal_note` column (not applied).
- Browser evidence: on `http://localhost:3000/dev/compliance-preview?screen=queue`, which renders synthetic rows and does not save, a short instruction was refused with “Write what the customer should correct. Internal notes are not sent.” A customer instruction and a separate internal note were accepted by the form and the preview reported “Nothing was saved.” No email was sent and no database row was written.
- Database evidence: none.
- Result: BLOCKED for the full loop. The data-flow split is implemented and unit-tested. Delivery, replacement versioning, and a second review were not run.

### Seller and property workflows

- Result: NOT TESTED.
- Policy enforcement was not switched on. Production `listing_publication` and `allow_reuse` were not changed.

### Transaction compliance

- Unit evidence: `confirmPayment` from `proof_uploaded` fails. `keys_handed_over` does not change legal transfer state. `registration_confirmed` can move a lodged transfer to `registered`.
- Runtime: no synthetic accepted-offer transaction was created.
- Result: NOT TESTED.

### Authorisation and concurrent reviewers

- Code evidence: case and evidence reads filter `client_id`. The decision function still raises `RE409` when the expected state does not match. Service-role access remains in the server after the application checks.
- Runtime: Agent A, Agent B, a manager, a reviewer, a wrong organisation, a revoked invitation, and an expired signed URL were not called as signed-in API requests. Two reviewers were not run against the database.
- Result: NOT TESTED.

### Compliance Centre UI

- Browser: synthetic preview only, desktop and a 390px-wide viewport.
- Observed: queue states include Awaiting review, Changes requested, and In review. File rows showed Awaiting scan with Open disabled, Safe to open with Open enabled, and Blocked with Open disabled. The phone layout stacks the detail under the queue. Filter tabs scroll horizontally.
- Not observed: a signed-in account, a real document viewer, or a customer portal session.
- Result: NOT TESTED for the signed-in product. The synthetic screen behaved as intended and did not write data.

## Migrations

| File | Applied to production | Applied to staging |
| --- | --- | --- |
| `20261103195500_re_compliance_management_foundation.sql` | Yes, previously, as version `20261103182852` | No staging database |
| `20261104013000_re_compliance_customer_message.sql` | No | No |
| `20261104023000_re_compliance_scan_lifecycle.sql` | No | No |

Existing rows were not rewritten. Rollback compatibility is in the release plan.

## Typecheck, lint, and build

- Typecheck: `tsc --noEmit` completed with exit code 0. No type errors were printed.
- Lint: `next lint` on the compliance files changed in this pass completed with no warnings or errors.
- Production build: not run. The local Next.js dev server is already using `.next`, and a production build was not started against that directory. The build remains part of the release checklist. A green build would still not make the blocked journeys pass.
