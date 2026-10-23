# SegmiQ Commercial Management — Release 4

Date: 23 October 2026

## Dependency and gap report

- Release 2 application code and `20261023160000_platform_commercial_atomic_workflows.sql` exist in the repository. The remote migration history ends at `20261023114812_segmiq_commercial_foundation_release1`.
- Release 3 application code and `20261023180000_platform_sales_quotes_and_agreement_foundation.sql` exist in the repository. Its agreement and activation flags default off.
- The remote read-only reconciliation returned 29 clients, 9 subscriptions, and zero commercial accounts, usage-ledger rows, plan changes, and grace periods.
- Release 4 therefore remains inactive and does not treat operational history as contracted usage.

## 4A — shadow usage observations

- `recordBillableAiConversation` is called only after the existing WhatsApp send operation reports success.
- The observer requires `PLATFORM_AI_USAGE_SHADOW_ENABLED=true` and an exact client UUID in `PLATFORM_AI_USAGE_SHADOW_CLIENT_IDS`.
- Subject identities are SHA-256 hashed before storage. Raw phone numbers, message bodies, prompts, and chain-of-thought are not stored.
- PostgreSQL advisory locks serialize the first successful event per client, channel, and hashed subject. Windows use UTC half-open intervals `[opened_at, opened_at + 24 hours)`.
- Duplicate source events return the original outcome. Further successful events in the same window are observations but do not open another conversation.
- Failed, test-mode, unsupported, read-only, human-approved, or unrecognized action events fail closed and never enter the financial ledger.
- Financial ledger insertion exists behind database-side contract checks, but no Release 4 application caller requests financial mode. Later 4D wiring must add quota reservation and reconciliation before enabling it.

## 4B — read-only quota reporting

- `/dashboard/commercial-ai-usage` is SUPER_ADMIN-only and distinguishes shadow, enforced, unmetered legacy, suspended, and missing-agreement states.
- The existing `/client/billing` page can show the company's own Agentic allowances when reporting is explicitly enabled.
- Quotas keep customer conversations and internal actions separate. Only active, period-bound top-ups increase conversation availability.
- Threshold calculations use 80%, 95%, and 100%. Notification claims are idempotent, but no sender is wired and no delivery is claimed.

## 4C — disabled top-up and invoice-line foundation

- `platform_ai_topup_requests` models explicit customer approval, payment linkage, one-time activation, idempotency, and period-bound non-carryover.
- `platform_invoice_lines` provides immutable integer-cent line snapshots and unique obligation keys without modifying historical invoice headers or the existing `sent` status.
- `/dashboard/commercial-topups` is a read-only queue. No admin endpoint can fabricate consent, confirm payment, activate credit, or issue an invoice.
- Customer top-up requests and invoice-line issuance remain disabled until the agreement and payment prerequisites are verified.

## Files and routes

- Migration: `20261023210000_platform_ai_usage_shadow_and_topup_foundation.sql`
- Domain: `lib/platform-ai-usage/*`
- Admin routes: `/dashboard/commercial-ai-usage`, `/dashboard/commercial-topups`
- Customer integration: existing `/client/billing`
- Source hooks: successful agent reply and autonomous executed-action audit in `lib/agent/runtime.ts`

## Remaining release gates

- Review and apply Releases 2, 3, then 4 in order in an isolated database.
- Exercise database concurrency, replay, period-boundary, quota-exhaustion, and payment retry tests.
- Reconcile shadow observations against provider-accepted sends for selected synthetic organisations.
- Approve v2 agreements, period creation, top-up expiry terms, and internal action definitions.
- Implement payment-confirmed top-up activation and invoice-line reconciliation as one retry-safe workflow.
- Add verified notification delivery before marking warning claims delivered.
- Keep quota enforcement, customer top-ups, v2 invoice issuance, and signup gating off until their respective gates pass.
