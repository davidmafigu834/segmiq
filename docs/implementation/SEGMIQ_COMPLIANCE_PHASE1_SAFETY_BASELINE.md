# SEGMIQ Compliance Phase 1 Safety Baseline

**Implementation date:** 22 October 2026  
**Scope:** Source implementation and additive migration preparation only  
**Production changes:** None  
**Migration applied:** No  
**Build/deployment:** Not run  

This report records the source implementation of Phase 1 from `SEGMIQ_REAL_ESTATE_COMPLIANCE_AUDIT.md`. It does not claim production verification, regulatory approval, malware scanning, private-bucket verification, or database integration testing.

## 1. Executive summary

The Phase 1 safety baseline has been implemented in source. Client-controlled compliance overrides were removed; transaction case links are now server-derived; policy evaluation has a structured, common boundary; verified evidence means accepted and current evidence; final approval requires complete profile/evidence, a classified risk, review status, and an independent reviewer; EDD cases cannot be approved because an evidence-backed EDD closure control does not yet exist; salesperson payloads and events are allowlisted; privileged support access uses the existing scoped Support Access system; document uploads receive signature validation and random private keys; and critical case/transaction changes are designed to execute through fail-closed atomic Postgres functions.

The additive migration is prepared but deliberately unapplied. The application refuses critical compliance decisions, transaction progression, and transaction completion with a safe 503 response if those functions are unavailable. It does not fall back to the vulnerable sequential paths.

Focused verification passed:

- 26 compliance tests passed.
- A targeted TypeScript project covering the changed source passed with zero errors.
- `git diff --check` is included in final verification.

The release is **source-complete but not production-ready** until the migration and its preflight queries are reviewed and executed in staging, database integration/concurrency tests pass, deployed grants and RLS are inspected, R2 privacy is verified, and the remaining blockers in section 20 are accepted.

## 2. Original defects and severity

| Defect | Original severity | Treatment |
|---|---:|---|
| Client request could set `compliance_approved` | Critical | Removed from route schema and service interface |
| Missing compliance case could permit `start_progress` | Critical | Atomic server/database gate fails closed when applicable |
| Arbitrary `compliance_case_id` accepted during transaction creation | Critical | Removed from API; exact case is selected by server |
| Received/under-review document counted complete | Critical | Only accepted, unexpired evidence qualifies |
| `under_review`/`edd_required` could approve incomplete cases | Critical | Strict source and database approval preconditions |
| EDD could be cleared without evidence-backed closure | Critical | Any case with an EDD reason is blocked from approval in Phase 1 |
| Internal notes duplicated into general event summaries | Critical | Generic public summaries and restricted before/after fields |
| State mutation and audit event were sequential | Critical | Critical actions use one Postgres transaction/RPC |
| Two reviewers could decide from stale state | Critical | Case row lock plus expected-status conflict check |
| Super admin had implicit compliance-file access | High | Existing scoped Support Access is mandatory and read-only |
| Admin client bypasses RLS | High | Service checks retained; direct Data API grants revoked in migration |
| Child-row tenant mismatch possible | High | Composite tenant foreign keys and validation triggers prepared |
| Predictable document object key | High | UUID object names |
| File extension/MIME trusted | High | Magic-byte detection and MIME consistency check |
| Reused storage key lacked source-case authorisation | High | Source case is loaded and actor visibility is checked |
| Download access was not recorded | High | Audit event required before signed URL issuance |
| Notification included reviewer reason | High | Generic privacy-safe copy |

## 3. Files changed

Core domain and services:

- `lib/real-estate/compliance.ts`
- `lib/real-estate/compliance-service.ts`
- `lib/real-estate/transaction-service.ts`
- `lib/real-estate/atomic-rpc.ts`

API and UI:

- `app/api/clients/[clientId]/compliance/cases/route.ts`
- `app/api/clients/[clientId]/compliance/cases/[caseId]/route.ts`
- `app/api/clients/[clientId]/compliance/cases/[caseId]/documents/[docId]/route.ts`
- `app/api/clients/[clientId]/compliance/settings/route.ts`
- `app/api/clients/[clientId]/transactions/route.ts`
- `app/api/clients/[clientId]/transactions/[transactionId]/route.ts`
- `app/api/clients/[clientId]/listings/[listingId]/route.ts`
- `app/api/leads/[leadId]/route.ts`
- `components/real-estate/compliance/ComplianceCasePanel.tsx`

Permissions, support access, and storage:

- `lib/auth/rbac/permissions.ts`
- `lib/auth/rbac/role-profiles.ts`
- `lib/security/support-access/scopes.ts`
- `lib/storage/r2.ts`

Database, tests, and documentation:

- `supabase/migrations/20261022113000_compliance_phase1_safety_baseline.sql`
- `tests/real-estate-compliance.test.ts`
- this implementation report

No unrelated industry source was modified.

## 4. Transaction gate correction

The `compliance_approved` property was removed from the transaction PATCH Zod schema and from `mutateRealEstateTransaction()`. Unknown request properties are not consumed as authority.

`start_progress` now calls `re_start_transaction_progress_compliance_safe`. That database function:

1. locks the transaction;
2. loads the client policy;
3. distinguishes non-applicable policy from applicable policy;
4. treats malformed/missing policy state as an error;
5. verifies the accepted offer;
6. verifies the exact linked case context;
7. requires current `approved` status when applicable;
8. updates the transaction and writes its event in the same transaction.

`complete` now calls `re_complete_transaction_compliance_safe`, which runs the same authoritative compliance assertion before delegating to the existing atomic `re_finish_transaction`. Missing new functions return 503 and never use the older sequential completion path. Cancellation and fallen-through handling retain their existing semantics and do not require an approval to stop a transaction.

`updateTransactionMilestone()` invokes the common gate before setting a milestone to `done` or `skipped`. This source-level check is not yet atomic with the milestone update; it is listed as a remaining integration hardening item.

Offer acceptance remains permissible because current organisation policy expresses CDD after an accepted offer. Acceptance triggers transaction creation in `pending_compliance`; it does not falsely signify CDD approval.

Listing sold/let/rented and lead WON continue to use `assertComplianceProgressAllowed()`, now with named `listing_completion` and `lead_won` checkpoints.

## 5. Case-link validation

The transactions POST endpoint no longer accepts `compliance_case_id`. `startOrGetTransactionFromOffer()` finds a case only through an exact server query on:

- organisation;
- offer;
- contact; and
- listing.

Compliance case creation/reuse now rejects caller-supplied listing or lead context that differs from the offer, verifies that a lead’s contact matches, and refuses to reuse a lead case for a different customer or property.

`complianceCaseMatchesContext()` provides a pure, tested relationship predicate. The authoritative gate uses it for organisation, customer, offer, listing, and lead comparisons.

The migration adds composite tenant foreign keys and context triggers for future inserts/updates. It does not silently repair existing data. The metadata-only preflight queries at the top of the migration identify rows requiring supervised remediation.

## 6. Evidence acceptance rules

`docCountsAsComplete()` now returns true only when:

- status is `accepted`; and
- the evidence has no expiry or its expiry is current.

`received`, `under_review`, `rejected`, `missing`, `requested`, and `expired` never satisfy verified-evidence completeness. The current date comparison treats a YYYY-MM-DD expiry as valid through the end of that UTC date.

Collection and final eligibility are separated. The UI and API now permit a collector to submit an incomplete case for reviewer guidance. That does not make the case approvable. Reviewers can request more information, but only accepted/current required evidence satisfies the final checkpoint.

## 7. Case approval preconditions

`mutateComplianceCase()` and `compliance_apply_mutation_atomic()` independently enforce the important conditions. Final approval requires:

- current status `under_review`;
- a reviewer authorised by `P.COMPLIANCE_REVIEW` and current reviewer settings;
- an actor different from the case creator, buyer agent, and recorded submitter;
- every required document accepted and unexpired;
- all required individual or corporate profile fields;
- required director and beneficial-owner records for a corporate customer;
- a risk level other than `unclassified`; and
- no unresolved EDD requirement.

Individual profile completeness now requires legal name, date of birth, nationality, identification type/reference, residential address, and source-of-funds status. Corporate completeness requires registered name, registration number, jurisdiction, registered address, at least one director, and at least one beneficial owner.

These checks do not assert that PEP, sanctions, identity-provider, corporate-registry, or beneficial-owner-provider screening occurred. Phase 1 introduces no such claim.

## 8. EDD restrictions

An `edd_required` case cannot be approved. Additionally, a case with a persisted `edd_reason` remains blocked even if its workflow status is subsequently returned to `under_review`.

This is deliberate fail-closed behaviour. Phase 1 has no structured EDD plan, evidence requirements, senior approval, or closure decision. A generic checkbox would falsely imply legal sufficiency. EDD closure belongs in a later legally reviewed phase. Until then, an authorised organisation must keep such a case restricted or use an externally governed process outside SegmiQ without marking the SegmiQ case approved.

## 9. Role and permission behaviour

The existing roles are preserved. Permission checks now participate directly in compliance decisions:

- salesperson: `P.COMPLIANCE_READ`, assigned-case collection only;
- client manager: `P.COMPLIANCE_READ` and `P.COMPLIANCE_REVIEW`, subject to reviewer flag policy;
- super administrator: no implicit tenant compliance read/review permission;
- Support Access: time-bound `COMPLIANCE` scope grants read-only access and never review/collection authority.

`COMPLIANCE_READ` and `COMPLIANCE_REVIEW` were added to the set of client-data permissions excluded from the normal super-admin baseline. The new Support Access scope maps only to `COMPLIANCE_READ`.

Compliance settings may be read under scoped support access, but only a tenant member with `SETTINGS_MANAGE` may change them.

## 10. Confidential response DTOs

`getComplianceCaseDetail()` no longer spreads an entire database row into an API response. `projectComplianceCaseRow()` constructs an explicit allowlist.

Salesperson/support-safe case data includes IDs required by the workflow, entity/status, safe status label, risk classification, editable CDD profile, assigned names, customer request message, and operational timestamps. It excludes internal notes, review notes, risk factors, decision reasons, reviewer identifiers, and EDD rationale.

Related-party responses expose only ID, name, and relationship to non-reviewers. Internal notes and contact linkage are reviewer-only. Document review notes are reviewer-only.

This default-deny projection prevents a future sensitive database column from being automatically exposed by `...row`.

## 11. Internal-note confidentiality

Internal notes use the event summary `Internal compliance note recorded`; the note text is kept in the restricted `after_value` and case field. Non-reviewer activity maps every event type through `safeComplianceEventSummary()` and never returns event before/after values.

Restricted, rejected, EDD, and risk events therefore produce generic salesperson messages. The same rule protects support-access reads because Support Access is read-only but not a client compliance-review authority.

No suspicion/STR capability was added. Such data must not use ordinary compliance events in a later phase.

## 12. Audit-event atomicity

The prepared `compliance_apply_mutation_atomic()` function locks the case, checks its expected status, applies the allowed case/document patch, and inserts the event before committing. Any failure rolls back all writes.

It is used for:

- submit for review;
- start review/reviewer assignment;
- request information;
- require EDD;
- change risk;
- approve;
- restrict;
- reject;
- accept/reject a document;
- reopen; and
- internal notes.

The event records organisation, case, actor, timestamp, event type, generic summary, structured before/after status and risk, a generated request identifier, and confidentiality classification. Raw document content is never stored.

The case is selected `FOR UPDATE`, and the function compares `p_expected_status`. Concurrent incompatible decisions cannot both commit from the same stale state.

## 13. Database hardening

The migration prepares:

- `submitted_by` for segregation of duties;
- structured event state, request ID, and confidential classification;
- composite `(client_id, id)` parent uniqueness;
- `NOT VALID` tenant-consistency foreign keys for documents, parties, events, and transaction case links;
- context triggers covering contact, lead, offer, listing, and transaction relationships;
- explicit RLS enablement;
- revocation of all compliance-table privileges from `PUBLIC`, `anon`, and `authenticated`;
- explicit service-role table privileges;
- append-only event update/delete prevention; and
- restricted function execution.

The privileged functions use `SECURITY INVOKER`, qualified relation names, and execute grants only for `service_role`. They are revoked from `PUBLIC`, `anon`, and `authenticated`, consistent with current Supabase guidance that database functions are callable by `PUBLIC` unless explicitly restricted.

## 14. Supabase migration files

Prepared migration:

`supabase/migrations/20261022113000_compliance_phase1_safety_baseline.sql`

It was not applied. The Supabase CLI generation attempt was unavailable in this environment, so the file was created using the repository’s timestamped migration convention and must receive normal migration review.

The `NOT VALID` constraints immediately protect new/changed relationships when installed but defer validation of historical rows. After preflight remediation, deployers should run explicit `VALIDATE CONSTRAINT` statements in a later reviewed migration.

No historical migration was edited.

## 15. R2 storage changes

Compliance object keys now use UUIDs and sanitised tenant/case path segments. Compliance storage configuration no longer depends on `CLOUDFLARE_R2_PUBLIC_URL`; private signed access needs credentials and a bucket, not a public origin.

The upload route validates:

- non-empty file;
- 20 MB maximum;
- allowed declared MIME;
- PDF/JPEG/PNG/WebP/HEIC file signature; and
- agreement between declared and detected type.

The object extension is chosen from the detected type, not a user filename. Content-Disposition filenames remove control characters, quotes, slashes, and excessive length.

Document reuse now verifies the source object is referenced by the same tenant, loads the source case, applies source-case visibility rules, and validates the private compliance prefix. Metadata is copied from the source record rather than trusted from the reuse request.

Before issuing a five-minute signed URL, `signComplianceDocument()` requires case access, exact case/document/tenant linkage, the private prefix, and a successfully written document-access audit event.

Malware scanning and bucket-origin privacy cannot be proved in source and remain deployment blockers.

## 16. Notification privacy

The information-request notification no longer appends a reviewer-entered reason. Current safe messages include:

- “A CDD case is ready for review.”
- “Additional customer documents are needed.”
- “Compliance has approved this case.”
- “Compliance review required before this transaction can proceed.”

Internal notes, EDD reasons, risk rationales, source-of-funds concerns, document identifiers, and screening details are not placed in normal notification previews. No second notification system or Important Messages feature was created.

## 17. Legacy compatibility

The implementation does not:

- approve, reject, revoke, or modify historical decisions automatically;
- promote received/under-review documents;
- reset risk classifications;
- invent reviewer/submitter identities;
- delete compliance records;
- enable hard gates for non-real-estate industries; or
- change quotation, construction, solar, trades, pricing, commission, reservation, or listing accounting rules.

Malformed compliance policy is blocked rather than silently approved. A valid policy with approval disabled remains not applicable. Non-real-estate clients remain outside the gate.

Legacy approved cases that do not meet the new conditions remain stored as approved; no transition automatically re-decides them. They should be reported for authorised review before relying on them for new transactions.

## 18. Test results

Focused command:

`node --import tsx --test --test-force-exit tests/real-estate-compliance.test.ts`

Result:

- 26 tests;
- 5 suites;
- 26 passed;
- 0 failed, cancelled, skipped, or todo.

Coverage includes applicable/non-applicable gates, no-case/pending/hold/approved behaviour, invalid policy, exact context matching, accepted/unexpired evidence, permissions, reviewer flag, source assertions for removed override fields, atomic RPC use and readiness guards, restricted SQL privileges, append-only events, file signatures/random keys, non-real-estate isolation, and preserved trades navigation/routes.

A temporary targeted TypeScript configuration included only changed entry points and their imported dependency graph. It completed with exit code 0 and no diagnostics. The temporary file was removed.

No full-project test, typecheck, lint, build, browser suite, local Supabase, or Docker service was run.

## 19. Untested integration scenarios

The following require staging with the migration installed:

- RPC discovery and typed argument compatibility through PostgREST;
- all SQL branches and raised error mappings;
- event rollback when event insertion is forced to fail;
- two concurrent approve/restrict/reject requests;
- simultaneous case decision and transaction progression;
- completion through the wrapper and existing finish function;
- RLS/grant behaviour for anon/authenticated/service roles;
- Support Access grant lifecycle and audit rows for compliance scope;
- `NOT VALID` constraint preflight and later validation;
- trigger behaviour on legacy mismatched rows;
- object upload/download against the actual R2 bucket;
- private-origin verification, encryption, lifecycle and access logging;
- notification delivery across in-app/email/push surfaces;
- offer-accept soft bootstrap failure and later transaction recovery;
- listing/lead/milestone check/update race windows;
- existing customers with incomplete legacy CDD profiles.

Pure tests do not establish production security.

## 20. Remaining critical blockers

1. **Migration not installed or database-tested.** Critical actions intentionally return 503 until it is deployed.
2. **No malware scanner/quarantine.** Magic-byte validation prevents simple MIME spoofing but not malicious valid PDFs/images.
3. **R2 privacy unverified.** Bucket public access, custom-domain exposure, encryption, region and lifecycle require infrastructure evidence.
4. **EDD closure unavailable.** EDD cases are safely blocked; operational closure must be designed in a later phase.
5. **No PEP/sanctions/TFS/identity/corporate screening.** Approval preconditions do not claim these controls passed.
6. **Listing, lead and milestone transitions are not yet in the same DB transaction as compliance evaluation.** They use the common fail-closed gate but retain a check/update race window. Transaction start/completion are atomic.
7. **Collection mutations are not all atomic with events.** Profile and related-party collection retain sequential writes; critical decisions are atomic.
8. **Legacy relationship violations are unknown.** Preflight queries must run before constraint validation.
9. **Support Access COMPLIANCE scope has not been exercised in staging.**
10. **Legal/policy confirmation remains required.** Phase 1 preserves current toggles and does not establish regulatory sufficiency.

## 21. Deployment dependencies

- Reviewed Supabase migration and confirmed existing base migrations/functions.
- Metadata-only preflight output reviewed by an authorised owner.
- Staging service-role access to the new RPCs.
- RLS/grant inspection and database advisor review.
- R2 private-bucket evidence and upload security decision.
- Tenant policy values validated as proper JSON booleans/arrays.
- Client manager/reviewer assignment and segregation-of-duties acceptance.
- Operational plan for cases returning 503 during an out-of-order release.
- Legal/compliance acceptance of current checkpoint semantics.

## 22. Safe migration order

1. Take a schema-only inventory and run the migration’s metadata preflight queries.
2. Resolve tenant/context violations under supervised change control; do not infer relationships.
3. Review SQL function ownership, `SECURITY INVOKER`, qualified relations, grants and triggers.
4. Apply the additive migration to an isolated staging project.
5. Confirm RPCs are absent to untrusted roles and callable only by the server service role.
6. Run database integration and concurrency tests.
7. Validate new writes under the `NOT VALID` constraints/triggers.
8. Deploy application source after the migration. If reversed, protected operations safely return 503, but the deployment creates an operational outage.
9. Observe logs/metrics without customer content.
10. After historical remediation, validate deferred constraints in a separate reviewed migration.
11. Promote through the normal production approval process.

Forward-fix is preferred. Dropping append-only or tenant controls as a rollback would weaken security. The additive columns are safe to leave in place if the application must be rolled back.

## 23. Staging verification procedure

1. Run the preflight queries and archive counts/IDs in a restricted change record.
2. Apply the migration in staging only.
3. Inspect `information_schema`/`pg_catalog` for columns, constraints, triggers, function owner/security mode and ACLs.
4. Confirm `anon` and `authenticated` cannot select/mutate compliance tables or execute the RPCs.
5. Confirm service-role calls can execute permitted functions.
6. Create synthetic tenants A/B, buyers, listings, offers, cases and transactions; use no real identity data.
7. Test all 24 scenarios requested in the task, including wrong tenant/buyer/offer/listing and missing/invalid policy.
8. Force audit insert failure and prove the case/document mutation rolls back.
9. Run concurrent final decisions and verify exactly one commits.
10. Change a case after one session reads it and verify transaction progression uses the locked current state.
11. Test support access with no grant, wrong scope, expired/revoked grant, correct COMPLIANCE grant and impersonation.
12. Upload signature-valid and spoofed files; confirm private keys and access events.
13. Verify notification payloads in every configured channel.
14. Verify non-real-estate synthetic workflows are unchanged.
15. Run Supabase database advisors and reviewed pgTAP/RLS tests before production approval.

## 24. Security acceptance checklist

- [x] Client compliance boolean removed.
- [x] Client-selected transaction compliance case removed.
- [x] Common structured gate implemented.
- [x] Invalid/unknown policy fails closed when checkpoint evaluation is required.
- [x] Exact case context checked.
- [x] Received/under-review/expired evidence rejected as verified evidence.
- [x] Strict approval preconditions in source and SQL.
- [x] Independent-review default enforced.
- [x] EDD cannot silently clear.
- [x] Salesperson case/event DTOs allowlisted.
- [x] Notification previews redacted.
- [x] Critical case decision/event RPC prepared.
- [x] Transaction start/completion atomic gate RPCs prepared.
- [x] RPC absence blocks rather than falls back.
- [x] Audit events append-only in prepared migration.
- [x] Data API grants revoked in prepared migration.
- [x] Tenant consistency constraints/triggers prepared.
- [x] Scoped Support Access integrated.
- [x] Random compliance object keys.
- [x] MIME signature validation.
- [x] Source-case authorisation for reuse.
- [x] Download access event required.
- [ ] Migration applied and inspected in staging.
- [ ] Database/concurrency/RLS integration tests passed.
- [ ] R2 bucket privacy and malware controls accepted.
- [ ] Remaining non-atomic transition windows addressed or formally accepted.
- [ ] Zimbabwe legal/compliance owner acceptance recorded.

## 25. Production readiness assessment

**Status: not production-ready; staging-ready after migration review.**

The source now fails safely around the defects that created the greatest immediate exposure. It does not treat collection as verification, does not accept a browser’s compliance verdict or case identity, does not allow a manager to approve their own created/owned/submitted case, does not expose raw internal event summaries to salespeople, and does not silently use sequential fallbacks for protected transaction progression/completion.

Production approval must wait for the additive migration to be reviewed and installed in staging, the untested scenarios to pass, actual database and R2 security to be evidenced, and the remaining blockers to be resolved or explicitly risk-accepted. This phase deliberately stops at the safety baseline and does not implement Phase 2–6 screening, EDD closure, regulatory filing, reporting, or new Compliance Centre functionality.

