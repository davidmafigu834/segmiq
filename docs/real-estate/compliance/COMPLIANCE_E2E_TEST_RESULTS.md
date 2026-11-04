# SegmiQ Real Estate compliance — end-to-end results

Audit date: 4 November 2026.

No synthetic organisation was available. Production was not used as a write fixture. No customer name, phone number, email address, identity number, or document is recorded here.

## Shared preconditions

| Item | Value |
| --- | --- |
| Source | Local `5392d03` |
| Production app | `https://www.segmiq.com`, Vercel deployment `dpl_HcEXfALyodeD41rs64CzMRXnT3pZ` observed on the verify response |
| Database | `gnnqzboaeezzevlwwryp`, foundation migration `20261103182852` |
| Test organisation | None |
| Synthetic actors | None created |
| Existing production data, read only | 1 buyer case, status `not_started`, 9 requirements all `not_started`, 1 submission invitation status `created`, no email, phone present, not sent, not submitted, 0 evidence files, 0 policy versions, events `CASE_CREATED` and `INVITATION_CREATED` |
| Unit tests | 47 passed, 0 failed, across `tests/compliance-management.test.ts`, `tests/compliance-copy.test.ts`, and `tests/real-estate-compliance.test.ts` |

## Journey 1 — Buyer KYC

**Result: FAIL.**

**Steps performed.**

- Confirmed the buyer screen mounts `ContextCompliancePanel` with the buyer contact.
- Read the open, invite, submit, and decide services.
- Read production counts. The only case is an individual buyer that has not started, with an invitation that was never sent.
- Did not sign in, did not open that case, and did not submit a document.

**Expected.** Agent opens the buyer, sends a link, the buyer submits, a reviewer opens the file, approves it, and the buyer profile shows that decision.

**Actual.** The invitation path can create a row. Delivery does not run without an email. The session cookie cannot authorise save or submit. The stored portal file would have no reviewer download. The profile therefore cannot show a real decision from this journey.

**Untested.** Signed-in open checklist, field validation in a live form, duplicate case behaviour, and the profile badge after a decision.

## Journey 2 — Seller KYC

**Result: FAIL.**

**Steps performed.**

- Confirmed the seller sheet mounts the same panel for a linked contact.
- Confirmed `considerReuse` does not apply to a property or transaction and does not copy documents.
- Confirmed reuse requires an active policy with `allow_reuse`. Production has no policy version.

**Expected.** A seller request, a seller submission, a review, and an updated seller profile, without approving every property the seller owns.

**Actual.** The seller uses the same broken submission and evidence path as the buyer. Property evidence is a separate case only if a listing party link exists. That split was not executed. Reuse cannot approve properties automatically while no policy allows it. That refusal was not executed against two properties.

**Untested.** A seller with several properties, company seller party rows, and the profile after review.

## Journey 3 — Property readiness

**Result: BLOCKED.**

**Steps performed.**

- Read `listingCompliancePublication` and the listing-readiness template.
- Counted `compliance_policy_versions`: 0.
- Did not activate a policy and did not approve a listing.

**Expected.** An incomplete property is refused server-side when the organisation’s readiness policy is on. A completed checklist does not by itself publish the listing.

**Actual.** With no active policy, the function returns `inactive` and the existing listing approval gate remains. An incomplete property can still be marketed if that older approval allows it. The code does not call listing approval from a compliance decision. Completing compliance would not silently publish. The blocking behaviour was not turned on, because that would change production rules.

**Untested.** Draft and rejected listing links, withdrawal, and a public page after enforcement is on. Private compliance keys are not read by the public listing photo helper. A live page was not checked for a compliance file because no compliance file exists.

## Journey 4 — Transaction

**Result: NOT TESTED.**

**Steps performed.**

- Confirmed the transaction panel and the three columns `status`, `compliance_readiness`, and `legal_transfer_status`.
- Confirmed payment confirmation and handover rules in unit tests.
- Did not create an offer or transaction.

**Expected.** One transaction connects buyer, seller, property, offer, price, and route. Agreement, payment, conveyancing, and handover stay distinct. A cancelled transaction does not become a registered transfer.

**Actual.** Not executed. Unit tests passed for “upload is not verification,” “proof is not confirmation,” and “handover is not registration.” Those tests do not write a transaction.

**Untested.** Every stage in the journey, including cancellation while a clearance is open, double decision, and stale approval.

## Journey 5 — Correction

**Result: FAIL.**

**Steps performed.**

- Traced `request_changes` to a work item and a requirement state.
- Confirmed the panel only creates `purpose: "submission"`.
- Confirmed a submitted invitation is closed.
- Confirmed a later portal upload would insert another `compliance_evidence_versions` row and would not delete the previous row. The delete trigger exists. No file was uploaded, so version history was not observed.

**Expected.** Reviewer requests a change, the customer replaces the file, the old version remains, and the reviewer approves the new one.

**Actual.** There is no customer return path and no reviewer file view. The journey cannot be completed.

**Untested.** The approval click, the customer-facing wording of the reason, and a concurrent reviewer.

## Journey 6 — Permission boundary

**Result: PARTIAL.**

**Steps performed.**

- `GET` the centre API with no session. Response 401 `{"error":"Unauthorized"}`. No case payload.
- `POST` an unknown invitation token. Response 404 `{"error":"This request is not available."}`.
- Opened that URL in the browser and clicked Continue. The page showed the same sentence and no requirements.
- `GET /dev/compliance-preview` on production returned 404.
- Queried privileges: `anon` and `authenticated` cannot select `compliance_cases` or `compliance_evidence_versions`. `anon` cannot execute `compliance_requirement_decide_atomic`.
- Read the decision function: stale state and self-approval of verify, waive, and reject raise `RE409`.
- Did not sign in as a salesperson, manager, or second organisation.

**Expected.** An unauthorised user cannot read or decide, and the response does not leak another customer’s file.

**Actual.** That holds for no session, for an unknown token, and for direct database roles other than the service role. It was not shown for a signed-in user from another organisation, a salesperson opening a manager-only document, or an expired signed URL.

**Untested.** Cross-tenant session, salesperson versus manager on one case, expired download URL, and a customer token pointed at another case id. The token is the lookup key. The body does not accept a case id on the public route. That was read from the route, not attacked with two live invitations.

## Other checks

| Check | Result | Evidence |
| --- | --- | --- |
| Unit rules | PASS | 47 tests, 0 failures |
| Production routes exist | PASS | Login redirects and the public invitation route responded |
| Signed-in centre, queue, filters, decisions | NOT TESTED | No session |
| Responsive signed-in UI | NOT TESTED | Widths were not measured |
| Upload interrupted, double approve, two reviewers | NOT TESTED | Would write data |
| Mobile and WhatsApp | NOT TESTED | Not called |
| Malware scan | FAIL | No scanner; status would be `unscanned` |

## Remediation retest — 4 November 2026

The repairs were not run as live journeys. There is no separate test organisation, controlled mailbox, or scanner. Production records were not used as fixtures.

| Journey | Result after the code repair | What ran |
| --- | --- | --- |
| A. Individual buyer | NOT TESTED | Cookie path, empty-submit rule, and quarantine rule passed as unit tests |
| B. Seller | NOT TESTED | Same submission rules. No seller session |
| C. Correction | NOT TESTED | The decision path now calls a correction invitation. No email was accepted by a mailbox |
| D. Property | BLOCKED | Listing enforcement was not activated |
| E. Transaction | NOT TESTED | Payment transition rules passed as unit tests. No transaction was written |
| F. Security | PARTIAL | Original signed-out checks still stand. Quarantine refusal is unit-tested. Two organisations were not signed in |
| G. Company buyer | NOT TESTED | The party parser keeps two owners and two directors. Nothing was inserted |

55 tests passed: the previous 47 plus 8 regression tests in `tests/compliance-remediation.test.ts`.

## What would make the journeys retestable

Use one non-production organisation, two staff users, and two synthetic contacts with email addresses on a mailbox the test controls. Do not use the production buyer case. Apply fixes 1–4 in the remediation plan first, then repeat journeys 1, 2, 5, and 6. Journey 3 needs a written decision to activate enforcement. Journey 4 needs a synthetic accepted offer.
