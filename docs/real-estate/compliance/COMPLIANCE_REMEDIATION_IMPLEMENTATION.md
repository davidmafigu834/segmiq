# Compliance remediation implementation

Date: 4 November 2026. Production was not deployed and production rows were not modified.

## 1. Customer verification session

- **Original finding.** Cookie path `/verify` was not sent to `/api/public/compliance-invitations`.
- **Root cause.** `app/api/public/compliance-invitations/route.ts` set `path: "/verify"`.
- **Fix.** `invitationSessionCookieOptions` uses path `/`, httpOnly, SameSite Lax, and Secure in production. The session id is still removed from the JSON body.
- **Files.** `lib/real-estate/compliance-management/remediation.ts`, `app/api/public/compliance-invitations/route.ts`.
- **Tests.** Cookie path-prefix test and a source check that the route no longer hardcodes `/verify`.
- **Runtime.** Not executed with a live code. A browser did not save and submit.
- **Blocker.** Needs a non-production invitation and a mailbox.

## 2. Reviewer evidence access

- **Original finding.** Portal writes `compliance_evidence_versions`. The older download reads `compliance_document_requirements`.
- **Root cause.** Two stores, and the new store had no reader.
- **Fix.** `listCaseEvidence` and `openCaseEvidence`. The list has filename, version, date, and scan status, and no storage key. Bytes are signed for 300 seconds only when `scan_status` is `clean`. Unscanned and quarantined files return 403 `EVIDENCE_QUARANTINED` and an audit event that does not include the file. The older document route is unchanged.
- **Files.** `service.ts`, `app/api/clients/[clientId]/compliance/cases/[caseId]/evidence/route.ts`, `evidence/[evidenceId]/route.ts`, `ComplianceCentre.tsx`.
- **Security.** Review permission, organisation, case visibility, case id on the row, and the key prefix `clients/{clientId}/compliance/{caseId}/` are checked before a URL is signed.
- **Tests.** Unscanned and quarantined decisions refuse bytes. Clean allows them.
- **Runtime.** No object was uploaded. A reviewer did not open a file.
- **Blocker.** No malware scanner is connected, so a new upload stays `unscanned` and cannot be opened.

## 3. Correction loop

- **Original finding.** Request changes created a work item and closed the submitted link.
- **Root cause.** `decideRequirement` did not create an invitation. The panel always used purpose `submission`.
- **Fix.** After a saved request-changes decision, the service creates a correction invitation for that requirement. The customer email contains the reviewer reason, which the screen describes as the customer-facing sentence. A second request for the same open scope revokes the previous open invitation before creating the next one. Older unused codes on that invitation are expired when a new code is sent.
- **Files.** `service.ts`, `ComplianceCentre.tsx`.
- **Tests.** `replaceOpenInvitation` returns `replace` for an open invite and `create` after submit.
- **Runtime.** No correction email was sent.
- **Blocker.** Mailbox and a signed-in reviewer.

## 4. Phone-only invitations

- **Original finding.** A row was created when the contact had a phone and no email.
- **Root cause.** Insert happened before the delivery check.
- **Fix.** `invitationDeliveryPrecheck` runs first. Missing email returns 400: "This contact needs an email address before a secure verification request can be sent." Missing Resend configuration returns 503 and does not insert. Provider failure after insert leaves status `created`; the next request revokes that open row and sends a new code. SMS and WhatsApp were not added.
- **Files.** `remediation.ts`, `service.ts`, `ContextCompliancePanel.tsx`.
- **Tests.** Precheck statuses.
- **Runtime.** The existing production invitation was not revoked.
- **Blocker.** A controlled inbox for the success path.

## 5. Empty submission

- **Original finding.** Submit could set `ready_for_review` with nothing submitted.
- **Root cause.** The case update was not tied to requirement updates.
- **Fix.** `submissionDecision` rejects a submit that misses a mandatory in-scope item. Save stores fields and files but does not move requirement state or case readiness. A real submit moves only the completed requirements to `submitted` and then marks the case ready. Upload still does not verify.
- **Files.** `remediation.ts`, `service.ts`.
- **Tests.** Empty submit fails. Save does not advance. A name plus a file advances.
- **Runtime.** No case was submitted.

## 6. Payment evidence

- **Original finding.** `proof_uploaded` did not need a file, and some statuses skipped `canTransitionPayment`.
- **Root cause.** Only two target statuses were special-cased.
- **Fix.** `paymentStatusChange` checks every transition. Proof requires an evidence row on the `payment_evidence` requirement. Confirmation still cannot jump from reported, and a salesperson cannot confirm. The transaction screen uploads a file instead of setting the status alone. The stored file remains unscanned.
- **Files.** `remediation.ts`, `service.ts`, `payment-evidence/route.ts`, `ContextCompliancePanel.tsx`.
- **Tests.** Bare proof is rejected. Stored proof is allowed. Reported cannot become confirmed. An agent cannot confirm.
- **Runtime.** No transaction was updated.

## 7. Salesperson visibility

- **Original finding.** A null agent id made the case visible to every salesperson.
- **Root cause.** `canSeeCase` treated a missing owner as public inside the organisation.
- **Fix.** `salespersonMaySeeCase` requires the actor to be `buyer_agent_id` or `listing_agent_id`, unless the actor is organisation-wide (manager, reviewer, or a non-salesperson with audit).
- **Files.** `remediation.ts`, `service.ts`.
- **Tests.** Assigned agent allowed. Other agent denied. Unassigned denied. Organisation-wide allowed.
- **Runtime.** Two agent tokens were not used.

## 8. Company parties

- **Original finding.** Beneficial owners were not written to `compliance_related_parties`.
- **Root cause.** The portal had a single profile field and the company template's party requirements were not rendered as names.
- **Fix.** The portal asks for one name per line for party requirements. Submit inserts director, beneficial owner, and representative rows, skipping a duplicate name and type on the same case. A party requirement is complete only when a matching row is present.
- **Files.** `PublicSubmissionPortal.tsx`, `remediation.ts`, `service.ts`.
- **Tests.** Two directors and two owners stay separate.
- **Runtime.** No rows were inserted.

## 9. Queue, notifications, and policy

- The review queue requests 25 rows at a time and returns `hasMore`. Counts on the page are the visible rows, not a separate organisation total.
- A ready submission inserts an in-app notification for users with `can_review_compliance`. The text does not include a document or an identity number. Email delivery of that alert was not observed.
- Completing a work item still returns `verifiedRequirement: false`.
- Listing publication enforcement and reuse were not activated. There are still no production policy versions from this change.
- `supabase/migrations/20261104013000_re_compliance_customer_message.sql` adds `customer_message`. It was not applied. Until it is applied, the correction sentence is in the email and the portal falls back when the column is missing.

## Deployment status

Local source only. Not deployed. Production behaviour remains the audited behaviour until a controlled release.
