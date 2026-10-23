# SegmiQ Commercial System — Master UI Implementation

Date: 24 October 2026

## Outcome

This pass establishes a coherent Super Admin commercial workbench on the existing application architecture. It adds a command centre, separates the commercial lifecycle in navigation, exposes real read-only grace and audit registers, upgrades quotation and agreement management, adds responsive billing records, improves Agentic AI states, and adds an honest public seat-price estimator.

Commercial launch mode remains fail-closed. This work did not apply a database migration, change a subscription, migrate a customer, create or collect a charge, send a communication, enable signing, or change a launch flag.

The release decision remains **NO-GO**. UI completeness does not close the database, legal, recovery, security, or end-to-end evidence gates recorded in Release 5.2.

## 1. Hallmark guidance applied

- Skill: `.cursor/skills/hallmark/SKILL.md`.
- Locked project system: `.cursor/skills/hallmark/design.md`.
- Genre and tone: SegmiQ modern-minimal, technical control centre.
- Macrostructure: Workbench — current operating state, one safe next action, then exception queues and records.
- Existing Geist/Inter typography, CSS variables, application shell, Lucide icons, and lime accent were reused.
- No new colour tokens, gradients, decorative illustration, fake browser chrome, or generic marketing card pattern was introduced.
- Hallmark preflight was cached in `.hallmark/preflight.json`; the build was recorded in `.hallmark/log.json`.
- Pre-emit critique: philosophy 5, hierarchy 5, execution 4, specificity 5, restraint 5, variety 3. Variety is intentionally constrained by the repository-owned Workbench system.

## 2. Existing routes audited

- `/pricing`
- `/dashboard/pricing`
- `/dashboard/clients` and `/dashboard/clients/[clientId]`
- `/dashboard/billing` plus subscription, invoice, payment, and settings routes
- `/dashboard/commercial-migrations`
- `/dashboard/commercial-sales`
- `/dashboard/commercial-sales/quotes/[quoteId]`
- `/dashboard/commercial-sales/agreements`
- `/offer/[token]`
- `/dashboard/commercial-ai-usage`
- `/dashboard/commercial-topups`
- `/dashboard/commercial-health`
- `/client/billing` and company billing components

The audit found capable backend foundations but fragmented navigation, no commercial overview, no dedicated quotation register, placeholder-only agreement administration, no global grace/audit registers, horizontal-only mobile subscription records, and weak empty/unavailable distinctions in AI/top-up views.

## 3. Screens implemented or redesigned

| Screen | Route | UI done | Functional | Mobile implemented | Blockers |
| --- | --- | --- | --- | --- | --- |
| Commercial overview | `/dashboard/commercial` | Yes | Read-only live models with fail-closed fallbacks | Yes | Later commercial tables are not yet present in production |
| Public pricing estimator | `/pricing` | Yes | Client-side estimate from canonical server catalogue | Yes | Estimate is not a quotation |
| Pricing catalogue | `/dashboard/pricing` | Existing/reused | Canonical versioned catalogue | Yes | New-version authoring intentionally not added |
| Customer list and billing | `/dashboard/billing` | Improved | Existing subscription data and detail routes | Yes, new card mode | Legacy and v2 commercial records are still split |
| Customer commercial profile | `/dashboard/clients/[clientId]` | Existing/reused | Plan preview, confirmation, grace, invoice/activity summaries | Existing responsive layout | Writes remain gated; R2 is pending |
| Customer migration queue | `/dashboard/commercial-migrations` | Existing/reused | Catalogue-backed preview path | Yes | R5.2 migration is pending |
| Prospects | `/dashboard/commercial-sales?view=prospects` | Improved | Create/search when the server feature gate is enabled | Yes | R3 is pending; no live communication |
| Quotations | `/dashboard/commercial-sales?view=quotes` | New register | Search, filter, detail, PDF, gated secure-link creation | Yes | R3 is pending; secure link is copied, never sent |
| Quotation builder | `/dashboard/commercial-sales?view=builder` | Existing/refined controls | Server-calculated preview and draft creation | Yes | Feature gate and R3 required |
| Public quotation review | `/offer/[token]` | Existing/reused | Tokenized review/response foundation | Existing responsive layout | End-to-end recipient evidence incomplete |
| Agreements | `/dashboard/commercial-sales/agreements` | Rebuilt register | Read-only status/version register when enabled | Yes | Legal approval, private PDF sealing, R3, and E2E evidence |
| Grace periods | `/dashboard/grace-periods` | New | Active and historical read-only register | Yes | Grant/end actions remain on customer profile; R2 required |
| Commercial activity | `/dashboard/commercial-activity` | New | Immutable audit timeline | Yes | Later workflow events require pending migrations |
| Agentic AI usage | `/dashboard/commercial-ai-usage` | Improved | Search, status, quotas, summary and safe empty states | Yes | R4 pending; enforcement remains off |
| AI top-ups | `/dashboard/commercial-topups` | Improved | Read-only approved-request queue | Yes | R4/R5.1 pending; no admin payment bypass |
| Commercial health | `/dashboard/commercial-health` | Existing/reused | Release evidence and fail-closed launch control | Existing responsive layout | Mandatory evidence remains incomplete |
| Customer commercial account | `/client/billing` | Existing/reused | Plan, invoices, payment history, and commercial data | Existing responsive layout | Full v2 agreement/AI account journey incomplete |
| Direct signup and signing | No complete route | No | No | No | Legal approval, activation workflow, payment validation, and controlled E2E evidence |

“Mobile implemented” means responsive code paths and card/reflow behavior were added or retained. It does not mean browser viewport inspection was performed.

## 4. Shared components created or reused

Created:

- `CommercialAdminDashboard`
- `CommercialSection`
- `CommercialMetric`
- `CommercialStatus`
- `CommercialEmptyState`
- `CommercialUnavailable`
- `PublicPricingCalculator`

Reused:

- `AgencyLayout`
- shared `Button`, `Input`, cards, billing status, meters, and existing application tokens
- canonical commercial catalogue/presentation model
- commercial health, sales, AI usage, and Supabase server read models

## 5. Navigation changes

The Super Admin shell now separates:

- **Platform:** Overview, Organisations, Users, Commercial Health.
- **Commercial:** Overview, Pricing & Plans, Customers & Billing, Customer Migrations, Prospects, Quotations, Agreements, Agentic AI Usage, AI Top-ups, Grace Periods, Commercial Activity.

Operations, Security, and Configuration remain separate. Existing URLs were preserved; quotation navigation uses the sales workspace's `view=quotes` state.

## 6. Functional controls wired

- Commercial overview quick actions route to prospect creation and the quotation builder.
- Attention queues route to migrations, quotations, agreements, health reconciliation, and billing.
- Prospect creation continues through the same-origin protected admin API.
- Quotation preview remains server-calculated from the versioned catalogue.
- Draft quotation creation and secure recipient-link creation use existing gated APIs.
- Issued quotation PDF links use existing authenticated endpoints.
- Public price estimates use the exact canonical Starter, Growth, Business, and Scale prices received from the server.
- Customer plan-change and grace actions remain in the existing customer profile workflow.
- No UI action silently sends, signs, bills, activates AI, confirms payment, or changes launch mode.

## 7. Controls blocked by backend or launch gates

- Digital agreement creation, issuing, signing, countersigning, sealing, and download remain blocked pending legal and technical evidence.
- Direct self-service signup through agreement, payment, and activation is not implemented.
- Accepted-quotation conversion into a customer remains incomplete.
- Customer-facing v2 agreement and AI top-up workflows are incomplete.
- New price-version authoring is not exposed because immutable catalogue administration lacks an approved workflow.
- Overages are not activated automatically.
- Commercial writes remain subject to the environment kill switch and database launch control.

## 8. Responsive behavior implemented

- Command-centre metrics collapse from four columns to two and then one without a wide fixed canvas.
- Records use stacked mobile layouts and definition lists rather than compressed tables.
- Subscription management now renders mobile cards below the desktop breakpoint.
- Quotation rows become stacked records with visible status and action controls.
- Forms use single-column mobile layouts and two-column desktop layouts.
- Primary newly touched controls have 44 px minimum targets; clickable labels are kept concise.
- Loading animation respects `prefers-reduced-motion`.

## 9. Visual issues found and fixed

- Fragmented lifecycle navigation was replaced by explicit Platform and Commercial groups.
- The absent commercial “home” was replaced by a decision-oriented overview.
- Quotations were hidden inside prospect cards; they now have an independent searchable register.
- Agreement administration exposed only a placeholder; it now shows real records while preserving the legal block.
- Empty AI/top-up states could imply success; they now distinguish disabled, unmetered, unavailable, and empty states.
- Billing depended on horizontal table scrolling on small screens; mobile records now use cards.
- Public Agentic pricing now exposes the total for the selected seat count and states that the organisation fee is additional to Growth seats.

## 10. Browser inspection

Not performed at the user's request. No browser was started.

## 11. Screenshots

None captured at the user's request.

## 12. Targeted verification

Passed:

- TypeScript syntax transpilation for 13 initially touched UI files: **13 passed, 0 syntax failures**.
- Focused commercial unit suite: **24 tests passed, 0 failed** across catalogue arithmetic, launch fail-closed gates, AI window/quota rules, quotation totals/tokens, and activation gates.
- Static Hallmark scan of the touched commercial UI found no new raw hex colours, `transition-all`, uniform hover scaling, italic display headings, or arbitrary pixel spacing utilities.
- `git diff --check` reported no whitespace errors on tracked touched files; only existing Windows line-ending notices were emitted.

Not completed:

- Full TypeScript project check.
- Production build.
- Browser or responsive viewport inspection.
- Accessibility automation.
- Live Supabase workflow tests.
- End-to-end signing, billing, migration, renewal, or customer-activation tests.

These omissions are intentional under the low-end-PC constraint and must not be treated as passing evidence.

## 13. Remaining incomplete features

- Legally approved agreement templates and complete signing UX.
- Agreement identity verification, sealed PDFs, retention policy, and download evidence.
- Direct signup and accepted-quote conversion workflows.
- Unified v2 customer commercial profile tabs for Overview, Billing, Agentic AI, Agreements, and Activity.
- Invoice reconciliation screens at individual line/event level.
- Customer-side AI top-up request/approval/payment journey.
- Admin catalogue-version authoring.
- Browser-proven responsive and accessibility behavior.

## 14. Build and typecheck limitations

No production build or full repository typecheck was run. The lightweight syntax check cannot detect every cross-module type error, generated Next.js route type issue, runtime server/client boundary problem, or CSS layout defect.

## 15. Files changed in this UI pass

Created:

- `app/(agency)/dashboard/commercial/page.tsx`
- `app/(agency)/dashboard/commercial/loading.tsx`
- `app/(agency)/dashboard/commercial/error.tsx`
- `app/(agency)/dashboard/grace-periods/page.tsx`
- `app/(agency)/dashboard/commercial-activity/page.tsx`
- `components/commercial/CommercialAdminDashboard.tsx`
- `components/commercial/CommercialPrimitives.tsx`
- `components/commercial/PublicPricingCalculator.tsx`
- `docs/implementation/SEGMIQ_COMMERCIAL_MASTER_UI_IMPLEMENTATION.md`
- `.hallmark/preflight.json`

Modified:

- `components/platform/nav.ts`
- `components/platform-sales/CommercialSalesClient.tsx`
- `app/(agency)/dashboard/commercial-sales/page.tsx`
- `app/(agency)/dashboard/commercial-sales/agreements/page.tsx`
- `components/platform-ai-usage/AdminAiUsageClient.tsx`
- `app/(agency)/dashboard/commercial-topups/page.tsx`
- `components/billing/SubscriptionsListClient.tsx`
- `app/(marketing)/pricing/page.tsx`
- `.hallmark/log.json`

No unrelated working-tree change was reverted or overwritten.

## 16. Migration dependencies discovered

The UI confirms and preserves the existing dependency sequence:

1. R1 `20261023114812_segmiq_commercial_foundation_release1` already exists in production and must not be replayed.
2. R2 commercial atomic workflows supplies plan-change and grace mutations used by customer profiles.
3. R3 sales/agreement foundation supplies the prospect, quotation, token, template, agreement, signer, and event tables queried by sales screens.
4. R4 AI usage/top-up foundation supplies periods, conversation windows, source events, top-up requests, and invoice lines.
5. R5 launch controls supplies release controls, evidence, decisions, and reconciliation findings.
6. R5.1 safety workflows depends on R2/R4.
7. R5.2 controlled migration depends on R2 validation/mutation functions.

The new read-only screens fail visibly when a pending table is unavailable. No SQL was changed or applied in this UI task.

## 17. Security and release-control status

- Every new Super Admin page performs a server-side `SUPER_ADMIN` session check and rejects impersonation.
- Database reads use the existing server-only Supabase admin client; no service credential is exposed to client components.
- Existing prospect/quotation mutations retain their same-origin protected server APIs and feature gates.
- Immutable audit records are displayed without edit/delete affordances.
- Secure quotation links are copied but not sent automatically.
- Agreement signing remains blocked rather than presenting a misleading live control.
- Missing read models render “unavailable/unknown,” never a false healthy or empty state.
- Launch mode changes were not made. The release remains **NO-GO** until the Release 5.2 mandatory evidence gates pass.
