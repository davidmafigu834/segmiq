# SegmiQ 2.0 — Company Leads

Route: `/client/leads`

## Purpose

Company Leads is the manager-facing acquisition and qualification workspace. It answers what enquiries entered the company, which are high intent, whether the team responded, who owns each Lead, what the customer needs, and which qualified Leads should become Deals.

A **Lead** is an enquiry or prospect. A **Deal** is a confirmed commercial opportunity. Leads never contribute directly to Pipeline Value, Active Deals, or Won revenue. Creating a Deal preserves the originating Lead and links the new Deal back to it.

## Company scope and permissions

- The page is available to authenticated `CLIENT_MANAGER` and authorized `SUPER_ADMIN` previews.
- Every page and detail query includes `client_id`; a deep link to another tenant's Lead returns not found/forbidden.
- Owner options include active sales-capable users in the company only.
- Managers can reassign Leads within their permitted company. Sales actions continue to use the canonical `alsoSells` and ownership checks.
- Create Deal uses the existing idempotent Lead → Deal service and is disabled when the Lead already has a Deal, is Not Qualified, or the actor cannot modify it.

## Information architecture

The page reuses `CompanyWorkspaceShell`, `CompanyDashboardHeader`, Company navigation, global search, notifications, theme control, and profile menu.

Desktop order:

1. `COMPANY / LEADS` header and **Add Lead**
2. One row of six KPI cards
3. One Leads table card on the left
4. One selected Lead detail panel on the right

The panel is approximately 28–30% / 360–410px at large desktop widths. It becomes an overlay below 1280px. There are no lower charts on this page.

No Lead is auto-selected. Row selection is stored in `?lead=<id>`, so refresh and Back preserve a valid selection. Closing the panel removes only `lead` and retains tab, search, filters, sort, and pagination state.

## KPI definitions

All KPI calculations are company-scoped and use the same meaningful-response service as the Company Dashboard.

| KPI | Definition |
|---|---|
| New Leads | Eligible Leads captured in the current 30-day cohort |
| Hot Leads | Open, non–Not Qualified Leads with the canonical Hot score band (`score >= 70`) |
| Contacted | Current-cohort Leads with a real first response event |
| Qualified | Current-cohort Leads in the canonical qualified-or-beyond set |
| Conversion Rate | Deals created from the current 30-day Lead cohort ÷ eligible Leads in that cohort |
| Avg. Response Time | Lead `created_at` → first meaningful outbound response for the current cohort |

The comparison period is the preceding 30 days. A positive value against a zero baseline is displayed as **New**, never Infinity. Missing comparison data omits the trend. Hot Leads is an operational stock count, so its trend is intentionally omitted until historical score snapshots exist. Missing cohort conversion is shown as unavailable rather than `0%`.

Meaningful response signals include successful call activity, outbound WhatsApp, and canonical contact events. Viewing, assigning, or editing metadata does not count as customer contact.

## Lifecycle and intent

Lifecycle and intent are independent:

- Lifecycle: New, Contacted, Qualified, Deal created, Not Qualified, plus legacy compatible qualified-or-beyond states.
- Intent: Hot, Warm, Cold from the canonical Lead score.
- Hot is never written to `lead.status`.
- Not Qualified Leads remain preserved acquisition records and are not Lost Deals.

The tabs are **All Leads**, **New**, **Hot**, **Contacted**, **Qualified**, and **Not Qualified**. Hot is an intent shortcut; the remaining tabs are lifecycle views. Not Qualified Leads are excluded from actionable Hot counts even when they retain an old high score.

## Table

The single table card contains, in order:

1. Underline tabs and real counts
2. `Search Leads...`, Filters, Source, Owner, and Sort controls
3. Table rows
4. Results count, pagination, and page size

Desktop columns are fixed in this order: checkbox, Lead, Source, Contact, Status, Lead score, Owner, Created, Actions.

- Lead identity is two-line with the best canonical name and enquiry context.
- Search covers identity, company/enquiry context, phone, email, location, source, lifecycle label, and owner.
- Source options come from real company data. WhatsApp and Facebook retain official brand colors.
- Status is lifecycle only; score shows the 0–100 score and intent color.
- Selected rows use a restrained SegmiQ lime tint. Checkbox and row-menu clicks stop propagation.
- The default page size is 10; 25 and 50 are available. The current implementation caps the tenant-scoped query at 2,000 records and performs in-memory view filtering over that bounded result.
- Mobile replaces the desktop table with readable Lead cards.

Filters support lifecycle, intent, first-contact state, Deal relationship, source, owner, and unassigned. Sorts support newest, oldest, score, response urgency, last activity, and next action.

## Lead detail panel

The panel section order is fixed:

1. Lead header and lifecycle
2. Call / WhatsApp / Email / More actions
3. Lead Score and real score/qualification signals
4. About this Lead: source, owner, first contact, last activity
5. Customer Need
6. Next Action and completion/scheduling controls
7. Related Deal or Not Qualified context when applicable
8. View full details / Create Deal footer

Score reasons are derived only from stored score breakdown and qualification fields. The panel never invents a static checklist. Customer Need uses the canonical field, supported form-answer fallbacks, then project/service context.

The panel has structured loading and error states. Switching rows updates the existing panel without closing it. On mobile it becomes a full-height, safe-area-aware sheet.

## Actions and integrations

- **Add Lead** opens the shared Add to Hub flow.
- **Call** uses the canonical call log form.
- **WhatsApp** opens the Sales Hub for WhatsApp Leads, otherwise a valid `wa.me` contact when a number exists.
- **Email** uses the validated mail address.
- **Assign / Reassign** uses the existing tenant-validated bulk assignment route.
- **Schedule follow-up / Mark complete** updates the canonical Lead follow-up and emits existing Lead events.
- **View full details** opens the canonical customer/Lead workspace when linked.
- **Create Deal** opens the shared `CreateDealSheet`; an existing Deal changes the action to **Open Deal**.
- **Mark Not Qualified** preserves the Lead, records the reason, and does not create or lose a Deal.

## Loading, empty, error, and theme behavior

- Initial content uses the Company Leads skeleton; table and panel loading retain their exact structure.
- Empty states distinguish no Leads, empty lifecycle/intent tabs, search misses, and filter misses.
- Failed detail loading does not disable the table and provides Retry/Close.
- Light and dark modes use shared sales tokens; WhatsApp remains `#25D366` and Facebook `#1877F2`.
- Stable course targets are provided for KPIs, tabs, table, Lead rows, detail, score, next action, and Create Deal.

## Data architecture

`getCompanyLeadsPageData` fetches Leads, owners, and response signals in bounded batched queries. The table mapper builds a compact row DTO; `getCompanyLeadDetail` authorizes and loads the selected panel DTO. Owner/source/score/contact data are not fetched once per row, avoiding N+1 behavior.

The Company Dashboard and Leads page share the canonical meaningful-response helper. Deal creation, related Deal state, Tasks/follow-ups, WhatsApp, and customer details continue to use their existing services rather than Lead-page-specific substitutes.
