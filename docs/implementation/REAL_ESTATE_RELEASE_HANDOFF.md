# Segmiq Real Estate — Release Handoff

Date prepared: 16 October 2026

This document hands the Real Estate correction pass over to the developer for database deployment, the external build, and browser testing. Nothing described here has been pushed, deployed, built or applied to any database by the implementation pass.

Readiness at the time of writing:

| Level | Status |
|---|---|
| Code implemented | Yes |
| Statically reviewed | Yes (file-level review and editor diagnostics on changed files only) |
| Targeted tests passed | Yes (ten test files, 155 tests, run one at a time) |
| Database validated | **No** |
| Build validated | **No** |
| Runtime validated | **No** |

Do not treat this release as production-ready until the database, build and browser steps below are complete.

---

## A. Code status

Complete in source code:

- **Atomic state changes.** Offer acceptance and transaction completion or fall-through go through the Postgres functions `re_accept_offer` and `re_finish_transaction` when present (`lib/real-estate/atomic-rpc.ts`). Before the migration is applied, the existing sequential code path is used instead.
- **Property categories.** House, apartment, townhouse, residential stand, commercial, industrial, agricultural and other. These are on listings, acquisitions, inspections and buyer searches, and are used by matching (`lib/real-estate/buyer-match.ts`).
- **Matching.** Matching is paged without a silent 300-record limit. Interests are tracked per search, and match notifications are invalidated when a listing or search changes.
- **Agent viewings.** Scoped to the viewing agent, the listing agent and the buyer search agent (`lib/real-estate/viewing-access.ts`). Contact details are masked when the agent is only the listing agent.
- **Mandates.** Renewal, revocation and superseding. Professional valuations require supporting evidence.
- **Commissions.** Cumulative amounts, payout history, beneficiary picker, and a one-time backfill of legacy commissions marked unverified.
- **Transaction operations workspace.** Milestones, assignees, private documents with a review workflow, and participants (`components/real-estate/transactions/TransactionOperations.tsx`).
- **Staff handover.** Paged discovery, a fingerprint check that blocks the handover if records changed after the preview, skipped and failed item tracking, and retry.
- **Property register.** Mandate state, sourcing agent, activity counts, issues, buyer matching, and links to transactions and collaboration requests.
- **Reports.** Sales are counted once per transaction; commission figures come from the ledger; truncated data is flagged as `incomplete` instead of being silently capped.
- **Access fixes.**
  - Creating a listing no longer sends WhatsApp messages to customers.
  - `send-match` is restricted to contacts the agent owns and no longer returns phone numbers.
  - The `commission_settled` milestone is manager-only.
- **Feature switch.** `RE_AGENCY_OPERATIONS` disables commission and handover actions without affecting other features.

## B. Database status

**Production (`leadstaq`, `gnnqzboaeezzevlwwryp`) has all five migrations applied and verified**, recorded as `20261016142310` to `20261016142637`. Those versions are apply timestamps, not the file versions, so never run `supabase db push` against it. Details are in `REAL_ESTATE_SUPABASE_DEPLOYMENT_REPORT.md`. No staging project exists. For any other environment, check its migration history before applying anything:

```sql
select version, name
from supabase_migrations.schema_migrations
where version >= '20261016000000'
order by version;
```

All five files below must be present for the full feature set. The code degrades gracefully when the last one is missing (see section K), but the atomic functions, register metrics and search-specific interests require it.

## C. Migration order

Apply in this exact order. The first four are the earlier phase migrations. Phase 1 had one change during deployment: the `viewings.client_id` backfill was rewritten from `UPDATE … FROM … JOIN` to a `WHERE` join, because the original failed with `42P01`. Behaviour is unchanged.

| Order | File | Purpose |
|---|---|---|
| 1 | `supabase/migrations/20261016013000_real_estate_phase1_foundation.sql` | Contact roles, buyer searches, property interests, listing parties, listing status events, migration reviews, activity subjects |
| 2 | `supabase/migrations/20261016042000_real_estate_phase2_acquisition.sql` | Acquisition opportunities and events, inspections and photos, price discussions, mandates and mandate events |
| 3 | `supabase/migrations/20261016120000_real_estate_phase3_buyer_sales.sql` | Buyer search events, match notifications, buyer introductions, rental applications |
| 4 | `supabase/migrations/20261016180000_real_estate_phase4_agency_operations.sql` | Deal participants, collaboration requests, commission templates, commissions, allocations, events and disputes, transaction documents, handovers and items, staff capabilities |
| 5 | `supabase/migrations/20261016220000_real_estate_final_corrections.sql` | **Correction migration** (this pass) |

The correction migration is additive and written to be safe to re-run:

- It uses `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS` and `CREATE OR REPLACE FUNCTION`.
- It starts with a guard that raises `Apply the real estate Phase 1 to Phase 4 migrations before the final corrections.` if `real_estate_commissions`, `real_estate_mandates`, `real_estate_match_notifications` or `real_estate_listing_status_events` is missing.
- The legacy commission backfill only inserts transactions that do not already have a ledger row, so running it twice does not duplicate data.

## D. Migration dependencies

The correction migration expects these to already exist:

- **Existing core tables from earlier migrations:** `listings`, `viewings`, `users`, `contacts`, `real_estate_offers`, `real_estate_offer_events`, `real_estate_transactions`, `real_estate_transaction_events`, `real_estate_transaction_milestones`.
- **Phase 1 to Phase 4 tables:**
  - `real_estate_property_interests`, `real_estate_buyer_searches`, `real_estate_listing_status_events`
  - `real_estate_acquisition_opportunities`, `real_estate_inspections`, `real_estate_mandates`, `real_estate_price_discussions`
  - `real_estate_match_notifications`
  - `real_estate_commissions`, `real_estate_commission_allocations`, `real_estate_commission_events`, `real_estate_commission_disputes`
  - `real_estate_transaction_documents`, `real_estate_handovers`, `real_estate_handover_items`, `real_estate_deal_participants`
- **Legacy commission columns** on `real_estate_transactions`. The backfill reads them.

What it changes, section by section:

1. `property_category` on listings, acquisitions and inspections; `property_categories` on buyer searches, with check constraints.
2. Interests:
   - Drops the contact-wide unique constraint on `(client_id, contact_id, listing_id)`.
   - Adds a unique index `(client_id, search_id, listing_id)`.
   - Adds a partial unique index `(client_id, contact_id, listing_id) WHERE search_id IS NULL`.
   - Adds rejection and reset columns.
3. Match notification invalidation columns.
4. Viewing reschedule history and reminder dedupe columns.
5. Mandate `previous_mandate_id`, `superseded_by_id`, `superseded_at` and revocation columns. Adds a **guarded** unique index for one approved mandate per listing.
6. Valuation evidence columns, plus a `NOT VALID` check constraint (`re_price_professional_valuation_evidence`). Existing legacy rows are not checked.
7. Document review states, and a milestone assignee index.
8. Cumulative commission columns, plus the new table `real_estate_commission_payouts`. RLS is enabled and access is revoked from `anon` and `authenticated`.
9. Legacy commission backfill. Rows are marked unverified, and the original values are kept in `legacy_fields`.
10. Handover status and item states, plus a **guarded** unique index on handover items.
11. Functions `re_accept_offer` and `re_finish_transaction`, which raise errors as `RE4xx: message`.
12. Function `re_listing_register_metrics`.

All three functions are `SECURITY INVOKER`, have `EXECUTE` revoked from `PUBLIC`, `anon` and `authenticated`, and are granted only to `service_role`.

## E. Migration safety

1. **Back up first.** Take a Supabase backup or point-in-time restore marker for the target project before applying anything.
2. **Apply to staging first.** Use a staging database with a copy of representative data. Do not run a broad `supabase db push` against production. Apply the single file explicitly once staging has passed.
3. **Run these review queries before applying file 5.** Each one should return no rows.

   ```sql
   -- More than one approved mandate per listing (the unique index is skipped with a NOTICE if any exist)
   select listing_id, count(*) from real_estate_mandates
   where status = 'approved' and listing_id is not null
   group by listing_id having count(*) > 1;

   -- Interests that would collide on the new search-specific unique index
   select client_id, search_id, listing_id, count(*) from real_estate_property_interests
   where search_id is not null
   group by client_id, search_id, listing_id having count(*) > 1;

   -- Duplicate handover items (the unique index is skipped with a NOTICE if any exist)
   select handover_id, record_type, record_id, count(*) from real_estate_handover_items
   group by handover_id, record_type, record_id having count(*) > 1;
   ```

   - The interest index is **not** guarded. If the second query returns rows, resolve those duplicates first, or the migration will fail at that statement.
   - If the mandate or handover queries return rows, the migration still succeeds but skips those indexes. Resolve the duplicates, then re-run the file.
4. **Transaction handling.** The file has no explicit `BEGIN`/`COMMIT`. When applied with the Supabase CLI migration runner, each migration runs in a single transaction, so a failure rolls back the whole file. If you apply it manually in the SQL editor, wrap it in `begin; … commit;` yourself.
5. **Watch the output for `NOTICE` lines** starting with `Skipped idx_…`. Each one means an index was not created and needs follow-up.
6. **After applying, confirm the functions exist:**

   ```sql
   select proname from pg_proc
   where proname in ('re_accept_offer', 're_finish_transaction', 're_listing_register_metrics');
   ```

7. **Check the backfill:**

   ```sql
   select count(*) from real_estate_commissions where legacy_fields is not null;
   ```

8. **Rollback considerations.** Every change is additive except the dropped contact-wide interest constraint, which is replaced by two narrower unique indexes. Do not drop the new columns or tables once agents have started using them; use section K instead.

## F. GitHub and Vercel

Do these only after the target database has the migrations and the review queries are clean. There is no staging project, so the preview will use production. Run the browser checks with the test organisation (`a1000001-e57a-4e00-8000-000000000001`) only.

1. Review the working tree with `git status` and `git diff`. Many Real Estate files are untracked, so also review them with `git add -N` or a visual diff before staging.
2. Commit on a feature branch, for example `real-estate-final-corrections`. Nothing has been committed by the implementation pass.
3. Push the branch and open a pull request. Let Vercel create a **preview** deployment.
4. Read the preview build log (section H), then run the browser checks (section I) and security checks (section J) on the preview URL.
5. Merge. Production deploys from the main branch. The production database already has all five migrations.
6. After the production deploy, repeat a short smoke test from section I with a manager account and an agent account.

## G. Environment variables

These are names only. Set them in Vercel for Preview and Production; never commit their values.

| Name | Used by | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All server data access | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | All server data access (server only) | Yes |
| `NEXTAUTH_SECRET` | Session signing | Yes |
| `NEXTAUTH_URL` | Auth callbacks (set per environment if your setup requires it) | Per setup |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Transaction documents, mandate and valuation evidence | Yes, for document upload |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Same | Yes, for document upload |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Same | Yes, for document upload |
| `CLOUDFLARE_R2_BUCKET_NAME` | Same | Yes, for document upload |
| `CLOUDFLARE_R2_PUBLIC_URL` | Public asset URLs (transaction documents stay private) | Existing setting |
| `CRON_SECRET` | `/api/cron/viewing-reminders` and `/api/cron/check-followups` (checked in `lib/cron-auth.ts`) | Yes, for reminders |
| `RE_AGENCY_OPERATIONS` | Optional switch. Set to `off`, `false` or `0` to disable commission and handover actions | No (enabled when unset) |

Existing WhatsApp and Meta variables are unchanged by this pass.

## H. Vercel build verification

This pass did not run a build. A full build has therefore **not** been validated, and the first Vercel preview build is the first real compile of these changes.

**A successful build log contains:**

- `Compiled successfully` or `✓ Compiled`
- `Linting and checking validity of types` with no errors after it
- `Generating static pages` and a route table listing these routes:
  - `/client/listings`, `/sales/listings`
  - `/client/transactions`, `/sales/transactions`
  - `/client/commissions`
  - `/client/agency/team`
  - `/api/clients/[clientId]/listings/register`
  - `/api/clients/[clientId]/transactions/[transactionId]/documents`
- `Build Completed` and `Deployment completed`

**A failed build shows:**

- `Type error:` with a file path. Changed files are most likely under:
  - `lib/real-estate/`
  - `components/real-estate/`
  - `app/api/clients/[clientId]/listings/`
  - `app/api/clients/[clientId]/agency/`
- `Error: ... @typescript-eslint/no-explicit-any` or other ESLint errors
- `Module not found: Can't resolve '@/lib/real-estate/...'`
- `Failed to compile`

**Runtime log messages to watch for on the preview** (these are not build failures):

- 503 errors with text like `Apply the … migration` mean a migration is missing in the database the preview uses.
- The fallback for a missing `re_accept_offer`, `re_finish_transaction` or `re_listing_register_metrics` is silent; nothing is logged. Confirm the functions exist with the query in section E, step 6. Without them, offer acceptance and completion still work, but not atomically.
- A 503 with `Property type needs the final corrections migration` when saving a listing means `listings.property_category` is missing.
- `Cloudflare R2 credentials are not configured` or `CLOUDFLARE_R2_BUCKET_NAME is not configured` in the logs, usually next to `[transaction-documents] upload failed`, means the R2 variables are missing.
- A 503 with `disabled: true` from `/api/clients/[clientId]/agency` means `RE_AGENCY_OPERATIONS` is switched off.

Real database errors are returned as errors. They are not hidden behind empty results.

## I. Browser validation

Run these against the **preview deployment pointed at staging**, never production customer data. Use one manager (CLIENT_MANAGER) account and two agent (SALESPERSON) accounts in the same organisation, plus one account in a second organisation.

1. **Navigation.**
   - Manager: the sidebar shows the Acquisition, Buyer and Sales, and Agency groups.
   - Agent: the mobile bottom bar shows Home, Inbox, Properties, Activities and Menu, and every link opens without a 404.
2. **Acquisition to listing.**
   - Create an acquisition with a property category, record an inspection and submit a mandate.
   - As manager, approve it, then convert it to a listing. Converting a second time returns the same listing, with no duplicate.
3. **Mandates.**
   - Renew an approved mandate: the old one shows as superseded.
   - Revoke a mandate with a reason.
   - Try to record a professional valuation without a document or reference: it is rejected.
4. **Listings.**
   - Create a listing with a category. No customer WhatsApp message is sent.
   - Open the preview panel: sourced-by, mandate badge, counts and issues appear.
   - Use "Match buyers" and check that contact details are masked.
5. **Buyer searches.**
   - Add category chips; matching respects them.
   - Mark a property not interested for one search: the same property stays available to the contact's other searches.
6. **Viewings.**
   - Agent A schedules a viewing on Agent B's listing.
   - Agent B sees it, with the buyer's contact masked.
   - An unrelated agent C cannot see it.
7. **Offers and transactions.**
   - Accept an offer, open the transaction from the listing register, and complete milestones.
   - Upload a document: it shows awaiting review. The manager verifies or rejects it with a reason.
   - Complete the transaction, then try a fall-through on another one, and check the listing status in both cases.
8. **Commissions.** Create a commission with beneficiaries, approve it, record a partial payout, then a full payout. The totals add up and the status never moves backwards.
9. **Handover.**
   - Preview the handover of an agent's work. Change a record, then execute: it is blocked because of drift.
   - Preview again, execute, and retry any failed items.
10. **Reports.**
    - The completed-sales count matches the transactions.
    - The gross commission figure shows verified and legacy amounts separately.
    - The incomplete notice appears when data is truncated.
11. **Feature switch.** Set `RE_AGENCY_OPERATIONS=off` on the preview. Commission and handover actions return the disabled message, while transactions, collaboration and the attention feed still work.

## J. Security checks

Run each of these with real sessions on the preview:

- **Agent restrictions:**
  - An agent cannot open another agent's transaction by ID, either through `/api/clients/[clientId]/transactions/...` or the `?open=` link. The response is 403 or 404.
  - An agent cannot update a milestone on a transaction they are not part of, and cannot mark `commission_settled` even on their own deal.
  - An agent cannot call `send-match` for a contact they don't own, unless there is an accepted introduction for that listing. The response does not include a phone number.
  - An agent cannot see buyer phone numbers on viewings where they are only the listing agent.
  - An agent cannot approve their own commission, verify receipts, record payouts, or run handovers without the `reassign_work` capability.
  - The property register returns aggregate counts only to agents, and `activeTransactionId` only when the agent may open that transaction.
- **Manager:** sees all organisation data, approves mandates and commissions, and runs handovers.
- **Cross-tenant:**
  - With a session from organisation B, call each Real Estate API with organisation A's `clientId` and with organisation A's record IDs under organisation B's `clientId`. Every call must return 403 or 404 and no data.
  - Endpoints to cover: listings, register, matching, buyer searches, viewings, offers, transactions, documents, commissions, handover, reports.
- **Documents:** transaction document downloads check that the storage key belongs to the same organisation (`isTransactionDocumentKeyForClient`). Try a document link ID from another organisation: it must fail.
- **Database:** `real_estate_commission_payouts` and the three functions are not callable with the `anon` or `authenticated` key.

## K. Rollback

Avoid destructive database rollback once customers have created records in the new tables or columns. Use these steps instead, from least to most invasive:

1. **Switch off agency operations.** Set `RE_AGENCY_OPERATIONS=off` in Vercel and redeploy. Commission and handover actions stop; all records are kept and can still be read.
2. **Revert the application code.** Redeploy the previous production commit in Vercel. The extra columns and tables are ignored by older code, so business records are preserved.
3. **Leave migration file 5 in place.** It is additive. The atomic functions are only called by the new code, and older code does not use them.
4. **If one function misbehaves,** it can be dropped individually, for example `drop function public.re_listing_register_metrics(uuid, uuid[]);`. The application then falls back to its sequential code path automatically. Prefer this over dropping tables or columns.
5. **Never drop** `real_estate_commission_payouts`, the cumulative commission columns, the mandate history columns or the backfilled commission rows once they hold data. Restore from the backup taken in section E only as a last resort, and only after exporting any records created since.
