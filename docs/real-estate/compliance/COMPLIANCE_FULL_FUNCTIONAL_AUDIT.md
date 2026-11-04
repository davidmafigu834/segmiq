# SegmiQ Real Estate compliance — full functional audit

Audit date: 4 November 2026 (probes at 23:09 UTC on 3 November 2026).

This is an evidence audit. It does not change production data, activate a policy, approve a case, or deploy code.

## 1. Executive summary

The compliance screens, APIs, and database tables are present on production. A salesperson can be sent to a login wall, an unknown customer link is rejected, and the database does not let the public or signed-in Supabase roles read the compliance tables directly.

The agency workflow does not complete.

A customer who receives a code cannot save or submit. The session cookie is limited to `/verify`, and the form posts to `/api/public/compliance-invitations`, so the browser will not send that cookie. Files stored by that portal are written to `compliance_evidence_versions` and there is no reviewer download for those rows. The Compliance Centre states that it does not preview identity documents. A correction does not send the customer back to a replacement form. A contact with a phone number and no email gets an invitation row that is never sent. Production already has one invitation in that state.

Checklist text is a starting point. It is not a signed legal policy. Listing publication is not blocked by compliance, because no organisation has an active listing-readiness policy. That matches the code, and it means an approved listing can still be marketed while compliance is incomplete.

**Verdict: PARTIALLY FUNCTIONAL.** Core screens and guards exist. The buyer, seller, document, review, and correction journeys cannot be completed safely for a real agency.

## 2. Audit environment

| Item | Evidence |
| --- | --- |
| Local git revision | `5392d03` — “Show published listing photographs on the public property page.” Compliance commit `98f19e7` is its parent. |
| Production host | `https://www.segmiq.com` on Vercel. Deployment id observed on the verify page: `dpl_HcEXfALyodeD41rs64CzMRXnT3pZ`. The exact git SHA of that Vercel build was not read from Vercel. |
| Database | Supabase project `gnnqzboaeezzevlwwryp`. Migrations present: `20261006083107 real_estate_compliance`, `20261103182852 re_compliance_management_foundation`. |
| Automated tests | `tests/compliance-management.test.ts`, `tests/compliance-copy.test.ts`, `tests/real-estate-compliance.test.ts`. 47 passed, 0 failed. These tests do not call the database or a browser. |
| Signed-in agency session | Not available. No synthetic organisation was created. No production case was opened, approved, rejected, or uploaded to. |
| Browser | Production page `https://www.segmiq.com/verify/c/abcdefghijklmnopqrstuvwxyz012345`. Continue was clicked. The page showed “This request is not available.” |

## 3. What was not done

- No live customer identity, identity document, or bank file was uploaded.
- No production case was approved, rejected, or escalated.
- No policy was saved or activated.
- No migration was applied.
- RLS was not disabled.
- Authenticated cross-organisation requests were not sent, because that needs two real sessions.
- Mobile, WhatsApp, and the existing lead-task product were not exercised.

## 4. Implementation inventory

| Surface | Where it lives |
| --- | --- |
| Agent page | `app/sales/compliance/page.tsx`, nav item in `lib/sales/navigation/sales-nav-config.ts` |
| Manager centre | `app/client/compliance/centre/page.tsx`, `components/real-estate/compliance/ComplianceCentre.tsx` |
| Older case workspace | `app/client/compliance/page.tsx`, `ComplianceWorkspace.tsx`, `ComplianceCasePanel.tsx` |
| Buyer | `BuyerSearchDetail.tsx` mounts `ContextCompliancePanel` with `context="buyer"` |
| Seller | `AcquisitionLists.tsx` mounts the panel when the owner contact is linked |
| Property | `ListingDetailView.tsx` mounts the panel with `context="property"` |
| Transaction | `TransactionOperations.tsx` mounts the panel with `context="transaction"` |
| Customer form | `app/verify/c/[token]/page.tsx`, `PublicSubmissionPortal.tsx` |
| Centre and subject APIs | `app/api/clients/[clientId]/compliance/centre/route.ts`, `subjects/route.ts` |
| Older case and file APIs | `cases/route.ts`, `cases/[caseId]/route.ts`, `documents/[docId]/route.ts` |
| Public invitation API | `app/api/public/compliance-invitations/route.ts` |
| Mobile summary | `app/api/sales/app/compliance/route.ts` |
| Rules | `lib/real-estate/compliance-management/engine.ts` |
| Persistence | `lib/real-estate/compliance-management/service.ts` |
| Older CDD service | `lib/real-estate/compliance-service.ts` |
| Listing extra gate | `lib/real-estate/compliance-management/publication.ts` |
| Tables | `compliance_cases`, `compliance_case_requirements`, `compliance_evidence_versions`, `compliance_invitations`, `compliance_invitation_sessions`, `compliance_policy_versions`, `compliance_work_items`, `compliance_case_events`, `compliance_document_requirements`, `compliance_related_parties` |
| Decision function | `compliance_requirement_decide_atomic` |
| Evidence retention | `compliance_prevent_evidence_delete` |

The phase-1 docs under `docs/real-estate/compliance/` describe this shape. They overstate production readiness. `phase-1-feature-matrix.md` still says the web app is not deployed. The routes now answer on `www.segmiq.com`. The matrix’s “tested” column is unit and UI wiring, not a completed agency journey.

## 5. Production data observed (read-only, no personal data)

| Record | State |
| --- | --- |
| Cases | 1. Context `buyer`, status `not_started`, readiness `not_started`, entity `individual`, `policy_enforced` false. |
| Requirements | 9, all `not_started`. |
| Invitations | 1. Purpose `submission`, status `created`, no email, phone present, `sent_at` null, `submitted_at` null, not revoked, not expired. |
| Evidence versions | 0. |
| Policy versions | 0. |
| Work items | 1. |
| Legacy document rows | 0. |
| Events | `CASE_CREATED`, `INVITATION_CREATED`. Neither is confidential. |

That invitation cannot receive the email code. `deliverInvitationCode` returns `OTP_DELIVERY_UNAVAILABLE` when the contact has no email or Resend is unset. The row was still inserted.

Transaction columns `legal_route`, `compliance_readiness`, `legal_transfer_status`, `payment_evidence_status`, and `compliance_case_id` exist.

## 6. Working functionality

These were executed or proven from the database privileges, not inferred from a file name.

- `GET /sales/compliance` on production returns 307 to `/login?callbackUrl=%2Fsales%2Fcompliance`.
- `GET /client/compliance/centre` returns 307 to the login page.
- `GET /api/clients/00000000-0000-0000-0000-000000000000/compliance/centre` with no session returns 401 `{"error":"Unauthorized"}`.
- `POST /api/public/compliance-invitations` with an unknown token returns 404 `{"error":"This request is not available."}`.
- The same unknown link in the browser shows that sentence after Continue. It does not show another customer’s name, documents, or requirements.
- `GET /dev/compliance-preview` on production returns 404. The sample form is not public.
- The verify HTML response sends `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, and `Cache-Control: no-store`.
- `anon` and `authenticated` do not have `SELECT` on `compliance_cases` or `compliance_evidence_versions`, and `anon` cannot execute the decision function.
- RLS is enabled on every compliance table inspected. Each has zero policies. Access is through the service role after the application checks the session.
- Unit tests pass for: an agent cannot verify, an upload does not verify, payment proof is not confirmation, handover and a completed sale are not registration, expired or revoked invitations fail the pure function, and a title-deed item is not applied to a cession route.
- The decision function in the database refuses a stale `expected_state` with `RE409` and refuses a non-independent verify, waive, or reject.

## 7. Partially functional

- Buyer, seller, property, and transaction panels call real endpoints (`/api/clients/[clientId]/compliance/subjects` and `/centre`). Opening a case, seeding requirements, and inviting are implemented. They were not executed with a signed-in user.
- Individual and company checklists are different templates in `POLICY_TEMPLATES`. The panel has an Individual / Company control. Opening an existing case returns that case and does not reseed when the control changes.
- Company beneficial owners are a profile field on the new portal. The new service does not write `compliance_related_parties`. The older CDD tests expect director and owner rows. Those two models are not the same workflow.
- Commercial stage, compliance readiness, and legal transfer are separate columns. The transaction summary says a completed sale is not a registered transfer. `recordLegalMilestone` rejects `keys_handed_over` as legal confirmation. This was not executed against a transaction.
- Listing marketing uses the existing approval gate unless an active `listing_readiness` policy has `listing_publication: true`. Production has zero policy versions, so compliance does not block publication. That is the coded fail-open behaviour. It was not tested by activating a policy.
- Payment confirmation cannot jump from “reported” to “independently confirmed” in `confirmPayment`. A manager can still set `proof_uploaded` with no file, and other payment values are written without `canTransitionPayment`.
- Escalation inserts an in-app `COMPLIANCE_ALERT` for users with `can_review_compliance`. Other events do not notify.
- Work items can be marked done. `completeWorkItem` returns `verifiedRequirement: false`. They are not the lead-task list.
- Audit rows store a short summary. Agents do not receive identity numbers from `maskProfileForAgent`. This masking was unit-tested, not observed in a signed-in session.
- Templates carry `TEMPLATE_DISCLAIMER`. They are not a legal determination.

## 8. Broken functionality

### Customer form cannot stay signed in

`app/api/public/compliance-invitations/route.ts` sets cookie `sq_cv` with `path: "/verify"`. `PublicSubmissionPortal` posts to `/api/public/compliance-invitations` with `credentials: "include"`. A cookie scoped to `/verify` is not sent to `/api`. `publicInvitationAction` then requires `sessionId` to equal the verified session row before `save` or `submit`. After a correct code, save and submit return 401 “Verify your code before continuing.”

This was not reproduced with a live code, because that would use a real invitation. The cookie path and the check are both in the current source, and the production route is the one that was probed.

### Reviewers cannot open portal files

`publicInvitationAction` inserts `compliance_evidence_versions` and calls `putPrivateDocument`. The only reads of that table are a version count before the next insert. `signComplianceDocument` reads `compliance_document_requirements`, a different table. The centre copy says: “This panel records the decision. It does not preview identity documents.” Production has zero evidence rows, so no orphan file was found, and no reviewer retrieval was possible to demonstrate with a file. There is no implemented retrieval.

### Corrections do not return the customer to the form

`decideRequirement` with `request_changes` writes a work item titled “Follow up on the requested correction.” It does not create an invitation, send email, or reopen the previous link. The panel always posts `purpose: "submission"`. The service accepts `purpose: "correction"`, and the portal changes its heading for that purpose, but no screen sends it. A submitted invitation is closed by `invitationAccess`.

### Phone-only requests are created and not delivered

The production invitation has a phone, no email, status `created`, and no `sent_at`. The code creates the row first, then returns `OTP_DELIVERY_UNAVAILABLE` when email or Resend is missing. There is no SMS or WhatsApp substitute. The customer cannot open the form.

### Empty submit can mark a case ready

If the session check were fixed, `submit` still sets the case to `ready_for_review` when the status is `in_progress`, `awaiting_documents`, or `more_information_required`, even when no file was stored. The queue only lists requirements in `submitted`, `under_review`, or `more_information_required`. A case can say it is ready while the queue stays empty.

### Malware scanning is not connected

Portal inserts use `scan_status: "unscanned"`. No scanner, quarantine, or block-on-unscanned check exists.

## 9. Security findings

| ID | Severity | Finding |
| --- | --- | --- |
| S1 | P1 | Customer session cookie cannot authorise the public API. The form fails after the code, and a future workaround that puts the session id in the page URL would be worse. The fix is a cookie path that covers the API, or an httpOnly cookie on `/`. |
| S2 | P1 | Portal files have no authorised read path. A stored identity document that cannot be reviewed will tempt staff to move files into chat or email. |
| S3 | P1 | The live invitation was issued to a phone-only contact and was never sent. Possession of a later link would still require the email code, but the link is dead for the intended recipient. OTP proves mailbox access, not government identity. The portal copy says that. |
| S4 | P2 | `canSeeCase` treats a case with no `buyer_agent_id` and no `listing_agent_id` as visible to every salesperson in the organisation. |
| S5 | P2 | Finance and conveyancing permissions are held by `CLIENT_MANAGER` together. There is no separate finance or conveyancer role. A manager who did not create the case can confirm payment and record registration. |
| S6 | P2 | `recordPaymentEvidence` enforces the state machine for `proof_uploaded` and `independently_confirmed` only. A manager request can write another payment status from the current row without `canTransitionPayment`. |
| S7 | P3 | The public API 404 observed on production carried `Referrer-Policy: strict-origin-when-cross-origin`. The HTML page correctly used `no-referrer`. The token is in the page path, so the page policy is the one that matters. The error body did not echo the token. |
| S8 | — | Invalid tokens do not reveal whether a different token exists. The same 404 text is used. |
| S9 | — | Decision writes go through `compliance_requirement_decide_atomic`, which is not executable by `anon`. The function checks expected state and independent review. |
| S10 | — | Service-role access bypasses RLS. Tenant isolation is the application `client_id` filter plus `requireClientDataAccess`. Unauthenticated access was denied. A signed-in user from another organisation was not tested. |

No P0 cross-organisation document leak was demonstrated. It also was not ruled out with two live organisations.

## 10. Database findings

- Foundation migration is applied. The decision function and the evidence-delete trigger exist.
- RLS is on and there are no policies. Grants to `anon` and `authenticated` were not present for the privileges checked.
- Unique open-case indexes exist in the migration for buyer, seller, and property. They were not stress-tested.
- The one production case, its nine requirements, its unsent invitation, and its two events are consistent with “opened, then invited, then delivery stopped.”
- No orphan evidence row exists because none were stored.
- `compliance_related_parties` exists and is unused by the new portal.
- Two document models coexist: `compliance_document_requirements` (older staff upload and signed download) and `compliance_evidence_versions` (portal). They are not linked.

## 11. UI findings

Production customer page, unknown token, desktop width used by the browser tool:

- The page renders without a session.
- Continue calls the API and shows “This request is not available.”
- The three step lines remain on screen after the error.
- Copy does not claim that a successful OTP verifies identity.

Not viewed while signed in, so these were not clicked on production: Compliance Centre queue, verify, request changes, policy save, buyer panel, seller sheet, listing panel, transaction panel, file picker, or pagination. The centre component searches the rows already loaded. It does not paginate. It does not show overdue or approved totals. Counts are `pendingReviews`, `changesRequested`, and `escalated` from the loaded requirement rows.

Responsive widths 360, 390, 430, 768, 1024, and 1440 were not measured in this audit. Authenticated layout was not opened.

## 12. Backend integration findings

| Module | Connection |
| --- | --- |
| Buyers, sellers, listings, transactions | Panels are mounted and call the subject API. Not executed signed-in. |
| Listing approval | Unchanged. Compliance adds a block only after an active listing policy. None is active. |
| Public property pages | Do not read compliance evidence tables. Private marketing photos use a different path. This audit did not re-test a public listing for a leaked compliance file. |
| Offers | A transaction case is reused from `offer_id` when one already exists. Not executed. |
| Leads, viewings, WhatsApp | No compliance submission or decision writes those products. Invitation email is the only customer message, and only when Resend and an email exist. |
| Tasks | `compliance_work_items` is separate. Completing one does not verify a requirement. |
| Notifications | Escalation only, in-app, to flagged reviewers. |
| Older CDD gate | `assertComplianceProgressAllowed` still exists for accepted-offer progression. This audit did not run a sale through it. |

## 13. End-to-end evidence

See `COMPLIANCE_E2E_TEST_RESULTS.md`. None of the six journeys passed. Journeys 1, 2, and 5 fail on the customer session and the missing reviewer file path. Journey 3 is blocked because activating publication enforcement would change production policy. Journey 4 was not run. Journey 6 passed only for a user with no session and for direct database privileges.

## 14. Production deployment status

| Layer | State |
| --- | --- |
| Local source | Implemented at `5392d03`, including the compliance commit. |
| Unit tests | 47 passed in this audit. |
| Integration tests against the database | Not run. |
| Browser, signed out | Invalid invitation and login redirects verified on production. |
| Browser, signed in | Not verified. |
| Staging | No separate staging host was identified. |
| Production routes | Deployed. Login redirects, 401, 404 for an unknown invitation, and 404 for the dev preview were observed. |
| Production workflow | Not verified, and blocked by the defects above. |
| Database | Foundation migration applied. One unfinished buyer case exists. |

## 15. Recommended fixes

Ordered in `COMPLIANCE_REMEDIATION_PLAN.md`.

1. Make the verified customer session reach save and submit.
2. Let an authorised reviewer open portal evidence, with an audit event and a short-lived link.
3. Send a correction invitation and do not leave the customer on a closed link.
4. Do not create an invitation that cannot be delivered. Say so before the row is stored.
5. Require a stored file before payment evidence is “submitted,” and apply the payment state machine to every change.
6. Do not mark a case ready for review when nothing was submitted.
7. Keep listing enforcement off until a named person approves a policy version.
8. Add a non-production organisation before any write-path test.

## 16. Final readiness verdict

**PARTIALLY FUNCTIONAL.**

The system is not ready for a real estate agency to collect identity documents, review them, request a correction, and rely on the result. The parts that were actually exercised — login walls, an unknown link, database privileges, and the pure rules — behave as intended. Those parts are not the workflow.

## 17. Remediation verification — 4 November 2026

The confirmed defects were repaired in the local source after this audit. Production data was not changed, the new `customer_message` migration was not applied, and listing enforcement was not activated.

| Original finding | Code change | What was proven |
| --- | --- | --- |
| Session cookie path `/verify` | Cookie path is `/`, httpOnly, Secure in production, SameSite Lax | Path-prefix test plus the route no longer contains `path: "/verify"`. No live OTP was entered. |
| Reviewer could not open portal files | New evidence list and open routes. Bytes are returned only when `scan_status` is `clean` | Unit test: unscanned and quarantined refuse bytes. No file was stored. |
| No correction invitation | Request changes creates a correction invitation and emails the customer-facing reason | Replacement rule is unit-tested. No mailbox received a message. |
| Phone-only invitation row | Email and provider are checked before insert | Unit test of the precheck. The existing production invitation was not deleted. |
| Empty submit marked ready | Submit advances only when required in-scope items are present. Save does not advance | Unit test. No case row was updated. |
| Payment status without a file | Every transition uses the payment state machine. Proof requires a stored payment file | Unit test. No transaction was updated. |
| Unassigned case visible to every salesperson | A salesperson must be `buyer_agent_id` or `listing_agent_id` | Unit test. Two live agent sessions were not used. |
| Company owners were one text field | Portal collects one name per line and the service writes `compliance_related_parties` | Unit test of the party parser. No company case was saved. |

55 compliance tests passed, including the 8 new regression tests. That is not an end-to-end journey.

The reviewer still cannot open a newly uploaded file, because no malware scanner is connected and unscanned files stay quarantined. That is intentional. It remains an activation blocker.

No isolated test organisation, synthetic mailbox, or private test bucket was available, so journeys A–G were not executed against a database. Production remains the audited behaviour until this source is deployed and the migration is applied.
