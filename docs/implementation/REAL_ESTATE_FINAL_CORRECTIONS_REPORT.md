# Segmiq Real Estate — Final Corrections Report

Date: 16 October 2026
Companion document: `docs/implementation/REAL_ESTATE_RELEASE_HANDOFF.md`

## Readiness summary

| Level | Status | Evidence |
|---|---|---|
| **Code implemented** | Yes | Files listed in sections 4 and 5 |
| **Statically reviewed** | Yes, partially | Changed files were read and checked with editor diagnostics (no issues reported). No full-project typecheck or ESLint run. |
| **Targeted tests passed** | Yes | 10 test files, 155 tests, 0 failures, run one at a time (section 20) |
| **Database validated** | **Yes (production)** | All five migrations are applied to `gnnqzboaeezzevlwwryp` and verified; see `REAL_ESTATE_SUPABASE_DEPLOYMENT_REPORT.md` |
| **Build validated** | **No** | No build was run; the first Vercel preview build will be the first compile |
| **Runtime validated** | **No** | No server was started; no authenticated workflow was exercised |

This report does not claim the project builds, that the migrations apply cleanly, or that the workflows work in a browser.

---

## 1. Executive summary

The correction pass closed the gaps left by Phases 1 to 4 without rebuilding any engine:

- Offer acceptance and transaction completion or fall-through can now run as single Postgres transactions.
- Matching is category-aware and no longer silently stops at 300 records.
- Agent access to viewings, transactions, milestones and buyer contacts is narrowed to the records the agent actually works on.
- Mandates can be renewed, revoked and superseded. Professional valuations need evidence.
- Commissions keep cumulative amounts and payout history, and legacy commissions are backfilled as unverified.
- Staff handover is paged, checked for changes since the preview, and can be retried.
- The listing screen became a property register.
- Reports count each sale once, take commission from the ledger, and say when data is incomplete.

Two customer-facing behaviours changed on purpose:

- Creating a listing no longer sends automatic WhatsApp messages to customers. Matches are recorded for agents to act on.
- `send-match` is limited to contacts the agent owns, and no longer returns phone numbers.

All schema changes are in one new additive migration. The four earlier phase migrations were reviewed but not edited.

## 2. Issues resolved

| Area | Issue | Resolution |
|---|---|---|
| Transactions | Offer acceptance and completion were multi-step writes that could leave a listing and its transaction out of step | `re_accept_offer` and `re_finish_transaction` in the correction migration, called through `callAtomic` |
| Acquisition | Converting an opportunity twice could create two listings | Conditional claim on `converted_listing_id`; the losing request deletes its own draft and returns the winner |
| Matching | Candidate scans stopped at 300 rows with no notice | Paged scans (`MATCH_PAGE_SIZE` 500, `MATCH_SCAN_CEILING` 5000) that report `incomplete` |
| Matching | No property type; apartments matched house searches | `property_category` / `property_categories` plus `categoryFit` |
| Interests | "Not interested" was contact-wide, hiding a listing from all of a buyer's searches | Unique per `(client_id, search_id, listing_id)` |
| Notifications | Stale match notifications stayed live after price or status changes | `invalidated_at` / `invalidated_reason`, revived only when the listing fingerprint changes |
| Viewings | Agents could see other agents' viewings and buyer phones | `viewingAccess` returns `full`, `listing_only` or `none`; contacts are masked for `listing_only` |
| Mandates | No renewal, revocation or superseding | `renewMandate`, `revokeMandate`, supersede inside `reviewMandate`, guarded one-approved-per-listing index |
| Valuations | Professional valuation could be recorded with no evidence | `valuationEvidenceError` plus the `NOT VALID` database check |
| Commissions | Later statuses cleared earlier amounts; no payout history; legacy commissions invisible to the ledger | Cumulative columns, `real_estate_commission_payouts`, unverified backfill |
| Commissions | Beneficiary was a free-text ID | Picker of active organisation staff |
| Transactions UI | No milestone, document or participant workspace | `TransactionOperations.tsx` |
| Handover | Discovery stopped at a fixed row count; executing after records changed was not detected | Paged discovery, fingerprint drift check, skipped and failed items, retry |
| Listings | List showed only price and status | Register with mandate state, sourcing agent, activity counts, issues and actions |
| Reports | Sales could be counted twice; commission came from legacy fields only; rows silently capped | `reportSaleOnce`, `ledgerCommissionSummary`, paged loaders returning `incomplete` |
| Privacy | Listing creation sent WhatsApp to matched customers | Removed; matching runs in the background and records matches only |
| Privacy | `send-match` worked on any contact and returned the phone | Ownership check; returns the contact name only |
| Milestones | Any agent could tick `commission_settled` | Manager-only; other milestones need deal involvement |
| Introductions | A declined introduction could be re-requested and reset | Existing requested or accepted introductions are returned; declined ones return 409 |

## 3. Issues not resolved

- **Transactions list cap.** `listRealEstateTransactions` keeps `.limit(500)`. For agents, owned listing IDs in the filter are capped at 250 and participant transactions at 250 (`lib/real-estate/transaction-service.ts` lines around 302–325). Large agencies may not see older transactions in the list. Opening by ID still works.
- **Offers list cap.** `lib/real-estate/offer-service.ts` uses `.limit(500)` for the offers list.
- **Listings list cap.** `components/real-estate/ListingsManager.tsx` loads up to 1000 listings (`LISTING_PAGE_LIMIT`). It shows a notice when the limit is reached instead of paging further.
- **Small dashboard limits.** The attention feed (`agencyAttentionFeed`) uses `limit(20)` per category, and commission disputes in `listCommissions` use `limit(100)`. These are summary widgets, not reports.
- **Viewing reminders batch.** `lib/real-estate/viewing-reminders.ts` handles 200 viewings per run. The cron schedule must run often enough.
- **Mandate and valuation evidence storage.** Evidence is stored as company documents, so normal company document visibility rules apply to it.
- **Silent atomic fallback.** When the atomic functions are missing, the fallback path does not log anything.
- **Not verified here:** builds, migrations and browser behaviour (see sections 21–26).

## 4. Files created

| Path | Purpose |
|---|---|
| `supabase/migrations/20261016220000_real_estate_final_corrections.sql` | Correction migration (12 sections, 3 functions) |
| `lib/real-estate/atomic-rpc.ts` | `callAtomic`, `isMissingFunctionError`, `parseAtomicError` |
| `lib/real-estate/paging.ts` | `readAllPages`, `chunk` |
| `lib/real-estate/viewing-access.ts` | `viewingAccess`, `canChangeViewing`, `viewingTransitionError`, `maskViewingContact`, `viewingReminderDue` |
| `lib/real-estate/listing-register-rules.ts` | `registerMandateState`, `registerIssues`, `canOpenRegisterTransaction`, labels |
| `lib/real-estate/feature-flags.ts` | `reAgencyOperationsEnabled`, `RE_AGENCY_OPERATIONS_DISABLED_MESSAGE` |
| `app/api/clients/[clientId]/listings/register/route.ts` | Property register metrics endpoint |
| `app/api/clients/[clientId]/transactions/[transactionId]/documents/route.ts` | Private transaction document upload and download |
| `components/real-estate/transactions/TransactionOperations.tsx` | Milestones, documents and participants workspace |
| `components/real-estate/acquisition/MandateActions.tsx` | Renew and revoke mandate actions |
| `components/real-estate/listings/ListingRegisterDetails.tsx` | Register details panel in the listing preview |
| `tests/real-estate-final-corrections.test.ts` | 40 tests for the correction pass |
| `docs/implementation/REAL_ESTATE_RELEASE_HANDOFF.md` | Release handoff |
| `docs/implementation/REAL_ESTATE_FINAL_CORRECTIONS_REPORT.md` | This report |

## 5. Files modified

**Library**

- `lib/real-estate/offer-service.ts` — atomic accept with sequential fallback.
- `lib/real-estate/transaction-service.ts`:
  - Atomic finish.
  - Milestone permission checks.
  - Participant-aware agent filter.
  - Match invalidation on close.
- `lib/real-estate/buyer-match.ts`:
  - Categories and `categoryFit`.
  - Candidate filters and paging constants.
  - `notificationPlan`, rejection fingerprints.
- `lib/real-estate/buyer-sales-service.ts`:
  - `discoverMatchesForListing` and `invalidateListingMatchNotifications`.
  - Search-specific interests.
  - Introduction status protection.
  - Assigned agent validation.
  - Paged metrics and report.
- `lib/real-estate/acquisition-service.ts`:
  - Categories.
  - Paged opportunity list.
  - Conversion claim.
  - `renewMandate`, `revokeMandate`, supersede in `reviewMandate`.
- `lib/real-estate/acquisition-plan.ts` — `mandateRenewalError`, `mandateRevocationError`, `mandateApprovalConflict`, `valuationEvidenceError`, `canRecordProfessionalValuation`.
- `lib/real-estate/agency-operations.ts`:
  - `commissionTotals`, `cumulativePatch`.
  - `documentDecisionError`, `canSeeTransactionDocument`.
  - `handoverRecordKey`, `handoverDrift`.
- `lib/real-estate/agency-service.ts`:
  - Commission payouts and cumulative amounts.
  - Beneficiary validation.
  - Paged handover with drift check and retry.
  - Document link and review, milestone assignment.
- `lib/real-estate/operations-report.ts` — `ledgerCommissionSummary`, `reportSaleOnce`, cancelled-viewing exclusion, `incomplete`.
- `lib/real-estate/viewing-reminders.ts` — reminder dedupe.
- `lib/real-estate/foundation-sync.ts`, `lib/real-estate/listings.ts` — category support.
- `lib/storage/r2.ts` — **shared file.** Added `generateTransactionDocumentKey` and `isTransactionDocumentKeyForClient`; existing functions are unchanged.

**API routes**

- `app/api/clients/[clientId]/listings/route.ts` — no customer WhatsApp on create; background matching; `property_category`; limit up to 1000.
- `app/api/clients/[clientId]/listings/[listingId]/route.ts` — category and match invalidation on update.
- `app/api/clients/[clientId]/listings/[listingId]/send-match/route.ts` — ownership check; no phone number in the response.
- `app/api/clients/[clientId]/viewings/route.ts` — scoped listing, masking, change permissions.
- `app/api/clients/[clientId]/mandates/route.ts` — mandate history and states.
- `app/api/clients/[clientId]/acquisitions/route.ts` — `propertyCategory`.
- `app/api/clients/[clientId]/acquisitions/[opportunityId]/actions/route.ts` — `renew_mandate`, `revoke_mandate`.
- `app/api/clients/[clientId]/inspections/route.ts` — chunked and paged, `incomplete`.
- `app/api/clients/[clientId]/buyer-searches/route.ts`, `app/api/clients/[clientId]/buyer-searches/[searchId]/route.ts` — `propertyCategories`.
- `app/api/clients/[clientId]/agency/route.ts` — feature switch on commission and handover actions only.

**Components**

- `components/real-estate/ListingsManager.tsx` — register columns, category field, register details panel, limit notice.
- `components/real-estate/transactions/TransactionsWorkspace.tsx` — `?open=<transactionId>` deep link.
- `components/real-estate/agency/CommissionsWorkspace.tsx` — beneficiary picker, cumulative totals, payouts.
- `components/real-estate/agency/HandoverWorkspace.tsx` — paged preview, drift message, retry.
- `components/real-estate/acquisition/AcquisitionDetail.tsx` — inspection category and other details.
- `components/real-estate/acquisition/AcquisitionLists.tsx` — mandate states and actions.
- `components/real-estate/buyers/BuyerSalesWorkspace.tsx` — category chips.
- `components/real-estate/buyers/BuyerSearchDetail.tsx` — category chips; listing pickers for viewings and rental applications.
- `components/real-estate/RealEstateReportsWorkspace.tsx` — "Completed in this period" and the gross commission tile.

**Tests**

- `tests/real-estate-phase4.test.ts` — `reportSaleOnce` array form and `duplicatesIgnored`.

## 6. Database migrations added

`supabase/migrations/20261016220000_real_estate_final_corrections.sql`:

- **Prerequisite guard.** Raises an exception if the Phase 1–4 tables are missing.
- **Sections:**
  1. Property categories.
  2. Search-specific interests.
  3. Notification invalidation.
  4. Viewing reschedule history and reminder dedupe.
  5. Mandate renewal, revocation and superseding.
  6. Valuation evidence.
  7. Document review states.
  8. Cumulative commissions and payouts.
  9. Legacy commission backfill.
  10. Handover batches.
  11. Atomic functions.
  12. Register metrics function.
- **Guarded indexes.** `idx_re_mandates_one_approved_listing` and `idx_re_handover_items_unique` are skipped with a `NOTICE` if duplicates exist.
- **Not guarded.** `idx_re_interests_search_listing` will fail if duplicate `(client_id, search_id, listing_id)` rows exist. A pre-check query is in the handoff, section E.
- **Security.** Functions are `SECURITY INVOKER`, revoked from `PUBLIC`, `anon` and `authenticated`, and granted to `service_role`. `real_estate_commission_payouts` has RLS enabled and access revoked from `anon` and `authenticated`.

## 7. Existing migrations reviewed

These were reviewed and **not modified** in this pass (their file timestamps predate the pass):

- `supabase/migrations/20261016013000_real_estate_phase1_foundation.sql`
- `supabase/migrations/20261016042000_real_estate_phase2_acquisition.sql`
- `supabase/migrations/20261016120000_real_estate_phase3_buyer_sales.sql`
- `supabase/migrations/20261016180000_real_estate_phase4_agency_operations.sql`

Gaps found in them are corrected in the new file rather than by editing applied history:

- The contact-wide interest uniqueness.
- No category columns.
- No mandate history columns.
- No payout table.
- Commission amounts not cumulative.
- No handover item uniqueness.

## 8. Transaction integrity improvements

- **`re_accept_offer`** locks the offer and listing, rejects acceptance when another offer already holds the listing, updates the listing status, and writes offer and listing status events, all in one transaction.
- **`re_finish_transaction`** handles completion, cancellation and fall-through in one transaction:
  - It locks the transaction and listing.
  - It blocks completion while another active transaction exists for the listing.
  - It writes transaction and listing status events.
  - On failure it cancels unverified commissions. Verified or paid commissions are never cancelled.
- **Error mapping.** Business errors are raised as `RE4xx: message` and mapped to HTTP status codes by `parseAtomicError`. A unique violation (`23505`) becomes 409; serialization failures (`40001`, `40P01`) become 409 "try again".
- **Fallback.** When a function is not deployed, `callAtomic` returns `missing`, and the previous sequential code runs. Other database errors are returned, not swallowed.
- **Conversion race.** Acquisition conversion is safe against double submits: the claim is `.is("converted_listing_id", null)`.

## 9. Property matching improvements

- **Categories.** The categories are house, apartment, townhouse, residential stand, commercial, industrial, agricultural and other. `wantedCategories` also reads the legacy free-text `propertyType`. `categoryFit` returns `confirmed`, `conflict`, `unknown` or `no_preference`. Unclassified legacy listings are `unknown`: they remain possible matches and are not excluded.
- **Paged scans.** `listingCandidateFilter` and `searchCandidateFilter` push price filters to the database, and scans page up to the ceiling with an `incomplete` flag.
- **Background matching.** `discoverMatchesForListing` runs in the background after listing creation and records matches only. No WhatsApp is sent to customers.
- **Notifications.** `notificationPlan` never repeats live notifications. It revives invalidated ones only when the listing fingerprint (price, suburb, status) changed. Notifications are invalidated when a listing closes, a mandate is revoked, or a listing stops being live.
- **Interests.** Interests are per search. A rejection carries a fingerprint, and `rejectionStillApplies` lets a material listing change bring a rejected property back.

## 10. Viewing permission changes

- **Managers** have full access.
- **Agents:**
  - `full` access when they are the viewing agent or the buyer search agent.
  - `listing_only` when they are only the listing agent: the buyer contact is masked by `maskViewingContact`.
  - `none` otherwise. Those viewings are filtered out of `GET /api/clients/[clientId]/viewings`.
- **Allowed changes.** `canChangeViewing` restricts which changes each access level may make (status, reschedule, feedback, reassign, confirm, follow-up). Reassignment checks that the target agent is in the organisation and checks for overlapping viewings.
- **Status changes** are validated by `viewingTransitionError`.
- **Excluded from counts.** Cancelled viewings no longer count towards register metrics or popular-property reports.
- **Tests.** `tests/re-agent-viewings.test.ts` (8 tests) and the viewing-access cases in `tests/real-estate-final-corrections.test.ts`.

## 11. Mandate workflow completion

- **Renew.** `renewMandate` creates a new mandate linked through `previous_mandate_id`. On approval, `reviewMandate` marks the previous one `superseded`. If that step fails, the previous status is restored.
- **Revoke.** `revokeMandate` requires a reason, records an event, and invalidates match notifications for the listing.
- **Approval conflict.** `mandateApprovalConflict` blocks a second approved mandate on the same listing. The guarded unique index enforces this in the database once applied.
- **Valuations.** A professional valuation needs a document or a verification reference (`valuationEvidenceError`). Only manager roles may record one (`canRecordProfessionalValuation`).
- **UI.** `MandateActions.tsx` provides renew and revoke; `AcquisitionLists.tsx` shows mandate states.

## 12. Commission corrections

- **Cumulative amounts.** `commissionTotals` and `cumulativePatch` keep approved, received and paid amounts from being cleared by later status changes.
- **Payouts.** Payouts are recorded per allocation in `real_estate_commission_payouts`. `payoutProgress` returns unpaid, partially paid or paid.
- **Beneficiaries.** Beneficiaries are chosen from active organisation staff and validated server-side.
- **Self-approval and receipts.** `canApproveOwnCommission` blocks self-approval. Receipt verification and payouts are manager or finance only.
- **Legacy backfill.** Transactions with legacy commission fields and no ledger row get an unverified commission. The original values are kept in `legacy_fields`, and `commission_settled_at` is not treated as verified cash.
- **Status order.** `commissionActionBlocked` stops statuses from moving backwards.

## 13. Transaction UI improvements

`components/real-estate/transactions/TransactionOperations.tsx` adds:

- **Milestones** with assignee and due date (`assignMilestone`).
- **Private documents** uploaded through `app/api/clients/[clientId]/transactions/[transactionId]/documents/route.ts`. Uploads start as `awaiting_review`. Managers verify, reject or request a replacement; rejection needs a reason (`documentDecisionError`).
- **Participants.** Add and end participants.

`TransactionsWorkspace.tsx` opens a transaction from `?open=<id>`, which the property register links to.

## 14. Handover improvements

- **Discovery.** `previewHandover` discovers all open work per record type with paging. It reports `incomplete` and `unavailable` types, and lists what is deliberately unchanged:
  - Sourcing agent on acquisitions.
  - Commission beneficiaries.
  - WhatsApp sessions.
  - Closed records.
  - The user account.
- **Drift check.** `executeHandover` compares the preview fingerprint with the current records (`handoverDrift`) and refuses to run if they differ.
- **Item results.** Items are applied in groups, and each is recorded as applied, skipped or failed. The status becomes `partial` when some items fail.
- **Retry.** `retryHandover` re-applies failed items only. The unique index on `(handover_id, record_type, record_id)` prevents duplicates.

## 15. Property register improvements

- **Endpoint.** `POST /api/clients/[clientId]/listings/register` accepts up to 1000 listing IDs. It uses `re_listing_register_metrics` when deployed and a paged fallback otherwise.
- **Per-listing data:**
  - Mandate state: approved, expiring within 30 days, expired, awaiting, revoked, legacy unverified, or none.
  - Sourcing agent.
  - Interest, viewing and offer counts.
  - Active transaction.
  - Issues: not approved, no agent, no price, no photos, mandate problems. No issues are reported for sold or let listings.
- **Agent restrictions.** Agents see aggregate counts only. `activeTransactionId` is returned only when `canOpenRegisterTransaction` allows it.
- **UI.** `ListingRegisterDetails.tsx` offers privacy-masked buyer matching, an open-transaction link, a collaboration request and an introduction request.

## 16. Reporting corrections

- **Sales counted once.** `reportSaleOnce` counts each transaction once and reports `duplicatesIgnored`.
- **Commission from the ledger.** `ledgerCommissionSummary`:
  - Uses live ledger rows ahead of legacy rows, and ignores cancelled rows.
  - Falls back to legacy transaction fields only when there is no ledger row.
  - Gives one figure per transaction.
  - The definition text keeps "This is not cash received".
- **Missing ledger table.** If the table is missing, the summary uses legacy figures. Any other database error is thrown, not hidden.
- **No silent caps.** Acquisitions, inspections, buyer metrics and buyer operations reports page through results and return `incomplete`.
- **UI.** The reports workspace shows "Completed in this period" and a gross commission tile split into verified, legacy and without commission.

## 17. Tenant isolation and access review

- **Route access.** Every changed route uses `requireClientAccessFromRequest` (or the session plus `canAccessClient`). Every query is filtered by `client_id`.
- **Cross-organisation references.** Lookups of other records (listings, users, searches, mandates) are also organisation-scoped. Examples:
  - The listing in an introduction request must belong to the organisation.
  - A search's assigned agent must be an active user of the organisation.
- **Storage keys.** Document keys include the organisation and are checked on download (`isTransactionDocumentKeyForClient`).
- **WhatsApp and directory leaks fixed:**
  - Listing creation no longer messages customers.
  - `send-match` checks ownership and returns names, not phones.
  - Viewing contacts are masked for listing-only access.
  - Register metrics are aggregates.
- **Milestones.** Non-managers must be a SALESPERSON involved in the deal. `commission_settled` is manager-only.
- **Database access.** The three functions are only executable by `service_role`. No RLS policy on existing production tables was changed.

## 18. Navigation and mobile corrections

- **Static review, no code changes.** I compared `lib/sales/navigation/sales-nav-config.ts` and the company navigation configuration against the Real Estate routes; every route has an entry.
- **Agent mobile.** The mobile primary items are dashboard, WhatsApp, listings and tasks (`AGENT_PRIMARY_NAV_IDS`), shown as Home, Inbox, Properties and Activities, plus Menu.
- **Handover.** Handover is reached from `/client/agency/team` and is matched under Team Management.
- **Tests.** `tests/company-nav-config.test.ts` passes (3 tests). Visual mobile behaviour was not checked in a browser.

## 19. Cross-system integration results

Verified by code reading and targeted tests, not by runtime:

- Acquisition conversion creates one listing and links `acquisition_opportunity_id`, and the register shows the sourcing agent.
- Listing creation and updates trigger matching and notification invalidation.
- Offer acceptance and transaction completion keep listing status, offer status and events in step, atomically once migrated.
- A fall-through cancels the commission (`cancelCommissionForFailedTransaction` or the atomic function).
- A mandate revocation invalidates match notifications.
- Reports use the same `reportSaleOnce` and ledger rules as the commission workspace.
- Solar and Trades flows were not changed. The only shared file modified is `lib/storage/r2.ts`, where new functions were added and existing ones were left unchanged.

## 20. Targeted tests executed

Each file was run on its own with `node .\node_modules\tsx\dist\cli.mjs --test tests\<file>.test.ts`:

| Test file | Tests | Result |
|---|---|---|
| `tests/real-estate-final-corrections.test.ts` | 40 | 40 pass |
| `tests/real-estate-phase4.test.ts` | 12 | 12 pass |
| `tests/real-estate-phase1.test.ts` | 19 | 19 pass |
| `tests/real-estate-phase3.test.ts` | 22 | 22 pass |
| `tests/real-estate-acquisition.test.ts` | 10 | 10 pass |
| `tests/real-estate-offers.test.ts` | 17 | 17 pass |
| `tests/real-estate-sales.test.ts` | 16 | 16 pass |
| `tests/re-agent-viewings.test.ts` | 8 | 8 pass |
| `tests/company-nav-config.test.ts` | 3 | 3 pass |
| `tests/real-estate-gating.test.ts` | 8 | 8 pass |
| **Total** | **155** | **155 pass, 0 fail** |

These tests cover pure rules: categories, candidate filters, rejections, notification plans, commission rules, ledger summary, document decisions, handover drift, atomic error parsing, paging, viewing access, mandates, register rules, the feature switch, sale de-duplication and navigation configuration. They do not touch a database.

## 21. Tests not executed due to machine limitations

- Full test suite. Only the ten files above were run.
- `tests/real-estate-compliance.test.ts` and `tests/real-estate-marketing.test.ts`. Those areas were not changed in this pass.
- Full-project `tsc --noEmit` and ESLint.
- `next build` / `vercel build`.
- Any test against Supabase, including migrations, the atomic functions, the register function and the backfill.
- Any server-backed or browser test.
- `git diff --check` was used on tracked files only. Most Real Estate files are untracked, so it did not cover them.

## 22. Database deployment requirements

- **Order.** Apply the five migrations in the order listed in the handoff, section C. Only file 5 is new in this pass.
- **Before applying:**
  - Take a backup.
  - Apply to staging first.
  - Run the three duplicate checks in the handoff, section E. The interest duplicate check is mandatory.
- **After applying:**
  - Confirm `re_accept_offer`, `re_finish_transaction` and `re_listing_register_metrics` exist.
  - Check the output for `Skipped idx_…` notices.
  - Check the backfill count.
- **Production.** Apply the single file explicitly after approval. Do not run a broad `supabase db push`.

## 23. Vercel readiness checklist

- [ ] Staging database has all five migrations, and the duplicate checks are clean.
- [ ] Environment variables set for Preview and Production (names in the handoff, section G).
- [ ] Changes committed on a feature branch. Untracked Real Estate files are included.
- [ ] Preview build log shows `Compiled successfully` with no `Type error:` or ESLint errors.
- [ ] Preview runtime logs show no 503 "migration" messages.
- [ ] Browser and security checks passed on the preview (handoff, sections I and J).
- [ ] Production backup taken, file 5 applied, then merged.

None of these items has been completed by the implementation pass.

## 24. Known limitations

- **List caps:**
  - Transactions list: 500 rows, with 250-ID agent filters.
  - Offers list: 500 rows.
  - Listings screen: 1000 rows, with a notice.
- **Dashboard widgets:** the attention feed shows 20 items per category, and commission disputes are limited to 100.
- **Viewing reminders:** 200 per cron run.
- **Atomic fallback:** without migration file 5, acceptance and completion are not atomic, and the fallback is silent.
- **Categories:** legacy listings and searches have no category until edited. They are treated as possible matches.
- **Backfilled commissions:** these are unverified and need manager review before counting as verified.
- **Evidence visibility:** mandate and valuation evidence follow company document visibility.
- **Feature switch scope:** `RE_AGENCY_OPERATIONS` disables commission and handover actions only. It does not hide navigation items.

## 25. Manual browser acceptance checklist

The full checklist is in the handoff, section I. Summary:

1. Manager and agent navigation, including the agent mobile bar.
2. Acquisition, then mandate approval, then conversion; a repeat conversion returns the same listing.
3. Mandate renew, revoke, and a valuation without evidence being rejected.
4. Listing creation with a category, no customer WhatsApp, and register details.
5. Buyer search categories and a per-search "not interested".
6. Viewing visibility across three agents, with contact masking.
7. Offer acceptance, transaction milestones, document upload and review, completion and fall-through.
8. Commission creation, approval, partial and full payout.
9. Handover preview, blocking after a change, execution and retry.
10. Report figures matching the source records.
11. `RE_AGENCY_OPERATIONS=off` behaviour.
12. Cross-tenant and agent-restriction checks (handoff, section J).

## 26. Production rollout blockers

These must be cleared before production use:

1. **No build has been run.** Type and lint errors may exist that editor diagnostics did not show. A Vercel preview build must pass.
2. **Resolved.** All five migrations, including file 5, are applied to production and verified. The interest duplicate pre-check returned no rows.
3. **No runtime or browser validation.** The checklists in the handoff, sections I and J, must pass on a preview pointed at staging.
4. **Behaviour changes need business sign-off:**
   - Listing creation no longer sends customer WhatsApp messages.
   - `send-match` is restricted to owned contacts.
   - `commission_settled` is manager-only.
5. **Backfilled legacy commissions need review.** They appear as unverified and should be reviewed before commission figures are used for payouts.
6. **Changes are not committed.** Nothing has been committed or pushed, and many Real Estate files are untracked.
