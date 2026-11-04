# SegmiQ Real Estate compliance — audit matrix

Audit date: 4 November 2026. Results are for the production host `www.segmiq.com`, database project `gnnqzboaeezzevlwwryp`, and local source `5392d03`.

“Runtime tested” means this audit executed the behaviour. A unit test alone is not a pass for the feature.

| Feature | UI exists | Backend exists | Database connected | Permissions verified | Runtime tested | End-to-end tested | Production verified | Result | Evidence | Issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Signed-out access to agent and manager compliance pages | Yes | Yes | Not required | Signed-out only | Yes | No | Yes | PASS | 307 to `/login` for `/sales/compliance` and `/client/compliance/centre` | Signed-in pages were not opened |
| Signed-out Compliance Centre API | Yes | Yes | Not reached | Signed-out only | Yes | No | Yes | PASS | 401 `Unauthorized` on `GET /api/clients/{zero-uuid}/compliance/centre` | Cross-tenant session not tested |
| Unknown customer link | Yes | Yes | Lookup ran | Public route | Yes | No | Yes | PASS | Browser and `POST /api/public/compliance-invitations` both returned “This request is not available.” | Valid link was not used |
| Direct table access by anon and authenticated | No | Yes | Yes | Yes | Yes | No | Yes | PASS | `has_table_privilege` false for select; `has_function_privilege` false for the decision function; RLS on; 0 policies | Service role still bypasses RLS inside the app |
| Production sample form hidden | Yes locally | Yes | No | Yes | Yes | No | Yes | PASS | `GET /dev/compliance-preview` returned 404; sample mode is `NODE_ENV !== "production"` | None for this check |
| Buyer identity journey | Yes | Yes | Schema yes; one unfinished buyer case exists | Agent cannot review in unit tests only | No signed-in run | No | Routes only | FAIL | `ContextCompliancePanel` on `BuyerSearchDetail`; production case is `not_started` with an unsent invitation | Customer submit and reviewer file access are broken |
| Company buyer | Yes | Partial | Profile field only | Not live | No | No | No | PARTIAL | `company_purchaser` template; portal field `beneficial_owner_name`; no write to `compliance_related_parties` | Not the same as the older director/owner records |
| Seller identity journey | Yes | Yes | Schema yes | Unit tests only | No | No | No | FAIL | Seller panel in `AcquisitionLists.tsx` | Same submit and evidence gaps as the buyer |
| Seller reuse across properties | Yes, as a service | Yes | `reused_from_case_id` | Not live | No | No | No | PARTIAL | `considerReuse` refuses property and transaction contexts and requires `allow_reuse` | Zero active policies, so reuse cannot succeed today; documents are not copied |
| Property checklist | Yes | Yes | Schema yes | Not live | No | No | No | PARTIAL | `listing_readiness` template; seller must already be a listing party | Does not approve the listing |
| Listing publication block | No separate button | Yes | Policy table empty | Not live | Read-only | No | Observed inactive | PARTIAL | `listingCompliancePublication` returns `inactive` unless an active policy sets `listing_publication` | Incomplete compliance does not stop marketing until a policy is activated |
| Transaction case | Yes | Yes | Transaction columns exist | Not live | No | No | No | PARTIAL | Reuses a case by `offer_id`; summary returns commercial, readiness, and legal fields separately | Not executed |
| Three independent states | Yes | Yes | Columns exist | Not live | Unit only | No | Columns only | PARTIAL | Engine tests; `keys_handed_over` is rejected as legal confirmation | No transaction was moved through the states |
| Agreement of sale | Checklist row | Requirement seed | Not written | Not live | No | No | No | PARTIAL | Template says an upload is not a fully signed contract | No agreement file was stored or reviewed |
| Payment evidence | Yes | Yes | Column exists | Unit only | No | No | No | PARTIAL | `confirmPayment` blocks a jump to confirmed; UI can set `proof_uploaded` with no file | State machine is not applied to every requested status |
| Conveyancing milestones | Yes | Yes | Milestone table used by service | Manager permission in code | No | No | No | NOT TESTED | `recordLegalMilestone` | No milestone was written |
| Handover versus registration | Copy and a rejected key | Yes | Column exists | Unit only | Unit only | No | No | PARTIAL | `legalTransferAfterMilestone` leaves legal status unchanged for handover keys | Not executed on a transaction |
| Secure invitation lifecycle | Yes | Yes | One `created` row | Invalid token only | Partial | No | Partial | FAIL | Cookie `sq_cv` path is `/verify`; API is `/api/public/...`; production invite has phone, no email, `sent_at` null | Save/submit cannot see the session; phone-only delivery does not send |
| Portal document storage and review | File input | Write only | 0 evidence rows | Not live | No | No | No | FAIL | Insert into `compliance_evidence_versions`; no read API; centre text says it does not preview documents | A reviewer cannot open the customer’s file |
| Older staff document upload and signed URL | Yes, older panel | Yes | 0 legacy document rows | Code checks `client_id` and case visibility | No | No | No | NOT TESTED | `uploadComplianceDocument`, `signComplianceDocument` | Separate from the new portal |
| Correction loop | Request-changes dialog | Decision plus a work item | Not exercised | Unit reason check | No | No | No | FAIL | UI invite purpose is always `submission`; no email on request changes | Customer is not given a replacement path |
| Compliance Centre queue | Yes | Yes | Would query live rows | Signed-out 401 only | No signed-in | No | Route only | NOT TESTED | Queue is the latest 50 requirements in submitted, under review, or changes requested | No pagination; no overdue metric |
| Reviewer decision | Yes | Yes | Function installed | Unit and SQL text | No | No | Function presence only | NOT TESTED | `compliance_requirement_decide_atomic` checks expected state and independent review | Not called |
| Policy versions | Yes | Yes | 0 rows | Code limits this to managers | No | No | Empty table observed | BLOCKED | `savePolicyVersion` | Activating a policy on production was out of scope and would change agency behaviour |
| Salesperson, manager, finance, conveyancer sessions | Controls differ by capability | Yes | Not used | Unit capabilities only | No | No | No | NOT TESTED | Manager holds review, finance, conveyancing, and policy together | No separate finance or conveyancer role was signed in |
| Cross-tenant authenticated request | Hidden as 404 in code for some reads | `client_id` filters | RLS has no policies | Signed-out only | No | No | No | NOT TESTED | `requireClientDataAccess` | Two organisations were not used |
| Notifications | No dedicated screen | Escalation insert; invitation email | Not inspected beyond the unsent invite | Not live | No | No | Invite row was not sent | PARTIAL | Email only when Resend and a recipient email exist; escalation notifies flagged reviewers | No submission-received or correction email |
| Tasks and follow-ups | Work item title | `compliance_work_items` | 1 row exists | Not live | No | No | Count only | PARTIAL | `completeWorkItem` returns `verifiedRequirement: false` | Not the lead-task product |
| Audit trail | Yes | Yes | 2 events on the buyer case | Confidential filter in code | Read-only | No | Event types only | PARTIAL | Summaries are fixed sentences for known event types | Full decision history was not produced |
| Malware scanning | No | Status column only | `scan_status` would be `unscanned` | No | No | No | No | FAIL | Portal insert hardcodes `unscanned` | No quarantine |
| Mobile compliance summary | Contract doc | `mobileComplianceDto` | Not called | Not live | No | No | No | NOT TESTED | `app/api/sales/app/compliance/route.ts` | Android app was not run |
| WhatsApp, leads, viewings | No compliance control found | No write from the new service | Not used | No | No | No | No | NOT TESTED | Invitation email is the only outbound customer message in this feature | A notification row would not prove WhatsApp delivery |
| Authenticated responsive UI | Components exist | — | — | — | No | No | No | NOT TESTED | Widths 360, 390, 430, 768, 1024, and 1440 were not measured while signed in | Public unknown-link page was viewed at the tool’s desktop width only |

## Counts

| Result | Features |
| --- | --- |
| PASS | 5 |
| PARTIAL | 12 |
| FAIL | 6 |
| BLOCKED | 1 |
| NOT TESTED | 9 |
| Total | 33 |

The five passes are boundary checks. They are not a passed buyer, seller, property, or transaction journey.

## Status after the 4 November 2026 remediation code

These statuses are for the local source after the repair. They do not replace the production results above. No journey was executed against a database.

| Feature | New result | Evidence | Still open |
| --- | --- | --- | --- |
| Verification session cookie | PARTIAL | `invitationSessionCookieOptions` path is `/`. Route test forbids `path: "/verify"`. | No live code entry, save, refresh, and submit |
| Portal evidence access | PARTIAL | List and open routes exist. Unscanned and quarantined downloads are refused | No scanner, so a new file cannot be opened |
| Correction invitation | PARTIAL | Decision calls `createDocumentInvitation` with purpose `correction`. A second open link is revoked | No mailbox and no second reviewer click |
| Phone-only invitation | PARTIAL | Precheck returns 400 before insert when email is missing, 503 when email is not configured | Existing production row was left in place |
| Empty submission | PARTIAL | `submissionDecision` rejects an empty submit and does not advance a save | No case row was observed |
| Payment transitions | PARTIAL | `paymentStatusChange` covers every jump. Proof requires a stored file | No synthetic transaction |
| Salesperson visibility | PARTIAL | Unassigned and other-agent cases are denied for a salesperson | No two signed-in agents |
| Company parties | PARTIAL | Two directors and two owners become separate party drafts | Rows were not inserted |
| Review queue pagination | PARTIAL | Centre loads 25 rows and returns `hasMore` | Signed-in paging was not clicked |
| Listing enforcement | BLOCKED | Unchanged. Still inactive without an authorised policy | Do not activate on production |
| Signed-out boundaries | PASS | Unchanged from the original audit | Cross-tenant signed-in access still not tested |
