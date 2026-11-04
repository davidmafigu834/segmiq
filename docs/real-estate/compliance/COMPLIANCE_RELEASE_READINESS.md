# Compliance release readiness

Date: 4 November 2026.

## Verdict

**Partially functional in local code. Not fully verified. Not ready for production compliance processing.**

The repaired rules are covered by 55 passing compliance tests, 8 of them new. No synthetic buyer completed a form, no reviewer opened a stored file, and no correction email was received. Production data and production policy were not changed.

## Production safety

- Do not deploy this source until the checks below are done in a non-production organisation.
- Do not apply the customer-message migration to production as part of an unattended deploy. Apply it in the same release as the code, before traffic uses correction invites, or the portal will keep working and the correction sentence will only be in the email.
- Do not delete or revoke the existing unsent production invitation unless the agency asks.
- Do not activate `listing_publication` or `allow_reuse`.

## What stays fail-open

With zero policy versions, an approved listing can still be marketed while the compliance checklist is incomplete. Compliance approval does not publish a listing. That is unchanged.

## Environment dependencies

| Dependency | Required for | Current state |
| --- | --- | --- |
| `RESEND_API_KEY` and `RESEND_FROM_EMAIL` | Any new invitation | Required before insert. A missing provider now refuses the request instead of storing a dead one. |
| Contact email | Any new invitation | A phone number alone is refused. |
| `NEXTAUTH_SECRET` | Invitation and code hashes | Production already refuses to run without it. |
| `CLOUDFLARE_R2_PRIVATE_DOCUMENT_BUCKET_NAME` | Portal and payment files | Must be a private bucket, different from the public media bucket. Not exercised in this remediation. |
| Malware scanner | Opening file bytes | Not connected. `unscanned` is not treated as clean. Download returns 403. |

## Malware quarantine

New files are stored as `unscanned`. The reviewer sees the filename, version, and "Not scanned". Open stays disabled. A quarantined file is also refused. This blocks the acceptance line "a reviewer can retrieve the evidence" until a scanner sets `scan_status` to `clean`. Do not flip that status by hand to finish a demo.

## Roles

A salesperson can collect and request documents for an assigned case only. A manager still holds review, finance, conveyancing, and policy together. This remediation did not split finance away from the manager profile. Payment confirmation remains a manager action and still cannot skip the state machine.

## Remaining risks

- Service-role access still bypasses row-level security. Isolation is the application check. A signed-in cross-organisation request was not repeated after the repair.
- The correction email uses the same reason the reviewer types. The screen tells them not to put internal notes there. There is no second field for a confidential note.
- Queue counts are the rows on the loaded page after visibility filtering, not a full organisation total.
- The mobile summary was not retested on Android.
- No concurrency test hit the decision function with two reviewers.

## Rollback

The code changes are backward-looking for stored rows: old invitations keep working once the cookie path is deployed, and old document downloads are untouched. Rolling back the application restores the `/verify` cookie bug and the dead phone-only insert. The unapplied `customer_message` column can stay; the previous code does not read it. Do not drop evidence rows or events.

## Before an agency uses it

1. Provision a non-production organisation, two agents, one manager, and contacts with test email addresses.
2. Apply `20261104013000_re_compliance_customer_message.sql` there.
3. Run journey A and journey C with synthetic PDFs.
4. Confirm the reviewer sees the file and cannot open it while it is unscanned.
5. Connect a scanner, or accept that reviewers cannot open bytes, and write that into the agency instructions.
6. Only then deploy the application and the migration together.
7. Leave listing enforcement off until a named policy owner activates a reviewed version.
