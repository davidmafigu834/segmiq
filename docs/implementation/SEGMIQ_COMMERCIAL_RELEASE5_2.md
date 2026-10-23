# SegmiQ Commercial System — Release 5.2

Date: 24 October 2026

## Decision: NO-GO

Commercial launch mode must remain `OFF`. Release 5.2 adds a controlled legacy-customer migration queue and closes backdating/premature-activation defects, but production backup/recovery evidence, database compilation/integration evidence, legal signing approval, and full release verification are still missing.

No production migration was applied. No customer was migrated, no historical subscription/payment/invoice was changed, no invoice or communication was sent, no payment was confirmed, no Agentic AI package was activated, and no launch flag was changed.

## Production baseline and migration reconciliation

- Project: `leadstaq` (`gnnqzboaeezzevlwwryp`), region `eu-west-1`, observed `ACTIVE_HEALTHY`, PostgreSQL 17.
- Production migration history still ends at `20261023114812_segmiq_commercial_foundation_release1`.
- R1 is already present and **must not be reapplied**.
- The required pending order is:
  1. `20261023160000_platform_commercial_atomic_workflows.sql` (R2)
  2. `20261023180000_platform_sales_quotes_and_agreement_foundation.sql` (R3)
  3. `20261023210000_platform_ai_usage_shadow_and_topup_foundation.sql` (R4)
  4. `20261023230000_commercial_launch_controls.sql` (R5)
  5. `20261023233000_commercial_release5_1_safety_workflows.sql` (R5.1)
  6. `20261023234500_commercial_release5_2_controlled_customer_migrations.sql` (R5.2)
- The post-R1 SQL contains no `DROP TABLE`, `TRUNCATE`, or `DELETE FROM` operation. R5.2 only replaces the service-role migration RPC; it does not migrate data by itself.
- Static dependency tests pass for the above ordering. R2 depends on R1; R3 depends on R1; R4 depends on R1 and the legacy billing/agent tables; R5 depends on R1 audit/users/invoices; R5.1 depends on R2/R4; R5.2 depends on R2's validation and mutation functions.

### Backup and recovery gate

The available project metadata and database connector do not expose the project's current backup inventory, retention, last successful recovery point, or a completed restore exercise. Therefore backup/recovery arrangements are **not verified** and the production migration gate is closed.

No transactionally rolled-back DDL dry run was attempted against the shared production database. A successful rollback would not prove application workflow, concurrency, privilege, or recovery safety and could still acquire production locks.

Testing without an isolated database cannot prove PostgreSQL function compilation as a complete chain, migration transaction behavior, concurrent replay behavior, RLS impersonation, tenant isolation, or restoration. Static SQL inspection and in-memory fixtures reduce risk but do not replace those gates.

### Authorised production migration procedure

1. In the Supabase dashboard, record the backup method, retention, latest successful backup/recovery point, and the person authorised to restore it. Record the expected restore downtime.
2. Export/capture the current schema, grants, advisors, row counts, and migration history. Confirm R1 is present and R2 is absent.
3. Keep all commercial application kill switches closed and launch mode effectively `OFF`.
4. Schedule a maintenance window and name the release and recovery owners.
5. Apply R2 through R5.2 in the exact order above, one migration/history entry at a time. Never submit R1.
6. After each migration, verify expected objects, constraints, RLS, grants, function execution privileges, and migration history before continuing.
7. Run synthetic database checks for idempotency, stale snapshots, effective-date bounds, tenant swaps, token expiry/revocation, AI windows, renewal boundaries, and exact-payment matching.
8. Rerun Security Advisor and compare it with the recorded baseline.
9. Leave launch mode `OFF`; deployment and customer activation require a separate explicit release decision.

Recovery is restore-or-forward-fix, not destructive rollback. If any migration fails, stop the sequence, leave flags closed, do not mark it applied manually, and either let the failed transaction roll back or produce a reviewed forward corrective migration. If integrity is uncertain, invoke the documented Supabase restore procedure and accept the planned project downtime. Historical commercial records must not be deleted or rewritten.

## Official pricing

The existing versioned catalogue `2026-10-22` remains the sole pricing source:

| Product | Price |
| --- | ---: |
| Starter | $19/user/month |
| Growth | $29/user/month |
| Agentic Business | $99/business/month plus Growth users |
| Agentic Scale | $249/business/month plus Growth users |

The migration queue calculates in integer cents from this catalogue. Agentic AI defaults to unselected and can only be added explicitly with Growth.

## Features implemented

### Super Admin customer migration queue

- Added `/dashboard/commercial-migrations`, protected by a server-side active `SUPER_ADMIN` session check and blocked during impersonation.
- Lists legacy CRM customers that do not yet have a v2 commercial account.
- Shows existing plan, current agreed monthly amount (annual terms normalized for comparison), active non-Super-Admin users, proposed plan, official proposed monthly price, Agentic AI selection state, proposed effective date, and the signed agreement/amendment requirement.
- Provides a one-customer-at-a-time review path into the existing preview-and-confirm flow. There is no bulk activation action.
- Uses the current active-user count as the recommended purchased-seat count rather than silently defaulting every customer to one seat.
- Preserves legacy subscription, invoice, and payment rows. The new commercial account stores the legacy subscription reference and the immutable audit event records the legacy terms.

The one-at-a-time workflow, explicit warning, preview, and confirmation step follow the UI safety review: irreversible commercial changes require a deliberate confirmation and visible outcome rather than a silent or bulk action.

### Migration activation safety

- Application and database guards reject backdated migration confirmation.
- Future migrations may be previewed, but confirmation is rejected until the effective time arrives. A five-minute window allows clock skew.
- A signed agreement or amendment reference and a stable idempotency key are mandatory.
- The RPC is active-Super-Admin-only, advisory-lock serialized, idempotent on replay, service-role-only, and records an append-only audit event.
- The next renewal is calculated from the preserved legacy period end or from the new effective date and billing cycle.
- The RPC does not alter the legacy subscription amount/status, backdate charges, create an invoice, confirm a payment, or automatically select Agentic AI.

### Existing commercial workflows retained

The Release 5/5.1 implementation continues to provide manual plan-change previews, renewal scheduling, grace periods, quotation revisions and tokenized acceptance, agreement records, contract-gated activation rules, AI shadow metering, customer-approved top-up foundations, draft invoice preparation, and exact-payment-evidenced top-up activation. Legally unapproved signing and live financial activation remain disabled/unwired.

## Existing customers eligible for migration

A read-only production aggregate found:

- 9 customers with a current CRM subscription;
- 9 eligible customers with no v2 commercial account;
- 9 of those subscriptions currently marked active;
- 28 active, distinct, non-Super-Admin users across eligible customers;
- 0 eligible customers missing a current-period end date;
- 0 customers already migrated.

This is eligibility evidence only. It does not mean consent, contract, pricing acceptance, or operational readiness has been established for any customer.

## Security review

- Current Security Advisor baseline: 31 `WARN` mutable-function-search-path findings, one `WARN` extension-in-public finding, and 282 `INFO` RLS-enabled-without-policy findings.
- Billing-adjacent legacy warnings include `create_crm_invoice`, `confirm_work_project_payment`, and `reverse_work_project_payment`. They were not broadly rewritten without database regression evidence.
- The R1 commercial tables remain private/service-role-oriented; the pending migrations explicitly enable RLS and revoke `public`, `anon`, and `authenticated` privileges for their new private objects.
- Migration preview/confirmation require Super Admin; confirmation rejects impersonation, requires same-origin, and passes the independent environment and database launch gates.
- R5.2 uses `search_path=''`, fully qualified relations/functions where applicable, an advisory lock, stable idempotency, and immutable audit evidence.
- Database-backed cross-tenant, privilege, and concurrency tests remain incomplete.

Advisor reference: <https://supabase.com/docs/guides/database/database-linter>

## Verification results

### Passed

- Focused lightweight commercial suite: **45 tests passed, 0 failed**.
- Covered official price arithmetic, unique paid-seat counts, AI/Growth coupling, migration comparison, annual-to-monthly display, AI default-off, agreement requirement, effective-date enforcement, plan amendments, grace expiry, launch fail-closed behavior, quotation/token controls, AI shadow reconciliation, renewal boundaries, quota reset, and exact-payment top-up activation.
- Release migration static checks: dependency order valid; no table drops, truncation, or history deletion; expected service-role/RLS controls present.
- Targeted TypeScript syntax transpilation: passed for 9 Release 5.2 files.
- `git diff --check`: no whitespace errors (line-ending notices only).
- Production inspection was read-only.

### Not completed

- The targeted semantic TypeScript check produced no diagnostics but did not finish within 60 seconds and was stopped to protect the low-end machine; no pass is claimed.
- Full repository type-check, production build, browser/UI tests, responsive inspection, and screenshots were intentionally not run under the user's low-end-PC instruction.
- No production SQL compilation/rolled-back DDL test, database integration test, restore exercise, invoice issue/send, customer communication, payment mutation, or customer migration was performed.
- No deployment status is claimed.

## Files changed for Release 5.2

- `app/(agency)/dashboard/commercial-migrations/page.tsx`
- `app/api/admin/commercial/clients/[clientId]/migration/confirm/route.ts`
- `components/commercial/CommercialActions.tsx`
- `components/commercial/CommercialOverviewPanel.tsx`
- `components/platform/nav.ts`
- `lib/commercial/account-repository.ts`
- `lib/commercial/amendment-service.ts`
- `lib/commercial/migration.ts`
- `lib/commercial/migration-repository.ts`
- `supabase/migrations/20261023234500_commercial_release5_2_controlled_customer_migrations.sql`
- `tests/commercial-migrations.test.ts`
- `tests/commercial-release5-2.test.ts`
- `docs/implementation/SEGMIQ_COMMERCIAL_RELEASE5_2.md`

Unrelated pre-existing working-tree changes were preserved.

## Remaining commercial risks and exact pre-launch steps

1. Verify and record production backup/restore evidence and recovery ownership.
2. Obtain explicit authorisation for the exact R2–R5.2 production migration sequence.
3. Apply and verify migrations using the procedure above; keep launch mode `OFF`.
4. Complete database-backed synthetic tests for compilation, replay/concurrency, RLS, tenant isolation, renewal execution, grace/suspension, AI metering, and invoice reconciliation.
5. Obtain counsel-approved agreement text, electronic-signature method, identity/evidence-retention policy, and sealed private final-PDF process.
6. Complete the accepted-offer → agreement → signature → billing → activation saga without treating acceptance, signature, payment, and activation as the same event.
7. Wire and verify the authorised due-plan-change executor and customer-approved top-up/payment workflow without automatic charging.
8. Complete a semantic type-check, production build, and browser/responsive review on suitable hardware.
9. Select one synthetic/internal pilot and collect rollback, support, finance, and security sign-off evidence.
10. Only then make a separate, human-authorised decision whether to move from `OFF` to `INTERNAL_ONLY`. Never promote modes automatically.

Until every mandatory gate is evidenced, the decision remains **NO-GO**.
