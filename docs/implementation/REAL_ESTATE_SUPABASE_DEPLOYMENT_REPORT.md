# Segmiq Real Estate — Supabase Deployment Report

Date: 16 October 2026
Status: **DEPLOYED AND VERIFIED.** All five Real Estate migrations are applied to production and the post-deployment checks pass. The application code is not deployed yet (section 17).

All work went through the authenticated Supabase MCP connection. No local build, dev server, Docker, local Supabase, GitHub push or Vercel deployment was used.

---

## 1. Supabase project

| Item | Value |
|---|---|
| Project name | `leadstaq` |
| Project reference | `gnnqzboaeezzevlwwryp` |
| Organisation | Adlense Network (`hcrhqcmbfhwdtorzhilr`), Pro plan |
| Region | eu-west-1 |
| Postgres | 17.6.1.104 |
| Status | ACTIVE_HEALTHY |
| Branches | None |

This is the only project visible to the connected account. `.env.local` points `NEXT_PUBLIC_SUPABASE_URL` at this same reference, so it is the database the SegmiQ application uses.

## 2. Environment

**Production.** Evidence:

- 29 organisations (10 not archived), 61 users, 1,636 leads and 1,492 contacts.
- A lead was created on the day of deployment.
- Solar, Trades, logistics, tyre, vehicle-hire, marketing and professional-services organisations are active.
- There is no separate staging project or branch.

Because this is production, I stopped before changing anything and asked for approval. The project owner approved applying all five migrations to `gnnqzboaeezzevlwwryp`, in order, with one transaction each.

## 3. Backup and restore availability

- The organisation is on the **Pro** plan, which includes daily backups.
- The MCP connection has no backup tool, so I could not read the restore point myself.
- **The project owner confirmed in the Supabase dashboard that a recent backup or point-in-time recovery restore point exists** before approving the deployment.

## 4. Migration history before deployment

- `supabase_migrations.schema_migrations` held 38 rows. The latest was `20261012194500 demo_guest_sessions`.
- None of the five Real Estate migrations was recorded, and none of their 30 tables existed.

**The history already differed from the local folder:**

- Earlier migrations were recorded under apply-time version numbers rather than their file names. For example, local `20261003190000_work_projects.sql` is recorded as `20261003194046 work_projects`.
- These local files are not recorded at all, although most of their tables exist:

  | Local file | Tables present |
  |---|---|
  | `20260919120000_social_inbox.sql` | Yes |
  | `20260919210000_support_access.sql` | Yes |
  | `20260921020000_weekly_team_performance_reports.sql` | Yes |
  | `20260924120000_demo_workspaces.sql` | Yes |
  | `20261011140000_sales_dashboard_visits.sql` | **No — `sales_dashboard_visits` is missing** |
  | `068_whatsapp_contact_profile.sql`, `069_whatsapp_qualification.sql` | Their columns exist |

Because of this, `supabase db push` was not used. It would have tried to re-run migrations that were already applied. Each of the five files was applied individually.

## 5. Migrations applied

Each was applied with the Supabase MCP `apply_migration` tool, which runs the file as a single transaction.

| Order | Local file | Recorded version and name | Result |
|---|---|---|---|
| 1 | `20261016013000_real_estate_phase1_foundation.sql` | `20261016142310 real_estate_phase1_foundation` | Failed on the first attempt and rolled back; succeeded after the correction in section 8 |
| 2 | `20261016042000_real_estate_phase2_acquisition.sql` | `20261016142357 real_estate_phase2_acquisition` | Success |
| 3 | `20261016120000_real_estate_phase3_buyer_sales.sql` | `20261016142425 real_estate_phase3_buyer_sales` | Success |
| 4 | `20261016180000_real_estate_phase4_agency_operations.sql` | `20261016142455 real_estate_phase4_agency_operations` | Success |
| 5 | `20261016220000_real_estate_final_corrections.sql` | `20261016142637 real_estate_final_corrections` | Success |

Migrations 2 to 5 were applied with exactly the contents of the repository files.

## 6. Migrations skipped because already applied

None. All five were outstanding before deployment.

## 7. SQL errors encountered

One error, on the first attempt at Phase 1:

```
ERROR: 42P01: invalid reference to FROM-clause entry for table "v"
LINE 44: JOIN contacts c ON c.id = v.contact_id
```

The cause was the backfill that copies `client_id` onto `viewings`. In Postgres, an `UPDATE … FROM` cannot reference the target table (`v`) inside a `JOIN … ON` clause in the `FROM` list.

**Rollback confirmed.** After the failure:

- `viewings.client_id` did not exist.
- `real_estate_migration_reviews` did not exist.
- `re_viewings_enforce_tenant` did not exist.
- Migration history was still 38 rows, with `20261012194500` as the latest.

Nothing from the failed attempt remained.

## 8. Database corrections performed

**One correction to a migration file that had never been applied anywhere.** In `supabase/migrations/20261016013000_real_estate_phase1_foundation.sql`, the join condition moved from `JOIN … ON` into `WHERE`. The behaviour is the same: the statement updates the same rows under the same organisation check.

```sql
UPDATE viewings v
SET client_id = l.client_id
FROM listings l, contacts c
WHERE v.listing_id = l.id
  AND c.id = v.contact_id
  AND v.client_id IS NULL
  AND c.client_id = l.client_id;
```

- I searched all five files for the same `UPDATE … FROM … JOIN` pattern. This was the only one.
- No applied migration was edited, and migration history was not altered by hand.
- No customer data had to be corrected. The pre-flight checks found no duplicates or organisation mismatches (section 14).

## 9. Tables created

All 30 tables exist:

| Migration | Tables |
|---|---|
| Phase 1 | `real_estate_migration_reviews`, `real_estate_listing_status_events`, `real_estate_contact_roles`, `real_estate_buyer_searches`, `real_estate_property_interests`, `real_estate_listing_parties`, `activity_subjects` |
| Phase 2 | `real_estate_acquisition_opportunities`, `real_estate_acquisition_events`, `real_estate_inspections`, `real_estate_inspection_photos`, `real_estate_price_discussions`, `real_estate_mandates`, `real_estate_mandate_events` |
| Phase 3 | `real_estate_buyer_search_events`, `real_estate_match_notifications`, `real_estate_buyer_introductions`, `real_estate_rental_applications` |
| Phase 4 | `real_estate_deal_participants`, `real_estate_collaboration_requests`, `real_estate_commission_templates`, `real_estate_commissions`, `real_estate_commission_allocations`, `real_estate_commission_events`, `real_estate_commission_disputes`, `real_estate_transaction_documents`, `real_estate_handovers`, `real_estate_handover_items`, `real_estate_staff_capabilities` |
| Final corrections | `real_estate_commission_payouts` |

Every one of the 30 has a foreign key to `clients` for organisation scoping.

Columns added to **existing** tables:

| Table | New columns |
|---|---|
| `viewings` | `client_id`, `buyer_search_id`, `confirmation_status`, `outcome`, `instructions`, `idempotency_key`, plus reschedule and reminder columns |
| `listings` | `acquisition_opportunity_id`, `property_category` |
| `leads` | `buyer_search_id` |
| `real_estate_offers` | `reserves_listing`, `buyer_search_id`, `property_interest_id` |
| `real_estate_transaction_milestones` | Assignee columns |

## 10. Functions created

| Function | Returns | Security | `search_path` | `anon` | `authenticated` | `service_role` |
|---|---|---|---|---|---|---|
| `re_accept_offer(p_client_id uuid, p_offer_id uuid, p_expected_updated_at timestamptz, p_patch jsonb, p_actor_id uuid, p_event_amount numeric, p_event_note text)` | `jsonb` | Invoker | `public` | No | No | Yes |
| `re_finish_transaction(p_client_id uuid, p_transaction_id uuid, p_action text, p_reason text, p_actor_id uuid)` | `jsonb` | Invoker | `public` | No | No | Yes |
| `re_listing_register_metrics(p_client_id uuid, p_listing_ids uuid[])` | Table of per-listing metrics (stable) | Invoker | `public` | No | No | Yes |

**Tenant-check trigger functions:** `re_viewings_enforce_tenant`, `re_assert_contact_tenant`, `re_assert_listing_tenant` and `re_acq_enforce_tenant`.

- Postgres only allows trigger functions to run as triggers, so their default execute grant cannot be used to call them directly.
- They do not pin `search_path` (see section 12).

**Non-mutating function checks on production:**

- `re_listing_register_metrics` for the test organisation returned 10 rows. Interest counts, viewing counts and `legacy_unverified` mandate status all matched the backfilled data.
- `re_accept_offer` with a random offer id raised `RE404: Offer not found.`
- `re_finish_transaction` with a random transaction id raised `RE404: Transaction not found.`
- Both functions raise this error before any write. Offers and transactions were 0 before and after these calls.

## 11. Indexes and constraints verified

- **Indexes.** All 58 expected indexes exist and are valid, including 14 unique indexes.
  - No guarded index was skipped: `idx_re_offers_one_reserving`, `idx_re_txn_one_active_per_listing`, `idx_re_mandates_one_approved_listing` and `idx_re_handover_items_unique` are all present.
  - The interest uniqueness indexes are present: `idx_re_interests_search_listing` (one per search and listing) and `idx_re_interests_unscoped_contact_listing` (one per contact and listing when there is no search).
  - The old contact-wide unique constraint on `real_estate_property_interests` is gone, as intended.
- **Named constraints.** All are present and validated, with one deliberate exception: `re_price_professional_valuation_evidence` is `NOT VALID`. It applies to new and updated rows without re-checking legacy rows.
- **Validated constraints include:** the `property_category` checks on listings, acquisition opportunities and inspections; the buyer-search stage and category checks; the interest-state, handover, commission-allocation, transaction-document and viewing-confirmation status checks; and the listing and acquisition foreign keys.
- **Triggers.** The pre-existing `real_estate_offers_set_updated_at` and `real_estate_transactions_set_updated_at` were left in place.

## 12. RLS and access controls reviewed

- **New tables.** All 30 have RLS enabled. `anon` and `authenticated` have no `SELECT` or `INSERT` privilege on any of them. `service_role` has access, which is how the application reads and writes.
- **Existing tables.** RLS is still enabled. Phase 1 revoked the `anon` and `authenticated` grants on the Real Estate tables it touches. Those tables already had RLS with no policies, so this does not change behaviour for the application.
- **New functions.** Only `service_role` can execute the three application functions.
- **Supabase security advisors, after deployment:**
  - `rls_enabled_no_policy` (INFO, 274 tables). This is the existing service-role-only pattern and is intended.
  - `extension_in_public` (`pg_trgm`). Pre-existing and unrelated.
  - `function_search_path_mutable` (WARN, 31 functions). Four of these are new: the Real Estate tenant trigger functions. The other 27 are pre-existing.
  - The risk is low because these are `SECURITY INVOKER` trigger functions, but the warning should be closed with `ALTER FUNCTION … SET search_path = public` in a small follow-up migration. **This was not applied**, because only the five reviewed migrations were approved.

## 13. Legacy backfill results

Every backfilled row is in one organisation: `a1000001-e57a-4e00-8000-000000000001` ("Haven Properties"), which the project owner confirmed is test or seed data. **Solar, Trades and every other organisation received no rows.**

| Backfill | Migration | Rows | Status |
|---|---|---|---|
| `viewings.client_id` set from listing | Phase 1 | 5 of 5 updated | 0 viewings left without an organisation |
| Viewing tenant review rows | Phase 1 | 0 | No mismatches existed |
| `real_estate_offers.reserves_listing` | Phase 1 | 0 | No offers exist |
| Buyer searches from legacy contact fields | Phase 1 | 11 | 10 `active`, 1 `needs_review`. The search needing review has no pipeline stage, so it is not treated as active |
| Contact roles from `leads.deal_side` | Phase 1 | 12 | All `unverified` |
| Property interests from `contacts.interested_listing_ids` | Phase 1 | 10 | All contact-level (no `search_id`); 0 cross-organisation |
| Mandates from listing mandate fields | Phase 2 | 10 | All `legacy_unverified`, evidence `not_provided`; none approved |
| Buyer search pipeline stage | Phase 3 | 10 | Only on active searches |
| Legacy commissions | Final | **0** | No transactions exist, so no commission is created and none is verified |

**For review, though nothing is broken:**

- Of the 10 legacy mandates, 5 have an expiry date already in the past and 3 have no expiry date. The mandate workspace shows these for renewal or review.
- None of the 10 listings has a `property_category` yet. Matching treats a missing category as "unknown" and still includes the listing, so agents should set the category to get confirmed property-type matches.

## 14. Data-integrity verification

| Check | Before | After |
|---|---|---|
| Organisations (`clients`) | 29 | 29 |
| Users | 61 | 61 |
| Leads | 1,636 | 1,636 |
| Contacts | 1,492 | 1,492 |
| Listings | 10 | 10 |
| Viewings | 5 | 5 |
| Offers / transactions | 0 / 0 | 0 / 0 |
| Work projects (Solar and Trades) | 1 | 1 |
| Viewings without `client_id` | n/a | 0 |
| Backfilled rows whose contact or listing is in another organisation | n/a | 0 |
| Duplicate approved mandates | n/a | 0 |
| Duplicate search interests | n/a | 0 |
| Duplicate handover items | n/a | 0 |
| Commissions (any status) | n/a | 0 |
| Migration review rows | n/a | 0 |

- No customer record was modified for testing.
- No WhatsApp message was sent.
- No financial record was created or changed.

**Integration checks.** The deployment instructions limit integration tests to staging. Since only production exists, I did not create, accept, fall through or complete any test offers or transactions. The function checks were limited to the non-mutating calls in section 10. The full write paths remain covered by the local tests, which passed 155 of 155 (see the release handoff).

## 15. Migration history after deployment

43 rows. The five new entries:

```
20261016142310  real_estate_phase1_foundation
20261016142357  real_estate_phase2_acquisition
20261016142425  real_estate_phase3_buyer_sales
20261016142455  real_estate_phase4_agency_operations
20261016142637  real_estate_final_corrections
```

These versions are apply timestamps, not the file versions (`20261016013000` and so on). Earlier migrations in this project were recorded the same way.

## 16. Outstanding blockers

1. **History versions do not match file names.**
   - The Supabase CLI will see the five local files as unapplied. `supabase db push` must never be run against this project.
   - To reconcile, mark each local version as applied with `supabase migration repair --status applied <version>`. Do this only after agreeing how the older divergent entries (section 4) will be handled.
2. **`sales_dashboard_visits` is missing.**
   - This predates the Real Estate work: `20261011140000_sales_dashboard_visits.sql` was never applied, and `lib/sales/dashboard/load-daily-workspace.ts` uses the table.
   - It was not touched, because it is outside the approved scope.
3. **Trigger function `search_path`** (section 12). A small follow-up migration is recommended.
4. **Browser validation is still to do.** Run the checks in `REAL_ESTATE_RELEASE_HANDOFF.md`, section I, against a preview deployment.
5. **No production build has been run**, because local builds are prohibited. The Vercel build will be the first full compile and type check.

## 17. Readiness for Vercel deployment

**The database is ready.** The schema, functions, privileges and backfills that the Real Estate code expects are in production.

The currently deployed application is unaffected:

- New columns are nullable or have defaults.
- The new `viewings` trigger fills `client_id` and accepts all existing data.
- No existing column, table or policy was removed.

Before promoting the Vercel deployment:

1. Push the application code and let Vercel build a **preview** deployment. The preview build is the type check.
2. Run the browser checks in `REAL_ESTATE_RELEASE_HANDOFF.md`, section I, on the preview, using the test organisation.
3. Promote to production once those pass.

No GitHub push or Vercel deployment was made as part of this work.
