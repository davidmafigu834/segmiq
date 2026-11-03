# SEGMIQ Real Estate Compliance & Due Diligence Audit

**Audit date:** 22 October 2026  
**Scope:** Repository, migrations, source-level tests, and current authoritative Zimbabwe sources  
**Mode:** Read-only architecture and solution-design audit; no implementation or production mutation  
**Legal status:** This is a product and technical assessment, not legal advice. Every rule marked for implementation must be confirmed by a qualified Zimbabwean AML/CFT and data-protection professional.

## Audit method and evidence standard

This audit inspected the existing SegmiQ repository rather than inferring features from table names. It used migrations, services, route handlers, UI components, permission code, storage helpers, and focused tests. The four compliance tables were reported by the requester as containing zero rows at the time of a separate authorised inventory; no customer records or identity documents were accessed for this report. No build, development server, Docker service, local Supabase instance, migration, full typecheck, production mutation, push, or deployment was performed.

The labels used throughout are:

- **Implemented and verified in source:** an end-to-end code path exists, although production deployment and live configuration are not proven.
- **Partially implemented:** meaningful code exists but a control, workflow, or data element is incomplete.
- **Database-only foundation:** schema exists without a sufficiently complete product path.
- **Planned/not implemented:** the repository signals an intended capability but does not provide it.
- **Missing:** no material implementation was found.

“Legally required” below means supported by the cited Zimbabwe source. “Product control” means a prudent implementation choice and must not be represented as law unless counsel confirms it.

---

## 1. Executive summary

SegmiQ already contains a substantive real-estate compliance subsystem. It is not merely four empty database tables. The repository contains a domain model, server services, protected API routes, manager workspaces, an agent-facing card, private signed-document downloads, notifications, workflow events, and focused source tests. The system can start an individual or corporate case, collect basic profile information and documents, add related parties, classify risk manually, request EDD, review evidence, and record an approval, restriction, or rejection.

It is nevertheless **not ready to be relied upon as a production AML/CDD control**. The highest-risk defects are enforcement and confidentiality defects, not missing dashboard polish:

1. `mutateRealEstateTransaction()` in `lib/real-estate/transaction-service.ts` permits `start_progress` when there is no linked compliance case, and trusts the API-supplied `compliance_approved` boolean to bypass the database check. `startOrGetTransactionFromOffer()` also accepts an unverified `compliance_case_id`. This makes the transaction checkpoint fail open.
2. `docCountsAsComplete()` in `lib/real-estate/compliance.ts` counts `received` and `under_review` documents as complete. Uploading is therefore conflated with verification.
3. `mutateComplianceCase()` in `lib/real-estate/compliance-service.ts` can approve an `under_review` or `edd_required` case despite incomplete required evidence.
4. An internal note is stored as a compliance-event `summary`. `getComplianceCaseDetail()` hides event before/after values from salespeople but still returns the summary, so confidential reviewer text may leak.
5. Compliance mutations and their audit events are not atomic, and `appendEvent()` ignores insertion errors. A decision can succeed without a corresponding audit record.
6. The code uses an admin/service client and hard-coded role checks. The compliance migration enables RLS but defines no policies and does not explicitly revoke Data API grants. Database grants must be verified in the deployed project; application checks alone are insufficient defence in depth.
7. `SUPER_ADMIN` is treated as an unrestricted compliance viewer even though `canAccessClient()` warns that business-data endpoints need scoped support access. Compliance routes do not apply that additional constraint.

Zimbabwe’s AML/CFT framework squarely applies to estate agents when they perform the covered activities. The current FIU real-estate guidance requires risk-based CDD for both vendor and purchaser, beneficial-owner identification and verification, PEP and targeted-financial-sanctions controls, EDD for higher-risk relationships, ongoing monitoring, internal escalation, timely suspicious-transaction reporting, training, compliance oversight, and five-year record keeping. SegmiQ presently provides collection and workflow scaffolding but no PEP, sanctions, adverse-media, identity-verification, corporate-verification, STR case management, periodic reassessment, or defensible retention/legal-hold implementation.

The recommended first implementation is a narrowly scoped **Foundation Correction release**: close all fail-open transaction paths; separate collection from verification; make audit writes atomic and immutable; stop confidential-note leakage; enforce tenant and support-access boundaries server-side and at the database; and add regression tests. Only after that should SegmiQ expand profiles, screening evidence, EDD, and a richer Compliance Centre.

Overall readiness:

- **Architecture foundation:** good and reusable.
- **Operational CDD workflow:** partial.
- **Legal-control coverage:** materially incomplete.
- **Security/audit assurance:** insufficient for production reliance.
- **Recommended disposition:** controlled pilot only after Phase 1 corrections and Zimbabwe legal review; not marketed as “compliant” or as replacing an agency’s MLRO/compliance judgment.

---

## 2. Product architecture discovered

The compliance capability is integrated into the existing multi-tenant Next.js/Supabase/R2 architecture:

| Layer | Repository evidence | Assessment |
|---|---|---|
| Domain rules | `lib/real-estate/compliance.ts`: `parseComplianceSettings`, `requiredDocsForEntity`, `profileComplete`, `checklistCompleteness`, `canReviewCompliance`, `evaluateComplianceGate` | Implemented, with important correctness gaps |
| Server orchestration | `lib/real-estate/compliance-service.ts`: `startOrGetComplianceCase`, `listComplianceCases`, `getComplianceCaseDetail`, `mutateComplianceCase`, `uploadComplianceDocument`, `signComplianceDocument`, `assertComplianceProgressAllowed` | Implemented and reusable; needs control hardening |
| Persistence | `supabase/migrations/20260829140000_real_estate_compliance.sql` | Four core tables plus settings and reviewer flag |
| HTTP API | `app/api/clients/[clientId]/compliance/**` | Session- and client-aware routes exist |
| Manager UI | `app/client/compliance/page.tsx`, `app/client/compliance/reviews/page.tsx`, `components/real-estate/compliance/ComplianceWorkspace.tsx` | Functional source path exists |
| Case UI | `components/real-estate/compliance/ComplianceCasePanel.tsx` | Profile, documents, risk, review and activity tabs |
| Agent UI | `components/real-estate/compliance/InquiryComplianceCard.tsx` | Embedded, practical collection/status surface |
| Settings UI | `components/real-estate/compliance/CompanyCompliancePage.tsx` | Basic policy toggles and reviewer configuration |
| Storage | `lib/storage/r2.ts`: `generateComplianceDocKey`, `generatePresignedDownloadUrl`, `putObject` | Tenant-prefixed keys and short-lived signed reads; several controls missing |
| Notifications | `lib/real-estate/compliance-service.ts`: `notifyUsers`; notification type `COMPLIANCE_ALERT` | Normal notifications exist; Important Messages integration does not |
| Real-estate gates | Listing and lead routes call `assertComplianceProgressAllowed`; transaction service has separate logic | Fragmented and bypassable |
| Tests | `tests/real-estate-compliance.test.ts` | Focused source/unit tests; no DB/API/E2E security proof |

This architecture should be extended, not replaced. A new database per agency, duplicate CDD tables, or a parallel notification system would weaken the product.

---

## 3. Existing compliance tables

### `compliance_cases`

Defined in `supabase/migrations/20260829140000_real_estate_compliance.sql`. It links a case to `client_id`, `contact_id`, and optionally a lead, offer, and listing. It holds entity type, status, risk, reviewer/decision identities and timestamps, request/review/internal notes, reasons, a JSONB CDD profile, and JSONB risk factors. A partial unique index prevents more than one case for the same client/offer.

Strengths are transaction context, decision provenance, an explicit EDD state, and reuse of existing contacts. Gaps include no case-policy/version snapshot, next-review/approval-expiry date, risk-method/version, structured screening status, STR confidentiality boundary, seller/party role, or explicit transaction foreign key. JSONB is flexible but currently under-validated.

### `compliance_related_parties`

Supports directors, beneficial owners, authorised representatives, and “other”. It records name, optional contact, relationship, and notes. This is only a relationship list. It lacks ownership percentage, control basis, date of birth, nationality, identifying particulars, verification result/date/method, source provenance, and a corporate ownership graph. It cannot evidence beneficial-owner identification and verification by itself.

### `compliance_document_requirements`

Supports required/optional requirements, a single storage key, upload metadata, review status/actor/date/notes, expiry, and free text. It supports collection and a simple review decision. It lacks immutable versions, content hash, malware result, verification method, issuer/reference, replacement chain, download audit, retention class, disposal date, preservation/legal hold, and deletion record.

### `compliance_case_events`

Records event type, summary, text before/after values, actor, and timestamp. It is a useful start but is neither immutable by database rule nor guaranteed to be written atomically with the business mutation. It lacks source/channel, request/correlation ID, actor role, delegated/support context, structured redaction, and export provenance.

### Database control assessment

All four tables have RLS enabled, but this migration contains no RLS policies and does not explicitly revoke `PUBLIC`, `anon`, or `authenticated` privileges. Later real-estate migrations do revoke those privileges. Because compliance services use `createAdminClient()`, RLS is bypassed and every service query must enforce tenancy correctly. The deployed grants and policies require metadata-only verification before launch.

Child tables repeat `client_id` but do not enforce that it matches the parent case’s `client_id`. Add tenant-consistency constraints or triggers rather than depending only on application code. Preserve existing table names and migrate additively.

---

## 4. Existing services and APIs

### Service functions

- `loadComplianceActor()` loads the user’s review flag.
- `loadComplianceSettings()` reads and normalises client policy.
- `startOrGetComplianceCase()` validates client/contact/offer/lead/listing, creates or reuses a lead/offer-scoped case, seeds requirements, and notifies managers.
- `listComplianceCases()` applies basic role scope, status filters, and a 300-row ceiling. Its summary is derived from the filtered result, not necessarily the organisation-wide population.
- `getComplianceCaseDetail()` loads contact, listing, offer, evidence, parties, activity, users, and prior approvals. Prior approvals are informational and are not inherited automatically, which is safer.
- `mutateComplianceCase()` implements profile, party, submission, review, risk, EDD, document, decision, reopening, and note actions.
- `uploadComplianceDocument()` accepts a file/reused key and marks the requirement `received`.
- `signComplianceDocument()` authorises case visibility and issues a five-minute signed URL.
- `assertComplianceProgressAllowed()` evaluates a configurable gate using the latest matching case.
- `listAgentComplianceActions()` supplies salesperson action counts.

### API routes

- `app/api/clients/[clientId]/compliance/cases/route.ts`: list/start.
- `app/api/clients/[clientId]/compliance/cases/[caseId]/route.ts`: detail/mutation.
- `app/api/clients/[clientId]/compliance/cases/[caseId]/documents/[docId]/route.ts`: upload/reuse/sign.
- `app/api/clients/[clientId]/compliance/settings/route.ts`: read/update policy.

The routes use authenticated sessions, `canAccessClient()`, real-estate client checks, and Zod request validation. Settings mutation requires `P.SETTINGS_MANAGE`. The case service, however, primarily enforces hard-coded roles and a reviewer flag instead of the declared `P.COMPLIANCE_READ` and `P.COMPLIANCE_REVIEW` permissions.

### Classification

The APIs are **partially implemented**, not merely database-ready. Production readiness is held back by non-atomic audit writes, incomplete validation, support-access scope, missing CSRF/security assurance tests, and the transaction bypass described in section 14.

---

## 5. Existing UI

`ComplianceWorkspace.tsx` provides search, attention/under-review/EDD/approved/restricted/all views, summary tiles, reviewer controls, and responsive list/detail behaviour. `ComplianceCasePanel.tsx` presents Overview, CDD, Documents, Risk, Review, and Activity tabs, including upload/open/review actions and decisions. `InquiryComplianceCard.tsx` brings compliance status and collection into the salesperson’s existing journey. `CompanyCompliancePage.tsx` configures policy and reviewers.

The UI is connected to real-estate workflow and is therefore a strong base. It is not yet a full Compliance Centre: there is no dedicated confidential escalation queue, screening evidence view, reassessment queue, expiry queue, audit export, workload/SLA report, or compliance-program administration. Corporate parties are names rather than verified ownership/control records. Individual source-of-wealth is present in the type but not collected in the individual form.

The eventual interface should preserve the current Hallmark-style density, restrained status colour, side-panel case review, explicit next action, and mobile collection path. Confidential functions should be separate views, not merely hidden fields on a shared salesperson payload.

---

## 6. Current role permissions

The global roles in `lib/auth/roles.ts` are `SUPER_ADMIN`, `CLIENT_MANAGER`, and `SALESPERSON`; there is no genuine Compliance Officer role. `lib/auth/rbac/permissions.ts` defines `COMPLIANCE_READ` and `COMPLIANCE_REVIEW`; the salesperson profile receives read and managers receive both. The compliance service does not consistently use those permissions.

Current effective behaviour:

| Actor | Current capability | Concern |
|---|---|---|
| Salesperson | View assigned case; collect profile/parties/documents; submit; view authorised status/activity | Detail response includes raw case fields and related-party rows; internal-event summary can leak |
| Client manager | View all tenant cases; review documents; set risk/EDD; approve/restrict/reject | Every manager is a reviewer unless `restrict_review_to_flagged_users` is enabled |
| Flagged manager | Same reviewer powers under restricted setting | A flag is not a distinct duty/role or scoped grant |
| Super administrator | Broad access including internal notes | Compliance routes do not require scoped support access despite warning in `canAccessClient()` |
| Compliance officer | Not represented | Missing least-privilege operational role |

Smallest safe extension: introduce granular permissions and an assignable compliance function without proliferating global roles unnecessarily. At minimum separate `compliance.status.read`, `compliance.collect`, `compliance.document.review`, `compliance.risk.assess`, `compliance.case.decide`, `compliance.confidential.read`, `compliance.export`, and `compliance.policy.manage`. A client-scoped “Compliance Officer” role/profile can compose them. Enforce permissions in service functions and queries, not only navigation.

Self-approval should be prohibited by default with an explicit, audited policy exception. Support personnel should require a scoped, time-bound support grant and audit trail. Salespeople should receive a deliberately projected DTO rather than redaction after `...row` expansion.

---

## 7. Existing document storage

`generateComplianceDocKey()` in `lib/storage/r2.ts` creates `clients/{clientId}/compliance/{caseId}/{timestamp}.{ext}`. `uploadComplianceDocument()` writes through `putObject()` and `signComplianceDocument()` checks case visibility, verifies the client prefix, and returns a five-minute signed download. This is **partially implemented secure storage**.

Positive controls:

- tenant and case appear in the object prefix;
- the application does not return a permanent public URL from the compliance path;
- downloads are authorised through the case service;
- document decision actor/date/status exist;
- content is requested with private cache semantics.

Missing or unproven controls:

- proof that the R2 bucket and origin are private; configuration currently requires `CLOUDFLARE_R2_PUBLIC_URL` even though compliance should not depend on public access;
- random, non-enumerable object names (timestamp-only names are predictable);
- magic-byte/type validation, malware scanning, quarantine, image/PDF sanitisation, and size/shape abuse controls;
- server-side encryption configuration and key-management evidence;
- immutable versions, hashes, replacement chain, and safe cleanup of superseded objects;
- access/download audit, controlled export, watermarking where appropriate, and bulk-export approval;
- retention class, legal hold, deletion approval, destruction evidence, and backup-expiry behaviour;
- processor terms and cross-border data-transfer assessment for R2 and any screening vendor.

The current “reuse storage key” path only verifies that another compliance-document row in the same client references the key. It should require source-case authorisation and create an immutable evidence reference/version rather than silently repointing a requirement.

SegmiQ Cloud’s document version helpers and transaction-document review patterns should be reused where their security model fits, but identity evidence should remain in a more restricted compliance security domain.

---

## 8. Customer due diligence capabilities

### Individual buyer

The case profile can store legal name, date of birth, nationality, identity type/reference/expiry, residential address, occupation, and source-of-funds/source-of-wealth statuses. Default requirements are identification, proof of address, and source of funds. An agent can collect, upload, submit, and see progress; a manager can review and decide.

This is partial because `profileComplete()` considers only `legal_name` sufficient for an individual, uploads count as complete before acceptance, and there is no structured verification method/result. The application does not distinguish customer declaration from independently verified data.

### Individual seller

Seller authority/ownership document defaults exist as constants, but `requiredDocsForEntity()` seeds individual or corporate customer requirements rather than a separate seller-side package. Case creation is driven by a contact/lead/offer/listing and buyer-agent context. There is no explicit customer role (`buyer`, `seller`, `landlord`, `tenant`, representative), and acquisition/mandate workflows do not initiate seller CDD. Seller CDD is therefore **planned in data concepts but not operationally implemented**.

### Required semantic separation

Every significant fact should carry a state such as declared, evidenced, independently verified, rejected, expired, or not applicable. The final decision should reference the evidence and risk assessment versions reviewed. “Uploaded”, “received”, “reviewed”, and “verified” must never be synonyms.

---

## 9. Corporate and beneficial ownership capabilities

The CDD profile supports registered/trading name, registration number, jurisdiction, registered address, and arrays of directors, beneficial owners, and authorised representatives. `compliance_related_parties` persists named relationships. Corporate default documents cover registration, address, directors, beneficial owners, authority, and source of funds.

`profileComplete()` requires only a registered name plus at least one director and one beneficial owner. There is no corporate registry verification, entity status, nature/purpose of business, signatory authority evidence, ownership percentage, control test, ownership chain, trust roles, nominee indicator, natural-person resolution, or verification provenance. Names in an array are not a beneficial-ownership determination.

Recommended additive model:

- enrich related parties with structured identity and verification metadata;
- represent ownership/control edges, percentages where applicable, and the basis of control;
- record the search/source, date, reviewer, result, and evidence version;
- support trust settlors, trustees, protectors, beneficiaries/classes, and other controllers;
- require a reason and senior review if the natural beneficial owner cannot be established; and
- prohibit progression when required ownership verification is unresolved, subject only to legally reviewed exceptions.

The 25% indicator in FIU guidance should be configurable and legally reviewed: it does not replace control and benefit tests.

---

## 10. Risk assessment

Risk is manually selected as unclassified, low, medium, or high. `risk_factors` accepts JSON and `riskChangeRequiresReason()` requires an explanation only when entering or leaving high risk. There is no computed score, methodology version, required factors, residual/inherent distinction, assessment date, assessor, next review, or evidence links. The audit event provides some override history, but there is no explicit “system recommendation versus reviewer override” because no system recommendation exists.

This manual approach is preferable to falsely presenting an arbitrary score as law, but it is not a complete documented risk assessment. Implement a counsel-approved questionnaire covering customer, transaction/product, geography, delivery channel, ownership complexity, source of funds/wealth, PEP/TFS results, unusual features, and agency-specific institutional risk. Store the rationale and methodology version. Any rules engine should recommend and explain; an authorised human should decide. Overrides should require reason, identity, before/after rating, evidence references, and—where policy requires—independent approval.

Prior approvals are shown but not automatically inherited. That is correct. Reuse should import current verified attributes/evidence references while creating a transaction-specific assessment, checking material changes, expiry, screening freshness, and ongoing-monitoring results.

---

## 11. EDD support

The `edd_required` state, `edd_reason`, high-risk rating, notifications, workspace filter, and reviewer action are implemented. This is workflow scaffolding, not complete Enhanced Due Diligence.

Missing EDD controls include structured additional inquiries, source-of-wealth evidence, complex/unusual transaction purpose, senior-management approval, enhanced monitoring plan/frequency, first-payment/account checks where applicable, high-risk-country rationale/countermeasures, PEP treatment, evidence-linked completion criteria, and a prohibition on clearing EDD merely because the case reached review. The existing approval condition can bypass incomplete evidence in `edd_required`, which must be fixed first.

---

## 12. Screening integration assessment

No actual provider integration, SDK, API client, webhook, licence configuration, or persisted result model was found for PEP, sanctions/targeted financial sanctions, adverse media, identity verification, corporate registry verification, or beneficial-ownership verification. The repository’s compliance test explicitly recognises the absence of PEP/sanctions integration. No structured manual-screening evidence flow was found either.

Three different capabilities must be designed separately:

1. **Manual evidence capture:** source/list searched, query, timestamp, operator, result, match candidates, disposition, attachments, and next rescreen date.
2. **Human confirmation:** an authorised reviewer resolves false positives and records rationale; the salesperson cannot alter the result.
3. **Provider integration:** provider request/response references, list/version, match score/data, webhook/retry state, audit metadata, data location, contract/licence coverage, and ongoing screening.

Before selecting a provider, run a procurement and data-protection assessment covering Zimbabwe coverage, UN and applicable domestic lists, PEP/family/associate coverage, corporate and transliteration quality, update latency, false-positive handling, permitted storage/display, auditability, service levels, cross-border processing, sub-processors, deletion, and price. Manual controls remain necessary for outages and non-integrated customers.

Do not hardcode a country list; consume the current FIU directives through a controlled policy update process. The FIU directives page lists a high-risk-jurisdictions directive dated 17 February 2026.

---

## 13. Property and mandate due diligence

Property due diligence must remain distinct from customer AML/CDD.

- `real_estate_acquisition_opportunities` captures owner/property acquisition context.
- `real_estate_inspections` and `saveInspection()` in `lib/real-estate/acquisition-service.ts` capture the agency’s property inspection process. An inspection is not legal-title verification.
- `real_estate_mandates`, `saveMandate()`, `reviewMandate()`, `renewMandate()`, `revokeMandate()`, and `mandateHistory()` capture mandate evidence, review, renewal/version chain, and revocation.
- `assertStageChange()` and `listingPreparationGate()` in `lib/real-estate/acquisition-plan.ts` prevent certain stages without inspection/valid mandate, with an explicit manager exception for listing preparation.
- `real_estate_transaction_documents` and transaction document services provide operational document categories, review status, visibility, and replacement relationships.

Reuse and link these records from a compliance case. Do not copy mandates, inspections, or conveyancing files into duplicate compliance tables. Add typed evidence links/snapshots when a compliance decision depends on one of them so later changes do not erase what was reviewed.

Still needed are explicit seller authority, ownership/title evidence type and independent reviewer outcome, dispute/claim/encumbrance flags, legal-review and conveyancer-handoff status, and reasons. SegmiQ should record evidence and qualified decisions; it must not automatically certify legal title or replace deeds-office/conveyancer review.

---

## 14. Transaction compliance

### Current touchpoints

- Listing status changes to sold/let/rented call `assertComplianceProgressAllowed()` in `app/api/clients/[clientId]/listings/[listingId]/route.ts`.
- Lead status change to `WON` calls the same gate in `app/api/leads/[leadId]/route.ts`.
- Offer acceptance in `lib/real-estate/offer-service.ts` does not call the gate. The offer API then attempts transaction bootstrapping, but that is not a compliance decision.
- `startOrGetTransactionFromOffer()` creates a transaction in `pending_compliance` but accepts a caller-supplied `compliance_case_id` without proving that it belongs to the same tenant, contact, offer, listing, or transaction.
- `mutateRealEstateTransaction()` allows `start_progress` with no linked case because it rejects only a fetched non-approved case. It also trusts `complianceApproved: true` from the request to skip the lookup.
- Completion does not establish a single authoritative re-check of compliance status/policy.

### Required journey model

| Journey point | Legal/company-policy interpretation | Product behaviour |
|---|---|---|
| Owner/buyer enquiry | Full CDD need not automatically block an initial response; trigger depends on relationship/activity and agency policy | Capture minimum identity/contact data and show policy-driven “CDD not yet due” |
| Serious engagement/mandate | Seller/vendor CDD should begin early enough to verify before the covered transaction; mandate review remains separate | Start seller-side case, link mandate/property evidence |
| Buyer requirements/viewing | Risk-based preliminary collection may occur; avoid collecting excessive ID too early | Configurable initiation, no blanket hard block |
| Offer/negotiation | Establish customer role, parties, transaction purpose/value, source-of-funds plan | Require case linkage and highlight unresolved checks |
| Accepted offer | Natural default hard checkpoint because a covered transaction is proceeding | Create/link transaction-specific buyer and seller cases; fail closed according to reviewed policy |
| Conveyancing/milestones | Continue monitoring and evidence collection; high-risk/EDD must remain restricted | Server-side milestone rules, exception approval, immutable reason |
| Completion | Confirm current approval, no blocking escalation, and required evidence/reporting records | Authoritative re-check before final status |

The same policy service must be called by every protected transition. The server must derive approval from a correctly linked case; no client-provided boolean may override it. Exceptions should be narrowly permissioned, reasoned, time-bound, and audited.

---

## 15. Notifications

`notifyUsers()` writes `COMPLIANCE_ALERT` rows into the existing `notifications` table. Submissions, information requests, decisions, and similar events can therefore reach existing notifications. Some notification text concatenates a reviewer’s reason, which can expose sensitive facts in previews.

`loadImportantMessages()` in `lib/important-messages/feed-service.ts` currently loads only `BUYER_INTRODUCTION` notifications plus pending introductions and platform announcements. `COMPLIANCE_ALERT` is not mapped to the Important Messages model. The model’s categories are collaboration, approvals, and what’s new; there is no compliance category.

Recommended integration:

- keep ordinary, low-sensitivity updates in normal notifications;
- elevate actionable assignments, submitted approvals, unresolved EDD, expiring evidence, and policy-blocked transactions to **Approvals**, using the existing feed;
- show generic preview text (“Compliance action required”) and reveal details only after case authorisation;
- never include suspicion, STR filing, PEP match details, document identifiers, source-of-funds facts, or internal rationale in previews, email, push, or salesperson-visible messages;
- deduplicate by case/event, support resolution, and honour assignment changes.

Do not create a second notification table or feed.

---

## 16. Sensitive data protection

Identity, political-opinion/PEP, financial-history, source-of-wealth, and suspicion records demand stricter handling than ordinary CRM notes. Current positive controls include authenticated APIs, tenant-prefixed object keys, short-lived downloads, and internal-note redaction. Material weaknesses remain:

- raw case/party spreading makes least-privilege DTOs uncertain;
- internal notes can leak through event summaries;
- support/admin access is not scoped;
- there is no document access log or bulk-export control;
- bucket privacy, encryption, malware scanning, backup disposal, and cross-border safeguards are unproven;
- free-text fields can accumulate excessive sensitive data;
- API/service operations are not atomically audited;
- no confidential STR/escalation security domain exists.

Apply privacy by design: field-level purpose classification, minimal collection, explicit notices/lawful basis reviewed by counsel, restrictive projections, encryption in transit/at rest, secrets and key rotation, access audit, DLP-safe logs, secure deletion, incident procedures, processor contracts, and a transfer assessment. Never log full request bodies or provider screening payloads.

---

## 17. Record retention and audit

Zimbabwe AML records generally require at least five years in the circumstances mapped in section 18, while data-protection law requires data not to be kept longer than necessary for its purpose. SegmiQ currently stores rows indefinitely by default but that is not a retention control. There is no retention schedule, start-event calculation, legal hold, disposal queue, approval, deletion certificate, backup policy, or customer-configurable longer period subject to law.

Existing audit coverage includes case status/decision timestamps, reviewer identities, document review metadata, and case events. It is incomplete because:

- event insert errors are ignored;
- mutation and event are not transactional;
- events can be updated/deleted unless deployed database controls prevent it;
- note events can leak confidential contents;
- upload/download/export access is not fully logged;
- no policy or evidence-version snapshot ties a decision to what was reviewed;
- no reason is mandatory for every risk change or approval;
- no controlled audit-export job, manifest, checksum, approval, or access log exists.

Use append-only, structured, redacted events written in the same database transaction as the business action. Restrict event mutation at the database. Keep a separate, highly restricted suspicious-activity audit domain. Controlled exports should be asynchronous, scoped, encrypted, watermarked/manifested where appropriate, expiring, and fully audited.

---

## 18. Zimbabwe regulatory mapping with sources

### Source posture

The principal source is the [Money Laundering and Proceeds of Crime Act, Chapter 9:24, version dated 29 December 2025](https://zimlii.org/akn/zw/act/2013/4/eng%402025-12-29). The FIU states that its sector guidelines amplify obligations under the Act and are legally binding; its page lists [Guidances for Real Estate Sector — June 2026](https://www.fiu.co.zw/index.php/guidelines/) (direct [FIU PDF](https://www.fiu.co.zw/wp-content/uploads/2025/05/Guidances%20for%20Real%20Estate%20Sector%20June%202026.pdf)). The guidance’s publication/effective status should be confirmed with FIU/counsel because the page labels it June 2026 while the PDF metadata is later. FIU directives are issued under section 4; use the live [FIU directives index](https://www.fiu.co.zw/index.php/directives/) for current instruments.

| Requirement | Authority and applicability | Exceptions/threshold/effective information | Product implication | Legal review |
|---|---|---|---|---|
| Estate-agent/DNFBP scope | MLPC Act s13 includes estate agents; FIU 2026 guidance paras 1–7 applies to real-estate professionals involved in buying/selling and to both sides of the transaction | Scope depends on covered activity; do not assume every casual enquiry is a completed business relationship | Policy-driven initiation by customer role and activity | Confirm scope for rentals, developers, introducers, and agencies not handling funds |
| Institutional risk assessment | Act s12B; guidance paras 38, 43–54 and 84–88 requires documented, evidence-based, periodically reviewed risk approach | Guidance says review at least every 12 months and refers to annual submission by 31 March | Versioned agency risk assessment, policy basis, annual review/reminder/export | Confirm supervisory filing form/channel and first applicable date |
| Customer identification/verification | Act ss15–23; guidance paras 111–119 and 149–155 requires identifying and verifying through reliable independent sources before the relationship/transaction, subject to limited risk-managed timing | Limited delayed verification only where legally permissible and completed promptly; inability to complete CDD can require refusal/termination and consideration of STR | Separate declaration, evidence, verification and final decision; fail-closed checkpoints | Confirm exact timing per agency activity and any threshold-based occasional transactions |
| Vendor and purchaser | Guidance paras 111–119 says both vendor and purchaser are subject to CDD regardless of which party the agency represents | Risk-based extent; relationship timing may differ | Explicit customer role; seller and buyer cases linked to property/offer/transaction | Confirm landlord/tenant and dual-agency treatment |
| Legal persons and authority | Act ss15–23; guidance para 155 | Verify entity and natural person acting; authority must be established | Corporate particulars, status, signatory/authority evidence and verification | Confirm acceptable Zimbabwe and foreign registries/documents |
| Beneficial ownership | Act CDD provisions; guidance paras 120–129 requires natural-person identification through ownership/control layers | 25% is an indicator; control and benefit tests remain relevant; special trust roles apply | Ownership/control graph, natural-person resolution, trust roles, source and verification evidence | Confirm exact threshold/test application and evidence standard |
| Customer/transaction risk | Act s12B; guidance paras 38–54 | No single prescribed scoring method; low/medium/high categorisation in guidance does not make an automated score legally conclusive | Explainable, versioned assessment and human decision | Approve agency methodology and override governance |
| Source of funds/wealth | Guidance paras 111–119 and 132–144, especially high-risk and PEP relationships | Risk-based; heightened for higher-risk/PEP/complex or unusual matters | Separate declaration, evidence, verifier and sufficiency decision | Define acceptable evidence and when wealth evidence is mandatory |
| PEP | Guidance paras 134–144 requires systems for PEPs; foreign PEP measures include senior approval, source of wealth/funds and enhanced monitoring; domestic/international-organisation PEPs receive enhanced measures when higher risk | Family members/close associates included; former PEPs remain risk-based, with no arbitrary fixed expiry | Manual/provider screening record, match resolution, senior approval, ongoing rescreening | Confirm lists, definitions, domestic treatment and former-PEP policy |
| Targeted financial sanctions | Guidance paras 202–209 and current FIU directives require screening potential/existing customers and relevant parties and rapid action/returns | Guidance refers to action within 24 hours and nil returns; current directives/lists must be consulted | TFS-specific confidential workflow, live list/version, alert SLA, freeze/escalation evidence—not salesperson action | Specialist legal review is mandatory before implementing any freeze/report action |
| High-risk countries | Guidance paras 145–148; FIU directives index lists “High Risk Jurisdictions & Countries under Increased Monitoring” dated 17 Feb 2026 | Dynamic; must not be hardcoded | Controlled policy feed/version, EDD and countermeasure configuration | Confirm current list and required countermeasures at release time |
| Enhanced due diligence | Act risk-based provisions; guidance paras 132–148 | Triggered by higher risk, PEP and relevant geographic/transaction factors | Structured EDD plan, senior approval, enhanced monitoring and completion criteria | Agency policy and exceptional handling require approval |
| Ongoing monitoring | Act s26; guidance paras 168–175 | Risk-based frequency; refresh on doubts/material change and unusual activity | Review dates, rescreening, change triggers, transaction monitoring, stale-approval rules | Define cadence per risk and customer type |
| Suspicious transaction reporting | Act s30 requires prompt submission, no later than three working days after suspicion; s30(2) states estate-agent applicability when engaging for/on behalf of a client in the specified covered activity; guidance paras 176–183 | No general monetary threshold for suspicion; legal-professional privilege exception is not an estate-agent exception | Confidential internal escalation, suspicion timestamps, authorised MLRO decision, goAML/manual filing evidence | Mandatory specialist review of trigger, clock, responsibility and filing workflow |
| Internal suspicion decisions | Guidance paras 182–183 requires internal escalation and records even where no STR is filed | Access must be need-to-know | Separate restricted case, decision/rationale and immutable timestamps | Define MLRO delegation and governance |
| Confidentiality/tipping off | MLPC Act s31; guidance paras 189–191 | Disclosure restrictions apply to STR-related facts | Suppress from ordinary events, notifications, agent views and subject-access exports where law permits | Design and wording require counsel |
| CTR/reporting | Guidance paras 192–197 and FIU [Directive 01-04-2024](https://www.fiu.co.zw/wp-content/uploads/2025/05/DIRECTIVE-01-04-2024-REVISED-THRESHOLDS-FOR-CTRs-EFTs-AND-IFTs.pdf) | Directive page currently lists revised thresholds; the 2024 directive states ZiG 70,000 or USD 5,000/equivalent for non-bank/DNFBP cash transactions and monthly reporting including nil returns by the 10th. Currency/threshold may have been superseded and must be revalidated | Configurable effective-dated reporting rules; never hardcode current figures; reporting register/export only until an integration is verified | Confirm whether/how the customer handles cash and the current threshold/directive |
| goAML/supervisory administration | Guidance para 176 refers to goAML registration within 30 days of Estate Agents Council registration; guidance paras 84–110 cover program and supervisory duties | Applies to regulated agency; exact process is external | Store registration/renewal metadata and reminders, not credentials unless securely justified | Confirm current registration and reporting channels with FIU/EAC |
| Records | MLPC Act s24 and guidance paras 198–201 | Generally at least five years: CDD after relationship ends; transactions from date; findings and STR records from relevant event | Effective-dated retention schedule, legal hold and defensible deletion | Confirm trigger for each record class and other laws requiring longer retention |
| Compliance program/officer/training/audit | MLPC Act s25; guidance paras 90–110 | Proportionate program; guidance calls for management-level MLRO with authority/independence/access, annual training and independent audit | Roles, assignments, training evidence, policy versions, attestations and independent-review records | Confirm staffing/deputy and audit frequency for agency size |
| Data minimisation, purpose and accuracy | [Cyber and Data Protection Act, Chapter 12:07](https://zimlii.org/akn/zw/act/2021/5/eng%402022-03-11/source), ss7–13 | Legal AML retention can justify retention, but does not justify unrelated/excessive use | Purpose/classification, minimised fields, accuracy/refresh, privacy notices and lawful-basis record | Confirm controller/processor roles and sensitive-data basis |
| Security and breach response | Cyber and Data Protection Act ss18–24 | Section 19 provides a 24-hour Authority notification obligation; facts may determine other notices | Security program, processor guarantees/contracts, access logs and incident playbook | Confirm exact incident thresholds, recipients and timing |
| Cross-border processing | Cyber and Data Protection Act ss28–29 | Transfer depends on adequacy/safeguards or permitted conditions | Vendor/R2 location inventory, transfer assessment, contracts and data residency options | Required before screening/storage vendor selection |
| Professional/property boundary | [Estate Agents Act, Chapter 27:17](https://zimlii.org/akn/zw/act/1999/6/eng%402016-12-31) governs estate-agent registration/professional matters; conveyancing/title conclusions remain professional/legal matters | AML tooling does not confer title-certification authority | Track mandate/title evidence and handoff; never claim automated legal certification | Confirm EAC rules, trust-account duties and conveyancer responsibilities |

The 2024 National Risk Assessment, linked from the FIU publications area, characterises real estate as medium-high risk and identifies weak compliance. This informs product prioritisation but is not itself a substitute for a customer-specific institutional risk assessment.

---

## 19. Legal issues needing specialist review

Before schema or rules are finalised, Zimbabwe counsel/compliance specialists must determine:

1. The exact activities that bring each customer journey (sales, rentals, property management, development, introductions) into scope.
2. When a business relationship begins and the latest lawful verification point for vendor, purchaser, landlord, tenant, and representative.
3. The current force/effective date of the June 2026 real-estate guidance and interaction with older directives.
4. Current CTR currencies/thresholds, nil-return expectations, and whether the agency’s role triggers reporting when funds move directly between parties.
5. FIU/EAC supervisory registration, institutional-risk-assessment submission, goAML and audit obligations.
6. Beneficial-owner thresholds, control tests, trusts, nominees, and acceptable independent evidence.
7. PEP categories, family/associates, former-PEP treatment, high-risk countries, and TFS response procedure.
8. STR trigger, three-working-day clock, delegation, filing proof, law-enforcement holds, confidentiality, and subject-access exceptions.
9. Record-class retention triggers, longer professional/tax/litigation periods, legal hold, and destruction.
10. Data-controller/processor allocation between SegmiQ and agencies, sensitive-data lawful basis/notice, registration, cross-border transfers, breach response, and data-subject rights.
11. Whether self-approval or manager exceptions are ever permissible and the required segregation of duties.
12. Wording that avoids representing workflow completion as legal compliance or title certification.

---

## 20. Complete capability matrix

Abbreviations: **I** implemented in source, **P** partial, **DB** database-only foundation, **M** missing. Risk is the risk of relying on the present capability.

| # / capability | Business purpose / legal relevance | Source implementation and DB | UI / API / security readiness | Missing parts | Risk | Recommended next step |
|---|---|---|---|---|---|---|
| 1 Individual CDD | Identify/verify customer; Act ss15–23, guidance 111–119 | P: profile/default docs in `compliance.ts`; JSONB + doc rows | P: form/upload/review APIs; completion is unsafe | Required particulars, independent verification, role and freshness | Critical | Correct semantics, required fields and verified-evidence gate |
| 2 Corporate CDD | Identify legal person and authorised actor | P: corporate JSONB and docs | P: names/forms; hard-coded access | Registry status, nature/purpose, authority verification | High | Versioned corporate profile and verification evidence |
| 3 Beneficial ownership | Resolve natural owners/controllers; guidance 120–129 | DB/P: related-party names | P UI/API; no restricted evidence model | Ownership/control graph, percentages/basis, verification, trusts | Critical | Enrich parties/edges and add BO review |
| 4 Document collection | Gather required evidence | I/P: requirements, R2 upload, status | Mobile-capable; signed read | Scan/type controls, source-case reuse auth | High | Quarantine/scan and safe versioned upload |
| 5 Document verification | Record human/independent decision | P: accept/reject metadata | Reviewer UI/API exists | “Received” counts complete; no method/issuer/hash | Critical | Only accepted/current evidence satisfies gate |
| 6 Source of funds | Understand transaction funding; risk/EDD guidance | P: status + default document | Collection/review exists | Structured declaration, amount/source, evidence sufficiency | High | Evidence-linked SoF assessment |
| 7 Source of wealth | Higher-risk/PEP understanding | DB/P: profile property only | Individual UI incomplete | Evidence, rationale, reviewer decision | High | Add risk-driven SoW workflow |
| 8 Risk assessment | Document risk-based controls; Act s12B | P: manual level, JSON factors | Reviewer action exists | Method/version, required rationale, reassessment | High | Counsel-approved assessment with human override audit |
| 9 PEP screening | Identify PEP risk; guidance 134–144 | M | No UI/API/provider/security model | Everything incl. family/associate/ongoing | Critical | Manual evidence design then vendor evaluation |
| 10 Sanctions/TFS screening | Prevent prohibited dealing; guidance 202–209/directives | M | None | Lists, version, resolution, 24h workflow, rescreen | Critical | Legally designed confidential TFS process |
| 11 Adverse media | Risk indicator; product/risk control, not universally conclusive law | M | None | Search evidence, relevance/disposition | Medium | Optional policy-driven manual/provider model |
| 12 EDD | Enhanced controls for high risk | P: status/reason/filter | UI/API exists; approval bypass unsafe | Plan, senior approval, enhanced monitoring, criteria | Critical | Structured EDD and fail-closed completion |
| 13 Reviewer assignment | Ownership and segregation | P: assigned user/flag | Manager assignment path; no dedicated role | Queue, workload, deputy, conflicts | High | Granular compliance role and assignment controls |
| 14 Review and approval | Defensible final decision | P: statuses/timestamps/events | UI/API usable; incomplete case can approve | Evidence snapshot, mandatory reason, self-approval rule | Critical | Atomic decision transaction with strict preconditions |
| 15 Compliance restrictions | Stop unsafe progression | P: restricted/rejected and gate | Gate exists in two transitions | Central enforcement, exception governance | Critical | Single authoritative fail-closed policy service |
| 16 Ongoing monitoring | Refresh and detect changes; Act s26 | M/P: prior case display only | No monitoring queue | review date, triggers, rescreen, changed facts | High | Add approval expiry/reassessment plan |
| 17 Document expiry | Avoid stale evidence | P: expiry/status columns | No complete automatic queue/control | scheduler, reminders, gate impact, replacement | High | Effective-dated expiry job and Important Message |
| 18 Property ownership evidence | Support seller authority/title review | P: seller constants + transaction docs | Fragmented | Explicit link/reviewer/legal outcome/dispute flags | High | Link property/legal evidence; no title claim |
| 19 Mandate review integration | Avoid duplicate due diligence | I in acquisition services/tables | Existing manager review/version chain | Typed compliance evidence link/snapshot | Medium | Reuse mandate record from case |
| 20 Offer/transaction checkpoints | Prevent progression without approval | P and bypassable | Listing/lead gates only; client boolean bypass | Offer/start/completion central checks and valid linkage | Critical | Fix before any pilot |
| 21 Suspicious activity escalation | Internal decision and STR support | M | No confidential UI/API/security domain | suspicion clock, MLRO workflow, tipping-off controls | Critical | Separate restricted escalation design after legal review |
| 22 Regulatory reporting support | Maintain reporting registers/exports | M | No verified FIU/goAML integration | STR/CTR/TFS registers, approvals, manifests | High | Manual controlled support; do not auto-file |
| 23 Data retention | Meet AML minimum and privacy limits | M | Indefinite storage is not a control | schedule, holds, disposal, backups | High | Counsel-approved retention service/model |
| 24 Audit reporting | Evidence who did what/when | P: events and decision fields | Activity UI; events non-atomic/mutable | access/export logs, immutability, policy snapshot | Critical | Transactional append-only event layer |
| 25 Manager oversight | Workload/status monitoring | P: workspace counts/tabs | Summary may be filtered/limited to 300 | ageing, SLA, assignment, completeness, reliable aggregates | Medium | Server aggregates after core correctness |
| 26 Salesperson mobile workflow | Practical evidence collection and next action | I/P: inquiry card/panel | Responsive; overexposure risk | least-privilege DTO, safe messages, seller flow | High | Preserve UX while narrowing payload/actions |

---

## 21. Security vulnerabilities

| Priority | Finding and evidence | Impact | Required treatment |
|---|---|---|---|
| P0 | `mutateRealEstateTransaction()` trusts `compliance_approved` and permits no-case progression | Unapproved transaction can proceed | Remove client override; server derives linked, current approval and fails closed |
| P0 | `startOrGetTransactionFromOffer()` accepts unvalidated `compliance_case_id` | Cross-context/cross-tenant mislink under service role | Validate tenant, contact, offer, listing, status; add DB tenant-consistency constraints |
| P0 | `received`/`under_review` counts complete and review/EDD can approve incomplete | Upload may masquerade as verified compliance | Require accepted/current evidence and complete verified profile/BO/screening preconditions |
| P0 | Internal note text is an event summary visible to agents | Confidential AML/reviewer information disclosure | Structured redacted event; separate confidential event stream |
| P0 | Mutation and event are non-atomic; event errors ignored | Missing/falsifiable audit trail | Transaction/RPC with mandatory event; reject on audit failure |
| P1 | Admin client bypasses RLS; no policies/revokes in compliance migration | Application bug may expose/mutate another tenant | Explicit grants/revokes, DB policies/constraints, service query tests |
| P1 | `SUPER_ADMIN` access lacks scoped support check | Unnecessary access to sensitive IDs/AML data | Time-bound support grants and audit; default deny |
| P1 | Raw case/party rows returned then partially redacted | Future/new fields can leak by default | Explicit response DTO allowlists per role |
| P1 | No malware/magic-byte validation or quarantine | Malicious/disguised uploads | Scan, validate, quarantine, sanitise, size/rate limits |
| P1 | No download/export access trail | Undetected sensitive-data extraction | Log read/download/export purpose, actor and scope |
| P1 | Notification previews may contain request reasons | Sensitive data in broad channels | Generic previews and authorised deep links |
| P1 | Predictable timestamp object names and public-URL configuration dependency | Increased object-discovery/configuration risk | Random IDs; private origin; explicit configuration assurance |
| P2 | `risk_factors` and profile JSON weakly validated | Inconsistent/untrusted decisions and reporting | Versioned schemas and server validation |
| P2 | Latest-case lookup may select wrong case when multiple contexts exist | Incorrect gate decision | Deterministic context linkage and unique constraints |
| P2 | List ceiling/client-side search and filtered summaries | Incomplete manager picture | Server pagination and authoritative aggregate queries |

Threat-model tests should include IDOR/cross-tenant access, salesperson-to-reviewer privilege escalation, case/document key swapping, support-role access, stale approval, concurrent decisions, event-write failure, malicious files, notification leakage, export abuse, and race conditions.

---

## 22. Missing workflows

- Seller/vendor, landlord/tenant, representative, joint customer and multi-party initiation.
- Verified individual identity and proof-of-address decision separate from upload.
- Corporate registry, authority, ownership/control chain and trust-party verification.
- PEP, TFS/sanctions, adverse-media, identity and corporate screening evidence.
- Structured risk methodology, override approval, periodic refresh and material-change trigger.
- Complete EDD plan, senior approval and enhanced-monitoring schedule.
- Confidential suspicion intake, MLRO triage, decision, STR filing evidence and tipping-off controls.
- CTR/TFS/other regulatory reporting register and controlled manual export.
- Evidence expiry, replacement, revocation, reassessment and ongoing rescreening.
- Retention, legal hold, disposal and access/export audit.
- Central checkpoint enforcement across offer, transaction, milestones and completion.
- Exception workflow with independent approval, expiry, reason and after-the-fact review.
- Compliance-officer workload/delegation, training/policy attestations and independent audit records.

---

## 23. Existing components to reuse

1. Keep the four compliance tables and extend them additively.
2. Keep `compliance.ts` as the domain-policy boundary, after correcting completion and authorisation logic.
3. Keep `compliance-service.ts` as orchestration, but move critical multi-write operations to transactional database functions or equivalent atomic boundaries.
4. Reuse contacts, leads, listings, offers and transactions as context; do not create duplicate customer or deal masters.
5. Reuse `real_estate_mandates`, inspections and transaction-document records through typed links.
6. Reuse the current manager workspace, case panel and inquiry card.
7. Reuse R2 helpers after privacy/security hardening and document-version integration.
8. Reuse the RBAC permission framework instead of adding UI-only role checks.
9. Reuse the existing notifications and Important Messages feed.
10. Reuse real-estate activity/event conventions only for non-confidential summaries; AML suspicion records need a stricter domain.

---

## 24. Required new components

These are solution-design components, not authorisation to implement:

- **Policy/version service:** effective-dated agency policy, document rules, checkpoints, assessment methodology and legal source/version.
- **Verified identity profile:** declared/evidenced/verified states and evidence provenance.
- **Ownership/control graph:** legal entity, natural parties, trust roles, edges and verification.
- **Screening evidence service:** manual and provider-neutral request/result/match/disposition/rescreen model.
- **EDD plan:** trigger, tasks, evidence, senior approval, monitoring frequency and closure.
- **Ongoing-monitoring scheduler:** review dates, expiries, material changes and screening refresh.
- **Confidential escalation domain:** MLRO-only suspicion/STR/TFS workflow, separated from normal case events and notifications.
- **Central checkpoint engine:** one server-side decision for all protected transitions, with typed, audited exceptions.
- **Secure evidence pipeline:** random keys, quarantine, malware/type checks, immutable versions/hashes, access logging and retention metadata.
- **Audit/export service:** append-only structured events, policy/evidence snapshots, controlled exports and manifests.
- **Compliance Centre extensions:** document-review queue, EDD, risk/reassessment, confidential escalations, audit/reports and policy pages.

---

## 25. Potential migration changes

No migration was created or applied. Likely additive changes, subject to legal and architecture review, are:

1. Add case customer role, transaction link, policy/method versions, assessment/review dates, approval expiry, and current decision version.
2. Add structured risk assessments/factors rather than relying solely on unvalidated JSON.
3. Enrich related parties and add ownership/control edges, verification status and evidence links.
4. Add document versions with immutable object key, hash, scan/type result, uploader, replacement, verification source/method, retention class and hold.
5. Add structured screenings and match dispositions with provider-neutral metadata.
6. Add EDD plans/tasks/approvals and monitoring schedules.
7. Add separate restricted escalation/report registers; do not put STR details in ordinary events.
8. Strengthen events with structured payload/redaction class, source, actor context, request ID and database immutability.
9. Add evidence links from compliance decisions to mandate, property and transaction documents.
10. Add explicit revokes/grants/RLS policies and tenant-consistency constraints/triggers for every foreign context.
11. Add uniqueness/check constraints for current decision/version relationships and valid state transitions where practical.
12. Backfill only safe defaults. Do not infer verification, beneficial ownership, approval, or screening from legacy names/uploads.

Migration compatibility must preserve zero/legacy rows, be idempotent where repository convention requires, and include preflight queries, rollback/forward-fix strategy, and production metadata verification. A table split should occur only where confidentiality or lifecycle genuinely differs.

---

## 26. Phased implementation roadmap

### Phase 1 — Existing foundation correction (release blocker)

- Close transaction/case-link bypasses and centralise fail-closed gate evaluation.
- Require accepted/current evidence; remove incomplete approval shortcuts.
- Introduce explicit per-role DTOs; eliminate internal-note/event leakage.
- Make decision/event writes atomic and event storage append-only.
- Enforce RBAC, tenant consistency, Data API grants/RLS, scoped support access, and self-approval policy.
- Harden uploads/downloads and add access logs.
- Add focused unit, service integration, database-authorisation and route tests.
- Obtain Zimbabwe legal sign-off on scope, timing and checkpoint defaults.

**Exit:** no known bypass of a configured checkpoint; no known confidential-data exposure; auditable decision consistency under failure/concurrency.

### Phase 2 — CDD operations

- Implement customer roles and seller/corporate flows.
- Make profile requirements policy-driven and versioned.
- Add verification metadata, document versions/replacement/expiry and beneficial-ownership structure.
- Link mandates, property and transaction documents rather than duplicate them.
- Deliver least-privilege agent and reviewer flows.

**Exit:** individual and corporate CDD can be evidenced from declaration through verified decision.

### Phase 3 — Risk and enhanced due diligence

- Add documented assessment method, rationale, override and review frequency.
- Add provider-neutral manual PEP/TFS/adverse-media evidence and match resolution.
- Add EDD plans, senior approval and monitoring.
- Add confidential internal escalation after specialist workflow approval.

**Exit:** high-risk cases cannot clear without the configured enhanced controls.

### Phase 4 — Transaction compliance

- Apply the central checkpoint engine at mandate/offer/transaction/milestone/completion points according to policy.
- Add deterministic buyer/seller/transaction links and safe prior-CDD reuse.
- Implement governed exceptions and material-change invalidation.

**Exit:** all protected transitions derive from the same authoritative, current compliance decision.

### Phase 5 — Oversight and audit

- Complete Compliance Centre queues, workload/ageing, reassessment and expiry views.
- Add retention/hold/disposal, audit manifests, management reporting and controlled exports.
- Add policy/training/independent-review records and Important Messages mapping.

**Exit:** an authorised reviewer can reconstruct decisions and management can supervise without exposing confidential case content.

### Phase 6 — external integrations

- Procure and pilot verified screening/identity/corporate providers.
- Add resilient adapters, consent/notice, data-transfer controls, retries, webhook verification, monitoring and manual fallback.
- Consider reporting assistance only after FIU/legal approval; do not auto-submit STRs by default.

**Exit:** contractual, licensing, coverage, privacy, security and operational acceptance criteria are met.

---

## 27. Recommended first implementation

Implement only a **Compliance Safety Baseline** first:

1. Delete the `compliance_approved` request override and require an appropriately linked, current approved case.
2. Validate every case-to-offer/transaction/contact/listing relationship and enforce it in the database.
3. Change completeness so only accepted, unexpired required evidence qualifies; enforce full approval preconditions.
4. Replace raw row spreading with explicit manager/reviewer/agent DTOs.
5. Split confidential notes/events; render generic agent-visible events.
6. Make every critical mutation and audit event atomic; prevent update/delete of audit events.
7. Add permission-based review/decision controls, scoped support access and no-self-approval default.
8. Add high-value regression tests for these controls.

This release delivers more risk reduction than adding a new dashboard or vendor integration. It should be small enough to review rigorously and must precede production data ingestion.

---

## 28. Dependencies and deployment risks

### Dependencies

- Qualified Zimbabwe AML/CFT, Estate Agents Council, conveyancing and data-protection advice.
- Customer policy decisions and MLRO/compliance responsibility mapping.
- Deployed Supabase grant/RLS/schema metadata and migration ordering.
- R2 bucket privacy, encryption, lifecycle, region and processor terms.
- Notification-channel privacy behaviour.
- Security review and threat model.
- Later: provider procurement/licensing, regional coverage and data-transfer assessment.

### Deployment risks

- Existing transactions may have null, stale, or incorrectly linked cases; strict gates need a reviewed remediation queue, not silent backfill.
- Existing `received` documents must not be auto-promoted to verified.
- Existing approvals may have been produced with incomplete evidence; flag for review rather than revoking automatically without policy.
- RLS/grant changes can break admin or reporting paths if not rehearsed.
- New retention jobs can irreversibly delete regulated records; begin in report-only mode and require dual approval/legal hold checks.
- Screening providers can create false positives and operational backlogs; pilot and measure before enforcement.
- Notification changes can leak sensitive facts through email/push even if in-app pages are secure.
- Policy changes need effective dates and decision snapshots so historical cases remain explainable.

Release through migrations and feature flags with metadata preflight, targeted tests, staged pilot tenant, structured observability without PII, rollback/forward-fix plan, and explicit compliance-owner acceptance. Do not enable hard gates globally until legacy cases have a safe transition path.

---

## 29. Open questions for the client

1. Which services are offered: sales, rentals, property management, development, auction, introductions, or holding client money?
2. Who is the registered estate agent and designated MLRO/compliance officer, and who is the deputy?
3. Which party does the agency represent in each journey, and does it nevertheless conduct CDD on both sides?
4. At what event does the agency consider a business relationship established?
5. Does the agency accept or facilitate cash, and how does it currently make CTR/STR/TFS returns?
6. Is the agency registered on goAML, and what supervisory submissions/audits/training are current?
7. What CDD/EDD, PEP, sanctions, high-risk-country, beneficial-ownership and document policies are already approved?
8. Which decisions require senior management, dual control, or independence from the salesperson?
9. May managers review, or is a dedicated client-scoped compliance role required immediately?
10. What is the approved retention schedule and legal-hold process for each record class?
11. Where may data be hosted/processed, and what processor/subprocessor terms are acceptable?
12. Which screening/identity/corporate providers, if any, are already licensed by the customer?
13. Which existing cases/transactions must be migrated, and may historic approvals be treated as evidence only?
14. What exceptions to hard checkpoints are operationally necessary, who approves them, and for how long?
15. Which status information may salespeople see, and what must remain MLRO-only?
16. What management reports are actually required by regulators, auditors, boards, and daily operations?

---

## 30. Final readiness assessment

SegmiQ has a credible, well-placed compliance foundation: connected real-estate entities, reusable tables and services, a practical case UI, private-download intent, decision states, and audit-event concepts. The architecture is more advanced than the zero-row database inventory suggests.

The present implementation is **not production-ready as a legally relied-upon Compliance Centre**. Critical fail-open transaction logic, premature evidence completeness, incomplete approval preconditions, confidential-note leakage, non-atomic audit records, broad support access, and unproven database/storage controls must be corrected before a pilot. Material legal capabilities—vendor CDD, beneficial-owner verification, screening, ongoing monitoring, confidential escalation, reporting support, and retention—remain incomplete or missing.

The correct path is evolutionary: secure the existing foundation, then add complete CDD semantics, risk/EDD, authoritative transaction checkpoints, oversight, and only then external providers. With those controls, legal validation, and disciplined deployment, the existing architecture can support a connected journey:

> Customer identified → requirements determined → evidence collected and independently reviewed → risk and EDD decided → compliance decision recorded → relevant transaction steps authorised → monitoring and audit retained.

SegmiQ should position the product as workflow, evidence, control and oversight infrastructure. The agency and its qualified compliance professionals remain responsible for legal judgment, filings, title/conveyancing conclusions, and the effectiveness of their compliance program.

---

## Repository evidence index

- `supabase/migrations/20260829140000_real_estate_compliance.sql`
- `lib/real-estate/compliance.ts`
- `lib/real-estate/compliance-service.ts`
- `app/api/clients/[clientId]/compliance/cases/route.ts`
- `app/api/clients/[clientId]/compliance/cases/[caseId]/route.ts`
- `app/api/clients/[clientId]/compliance/cases/[caseId]/documents/[docId]/route.ts`
- `app/api/clients/[clientId]/compliance/settings/route.ts`
- `app/client/compliance/page.tsx`
- `app/client/compliance/reviews/page.tsx`
- `components/real-estate/compliance/ComplianceWorkspace.tsx`
- `components/real-estate/compliance/ComplianceCasePanel.tsx`
- `components/real-estate/compliance/InquiryComplianceCard.tsx`
- `components/real-estate/compliance/CompanyCompliancePage.tsx`
- `lib/auth/roles.ts`
- `lib/auth/rbac/permissions.ts`
- `lib/auth/rbac/role-profiles.ts`
- `lib/auth/permissions.ts`
- `lib/storage/r2.ts`
- `lib/important-messages/feed-service.ts`
- `lib/important-messages/model.ts`
- `lib/real-estate/acquisition-plan.ts`
- `lib/real-estate/acquisition-service.ts`
- `lib/real-estate/offer-service.ts`
- `lib/real-estate/transaction-service.ts`
- `app/api/clients/[clientId]/transactions/route.ts`
- `app/api/clients/[clientId]/transactions/[transactionId]/route.ts`
- `app/api/clients/[clientId]/listings/[listingId]/route.ts`
- `app/api/leads/[leadId]/route.ts`
- `supabase/migrations/20261016042000_real_estate_phase2_acquisition.sql`
- `supabase/migrations/20260906220000_real_estate_transactions.sql`
- `supabase/migrations/20261016180000_real_estate_phase4_agency_operations.sql`
- `supabase/migrations/20261016220000_real_estate_final_corrections.sql`
- `tests/real-estate-compliance.test.ts`

