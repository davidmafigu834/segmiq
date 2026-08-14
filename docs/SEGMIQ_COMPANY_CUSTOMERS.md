# SegMiQ 2.0 — Company Customers

Route: `/client/customers`

## Purpose and business truth

Company Customers is the relationship directory for people and organisations that are already Customers. A Customer is a canonical `contacts` record with `lifecycle = 'customer'`. One Customer can have zero, one, or many canonical Deals.

The page never treats a Lead as a Customer or a Customer as a Deal. Lead score, qualification state, intent, and Deal health do not appear here.

## Company scope and permissions

- The page is available to authenticated `CLIENT_MANAGER` users and authorized `SUPER_ADMIN` previews.
- List and detail reads always include `client_id`; cross-company detail IDs return not found.
- Customer type and relationship owner are explicit Customer fields. They are not inferred from a name, Lead owner, or Deal owner.
- Existing Customer records remain unclassified until a user sets their type.
- Owner options are active, sales-capable users from the same company.

## Information architecture

The page reuses `CompanyWorkspaceShell`, the Company sidebar/mobile navigation, `CompanyDashboardHeader`, global search, notifications, theme control, and profile menu.

Desktop order:

1. `COMPANY / CUSTOMERS` header and **Add Customer**
2. Exactly five KPI cards
3. One Customers table card
4. A selected Customer detail panel at roughly 28–30% / 370–410px

No Customer is auto-selected. Selection is stored in `?customer=<contact-id>` and survives refresh/Back. The detail panel is inline from 1280px, an overlay below 1280px, and a full-screen sheet below 768px. The table becomes Customer cards on smaller screens.

## KPI definitions

| KPI | Definition |
|---|---|
| Total Customers | Canonical company contacts whose lifecycle is Customer |
| Companies | Customers explicitly classified `company` |
| Individuals | Customers explicitly classified `individual` |
| Active Deals | Canonical Deals in Qualified, Scoping, Proposal sent, or Negotiating |
| Total Pipeline Value | Sum of known canonical commercial values for active Deals |

Unknown and pending Deal estimates are excluded from the numeric sum and reported as “awaiting estimate.” If every active Deal is unknown, the value is unavailable rather than `$0`. Trends are intentionally absent because no historical Customer KPI snapshot service exists.

## Table semantics

The table card owns underline tabs, search/filter/sort controls, rows, results count, pagination, and page size.

- Tabs: All Customers, Companies, Individuals, Recent.
- Recent means a meaningful Customer interaction in the last 30 days. `contacts.updated_at` and profile views are not interactions.
- Search covers name, primary contact, phone, email, location, industry/category, and relationship owner.
- Customer Value means cumulative known value from won Deals. A won Deal without recorded value stays “Not recorded.”
- Customer type and owner filters use explicit contact fields.
- Rows use a restrained lime selection tint; there is no zebra striping or hover scaling.

The current tenant query is capped at 2,500 Customer records. Related Deals, Leads, quotes, calls, messages, and events are loaded in chunks, not per Customer, to avoid N+1 behavior.

## Detail panel

Panel order is fixed:

1. Customer header
2. Call / WhatsApp / Email / More
3. Customer Overview: since, type, primary contact, email
4. Commercial metrics: Total Deals, Active Pipeline Value, Won Deals, Won Value
5. Up to three real recent activities and View all activities
6. View full details and View Deals `(N)`

The panel does not invent a status badge, favourite state, invoice totals, payment totals, or activity descriptions. Missing facts display “Not recorded,” “Not assigned,” “Not estimated,” or an empty activity state.

## Actions and integrations

- **Add Customer** opens the shared Add to Hub sheet locked to Customer mode. It captures explicit company/individual type, relationship owner, location, primary contact, and category while retaining phone duplicate prevention.
- **Call**, **WhatsApp**, and **Email** are enabled only when the underlying contact value exists.
- **View full details** opens the canonical contact workspace.
- **View Deals** opens Company Pipeline with `customerId=<contact-id>`; Pipeline filters canonical `deals.contact_id`.

## Data architecture

Migration `20260814090000_company_customer_relationship_fields.sql` adds nullable `customer_type`, `primary_contact_name`, `industry`, and `relationship_owner_id` fields to canonical contacts. It deliberately performs no heuristic backfill.

`getCompanyCustomersPageData` builds compact table DTOs from company-scoped contacts and batched relations. `getCompanyCustomerDetail` authorizes the selected record and builds a focused panel DTO. Both use the central Deal commercial-value resolver and quote totals.

Light and dark modes use shared Sales tokens. WhatsApp retains its official green; SegMiQ lime remains reserved for primary actions, active tabs, selected rows, and focus states.
