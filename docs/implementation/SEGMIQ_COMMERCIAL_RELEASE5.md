# SegmiQ Commercial Management — Release 5

Date: 23 October 2026

## Release decision: NO-GO

The commercial launch gate must remain `OFF`. Releases 2–4 are present as application code and additive migration files, but their schemas and required end-to-end evidence were not observable in the connected Supabase project. Release 5 does not promote itself, migrate customers, send messages, collect payment, or enforce AI quotas.

## Evidence baseline

| Area                 | Observed evidence                                                                                              | Assessment                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Repository           | Branch `main`; commit `3e9d413`; working tree already contained extensive unrelated changes                    | Preserve and do not commit unrelated work             |
| Environment identity | No authoritative environment label or revision source was available                                            | `UNKNOWN`                                             |
| Database history     | Latest observed migration: `20261023114812_segmiq_commercial_foundation_release1`                              | R2–R5 migrations not evidenced in the target database |
| Live record counts   | 29 clients; 9 legacy subscriptions; 0 commercial accounts, usage-ledger rows, plan changes, and grace periods  | Legacy estate retained; no v2 journey evidence        |
| R2                   | `20261023160000_platform_commercial_atomic_workflows.sql`, plan-change/grace code and focused tests            | `CODE_ONLY`                                           |
| R3                   | `20261023180000_platform_sales_quotes_and_agreement_foundation.sql`, quote domain and focused tests            | `CODE_ONLY`                                           |
| R4                   | `20261023210000_platform_ai_usage_shadow_and_topup_foundation.sql`, shadow metering and focused tests          | `CODE_ONLY`                                           |
| R5                   | `20261023230000_commercial_launch_controls.sql`, dashboard, gates, reconciliation read model and focused tests | `CODE_ONLY`                                           |

The Supabase Security Advisor reported existing warnings, including RLS-enabled tables without policies and mutable function search paths. Because the Release 5 migration was not applied, that advisor result cannot validate the new objects and must not be treated as proof of Release 5 security.

## Implemented safe foundation

- Added `/dashboard/commercial-health`, protected by the existing server-side `SUPER_ADMIN` check and blocked during impersonation.
- Added observable release states, environment/revision/schema labels, exact feature-flag states, live-or-unknown counts, evidence references, readiness gates, reconciliation findings, and a read-only commercial audit stream.
- Added database-owned modes: `OFF`, `INTERNAL_ONLY`, `PILOT_ALLOWLIST`, and `GENERAL_AVAILABILITY`.
- Added an optimistic-locking, idempotent, permission-checked mode-change function. Pilot and GA promotion require current passing evidence for R2, R3, R4, legacy classification, invoice idempotency, tenant isolation, private documents, rollback ownership, and support ownership. Pilot additionally requires explicit client UUIDs.
- Added append-only decision and evidence records. Reconciliation findings use the required status vocabulary and are read-only in the application.
- Added an independent runtime gate to R2 plan-change, migration, grace-grant, and grace-end mutations. The existing environment flag must be open and the database mode must permit the exact client. Missing control state fails closed.
- Added explicit labels and icons so status is not communicated by colour alone. Missing sources remain `UNKNOWN`; an empty findings list is not presented as a passing reconciliation.
- Added a navigation entry using the existing platform navigation model.

## Focused verification

The lightweight Node test selection passed 27 of 27 tests:

- Release 5 environment kill switch, OFF, internal-only, pilot allowlist, and GA decisions.
- Promotion prerequisites and safe rollback modes.
- Canonical catalogue arithmetic, distinct-seat rules, and organisation-level AI pricing.
- R2 consent and grace-window rules.
- R3 quote totals, token hashing, and activation fail-closed behavior.
- R4 24-hour boundaries, quotas, and internal-action exclusions.

`git diff --check` reported no whitespace errors. In keeping with the machine constraints, no full build, full test suite, browser run, or visual checks were performed. Database concurrency and end-to-end workflows were not simulated, so the focused test result is not end-to-end evidence.

## Unmet mandatory gates

- Apply and inspect migrations `20261023160000`, `20261023180000`, `20261023210000`, and `20261023230000` in order in an isolated target environment.
- Provide a counsel-approved agreement template, approved electronic-signature method, proportionate evidence-retention policy, sealed private PDF path, and fresh five-minute download authorization.
- Prove tenant isolation, token expiry/revocation, stale-signature rejection, malformed input handling, service-role non-exposure, and cross-tenant object denial.
- Exercise the R2 amendment and grace transactions under concurrency and verify audit, billing recalculation, permissions, and deterministic expiry.
- Implement and exercise an idempotent accepted-offer-to-customer conversion saga. Quote acceptance must remain distinct from signature, payment, and activation.
- Reconcile R4 shadow observations against canonical successful source events for an agreed synthetic pilot, including duplicates, the exact 24-hour boundary, renewal crossing, failure/test exclusions, and internal-action classification.
- Link approved top-up, payment confirmation, one invoice line, and one period-bound grant in a single retry-safe workflow.
- Complete Journeys A–E using synthetic organisations only. Do not reuse or modify live customers.
- Resolve or explicitly accept existing Security Advisor findings, then re-run advisory checks after the new migrations exist.
- Assign named support, dispute, decision, and rollback owners and record source-linked evidence in the release-evidence table.
- Verify responsive navigation and forms at the required viewport sizes when suitable hardware or an external review environment is available.

## Rollback runbook

1. Set the database release mode to `OFF` and close the environment flags for new commercial writes, signup gating, top-ups, invoice lines, and AI enforcement.
2. Keep legacy subscriptions, invoice generation, existing access paths, executed agreements, invoices, decisions, and ledgers intact.
3. Record correction events and authorised compensating transactions; never rewrite historical agreements, invoices, or usage silently.
4. Return AI handling to shadow/human operation without discarding inbound work.
5. Investigate by internal identifiers, reconcile affected periods, and require fresh passing evidence before any later promotion.

No automated path promotes to GA. A human `SUPER_ADMIN` action, the separate launch-control write flag, current database evidence, ownership fields, and optimistic version match are all required.
