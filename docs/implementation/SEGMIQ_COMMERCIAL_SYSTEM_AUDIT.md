# SegmiQ commercial management implementation

Date: 2026-10-23

## Preserved legacy boundary

- `lib/billing/plans.ts` remains the source of the legacy $99/$199/$349 company defaults.
- Historical `subscriptions.amount`, invoice states (including `sent`), invoice generation, and legacy plan aliases are unchanged.
- `clients.plan = business` and `subscriptions.plan = scale` are never mapped to Agentic AI.
- Organisations without `platform_commercial_accounts` are shown as **Legacy — not migrated** and cannot use the v2 amendment workflow.

## Canonical commercial path

- Version `2026-10-22` is loaded server-side from `platform_price_catalog`; prices are represented only as integer USD cents.
- Missing, unavailable, not-yet-effective, unknown, or malformed catalogue records fail closed.
- Public and Super Admin pricing use the same presentation model. Feature copy distinguishes CRM, Sales Copilot, autonomous Agentic AI, and separate external provider charges.
- Agentic AI is an organisation fee on top of Growth seats, never a per-seat fee.

## Super Admin controls

- The existing organisation profile shows either historical terms or the migrated commercial account, seat occupancy, invoices, active grace, change history, and audit context.
- Active distinct organisation users count once; `SUPER_ADMIN` and inactive users do not count.
- Server routes independently require a non-impersonating `SUPER_ADMIN` session.
- Plan changes are server-priced, previewed before confirmation, use idempotency keys, and require external consent evidence for charge-bearing terms.
- Grace grants require explicit timestamps and reason, are capped at 30 days, and use a half-open active window (`starts_at <= now < ends_at`).
- `PLATFORM_COMMERCIAL_WRITES_ENABLED` defaults off. Confirmations also depend on the atomic RPC follow-up migration.

## Migration reconciliation

- Remote history was read without mutation and confirms `20261023114812 segmiq_commercial_foundation_release1`.
- Remote counts at reconciliation time: 29 clients, 9 subscriptions, 0 commercial accounts, 0 plan changes, 0 grace periods, 0 audit events, and 0 AI ledger rows.
- `20261023114812_segmiq_commercial_foundation_release1.sql` is the local representation of the already-applied tables, constraints, catalogue rows, RLS, grants, indexes, and immutability triggers. It must not be replayed blindly against the existing remote project.
- `20261024055631_platform_commercial_atomic_workflows.sql` is a separate additive change for atomic amendments and grace operations. Application writes remain disabled until this migration and the release flag are intentionally enabled.

## Access enforcement

- The daily billing job will not create a billing suspension while a platform grace is active.
- Edge middleware computes a current-time billing decision from overdue date, legacy grace days, and the platform grace window, so expiry does not depend on a cron run.
- An already-suspended/cancelled subscription or explicit security suspension is never bypassed by commercial grace.
- Grace does not alter invoice state, billing cycle, agreed charges, or AI allowances.

## Remaining release blockers

- Apply and verify the additive RPC migration in a controlled database change window before enabling writes.
- Define the operational process and acceptable reference format for externally signed amendments.
- Connect customer notifications before any workflow may set `customer_notified = true`.
- AI allowance is displayed as **not yet metered** until the usage ledger has an idempotent integration.
- Keep broader v2 entitlement enforcement behind a separate default-off rollout until end-to-end validation is complete.
