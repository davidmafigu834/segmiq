# SegmiQ Company Settings

Control center for how a company uses SegmiQ. Visual layout follows the SegmiQ 2.0 Settings reference. **Existing services and tables remain the source of truth** — Settings does not invent fields, security controls, or integrations.

Route: `/client/settings/{category}/{section?}`  
Legacy URLs redirect:

- `/client/account` → `/client/settings/profile`
- `/client/company-profile` → `/client/settings/company`
- `/client/account/whatsapp` → `/client/settings/integrations/whatsapp`

Sidebar **Settings** stays on the existing `CompanyWorkspaceShell` (same shell as Dashboard, Team, Billing).

## Architecture

Three navigation levels:

1. **Global company sidebar** — Settings is the active Tools item (Lucide Settings, lime active treatment).
2. **Category tabs** — Company, Profile, Team & Permissions, Notifications, Integrations, Automation, Data, Security.
3. **Section nav** — left list **changes with the category**. Company subnav is not shown on Security or Integrations.

Refreshing the URL restores the selected category and section. Default sections collapse (`/client/settings/company` = Company Information).

Data is loaded per category. The Company tab loads company profile, quotation company fields, timezone, and a **lightweight** subscription + seat summary. Team members, WhatsApp connection details, and integration panels load when those categories are opened.

## Permissions

Company Settings is for `CLIENT_MANAGER` (and `SUPER_ADMIN` preview / impersonation). Team salespeople are sent to `/sales/profile`. Server APIs remain authoritative (`canAccessClient`, `canManageClientTeam`, `canManageClientProfile`, marketing PATCH manager/admin only).

Tenant isolation: every read/write uses `session.clientId` (or the preview client for Super Admin). WhatsApp tokens, payment secrets, and Facebook tokens are never returned to the UI.

### Capabilities (UI)

| Capability | Who |
|---|---|
| View / edit company, branding, localization, preferences | Company manager |
| Manage team access | Company manager (`canManageClientTeam`) |
| Manage WhatsApp connection | Company manager |
| View billing summary / jump to Billing | Company manager |
| Change own password / profile | Signed-in manager |

## Company

Left nav: Company Information, Branding, Business Details, Localization, Subscription, Preferences.

### Company Information (default)

Center cards, matching the reference:

1. **Company Information** — logo, name, company email, phone, website, industry, Company ID (`clients.slug`, read-only here).
2. **Business Address** — `quotation_settings.company_address` plus `clients.country`. This is the quote/PDF address, **not** the billing address.
3. **Business Information** — business type (`trades` / `real_estate`), years in operation, IANA timezone.

Omitted because they are not in the model: company size, city/state/postal split, tax/VAT, registration number, fiscal year, a casual reporting-currency dropdown.

Company email (`quotation_settings.company_email` / `clients.owner_email`) is **not** the manager login email.

Edit opens a 560px `PremiumSheet`. Save PATCHes company-profile + quotation-settings and toasts **Company information updated.** Dirty close confirms.

### Branding

Logo upload via `/api/clients/{id}/logo/upload` (PNG/JPG/WebP). Primary color applies to the public profile, landing page, and quotation PDFs — **not** SegmiQ app chrome. Slug is the public Company ID. Quote footer uses `quotation_settings.footer_note`. Full quote terms/prefix stay at `/client/quote-settings`.

### Business Details

Capability tagline and lead response SLA hours (`response_time_limit_hours`).

### Localization

English only (read-only). Default dial code. IANA timezone via `client_marketing_settings.timezone`. Changing timezone updates display; stored timestamps stay UTC. Date/number format stores do not exist — not shown.

### Subscription

Lightweight plan, cycle, next bill (or access-until when cancelled), salesperson seats vs `CRM_PLAN_SEATS`. **Manage Subscription** goes to `/client/billing`. Does not recreate Billing.

### Preferences

Quote prefix, default tax, default terms. Managed marketing flag (`agency_managed`).

Right rail (Company category only): Account Summary, Quick Actions (Manage Subscription, Download Invoices, Manage Payment Method → Billing), Need Help (mailto Super Admin contact). Storage usage is not a real entitlement — omitted. “View usage analytics” is omitted (no usage page).

## Profile

Personal information (`/api/users/me`, avatar upload). Login email is read-only (contact support). Password change via `/api/users/me/password`. Appearance uses the existing device theme (`useCrmTheme`). Working hours are not in the product — omitted.

## Team & Permissions

Access management, not the sales performance Team page.

- Table: member, role, status, access.
- Invite reuses `CompanyTeamInviteDialog` (creates a salesperson; phone required). Seat limits from the CRM plan are enforced on `POST /api/clients/{id}/users`.
- Member drawer: promote to manager, also-sells, deactivate, remove. Historical CRM records are not deleted; uncontacted leads are redistributed by existing logic.
- Last remaining active manager cannot be removed or deactivated.
- Custom roles / permission matrix are not in the backend — omitted.

## Notifications

Manager prefs on `users.notification_prefs`: New lead, Deal won, Lead uncontacted × WhatsApp / Email. Auto-saves. Weekly digest is stored but send is a no-op — **toggle omitted**.

## Integrations

- **WhatsApp** — existing `WhatsAppConnectionSettings` (`embedded`), provider-neutral. QR only for authorized managers when Temporary Web beta is enabled.
- **Facebook Lead Ads** — status from `fb_page_id` / `fb_page_name` only. No fake OAuth Connect.
- **Website API** — `WebsiteIntegrationPanel` when `business_type === real_estate`.

## Automation

Lead assignment mode: direct / pool / round robin (`clients.assignment_mode`). No Zapier-style rule builder.

## Data

Link to `/client/reports` for export. No CSV importer, custom fields engine, or retention policy UI.

## Security

Password change only. No 2FA, session list, or audit-log UI (those backends are not implemented for company managers).

## Currency

Billing currency lives on the subscription and is shown in Billing. Settings does **not** offer a business-currency dropdown and does not convert historical deals/quotes.

## Mobile / tablet

`layout` breakpoint (1100px): three columns (220 / 1fr / 320). Below that, left nav becomes a section sheet and the right rail stacks under the Company cards. Mobile: header, scrollable category tabs, section selector, stacked cards. Team table becomes member cards.

## Dark mode

Sales tokens (`#0B0D0C` page through `#D4FF4F` lime). Sheets, selects, and the WhatsApp QR dialog use surface/border tokens (no white portals).

## Intentionally deferred

- 2FA, session revocation, admin audit log UI
- Custom roles / permission matrix
- Structured address lines, tax IDs, fiscal year
- Company size taxonomy
- Storage meter
- Weekly digest send
- CSV import / custom fields / retention policies
- Self-serve Meta OAuth
- Working hours database
- Company deletion
- Reporting currency conversion
