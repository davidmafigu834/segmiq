# SegmiQ Commercial System — Release 5.1

Date: 23 October 2026

## Decision: NO-GO

The launch mode must remain `OFF`. Release 5.1 closes several code-level safety defects, but database execution, legal signing, full conversion, and end-to-end evidence gates remain incomplete. No migration was applied to the production project, no customer record was changed, and no communication, payment, quota enforcement, or launch-mode transition was performed.

## Repository and database baseline

- Repository branch: `main`.
- Inspected commit: `3e9d41329a7b2789239ade84a143bc6ccc2affc5`.
- The working tree contained extensive unrelated changes before this work; they were preserved.
- `AGENTS.md` was not present at the repository root.
- Production migration history still ends at `20261023114812_segmiq_commercial_foundation_release1`.
- Read-only production counts: 29 clients, 9 legacy subscriptions, and zero rows in commercial accounts, plan-change requests, grace periods, and the AI usage ledger.
- The R1 tables have RLS enabled. Their observable grants are limited to `postgres` and `service_role`; no `anon` or `authenticated` table grants were found.
- The R1 immutability trigger function is `SECURITY INVOKER`, has `search_path=pg_catalog`, denies `anon`/`authenticated` execution, and permits `service_role` execution.
- R3 quote tables, R4 conversation-window tables, and R5 launch-control tables are not present in the production schema.

## Migration reconciliation

| Order | Migration                                                           | State                 | Dependencies and findings                                                                                                      |
| ----- | ------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| R1    | `20261023114812_segmiq_commercial_foundation_release1.sql`          | Present in production | Do not reapply. Supplies catalogue, accounts, changes, grace, audit, usage ledger, and immutability trigger.                   |
| R2    | `20261024055631_platform_commercial_atomic_workflows.sql`           | Local only            | Depends on R1. Now adds a consent-reference column for deferred changes.                                                       |
| R3    | `20261024055657_platform_sales_quotes_and_agreement_foundation.sql` | Local only            | Depends on R1 tables and immutability trigger. Remains legally disabled.                                                       |
| R4    | `20261024055726_platform_ai_usage_shadow_and_topup_foundation.sql`  | Local only            | Depends on R1, legacy invoices/payments, and existing agent execution tables. A blocking undeclared-variable defect was fixed. |
| R5    | `20261024055745_commercial_launch_controls.sql`                     | Local only            | Depends on R1 audit/users/invoices. Defaults to `OFF`.                                                                         |
| R5.1  | `20261024055804_commercial_release5_1_safety_workflows.sql`         | Local only            | Depends on R2 and R4. Adds period creation and payment-evidenced top-up workflows without executing them.                      |

The ordering is valid and the post-R1 migrations contain no `DROP TABLE`, `TRUNCATE`, or history-deleting statements. Static checks verify service-role-only access for new commercial tables and functions.

An isolated Supabase branch was requested but branch creation was declined. Supabase CLI, Docker, and local PostgreSQL tools were unavailable. Therefore, SQL compilation, transactional concurrency, RLS impersonation, and migration rollback behavior have not been proven against an isolated database.

### Safe migration procedure

1. Create or designate a non-production Supabase project/branch based on the current production schema.
2. Record its current migration history and verify R1 is already present. Never submit R1 again.
3. Apply R2, R3, R4, R5, then R5.1 in the exact order above, one migration per transaction/history entry.
4. After each migration, verify expected tables/functions, RLS, grants, function execution privileges, constraints, and migration history.
5. Run database-level replay, concurrency, stale-snapshot, tenant-swap, token-expiry, renewal-boundary, and payment-mismatch tests using synthetic UUIDs.
6. Run Security Advisor again and distinguish new findings from the current baseline.
7. Keep every application flag false and the database launch mode `OFF` while collecting evidence.
8. Only after the isolated evidence is accepted should an authorised release step repeat the same ordered plan against production.

### Recovery procedure

- Before an authorised migration window, confirm database recovery/PITR coverage and capture schema and migration-history evidence.
- If a migration transaction fails, do not skip ahead or mark it applied manually. Diagnose in isolation and produce a forward corrective migration.
- Close all commercial environment flags and retain launch mode `OFF` throughout recovery.
- Do not delete agreements, invoices, audit events, usage records, or legacy subscriptions.
- Correct business data only through append-only correction/audit records and authorised compensating transactions.

## Issues discovered and fixed

### R2 plan changes

Previously, `platform_apply_plan_change` immediately replaced the commercial account snapshot even when the request specified `at_renewal` or a future effective date. It now:

- records those changes as `approved` rather than `applied`;
- preserves the agreement/consent reference in a dedicated column;
- leaves the current account unchanged;
- exposes a separate SUPER_ADMIN-authorised `platform_apply_approved_plan_change` step;
- rejects early application and stale account snapshots;
- records scheduling and application as separate audit events.

An authorised scheduler/operator integration for due changes is still required before this is an end-to-end workflow.

### R4 AI metering

The customer-conversation function referenced undeclared `v_action` state in its failed/test branch. That would prevent successful function creation. The invalid reference was removed while retaining deterministic `excluded_test`, `excluded_failed`, and `excluded_unsupported` outcomes.

### Billing periods and top-ups

R5.1 adds default-inactive database functions that:

- create an idempotent billing period only for an active Agentic account with an agreement reference;
- derive Business allowances as 500 conversations/100 actions and Scale allowances as 2,000/500;
- prepare one draft, dedicated top-up invoice and immutable invoice line after explicit customer approval;
- activate credit only when the exact USD invoice is `paid`, the exact linked payment is `confirmed`, the billing period remains open, and amounts match;
- serialize retries, return the prior result on replay, and append audit events.

No route currently invokes these functions, which is intentional until database validation and payment workflow approval are complete.

### Runtime and request security

- Commercial write checks can now be tested with an injected control loader. Missing or failing release-control storage returns `release_control_unavailable` and denies the write.
- Privileged commercial and platform-sales mutations now require an explicit exact-origin header; missing and cross-origin requests are rejected.
- Existing environment kill switches and the database mode/allowlist remain independent gates.

## Synthetic AI shadow reconciliation

All results below are deterministic in-memory fixtures. They are not production usage or database integration evidence.

| Scenario                                              |  Operational events |                Shadow billable result |
| ----------------------------------------------------- | ------------------: | ------------------------------------: |
| Ten deliveries with one stable provider event key     |                  10 |   1 conversation; 9 duplicate replays |
| Failed model/send result                              |                   1 |                                     0 |
| Test-mode successful result                           |                   1 |                                     0 |
| First success plus later success inside 24 hours      |                   2 |                        1 conversation |
| Window opened before renewal and reused after renewal |                   2 | 1 unit assigned to the opening period |
| First success exactly at the 24-hour boundary         |                   1 |          1 new unit in the new period |
| Executed allowlisted autonomous action                |                   1 |                              1 action |
| Human-approved or failed action                       |                   2 |                             0 actions |
| Business quota reset                                  |          new period |         500 conversations/100 actions |
| Scale quota reset                                     |          new period |       2,000 conversations/500 actions |
| One approved conversation top-up                      | exact paid evidence |        250 period-bound conversations |

The reconciler never enables financial mode or overage charging. Historical invoice objects are not mutated by the simulation.

## Security findings

### Supabase Advisor baseline

- `WARN`: 31 mutable-function-search-path findings. Three are billing-adjacent: `create_crm_invoice`, `confirm_work_project_payment`, and `reverse_work_project_payment`. These are existing functions and were not broadly rewritten without isolated regression evidence.
- `WARN`: one extension installed in the public schema. It is not specific to the commercial release.
- `INFO`: 282 RLS-enabled tables have no policies. For the R1 commercial tables, direct `anon`/`authenticated` grants are absent and server access is service-role-only, so the missing-policy notice matches the intended private-table model. Data API exposure settings still need confirmation in the target environment.

Advisor findings are diagnostics, not proof of security. They must be rerun after R2–R5.1 exist in an isolated target.

### Application review

- Super Admin pages and mutation routes use server-side session/role checks and reject impersonation on sensitive commercial controls.
- Plan/grace writes require environment enablement, a readable database release control, and client-specific launch eligibility.
- New tables use RLS, revoke public/anonymous/authenticated privileges, and grant only `service_role`.
- Quote recipient tokens are random, stored as SHA-256 hashes, purpose/revision/expiry bound, revokeable, and attempt limited in database workflows.
- Quote downloads generate short-lived private-object URLs after server-side token/role checks.
- Commercial audit, quote/agreement event, signature, usage-source, invoice-line, and release-decision histories use append-only triggers where defined.
- Database-level tenant isolation and role impersonation tests remain blocked without an isolated database.

## Test results

- Focused commercial suite: **42 tests passed, 0 failed**.
- Covered catalogue arithmetic, seat de-duplication, plan consent, grace bounds, quotation pricing/tokens, activation fail-closed behavior, launch modes, migration order, renewal scheduling, release-control outage, exact-origin requests, AI replay/windows/actions/periods/quotas, and top-up evidence.
- `git diff --check`: no whitespace errors.
- Full typecheck: started but did not complete on the available machine and emitted no diagnostic result before being stopped.
- Production build: started but remained in the lint/typecheck phase and was stopped without a result.
- Browser/responsive verification and screenshots: not performed, following the final low-end-machine instruction.

No typecheck, build, browser, or screenshot success is claimed.

## Files changed for Release 5.1

- `supabase/migrations/20261024055631_platform_commercial_atomic_workflows.sql`
- `supabase/migrations/20261024055726_platform_ai_usage_shadow_and_topup_foundation.sql`
- `supabase/migrations/20261024055804_commercial_release5_1_safety_workflows.sql`
- `lib/commercial/plan-change.ts`
- `lib/commercial-launch/control.ts`
- `lib/platform-sales/http.ts`
- `lib/platform-ai-usage/shadow-reconciliation.ts`
- `lib/platform-ai-usage/topup-safety.ts`
- `tests/commercial-release5-1.test.ts`
- `tests/commercial-migrations.test.ts`
- `docs/implementation/SEGMIQ_COMMERCIAL_RELEASE5_1.md`

Release 5 files from the preceding work remain part of the same uncommitted working tree.

## Remaining mandatory blockers

- Execute R2–R5.1 successfully in an isolated Supabase database and prove constraints, functions, privileges, RLS behavior, concurrency, and replay safety.
- Obtain approved legal agreement text, jurisdictional electronic-signature review, identity/evidence-retention policy, and sealed private final-PDF workflow.
- Implement and verify the accepted-offer-to-agreement-to-customer conversion saga without conflating acceptance, signature, payment, or activation.
- Wire and test due-plan-change execution, subscription suspension, renewal invoice reconciliation, and recovery after partial downstream failures.
- Wire top-up draft issuance, confirmed-payment activation, and customer-visible state without sending or charging during automated tests.
- Reconcile shadow events against real provider-accepted synthetic traffic in an isolated environment before quota enforcement.
- Complete database-backed tenant isolation, stale signature, malformed input, link expiry/revocation, large PDF, concurrency, and invoice replay tests.
- Complete the requested typecheck/build and responsive UI review on suitable hardware.
- Assign named legal, support, dispute, release-decision, and rollback owners and record current evidence.

The system must not advance to `INTERNAL_ONLY`, `PILOT_ALLOWLIST`, or `GENERAL_AVAILABILITY` until these gates pass and a human authorises the exact transition.
