# SegmiQ Real Estate compliance — remediation plan

Audit date: 4 November 2026. Do not treat this file as permission to change production data. Fixes should land in a non-production organisation first, with synthetic contacts and synthetic files.

## 1. P1 — Customer session never reaches save or submit

**Problem.** After a valid email code, the form cannot save or submit.

**Reproduction.**

1. Create an invitation in a non-production organisation for a contact with an email address.
2. Open `/verify/c/{token}` and continue.
3. Enter the 6-digit code. The verify response sets `Set-Cookie: sq_cv=...; Path=/verify`.
4. Submit the form. The browser posts to `/api/public/compliance-invitations` and does not include that cookie.
5. The service compares `opts.sessionId` with the session row and returns 401 “Verify your code before continuing.”

**Root cause.** `app/api/public/compliance-invitations/route.ts` sets `path: "/verify"`. `PublicSubmissionPortal.tsx` posts to `/api/public/compliance-invitations`. `publicInvitationAction` in `lib/real-estate/compliance-management/service.ts` requires the cookie session id.

**Affected service.** `publicInvitationAction`.

**Database impact.** No requirement or evidence row is written. The invitation can remain `in_progress` after verify.

**Proposed fix.** Set the cookie path to `/` and keep it httpOnly, `SameSite=Lax`, and `Secure` in production. Add a test that a save request without the cookie is rejected and a save request with the cookie is accepted. Do not put the session id in the URL or in page JSON.

**Security.** The session id must stay out of analytics, referrers, and the JSON body. Keep the 30-minute expiry.

**Tests.** One route test with a fake verified session: cookie path covers the API; a missing cookie is 401; a mismatched cookie is 401.

**Dependencies.** None.

## 2. P1 — Reviewers cannot open portal evidence

**Problem.** A customer file stored by the portal cannot be opened by an authorised reviewer.

**Reproduction.**

1. After fix 1, submit a synthetic PDF through the portal.
2. Confirm a `compliance_evidence_versions` row and a private object exist.
3. Open the Compliance Centre. The decision panel has no file action. Its copy says it does not preview identity documents.
4. Call `GET /api/clients/{clientId}/compliance/cases/{caseId}/documents/{evidenceId}`. That route reads `compliance_document_requirements`, not `compliance_evidence_versions`, and returns 404.

**Root cause.** `publicInvitationAction` writes `compliance_evidence_versions` through `putPrivateDocument`. Nothing reads that storage key back. `signComplianceDocument` serves the older document table.

**Affected service.** `publicInvitationAction`, `signComplianceDocument`, `ComplianceCentre.tsx`.

**Database impact.** Evidence rows would accumulate with `scan_status = unscanned` and no access event.

**Proposed fix.** Add a tenant-scoped download for an evidence version: same organisation, case visibility, private key prefix `clients/{clientId}/compliance/{caseId}/`, short-lived URL, and a `DOCUMENT_ACCESSED` event that does not include the file bytes in the log. Show the filename and version on the decision panel. Do not put the storage key in the centre list payload.

**Security.** Reject another organisation’s id, another case’s evidence id, and any key that does not start with the case prefix. Do not mark the requirement verified because the file opened.

**Tests.** Authorised reviewer receives a URL. Salesperson without review permission does not. A second organisation receives 404. The event row contains no document bytes.

**Dependencies.** Fix 1, so a synthetic file can be stored in a test organisation. Private document bucket must be configured in that environment. Confirm the download uses the same bucket as `putPrivateDocument`.

## 3. P1 — Correction does not give the customer a way back

**Problem.** Request changes updates the requirement and creates a work item. The customer is not invited to replace the file, and a submitted link is closed.

**Reproduction.**

1. Submit a requirement so its state is `submitted`.
2. As an independent manager, post `action: "decide"`, `decision: "request_changes"`, with a reason.
3. Observe a work item and state `more_information_required`.
4. Observe no new `compliance_invitations` row and no email.
5. The panel’s request button always sends `purpose: "submission"`.

**Root cause.** `decideRequirement` only inserts `compliance_work_items`. `ContextCompliancePanel` hardcodes `purpose: "submission"`. `invitationAccess` rejects status `submitted`.

**Affected service.** `decideRequirement`, `createDocumentInvitation`.

**Database impact.** The previous evidence version remains, which is correct, but the customer cannot add the next version.

**Proposed fix.** When changes are requested, create a correction invitation for the affected requirement keys, revoke or leave the old submitted invitation closed, and email the code only to the contact email. The portal already changes its heading when `purpose` is `correction`. Keep the reason shown to the customer free of internal risk notes. The reviewer reason stored on the case must not be copied verbatim if it can contain AML commentary. Use a separate customer-facing sentence.

**Security.** A correction link must be bound to the same case and the same requirement keys. It must not list other documents on the case.

**Tests.** Request changes creates one correction invitation. The old token stays closed. The new token accepts a replacement and increments `version_number`. The previous version remains. An unrelated requirement key is ignored.

**Dependencies.** Fixes 1 and 2.

## 4. P1 — A phone-only contact gets a dead invitation

**Problem.** The invitation row is stored even when no code can be sent. Production already has one invitation with a phone, no email, status `created`, and `sent_at` null.

**Reproduction.**

1. Open a checklist for a contact with a phone and a null email.
2. Request documents.
3. The API creates `compliance_invitations` and `deliverInvitationCode` returns `delivered: false`, reason `OTP_DELIVERY_UNAVAILABLE`.
4. The customer has no code. Continue on the link calls `send_code` and fails the same way.

**Root cause.** `createDocumentInvitation` inserts before delivery. Delivery requires `recipient_email`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`.

**Affected service.** `createDocumentInvitation`, `deliverInvitationCode`.

**Database impact.** An open invitation that cannot be used. The production row should be left as it is until the agency decides to revoke it. Do not email a real customer as part of the fix.

**Proposed fix.** If the contact has no email, return 400 before insert and tell the agent to add an email. If Resend is not configured, return 503 before insert. Keep SMS and WhatsApp unimplemented until a provider is actually connected. Do not treat a sent email as identity verification.

**Security.** The error must not include the contact’s phone number in a public response. The agent response can say “This contact has no email.”

**Tests.** No email means no invitation row. Email plus a mocked provider creates one row and one session. A second request does not leave two active codes without expiring the first, or the test states the current behaviour if multiple sessions are allowed.

**Dependencies.** None.

## 5. P2 — Payment evidence can be marked submitted without a file

**Problem.** “Record evidence submitted” sets `payment_evidence_status` to `proof_uploaded` with no object stored. Other statuses skip `canTransitionPayment` when the caller is a manager.

**Reproduction.**

1. Sign in as a manager in a test organisation.
2. On a transaction, use the payment control that posts `{ action: "payment", next: "proof_uploaded" }`.
3. The transaction column changes. No evidence row is created.
4. As a manager, post `next: "under_verification"` from `reported`. The update is not refused by `canTransitionPayment`.

**Root cause.** `recordPaymentEvidence` special-cases only `proof_uploaded` and `independently_confirmed`.

**Affected service.** `recordPaymentEvidence`. UI: `ContextCompliancePanel.tsx`.

**Database impact.** `real_estate_transactions.payment_evidence_status` only.

**Proposed fix.** Require `canTransitionPayment` for every change. Require a stored payment file, or rename the action so it cannot be read as “file received,” before `proof_uploaded`. Keep the rule that an agent cannot set `independently_confirmed`.

**Security.** Confirmation stays with `compliance.finance`, which today is every manager. If finance must be a different person, split that permission off the default manager profile in the same change and say so.

**Tests.** Reported to proof without a file is rejected. Reported to confirmed is rejected. Proof to under verification to confirmed succeeds for a finance-capable user and fails for a salesperson. A double submit with a stale current status returns 409.

**Dependencies.** A test transaction. Do not use a live sale.

## 6. P2 — Submit can mark a case ready when nothing was submitted

**Problem.** `submit` sets status `ready_for_review` for an in-progress case even if no file and no field changed a requirement to `submitted`. The queue will not show it.

**Reproduction.** After fix 1, open a verified link, leave documents empty, and submit. Inspect `compliance_cases.status` and the centre queue.

**Root cause.** The status update in `publicInvitationAction` is not tied to a requirement moving to `submitted`.

**Proposed fix.** Set `ready_for_review` only when at least one in-scope requirement is `submitted`. If required fields or required files are missing, return 400 and leave the invitation `in_progress`.

**Database impact.** Case status and readiness.

**Tests.** Empty submit stays in progress. A submit with one required file appears in the queue as `submitted`, not `verified`.

**Dependencies.** Fix 1.

## 7. P2 — Unassigned cases are visible to every salesperson

**Problem.** `canSeeCase` returns true for a salesperson when both agent ids are null.

**Reproduction.** Code inspection of `canSeeCase` in `lib/real-estate/compliance-management/service.ts`. Not executed with two agent sessions.

**Proposed fix.** A salesperson sees a case only when `buyer_agent_id` or `listing_agent_id` is their user id. Managers keep organisation scope.

**Tests.** Two salespeople, one assigned case, the other receives 404. A manager in the same organisation can read it. Another organisation cannot.

**Dependencies.** Two synthetic users.

## 8. P2 — Scanning is not connected

**Problem.** Evidence is stored as `unscanned` and would become downloadable once fix 2 exists.

**Proposed fix.** Until a scanner is integrated, show “Not scanned” on the reviewer panel and do not describe the file as safe. If the security design requires quarantine, block download until `scan_status` is `clean` and fail closed when the scanner is down.

**Tests.** A clean status can be downloaded by a reviewer. `infected` and `unscanned` follow the chosen policy, and the test asserts that policy explicitly.

**Dependencies.** Fix 2. A scanner vendor is a separate decision.

## 9. P2 — Company parties are a text field

**Problem.** Company buyer and seller templates collect a beneficial-owner name on `cdd_profile`. They do not create `compliance_related_parties` rows for directors or owners. The older CDD tests describe a different structure.

**Proposed fix.** Decide which model is authoritative. If related parties are required, write one row per owner from the portal and show those rows to the reviewer. Do not claim the older corporate CDD is complete because the new template has a company label.

**Tests.** A company submission with two owners stores two party rows on that case only.

**Dependencies.** Fixes 1 and 2.

## 10. P3 — Public API referrer header

**Problem.** The production 404 from `POST /api/public/compliance-invitations` was observed with `Referrer-Policy: strict-origin-when-cross-origin`. The HTML page correctly sent `no-referrer`.

**Proposed fix.** Confirm middleware headers survive the route response on Vercel. Assert `no-referrer` on the public API response.

**Dependencies.** None.

## 11. Do not do these as part of the repair

- Do not activate `listing_publication` or `allow_reuse` on production. There are zero policy versions. The templates are not a legal sign-off.
- Do not approve the existing production buyer case.
- Do not revoke that invitation until the agency asks. It is undelivered and still unexpired.
- Do not point the portal at the public media bucket.
- Do not treat a passed unit test as a completed journey.

## Suggested order

1. Session cookie.
2. Evidence download.
3. Correction invitation.
4. Refuse undeliverable invitations.
5. Payment file and transition checks.
6. Ready-for-review only after a real submission.
7. Salesperson assignment scope.
8. Scan policy.
9. Company party records.
10. Referrer header.

After 1–4, rerun journeys 1, 2, 5, and 6 in `COMPLIANCE_E2E_TEST_RESULTS.md` on a non-production organisation. Journey 3 still needs a written policy decision before enforcement is turned on. Journey 4 needs a synthetic accepted offer.
