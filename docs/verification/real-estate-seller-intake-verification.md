# Seller intake verification — 5 November 2026

Phase 1B closed the seller-slice gaps that were visible in the current code. The feature flag stays off. Nothing was deployed, no production SQL or storage was written, no message was sent, and nothing was committed or pushed.

## Status

| Question | Result |
| --- | --- |
| Implemented in source | Yes, for the gaps below. `RE_SELLER_INTAKE=on` is set in local configuration. The live site stays hidden until this commit is deployed. |
| Visually checked | Yes, for synthetic PDF pages rasterized from the renderer, and for a labelled mock of the client form and agent review. The live React screens were not opened. |
| Database journey verified | Blocked. Docker, the Supabase CLI, and `psql` are absent. The only configured application database is the live project, so the nine-step authenticated journey was not run. |
| Production-ready | No. |

## Source issues and fixes

Template setup existed only as `POST /api/clients/[clientId]/seller-intake-templates`. A manager can now approve an open or sole version from Company / Property opportunities (`app/client/acquisitions/page.tsx` passes `canManageTemplates` into `AcquisitionWorkspace`, which renders `components/real-estate/seller-intake/SellerTemplateSetup.tsx`). The form collects a title, an organisation name, and clause lines. Preview is local and is labelled as not a signed mandate. Approving calls the existing manager-only service, which retires the previous approved version of that kind and inserts the next version. Fees, VAT, and agency identity are not seeded.

An agent still selects an approved version in `SellerIntakePanel`. With none approved, the panel says a manager opens Company / Property opportunities, pastes the clauses, previews them, and approves a version.

A later template version does not rewrite an earlier document. The submission snapshot stores the clauses and template version, and the prepared file hash is left unchanged. Covered by `a later template version does not rewrite an earlier prepared document` in `tests/real-estate-seller-intake.test.ts`.

The PDF renderer (`lib/real-estate/seller-intake/pdf.ts`) repeated the organisation name, could split the signing block, and wrapped at a width that crowded wide letters. It now keeps one running header, repeats “continued” and the page number, wraps at 72 characters, and keeps the unsigned signing block together. Restricted answers can be omitted with `includeRestricted: false`. The stored signing copy still includes them. The organisation name comes from the template row (`organisation_name` on `re_seller_intake_templates`).

Prepared and signed seller documents were inserted as `unscanned`, and download already refused non-clean bytes, but `scanPendingEvidence` only reads `compliance_evidence_versions`. `lib/real-estate/seller-intake/scan.ts` now selects `re_seller_intake_documents` in `unscanned`, `pending`, `scanning`, or `scan_failed`. The existing cron `app/api/cron/compliance-scan/route.ts` calls that worker after the compliance scan. `vercel.json` was not changed, so no production job was scheduled. A missing scanner returns 503 and leaves an unscanned row unscanned. A client `scanStatus` is rejected on the public route, the agent route, a signed-file upload, and the cron. A clean row is not rewritten, and the unapplied trigger `re_seller_intake_document_immutable` rejects a later change to the storage key, checksum, or size.

`prepareListingFromAcquisition` copied `opportunity.contact_id` into `real_estate_listing_parties` as `owner`. Company intake stores that contact as the representative. `listingPartyPlan` in `lib/real-estate/seller-intake/parties.ts` now copies an individual registered owner as `owner`, and a company representative as `authorised_representative`. Opportunities with no party rows keep the previous contact-as-owner path. A submitted intake mandate still cannot prepare a listing; the conversion test sets the mandate to `approved` before the listing draft is created. That draft stays `approval_status: draft` and `status: reserved`.

The owner portfolio grouped only by `contact_id`, so the representative’s name hid the company. `portfolioGroups` groups a company by its registered-owner display name and lists each representative. The opportunity screen titles the company and shows the representative separately (`AcquisitionDetail.tsx`).

Salesperson JSON was already redacted. The stored PDF includes the restricted answers, and `openIntakeDocument` previously allowed any assigned agent to pass the scan check. A salesperson now receives 403 even when `scan_status` is `clean`. A manager receives a 300-second signed URL only after a clean scan and only when private storage is configured; otherwise the response stays 503 and no bytes are returned. The document GET route had treated a successful open as `{ error: "Not found" }`. It now returns the signed URL.

The `sq_si` cookie is `requestId.secret`. A cookie whose request id does not match the link is ignored, so one tab cannot attach or reveal another request. Reissue and revoke insert the previous token hash into `re_seller_intake_revoked_tokens` and the previous session hash into `re_seller_intake_revoked_sessions` before clearing them. A superseded token returns 410. Public rate-limit keys include a hash prefix of the link. Public and agent bodies that contain `scanStatus` are rejected. Client scope ids remain stripped by `answersFromClient`.

Review claim calls `re_seller_intake_claim_review` and falls back to the filtered update when the function is absent. The in-memory test client returns null for that function, so the tests exercise the fallback. They do not establish PostgreSQL row locking.

## Entry points

| Person | Where | What they do |
| --- | --- | --- |
| Manager | `/client/acquisitions` | Paste the organisation name and clause text, preview, and approve an open or sole version. |
| Agent | Property opportunities, an opportunity, a conversation, or the owner list | Choose an approved version, generate a link, copy or share it. Review, request a correction, or accept the capture. |
| Seller | `/seller-form/[token]` | Save, resume on the same browser, and submit. A correction link shows the accepted sections and asks for the rejected ones. |

No approved template: the agent cannot generate a link. The manager resolves it from Company / Property opportunities. The sales workspace does not show the approve control.

## Permissions

| Output | Seller session for that request | Assigned salesperson | Manager in the organisation | Another organisation or another agent |
| --- | --- | --- | --- | --- |
| Saved answers on the public form | Resume or correction cookie for the same request | No | No | No |
| Another request in a second tab | Ignored. The cookie is bound to one request id. | No | No | No |
| Identity, spouse, employer, PEP, source of funds, shareholder lines | Entered by the seller. Not returned as a search result. | JSON replaced with “Submitted for a permitted reviewer” | Visible on the review | Refused |
| Duplicate contact candidates | Never returned | Shown on the review | Shown on the review | Refused |
| Stored mandate PDF | No public download | 403, including after a clean scan | Signed URL only when the scan is clean | Refused |
| Unscanned, scanning, infected, failed, or quarantined file | No bytes | No bytes | No bytes | No bytes |

## Scan path

1. Intake acceptance inserts `re_seller_intake_documents` with `scan_status = unscanned` and `signature_state = prepared_unsigned`.
2. A returned signed file is a new row, `signed_uploaded` and `unscanned`. It does not replace the prepared file and it is not signature evidence.
3. `POST /api/cron/compliance-scan` rejects a body field `scanStatus`, returns 503 when `COMPLIANCE_CLAMAV_HOST` is unset, then scans compliance evidence and seller documents.
4. The seller worker sets `scanning`, reads the private object, requires the stored checksum, and applies the ClamAV response. `stream: OK` becomes `clean`. `FOUND` becomes `infected`. A checksum mismatch or a scanner error becomes `scan_failed` and can be retried. A finished `clean`, `infected`, or `quarantined` row is left unchanged.
5. Download reads that same `scan_status` through `evidenceAccessDecision`.
6. Setting `COMPLIANCE_CLAMAV_HOST` does not scan anything until a deployment calls this route. This change does not add a schedule. The isolated call is an authorised `POST` to `/api/cron/compliance-scan` with the existing cron secret, after the host and port are set. Production still needs that call, the private bucket, and both seller migrations.

## Company and representative

Saved parties keep a company `registered_owner` with no contact id and a separate representative contact. The opportunity `owner_name` is the company. Listing preparation copies the representative as `authorised_representative`.

Several properties for one company name appear as one portfolio group, with each representative named. Two representatives are not collapsed into one person.

Unresolved limits: listing parties require a contact, so the company itself is not a party row. Companies are grouped by the display name, so two different companies that share a name would appear as one group. There is no separate company record id on the opportunity.

## Synthetic PDF and UI evidence

Produced by `scripts/real-estate/render-seller-intake-samples.ts` and rasterized with `pdf-parse` `getScreenshot` into PNGs. These are synthetic. They are not organisation-approved templates.

| Sample | Pages inspected |
| --- | --- |
| `docs/verification/samples/synthetic-individual-open.pdf` | Page 1. Individual open fields, distinct mandate price 80000 and asking price 90000, distinct start and end dates, blank signature, witness, negotiator, place, and “Signature date: not recorded”. |
| `docs/verification/samples/synthetic-company-open.pdf` | Pages 1 and 2. Long address and representative name wrap. Company and representative stay labelled separately. The signing block is intact on page 2. |
| `docs/verification/samples/synthetic-sole-continuation.pdf` | Page 1. Asking price only, plus the template’s two-month continuation sentence. No invented signature or expiry date. |

The raster showed a repeated organisation line on the first pass. The renderer was corrected and the pages were rasterized again. Text is 11pt Helvetica with a 15pt line height. The samples contain no platform fee or VAT sentence.

`docs/verification/samples/mock-previews.html` is a static mock, labelled “MOCK PREVIEW — synthetic data — not the live application”. It was served only as a file by `scripts/real-estate/serve-seller-intake-samples.mjs` on `127.0.0.1:8765`. That server does not boot Next and does not read the application environment. Desktop and a 390px-wide mobile viewport were inspected. Fields stack, the long representative name wraps in the review, and the page does not scroll sideways (`scrollWidth` 390 equals `clientWidth` 390). Screenshots: `mock-desktop.png`, `mock-mobile.png`, `mock-mobile-review.png`. This is not the authenticated application.

`SellerForm` and the review sheet now wrap long values. The mock is not wired into a product route.

## Tests

In-memory PostgREST and source inspection, 5 November 2026:

- `tests/real-estate-seller-intake.test.ts`: 16 passed.
- `tests/compliance-scan.test.ts`: 7 passed.
- `tests/real-estate-acquisition.test.ts`: 10 passed.
- `tsc --noEmit`: passed, including a second run after the manager download was changed to return a signed URL. Exit code 0.

These tests do not use PostgreSQL. The claim function, tenant trigger, unique indexes, revoked-token tables, and document immutability trigger are in unapplied SQL. A fake client cannot prove them.

The earlier storage-failure test still shows one opportunity and `review_incomplete` until the retry stores the document. Acceptance still requires both the mandate id and the document id.

## Release prerequisites

Applied to the live project on 5 November 2026, in this order:

1. `supabase/migrations/20261105140000_real_estate_seller_intake.sql`
2. `supabase/migrations/20261105160000_real_estate_seller_intake_access.sql`

Do not apply `20261022113000_compliance_phase1_safety_baseline.sql` as part of this slice. The seller migrations do not add those constraints. The Phase 0 finding stands: that baseline is absent, and later compliance columns are not a substitute.

Also required before any production use:

- A manager-approved open template and a manager-approved sole template, with the organisation’s own clauses and name. The synthetic samples must not be inserted as those templates.
- `RE_SELLER_INTAKE=on` in the deployment that should show the workflow. It is on in local configuration. The hosted deployment still needs the variable and a deploy of this code.
- `COMPLIANCE_CLAMAV_HOST` plus a real call to `/api/cron/compliance-scan`. The host variable alone does not discover seller documents.
- Private document storage for `clients/{id}/seller-intake/`.
- `SELLER_INTAKE_TOKEN_PEPPER` or the existing auth secret, at least 16 characters. Links stay refused when that material is missing.

`scripts/real-estate/seller-intake-isolated-check.mjs` reports whether `docker`, `supabase`, and `psql` are on `PATH` and exits without reading or writing a database. On this machine all three are absent.

## Authenticated journey

| Step | Result |
| --- | --- |
| 1. Manager approves open and sole templates | Blocked. No isolated database. |
| 2. Agent generates and copies a link | Blocked. The same cause. |
| 3. Seller saves, resumes, and submits | Blocked. |
| 4. Agent requests a correction and applies it | Blocked. |
| 5. One seller or company, one opportunity, and one pending mandate | Blocked. The in-memory sequence covers this shape and is not this step. |
| 6. Prepared document through a real scan and download | Blocked. Scanner fixtures cover the worker. No ClamAV daemon was run. |
| 7. Signed copy stays separate and still needs review | Blocked as a database observation. The in-memory upload creates a second row and does not count it as signature evidence. |
| 8. A second organisation and an unauthorised actor are refused | Blocked as a database observation. The route test refuses a cross-organisation actor against the fake client. |
| 9. Repeated review and an injected failure do not duplicate records | Blocked as a database observation. The fake client has no unique indexes and no row locks. |

Android recovery and the accepted-offer transaction bootstrap were left unchanged.
