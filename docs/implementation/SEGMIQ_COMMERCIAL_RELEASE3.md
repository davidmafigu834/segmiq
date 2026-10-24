# SegmiQ Commercial Management — Release 3

Date: 23 October 2026

## Safety state

- Release 2 application code is present locally, but its atomic workflow migration is not present in remote migration history.
- The remote database still reports 29 clients, 9 subscriptions, and zero rows in `platform_commercial_accounts`, `platform_plan_change_requests`, and `platform_grace_periods`.
- Platform sales quotes, agreements, and the activation gate all default off. No existing customer is automatically migrated or gated.
- Agreement signing is intentionally unavailable because no counsel-approved template, signing method, evidence-retention policy, or sealed-PDF workflow has been approved.

## Implemented

- Separate `platform_sales_*` prospect, quote, immutable revision, event, and hashed-link domain. It has no foreign-key dependency on tenant quotations.
- Separate agreement template, customer agreement, signer, signature, event, and access-token foundation without legal text.
- Canonical version `2026-10-22` price calculation using integer USD cents and server-loaded catalogue rows.
- Scope-specific fixed or percentage discounts, basis-point tax calculation, setup services, and separate recurring/one-time totals.
- Super Admin-only prospect, preview, draft, issue, revise, and private PDF endpoints.
- Purpose-bound random recipient tokens stored only as SHA-256 hashes. Public APIs expose only the exact linked revision.
- Issuing stores an immutable PDF under `platform/commercial/quotes/{quoteId}/revisions/{revision}.pdf`; downloads receive fresh five-minute presigned URLs.
- Recipient view/accept/decline/request-changes workflow. Acceptance records named capacity but is explicitly not represented as a signature, payment, or tenant activation.
- Current-time validity, current-revision, revoked/redeemed token, replay, and request-count checks in transactional database functions.
- Fail-closed activation decision requiring an executed, sealed agreement and billing readiness, while legacy customers remain exempt.

## Application routes

- `/dashboard/commercial-sales`
- `/dashboard/commercial-sales/agreements`
- `/dashboard/commercial-sales/quotes/[quoteId]`
- `/offer/[token]`
- `/api/admin/platform-sales/prospects`
- `/api/admin/platform-sales/prospects/[prospectId]`
- `/api/admin/platform-sales/quotes`
- `/api/admin/platform-sales/quotes/preview`
- `/api/admin/platform-sales/quotes/[quoteId]/issue`
- `/api/admin/platform-sales/quotes/[quoteId]/revise`
- `/api/admin/platform-sales/quotes/[quoteId]/pdf`
- `/api/platform-sales/offers/[token]`
- `/api/platform-sales/offers/[token]/pdf`

## Migration reconciliation

- Existing remote foundation: `20261023114812_segmiq_commercial_foundation_release1`.
- Release 2 local follow-up prerequisite: `20261024055631_platform_commercial_atomic_workflows.sql`.
- Release 3 additive migration: `20261024055657_platform_sales_quotes_and_agreement_foundation.sql`.
- The Supabase CLI was not usable in this workspace, so the additive migration file was prepared locally and not applied remotely.
- All new public-schema tables enable RLS, revoke `anon` and `authenticated`, and grant only `service_role`. Function execution is also explicitly revoked from public roles, consistent with current Supabase function-security guidance.

## Boundaries and blockers

- Tenant `quotations`, `quotation_line_items`, their routes, public tokens, PDFs, and tenant workflows were not reused or modified.
- There is no verified send integration; issued offers are labelled **Link created — not sent**.
- No agreement template can be approved through the application yet. Counsel must supply and approve exact content and governing-law choices.
- Signature identity verification, OTP/e-sign provider integration, PDF sealing, countersigning, notification delivery, conversion saga, and signup enforcement remain blocked.
- Before enabling the quote flag, apply migrations in order in a controlled environment, run database transaction/concurrency tests, configure private R2, and exercise only synthetic prospects.
