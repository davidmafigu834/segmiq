# SegmiQ Company Billing

Route: `/client/billing`  
Shell: `CompanyWorkspaceShell` (same Company sidebar and chrome as Dashboard, Pipeline, Team, Reports)  
Aggregator: `getCompanyBillingPageData()` in `lib/billing/company-billing-data.ts`  
Download: `GET /api/billing/company/invoices/[invoiceId]/pdf`  
UI: `components/dashboard/company/billing/*`  
Solo operator billing remains `/solo/billing` (`ClientBillingView`) and is not this page.

## Purpose

Company Billing is a **subscription and billing management workspace** for an authorized Company Owner/Admin. It answers:

- What plan are we on?
- How much does it cost, and when is the next bill?
- Is the subscription healthy?
- Are we close to a plan limit?
- What payment method will be used?
- Where are invoices, and how do we get billing help?

It is **not** a sales analytics page. There are no revenue graphs, KPI strips, or Lead/Deal rails.

## Access permissions

| Role | Access |
|------|--------|
| `CLIENT_MANAGER` | Company Billing (`/client/billing`) |
| `SALESPERSON` on a **team** client | Denied (redirect `/sales/dashboard`) |
| `SALESPERSON` in **solo** mode | `/solo/billing` only |
| `SUPER_ADMIN` | May preview a client via `?clientId=` |

Server gate: `canAccessClientBilling` / `resolveBillingAccess` in `lib/billing/client-access.ts`. Invoice PDF/receipt download re-checks tenant (`invoice.client_id`) for non-admins.

UI capabilities (display only; server still enforces writes):

- `canViewBilling` — page
- `canManageSubscription` — **false** for company managers (agency SUPER_ADMIN only)
- `canManagePaymentMethods` — view published pay-in details
- `canDownloadInvoices` — tenant-scoped PDF redirect
- `canEditBillingInfo` — company name via `PATCH /api/clients/[clientId]/company-profile`

## Subscription source of truth

SegmiQ uses **manual agency invoicing**, not Stripe or card vaults.

Canonical tables (`supabase/migrations/038_manual_billing.sql`):

- `subscriptions` — CRM product row per company (`plan`, `billing_cycle`, `amount`, `currency`, `status`, period dates, `grace_days`, `cancelled_at`)
- `invoices` — issued documents (`draft` hidden from this page)
- `payments` / `payment_proofs` / `receipts` — bank transfer, mobile money, cash
- `billing_settings` — agency-published pay-in details (not a customer card)

The snapshotted `subscriptions.amount` is what the company is billed. Catalogue prices in `lib/billing/plans.ts` are defaults for **new** subscriptions only.

Webhooks are not used. Agency admin confirms payments; cron (`lib/billing/cron.ts`) marks overdue invoices, sets `past_due`, and suspends after `due_at + grace_days`.

## Plan model

CRM catalogue (`starter` / `growth` / `scale`):

| Plan | Monthly USD | Annual (10× monthly) | Salesperson seats |
|------|-------------|----------------------|-------------------|
| Starter | 99 | 990 | 5 |
| Growth | 199 | 1990 | 15 |
| Scale | 349 | 3490 | Unlimited |

Descriptions and headline features come from `CRM_PLAN_DESCRIPTIONS` / `CRM_PLAN_FEATURES` (aligned with public pricing). Custom plan strings that are not in the catalogue display as **Custom**.

## Status mapping

Subscription (`active | past_due | suspended | cancelled`):

| Raw | Label |
|-----|--------|
| active | Active |
| past_due | Past due |
| suspended | Suspended |
| cancelled | Cancelled |

There is no trial, pause, or cancel-at-period-end in the current provider. Agency cancel sets `status = cancelled` and `cancelled_at` immediately.

Invoice (`draft | sent | overdue | paid | void`):

| Raw | Label |
|-----|--------|
| sent | Open |
| overdue | Past due |
| paid | Paid |
| void | Void |

Draft invoices are not listed.

## Billing cycles

`monthly` or `annual`. Annual catalogue amount is ten months (two months free). Display uses the subscription snapshot, not a client-side recalculation.

## Plan changes

Company managers **cannot** write plan, cycle, amount, or cancellation.

Agency only:

- `POST /api/billing/subscriptions/[id]/update` — plan / cycle / amount (`requireAgencyAdmin`)
- `POST /api/billing/subscriptions/[id]/cancel` — immediate cancel

**Manage Plan** opens a catalogue comparison and routes **Contact support** to `/client/account`. Prices in the modal are labelled as catalogue defaults. The billed amount remains `subscriptions.amount`.

Upgrade / downgrade / resume are not self-serve. Downgrade does not delete users or data from this UI. Seat limits are enforced by existing backend entitlement checks, not by the Billing page.

## Current Plan

Left column, first card. Crown icon, plan name, status, catalogue description, 3–4 entitlements, snapshotted price + cadence, Manage Plan.

Custom agreements with amount `0` show **Custom** rather than a fake free plan. Cancelled subscriptions show the cancelled date. Past-due subscriptions may show grace end (oldest overdue invoice `due_at` + `grace_days`).

## Usage Overview

Only **Team Members**: active `SALESPERSON` users on the company vs `CRM_PLAN_SEATS`.

Not metered (and therefore not shown): API calls, storage, automations, WhatsApp sessions.

No “Resets on” date — seats do not reset on a billing period. No “View full usage analytics” link (no usage route).

Unlimited Scale seats: `N used · Unlimited` (no percentage bar).

UI-only bar tones: &lt;80% brand, 80–94% warning, 95%+ critical. Enforcement stays on the backend. At-limit shows **Upgrade**, which opens Manage Plan (support), not a client-side plan write.

## Billing Summary

Persistent right rail (not an invoice detail panel). Plan, cycle, next billing date (or Access until when cancelled), amount, status, **Update Payment Method**.

Next billing date is `subscriptions.current_period_end`. Recurring amount is `subscriptions.amount`, not the latest invoice total.

## Payment methods

There is no card PAN/CVV collection and no Stripe Payment Element.

The Payment Method card shows the agency’s published **bank transfer** or **mobile money** details (brand + last four of the account/number only). **Update Payment Method** / **View payment instructions** opens those details. Multiple saved customer methods, Set as Primary, and Remove are not product features — those controls are omitted.

Paying an invoice uses **Submit payment proof** on unpaid invoice detail (`POST /api/billing/client/proof`).

## Invoices

Desktop table columns (fixed order): Invoice, Date, Status, Plan, Amount, Payment Method, Download.

Pagination: 5 per page, newest first (`created_at` desc).

Download uses a tenant-scoped redirect to the stored PDF. Receipt download is offered only when a confirmed payment has a receipt PDF.

Row click opens a **separate right overlay drawer** (~460px). The billing rail does not change.

**Historical plan:** `invoices` do not store a plan snapshot. The Plan column uses the current CRM subscription plan. Documented limitation — do not invent a historical plan from amount matching.

## Invoice Detail

Order: summary → billing period (if `period_start` / `period_end` exist) → plan → amount (total only; no independent tax/discount recompute) → payment / proof upload → billing information → download invoice / receipt.

Download icon on the table does not open the drawer (`stopPropagation`).

## Billing History

Real actions only:

- **View all invoices** — scrolls to the invoices card (no bulk ZIP export)
- **Update Billing Information** — company name; billing email is the owner email (read-only)
- **View Subscription Terms** — `/legal/terms`

Omitted (not product features): Download All Invoices, separate Billing Statements.

## Support

**Billing help center** and **Contact Support** route to `/client/account` (Help & Support). There is no dedicated billing-only help site.

## Payment failures

Past due / suspended / overdue invoice shows a compact alert under the header with Update payment method and View invoice. Copy reflects unpaid invoices, not a failed card charge.

Grace: access-until date is `due_at + grace_days` when an overdue invoice exists. Suspension is applied by cron, not by this UI.

## Free / enterprise / custom

The product no longer has a free plan. Scale is the highest catalogue plan. Non-catalogue plans show Custom; Manage Plan becomes **Contact account team**.

## Security

- No raw card data in SegmiQ forms or logs
- PDF/receipt URLs are not listed across tenants; download checks `invoice.client_id`
- Plan/price writes are agency-admin only; the frontend never submits an amount as authoritative
- Payment proofs go to existing `/api/billing/client/proof` (R2 object + pending payment row)
- Billing administration audit for agency plan changes remains `plan_changes` / subscription update routes — not duplicated here

## Currency and dates

`formatBillingMoney` (`Intl.NumberFormat`) and `formatDate` (`en-US` calendar date). Currency comes from the subscription/invoice row.

## Responsive

- **Desktop ≥1100px:** two columns — main `1fr`, rail `350–390px`. Left: Current Plan → Usage → Invoices. Right: Summary → Payment Method → History → Need Help.
- **Tablet 768–1099:** single column, Current Plan then Billing Summary, then Usage, Payment Method, Invoices, History, Help.
- **Mobile:** Billing Summary first, then Current Plan, Usage, Payment Method, invoice **cards** (not the seven-column table), History, Help.

## Dark mode

Sales tokens (`#0B0D0C` page, `#111411` surface, `#272C27` border, lime `#D4FF4F`). Modals use `PremiumSheet` (sales surface). No card-hosted iframe.

## Loading / empty / errors

The page is server-rendered, so it does not flash `$0` / `0 / 0`. Partial query failures set `data.errors.*` and show local Retry (`router.refresh()`). Empty invoices: **No invoices yet.** Missing payment details: **No payment method added.**

## Course targets

`billing-current-plan`, `billing-manage-plan`, `billing-usage`, `billing-invoices`, `billing-summary`, `billing-payment-method`, `billing-history`.
