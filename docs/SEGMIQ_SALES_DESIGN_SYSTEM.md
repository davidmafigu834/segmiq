# SegmiQ Sales Design System

Source of truth for salesperson-facing UI (`/sales`, `/solo`). Visual reference boards live in [`docs/assets/`](./assets/):

| Board | File |
|-------|------|
| Colors, type, buttons, inputs, badges, cards | [sales-ds-board-01.png](./assets/sales-ds-board-01.png) |
| Tokens, spacing, elevation, full component kit | [sales-ds-board-02.png](./assets/sales-ds-board-02.png) |
| UI kit (selects, table, KPI, charts, toasts) | [sales-ds-board-03.png](./assets/sales-ds-board-03.png) |
| Consolidated board (pipeline badges, timeline) | [sales-ds-board-04.png](./assets/sales-ds-board-04.png) |

Dev showcase: `/dev/sales-design-system` (development only).

## 1. Philosophy

Premium, calm, precise, operational. Lime is an accent — never a page wash.

1. Information before decoration  
2. Red only for genuine attention / danger  
3. Missing data must look intentional (`—`, `Value not set`)  
4. Never expose raw enums  
5. Never invent mock data on production pages  

## 2. Colors

CSS scopes: `.sales-dashboard-premium`, `.pipeline-drawer-light`, `.sales-modal-premium`, `.calendar-modal-premium`

| Token | Value | Role |
|-------|-------|------|
| `--sales-brand` | `#D4FF4F` | Primary CTA / active |
| `--sales-brand-hover` | `#C6F23F` | Hover |
| `--sales-brand-soft` | `rgba(212,255,79,0.14)` | Soft tint |
| `--sales-brand-soft-solid` | `#F3FCE3` | Selected surfaces |
| `--sales-brand-border` | `rgba(160,205,40,0.4)` | Selected border |
| `--sales-bg` | `#F7F8FA` | Page canvas |
| `--sales-surface` | `#FFFFFF` | Cards |
| `--sales-surface-subtle` | `#FAFBFD` | Subtle panels |
| `--sales-border` | `#E4E7EC` | Default border |
| `--sales-border-strong` | `#D0D5DD` | Input / strong |
| `--sales-text-primary` | `#101828` | Body / titles |
| `--sales-text-secondary` | `#667085` | Secondary |
| `--sales-text-muted` | `#98A2B3` | Meta |
| `--sales-success` | `#16A34A` | Won / success |
| `--sales-warning` | `#F59E0B` | Warning |
| `--sales-danger` | `#EF4444` | Danger / overdue |
| `--sales-info` | `#2563EB` | Info / Cold intent |
| `--sales-purple` | `#8B5CF6` | Proposal stage |
| `--sales-teal` | `#14B8A6` | Accent series |
| `--sales-whatsapp` | `#25D366` | WhatsApp only |

### Semantic foreground pairs

Every semantic hue ships three tokens that must be used together — never hand-pick a hex for text on a tinted fill, because the light-mode value goes unreadable in dark:

| Fill | Text | Example |
|------|------|---------|
| `bg-sales-success-soft` | `text-sales-success-fg` | Won KPI tint |
| `bg-sales-warning-soft` | `text-sales-warning-fg` | Due-soon pill |
| `bg-sales-danger-soft` | `text-sales-danger-fg` | Overdue pill |
| `bg-sales-info-soft` | `text-sales-info-fg` | Cold intent |
| `bg-sales-purple-soft` | `text-sales-purple-fg` | Proposal stage |

`--sales-solid-ink` is the text colour for saturated `solid` fills (white in light, near-black in dark).

Tailwind: `bg-sales-brand`, `text-sales-text-primary`, etc.  
TS: [`lib/sales/design-tokens.ts`](../lib/sales/design-tokens.ts)

## 3. Typography

Boards specify **Inter**. The app ships **Geist Sans** (same geometric sans family) — do not introduce a second UI font unless product explicitly switches.

| Role | Class / size | Weight |
|------|--------------|--------|
| Display / page title | `.sales-type-h1` · 28px | 700 |
| Section | `.sales-type-h2` · 20px | 600 |
| Card title | `.sales-type-h3` · 16px | 600 |
| Body large | `.sales-type-body-lg` · 14px | 400 |
| Body | `.sales-type-body` · 13px | 400 |
| Small | `.sales-type-small` · 12px | 400 |
| Caption | `.sales-type-caption` · 11px | 400 |
| Label | `.sales-type-label` · 12px | 500 |
| Metric | `.sales-type-metric` · 28px | 700 |

Numbers: `tabular-nums` / `.sales-tabular`

## 4. Spacing, radius, elevation

**Spacing:** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48  

**Radius:** xs 6 · sm 8 · md 10 · lg 12 · xl 14 · pill 999  

**Shadows** (light mode is layered — a tight contact shadow plus a wide soft one; dark mode leans on surface steps instead):

| Token | Use |
|-------|-----|
| `--sales-shadow-card` | Cards at rest |
| `--sales-shadow-card-hover` | Interactive card hover |
| `--sales-shadow-raised` | Raised inline panels |
| `--sales-shadow-dropdown` | Menus |
| `--sales-shadow-popover` | Popovers |
| `--sales-shadow-modal` | Modals / drawers |

## 5. Components

Import from `@/components/sales/ui`.

### Buttons

| Variant | Spec |
|---------|------|
| Primary | Lime `#D4FF4F`, dark text |
| Secondary | White + `#D0D5DD` border |
| Ghost | Text only |
| Danger / Success | **Solid** semantic fill, white text |
| Link | Text + underline on hover |

**Sizes:** sm **32** · md **40** · lg **48**. `md` grows to **44** below `sm` so primary actions clear the touch-target minimum on phones.

Solid variants (`primary`, `danger`, `success`) carry `--sales-shadow-card` at rest and drop it on `:active` for a pressed feel.

### Inputs

White surface, `#D0D5DD` (`--sales-border-strong`) border, lime focus ring. `invalid` → red border + `--sales-focus-ring-danger` + `FieldError`.  
Height **44** below `sm`, **40** above. Text renders at **16px on phones** (below 16px iOS Safari zooms the viewport on focus) and steps down to the 13px board size at `sm`.  
`SearchInput` supports optional `shortcutHint` (⌘K) — hidden on phones, which have no ⌘ key.

### Badges

`appearance`: `soft` (default) · `outline` · `solid`  
`LeadScoreBadge`: Hot red · Warm amber · **Cold blue** (info)

### Cards

`standard` · `interactive` · `selected` (lime soft) · `attention` (danger soft) · `compact` · `flat`

`interactive` lifts to `--sales-shadow-card-hover` and nudges 1px down on press.  
`CardHeader` / `CardContent` / `CardFooter` use a 16px gutter below `sm` and 20px above; header and footer wrap rather than overflow.

### Controls

- Checkbox: lime fill + white check  
- Radio: lime center  
- Switch: lime track when on; the thumb goes **dark** when on (lime is too light for a white thumb) and the hit area extends to ~44px without changing the visual size  
- Tabs: lime underline; scrolls horizontally when tabs overflow  
- Segmented: lime-soft active segment, scrolls horizontally when segments overflow  

### Alerts & toasts

Alerts: soft fill + **3px left accent** border.  
Toasts: success / warning / error / info.

### Charts

`SalesAreaChart` · `SalesBarChart` · `SalesDonutChart`

### Icons

Lucide for UI. `BrandIcon` for WhatsApp / Facebook — never `MessageCircle` as WhatsApp.

## 6. Shell

`SalesAppShell` + `SalesPageHeader` + `PremiumSheet`

## 7. Writing

Sentence case. Verb buttons (`Log call`, `Add lead`). Human errors.

## 8. Accessibility

Two focus treatments, both driven by tokens:

| Treatment | Token | Applies to |
|-----------|-------|------------|
| Soft lime glow | `--sales-focus-ring` | Text fields (`Input`, `TextArea`, `Select`, `SearchInput`) |
| Crisp 2px outline, 2px offset | `--sales-focus-outline` | Buttons, icon buttons, tabs, segments, switches, linked KPI cards |

Buttons use the outline because the lime glow is effectively invisible against the lime `primary` fill.

Icon buttons require `aria-label`. Prefer 44px touch targets on mobile primary actions.

## 9. Do / Don't

| Do | Don't |
|----|-------|
| Compose from `sales/ui` | One-off button hex |
| Use `--sales-*` | Scatter raw hex in new work |
| Pair `-soft` fills with `-fg` text | Hardcode a hex for text on a tinted fill |
| Soft badges for stages | Lime page backgrounds |
| Cold = blue | Cold = gray |

## 10. Migration

1. Wrap in `SalesAppShell`  
2. Swap local controls for `sales/ui`  
3. Keep APIs / auth unchanged  

## 11. Sales Sidebar

Definitive salesperson navigation (white / minimal). Source: `components/sales/navigation/SalesSidebar.tsx` + `lib/sales/navigation/sales-nav-config.ts`.

| Spec | Value |
|------|-------|
| Expanded width | **228px** |
| Collapsed width | **68px** |
| Background | `#FFFFFF` (`--sales-sidebar-bg`) |
| Right border | `1px solid #E4E7EC` |
| Section labels | `SALES` / `TOOLS` — 10px, uppercase, tracking 0.08em, `#98A2B3` |
| Nav row height | **40px**, radius **8px** |
| Default text | 13px / 500 / `#475467` |
| Active | Soft lime gradient (`--sales-sidebar-active-gradient`), text `#101828` / 600, icon `#4E6400` |
| Badges | Soft lime (`rgba(212,255,79,.30)`), text `#4E6500` — live counts only |
| Logo | Real wordmark (`/segmiq-wordmark-black.png`); collapsed uses `/brand/segmiq-q.png` |
| Profile | **Not** in sidebar — top-bar `SalesProfileMenu` (avatar, name, role) |
| Tools | Toolbox + Help & Support (`mailto:support@leadstaq.tech`) |
| Upgrade card | **Hidden** until real salesperson upsell rules exist |
| Collapse | `localStorage` key `segmiq-sales-sidebar-collapsed` |
| Mobile | Fixed top bar + bottom nav below `layout` (1100px); desktop sidebar hidden. See **Mobile Responsive System** below. |

**Do not** add a second Sales sidebar variant. Content padding uses `--sales-sidebar-current-width` on the shell.

## 12. Mobile Responsive System

Sales mobile chrome is shared across `SalesAppShell`, `WhatsAppSalesHubShell`, and `SalesDashboard`. No duplicated `/mobile` routes.

### Breakpoints

| Range | Behavior |
|-------|----------|
| **&lt; 768 (`md`)** | List card UIs; calendar Agenda-only; denser KPIs |
| **768–1099** | Tablet hybrid: cards/`md` patterns + mobile shell chrome |
| **≥ 1100 (`layout`)** | Desktop sidebar + premium multi-column layouts unchanged |

Inbox compact / single-pane WhatsApp flow aligns to **below layout** (`INBOX_COMPACT_BP = 1099`).

### Tokens (`app/globals.css`)

| Token | Role |
|-------|------|
| `--sales-mobile-header-height` | Top bar (56px) |
| `--sales-mobile-nav-height` | Bottom nav (64px) |
| `--sales-mobile-page-padding` | Page gutter (16px) |
| `--sales-mobile-content-pb` | Scroll area bottom pad = nav + safe-area + 12px |
| `--sales-mobile-fab-bottom` | FAB / toast clearance above nav |

### Chrome

- **Top bar** (`SalesMobileTopBar`): wordmark, search, notifications, profile menu. Hidden at `layout+`.
- **Bottom nav** (`SalesBottomNav`): Dashboard · Pipeline · WhatsApp · Tasks · More. Lime active; live WhatsApp/Tasks badges.
- **More sheet** (`SalesMoreSheet`): Leads, Quotations, Calendar, Reports, Won & Lost, Goals, Toolbox, Help (mailto), My profile + Quick actions entry. No Customers until a route exists.
- **Quick actions sheet**: Add lead, Log call, Create quote, Schedule follow-up — not a permanent header button on phone.
- **WhatsApp**: hide top bar + bottom nav while chat/intel pane is active (`setHideBottomNav`); composer uses `dvh` + safe-area.
- **Lead detail / sheets**: hide bottom nav below layout while open; sheets use `PremiumSheet` / drawer `z` above nav (`--sales-z-*`: nav 40, sheet ~70–80, toast 100).

### Content rules

- Main scroll regions use `.sales-mobile-scroll` so bottom padding clears the nav (reset when nav is hidden).
- Tables → cards below `md` where lists exist (Leads, Quotes, Won & Lost, Reports Sources). Any table kept at `md+` needs an `overflow-x-auto` wrapper and a `min-w-*` on the table — `DataTable` does this for you.
- Filters must stay reachable on phones: every list page hides its desktop filter row at `md` and offers the same controls in a `PremiumSheet` behind a **Filters** button with an active-count badge (Leads, Quotes, Won & Lost).
- KPI rows step `grid-cols-2` → `md:grid-cols-3` → `xl:grid-cols-5`. Skeletons must use the same steps as the real cards or the page reflows on load.
- Charts: prefer ~220–260px height on phone; stack report sections vertically.
- Toasts: `.sales-mobile-toast-anchor` pins above the bottom nav on small screens.
- Log FAB: desktop/`layout+` only; mobile uses Quick actions.

### QA viewports

375 · 390 · 430 · 768 · 1024 · 1366 · 1440 — no body horizontal overflow; desktop chrome unchanged at `layout+`.

---

## 13. Authentication

Public CRM auth (`/login`, `/forgot-password`, `/reset-password`) and SegmiQ Cloud auth (`/cloud/login`, `/cloud/signup`, `/cloud/forgot-password`) share the **marketing theme preference** (`segmiq-marketing-theme`) with the landing page — not the CRM app theme.

### Layout

| Viewport | Behavior |
|----------|----------|
| ≥1024px | Split screen: brand/product left (~55%), form right (~45%) |
| <1024px | Single column: logo + theme toggle, then form (no large product panel) |

Shell: `components/auth/AuthShell.tsx` (CRM) · `components/auth/CloudAuthShell.tsx` (Cloud)  
Layout: `AuthLayout` / `CloudAuthLayout` · left panel: `AuthMarketingPanel` / `CloudAuthMarketingPanel`

CRM left panel uses the static `ProductHeroVisual` (same light product UI as marketing). Do **not** mount the live app.

### Form

- Max width: ~430px login / ~460px signup  
- Input height: 48px · radius 9px  
- Primary CTA: `#D4FF4F` / ink `#101828` (dark ink `#0B0D0C`), height 48px  
- Labels: 13px · visible (not placeholder-only)  
- Focus: border `#A8D52C` + soft lime ring  

### Theme

Sun/Moon toggle (top-right desktop; header on mobile). Persists with landing via `MarketingThemeProvider`.

### Tokens

Reuse `--marketing-*` (see `app/globals.css` `.marketing-page` / `.marketing-page.dark`).

### Product facts

- CRM: credentials only · no self-signup · no OAuth · forgot/reset real  
- Cloud: self-signup fields from `/api/cloud/signup` schema · password min 8  
- No free-trial / Google / remember-me unless product adds them  
- Redirects: preserve `/api/auth/home` + `callbackUrl` sanitization  

### Errors & loading

Inline alerts (no `alert()`). Button spinner + disabled while submitting. Preserve anti-enumeration copy on password reset success.

---

## 14. Dark Mode

Dark mode is a **first-class color theme** for the approved light Salesperson application. It does **not** redesign layout, navigation, business logic, or data.

### Preference & persistence

| Concern | Implementation |
|---------|----------------|
| Provider | Reuse `CrmThemeProvider` (`segmiq-crm-theme`) — no separate SalesThemeProvider |
| Toggle | Compact Moon/Sun in desktop + mobile sales top bars (`SalesThemeToggle`) |
| Profile | Appearance section (`CrmThemeSetting`) |
| Sync | CRM theme persists marketing/auth key too (and vice versa) so Landing → Login → Sales feel continuous |
| FOUC | Blocking script in `app/layout.tsx` sets `data-crm` / `data-crm-theme` before paint |
| Scope | `.sales-dashboard-premium`, `.pipeline-drawer-light`, `.sales-modal-premium`, `.calendar-modal-premium` |

Selector for dark sales tokens:

`html[data-crm]:not([data-crm-theme="light"]) .sales-dashboard-premium` (and portal sibling classes)

### Dark palette (semantic `--sales-*`)

| Token | Value |
|-------|-------|
| `--sales-bg` | `#090B09` |
| `--sales-bg-subtle` | `#0C0E0C` |
| `--sales-sidebar-bg` | `#0C0E0C` |
| `--sales-surface` | `#171B17` |
| `--sales-surface-subtle` | `#1C211C` |
| `--sales-surface-raised` | `#1F241F` |
| `--sales-surface-hover` | `#222822` |
| `--sales-surface-selected` / active | `#243024` |
| `--sales-text-primary` | `#F7F8F5` |
| `--sales-text-secondary` | `#B8BEB4` |
| `--sales-text-muted` | `#8A9187` |
| `--sales-border` | `#2F362F` |
| `--sales-border-subtle` | `#262C26` |
| `--sales-border-strong` | `#3F473F` |
| `--sales-brand` | `#D4FF4F` |
| `--sales-brand-soft` | `rgba(212,255,79,.12)` |

### Semantic status (dark)

Success `#4ADE80` · Warning `#FBBF24` · Danger `#F87171` · Info `#60A5FA` · Purple `#A78BFA` · Teal `#2DD4BF` · WhatsApp `#25D366`  
Soft variants use ~10% alpha on the same hues.

### Surface hierarchy

Page `#090B09` → Sidebar `#0C0E0C` → Card `#171B17` → Nested `#1C211C` → Raised `#1F241F` → Hover `#222822`. Cards use a soft lift shadow plus clearer borders so bordered elements separate from the canvas. No glassmorphism, neon lime glows, or pure-black-only UI.

### Lime usage

Accent only: primary CTAs, active nav (soft lime surface + lime icon), selected chips, chart primary series, goal progress. Not every icon/border/row.

### Charts

Use `useSalesChartColors()` so Recharts grid/axis/tooltip/series follow CSS vars without remounting business data.

### WhatsApp Sales Hub

Premium hub styles bind to `--sales-*` / `--wa-*` aliases. Inbound bubbles elevated dark surface; outbound restrained lime alpha — not full `#D4FF4F` blocks. Session closed = soft amber. WhatsApp green preserved for WhatsApp actions.

### Documents / media

Quotation PDF/print previews stay print-correct (white document). Dark theme applies to the editor chrome around them, not the printed page. Photos/avatars never inverted.

### Mobile

Same nav structure. Top bar + bottom nav + More sheet use sales tokens. Theme toggle remains in the mobile top bar.

### Showcase

`/dev/sales-design-system` includes a theme toggle and must be validated in both Light and Dark.

### Light regression

Light tokens in `.sales-dashboard-premium { ... }` remain the approved light system. Dark overrides must not alter light values.

## 14. Daily Sales Intelligence components

See also [SEGMIQ_DAILY_SALES_INTELLIGENCE.md](./SEGMIQ_DAILY_SALES_INTELLIGENCE.md).

| Component | Role |
|-----------|------|
| Today's Focus card | Strategic BUILD / MOVE / CLOSE context + Start focus mode |
| Next Best Action | Rank 1 action: customer, recommended action, why now, Call/WhatsApp/Open |
| Up Next queue | Ranks 2-8 compact rows |
| Today's Plan progress | Priority actions + opt-in commitments as text + Progress bars |
| Pipeline coverage blurb | Cautious interpretation; never fake % |
| System recommendation label | Subtle "Recommended by SegmiQ" badge ? Target/Zap icons, no AI sparkles |
| Focus Mode overlay | Full-screen/centered one-action workflow; 44px touch targets |
| Goal coverage / commitments | Goals page sections using the same tokens |

Rules:

- Use `--sales-*` tokens only (light + dark)
- No giant gradient / glow / purple AI styling
- Progress must include numeric text, not color alone
- Intelligence API failure: show calm error; traditional tasks remain usable
- Mobile: stack Focus ? Plan ? NBA ? Up Next; no horizontal tables for intelligence

## 15. Lead → Deal workflow components

See also [SEGMIQ_LEAD_TO_DEAL_ARCHITECTURE.md](./SEGMIQ_LEAD_TO_DEAL_ARCHITECTURE.md).

| Component | Role |
|-----------|------|
| Deal readiness card | Compact checklist; optional value; Create deal CTA when ready |
| Discovery / Create Deal sheet | Full-screen on mobile; prefilled lead fields; sticky primary CTA |
| Deal Workspace | Command centre: header, stage chips, next action, What we know, commercial, quotes, timeline |
| Deal stage progress | Horizontally scrollable chips on mobile; never squeeze equal tiny columns |
| Next action card | Prominent; empty state with Schedule follow-up |
| Deal completeness | Lightweight checklist; one suggested next field |
| Deal quote list | Latest first; status labels humanized |
| Deal timeline | Human event labels only (no raw enums) |
| Pipeline deal card | Customer name + deal name + value + basis + next action |
| Related deal (Lead drawer / WhatsApp) | Compact Active deal + Open deal; do not embed full workspace |

### Layout

**Desktop Deal Workspace:** header → stage → 2-column (~65% main / ~35% rail).  
**Mobile:** identity → stage → value → actions → next action → what we know → commercial → quotes → timeline.

### Tokens

Page `#F7F8FA` / `#0B0D0C` · Surface `#FFFFFF` / `#111411` · Text `#101828` / `#F7F8F5` · Secondary `#667085` / `#B1B7AE` · Border `#E4E7EC` / `#272C27` · Lime `#D4FF4F`.

### Copy

Use: Estimated deal value · Expected decision · Next action · Value not estimated yet · Deal created.  
Avoid fake probabilities and enterprise CRM jargon.

## 16. Salesperson Dashboard

Route: `/sales/dashboard` · Aggregator: `getSalesDashboardData()` · UI: `components/dashboard/sales/*`.

### Information hierarchy (action first)

1. Greeting (real first name) + search / chrome  
2. Commercial KPI row (6)  
3. **Today's Focus** (BUILD / MOVE / CLOSE from Daily Sales Plan)  
4. **New enquiries needing action** + **Deals requiring attention**  
5. Right rail: Lead → Deal funnel · My activity today · Source mix · Recent activity  
6. **Pipeline snapshot** (Deals only)  
7. Today's Sales Plan continuation strip  
8. Optional compact Goal / My Performance when a target exists  

### Lead vs Deal semantics

| Module | Entity |
|--------|--------|
| New enquiries KPI + list | **Leads** needing first contact / reply |
| Active deals · Pipeline value · Pipeline snapshot | **Active Deals** via `getDealCommercialValue()` |
| Deals won | **Deal** outcomes (`stage = WON`) |
| Source mix | Lead acquisition this period |
| Funnel | Lead → Deal journey counts (period counts; no fake cohort %) |

### KPI definitions

| KPI | Meaning |
|-----|---------|
| New enquiries | Leads created today in salesperson scope |
| Active deals | Deals in QUALIFIED / SCOPING / PROPOSAL_SENT / NEGOTIATING |
| Pipeline value | Sum of known commercial values on active Deals; pending excluded (never `$0`) |
| Deals won | Won Deals this calendar month |
| Follow-ups due | Due today + overdue (leads + deal next actions) |
| Response time | Avg minutes lead created → first call log |

### Today's Focus

Uses `fetchDailySalesPlan().focus` (`BUILD` / `MOVE` / `CLOSE`). Soft lime wash only; no AI chrome. CTA → `/sales/tasks`.

### Responsive

| Breakpoint | Layout |
|------------|--------|
| Mobile | Focus + Plan high; KPI 2-col; enquiry/deal cards; funnel horizontal scroll; source legend under donut |
| ~1024 | Stack main then intelligence |
| Desktop `xl` | ~68/32 main + rail; KPI 6-across when comfortable |

### Dark mode

Surfaces `#111411` / raised `#151815`; borders `#272C27` / `#1E231E`; chart tooltips use sales surface tokens; lime restrained.

### Links

Enquiries → `/sales/call-now` · Deals → `/sales/deals/[id]` · Pipeline → `/sales/pipeline` · Plan/Focus → `/sales/tasks` · Goals context → Goals when present.

## 16c. Company Dashboard

Route: `/client/dashboard` · Aggregator: `getCompanySalesDashboard()` · UI: `components/dashboard/company/*` · Full product docs: [SEGMIQ_COMPANY_DASHBOARD.md](./SEGMIQ_COMPANY_DASHBOARD.md).

### Information hierarchy (operational visibility)

1. Breadcrumb **COMPANY / DASHBOARD** · title **Company dashboard**
2. Commercial KPI row (6) — acquisition → qualification → deals → value → outcome → response quality
3. **Focus areas that need attention** (aggregated alerts) + **Lead → Deal Funnel**
4. **Team performance** + **Top Lead Sources**
5. **Pipeline snapshot** (Deals only)
6. **Deals at Risk** · **Revenue trend** · **Recent team activity**

### Lead vs Deal vs Revenue

| Module | Entity |
|--------|--------|
| New enquiries · Sources · Funnel enquiry stages | **Leads** |
| Active Deals · Pipeline value · Snapshot · At risk | **Active Deals** via `getDealCommercialValue()` |
| Deals Won · Revenue trend | **Won Deal** `won_value` |
| Team Goal progress | Individual `sales_goals` (never fake 0%) |

### Components

| Component | Notes |
|-----------|--------|
| KPI cards | Same `KpiStat` / sales surface tokens; 2→3→6 grid |
| Focus areas | Wide card, ≤3 signals, subtle lime tint `rgba(212,255,79,.035)`, semantic icon chips |
| Team table | Desktop table; mobile salesperson cards; lime goal bars; **No Goal** when absent |
| Funnel | Soft lime progression; mobile vertical steps; period counts only |
| Source bars | Brand colors (WhatsApp `#25D366`, Facebook blue); thin bars |
| Revenue chart | Lime 2px line + soft area; dark tooltip `#181C18` / grid `#202520` |
| Activity feed | Human titles; semantic icons; no raw enums |

### Responsive

| Breakpoint | Layout |
|------------|--------|
| Mobile | Focus first; KPI 2-col; team cards; vertical funnel; stack analytics |
| Tablet ~768–1024 | Stack intentionally; avoid cramped 3-column |
| Desktop | Focus+Funnel row; Team+Sources; 3-up bottom analytics |

### Dark mode

Same structure as salesperson premium scope (`.sales-dashboard-premium`). Focus card: surface + subtle lime tint — not a giant lime panel. Team header row: raised / `#0F120F` in dark.

### Links

Leads / Hub → `/client/leads` · Pipeline → `/client/leads/pipeline` · Team → `/client/team` · Company Deal workspace → `/client/deals/[id]` · Deals (if `alsoSells`) → `/sales/deals/[id]` · Reports → `/client/reports`.

## 16e. Company Pipeline

Route: `/client/leads/pipeline` · Shell: same `CompanyWorkspaceShell` as Dashboard and Team · Full product docs: [SEGMIQ_COMPANY_PIPELINE.md](./SEGMIQ_COMPANY_PIPELINE.md).

This is **table-first company oversight**, not the salesperson Kanban (`/sales/pipeline`). Dashboard, Team, and Pipeline should read as three pages of the same application.

### Information hierarchy

1. Breadcrumb **COMPANY / PIPELINE** · title **Pipeline** (never “My Pipeline”) · supporting 13–14px
2. **Six** KPI cards full width
3. **One Pipeline table card (left ~70%)** + **Deal detail panel (right ~360–410px / 28–30%)** when a row is selected
4. Pagination inside the table card — **no charts, funnels, or analytics under the table**

Do not auto-select a Deal on load. No panel → table uses full content width.

### Visual patterns

| Element | Spec |
|---------|------|
| Page | `#F7F8FA` / dark `#0B0D0C` |
| Cards | White / `#111411`, 1px `#E4E7EC` / `#272C27`, radius 12–14px, near-flat shadow |
| Active Pipeline nav | Soft lime wash, not a solid lime pill |
| Tabs | Underline lime + muted count, not pills |
| Toolbar | Search · Filters · Group by · Sort **inside** the table card, below tabs |
| Selected row | `rgba(212,255,79,.16)` light · `.08` dark |
| Row height | ~56px · hover `#FAFBFC` / dark `#171B17` |
| Panel | Same top as table; ~180–220ms width transition |

### Deal panel order (do not rearrange)

Deal name → Stage + Value → Customer → Expected Decision + Owner → Next Action → View Deal / Log Activity → Deal Health → Deal Summary → View full details.

Deal Health is operational (On track / Needs attention / At risk), never a fake close probability.

### Responsive

| Breakpoint | Layout |
|------------|--------|
| ≥1280 | Inline panel beside table |
| <1280 | Overlay drawer |
| <768 | Deal cards; KPI 2-col; chip tabs; full-height sheet |

## 16d. Company Team

Route: `/client/team` · Shell: same `CompanyWorkspaceShell` as Dashboard · Full product docs: [SEGMIQ_COMPANY_TEAM.md](./SEGMIQ_COMPANY_TEAM.md).

Dashboard and Team should read as two pages of the same application. Difference: Team nav is active; main content changes.

### Information hierarchy

1. Breadcrumb **COMPANY / TEAM** · title **Team** (~28–30px) · supporting 13–14px
2. Five KPI cards full width (Team members, Active Deals, Team Pipeline Value, Deals Won, Avg. response time)
3. **Team table (left ~68–70%)** + **member detail panel (right ~400–440px)** when a row is selected
4. Below the table only: **Team composition** · **Goal coverage** · **People needing support** — the member panel continues down the right

Do not auto-select a member on load. No panel → table and analytics use full content width.

### Visual patterns

| Element | Spec |
|---------|------|
| Page | `#F7F8FA` / dark `#0B0D0C` |
| Cards | White / `#111411`, 1px `#E4E7EC` / `#272C27`, radius 12–14px, near-flat shadow |
| Active Team nav | Soft lime wash, not a solid lime pill |
| Tabs | Underline lime, not segmented pills |
| Selected row | `rgba(212,255,79,.16)` light · `.08` dark |
| Goal bars / ring / chart | SegmiQ lime on a light track |
| Table rows | ~52px |
| Micro KPIs | 2×3, ~68px, radius 10px |
| Member panel actions | Icon slots + lime primary **View pipeline** |

### Member panel order (do not rearrange)

Header → Goal progress → 6 micro KPIs → Performance trend (Won revenue, 6 months) → Needs attention + Recent activity → action bar.

### Responsive

| Breakpoint | Layout |
|------------|--------|
| ≥1280 | Inline panel beside table + analytics |
| <1280 | Overlay drawer |
| <768 | Member cards; stacked KPIs 2-col; analytics 1-col; sheet stacks attention/activity |

### Dark mode

Selected row restrained lime. Panel `#111411`, inner micro cards `#151815`, borders `#272C27`. Chart tooltips from `useSalesChartColors` — no white leak.

## 16b. My Pipeline

Route `/sales/pipeline` (legacy `/sales/leads` redirects). Deal-based Kanban (not Lead cards). Light mode should match the SegmiQ 2.0 Pipeline reference density.

### Layout

| Element | Spec |
|---------|------|
| Header | Breadcrumb `SALES / PIPELINE` · title **My pipeline** · supporting Deal-focused copy |
| Tabs | **Active** / **Closed** with thin lime underline on active |
| Segment | **Board** / **Picks** (Active only) |
| Filter | **Filter & search** control; chips when filters applied |
| Desktop board | 4 equal columns; thin colored top accent per stage; near-page background (no heavy grey columns) |
| Drawer | Right panel ~380–400px; push board with padding ≥1280px; overlay below |
| Mobile | One stage at a time via horizontal chips; full-height Deal sheet |

### DealCard (`PipelineDealCard`)

- Radius 12px · 1px border `#E4E7EC` / dark `#272C27` · subtle shadow  
- Hover: stronger border `#CDD5DF`, shadow `0 4px 12px rgba(16,24,40,.06)` — **no scale / neon**  
- Selected: soft lime tint `rgba(212,255,79,.035)` + restrained lime border  
- Action strip: Open · WhatsApp · Call · Schedule · Quote · More (~32px outlined icons)  
- Attention badges compact (Overdue / Due today / At risk / No next action)

### Stage accents

Use `DEAL_STAGE_ACCENT`: Qualified `#2684FF` · Scoping `#14B8A6` · Proposal sent `#8B5CF6` · Negotiating `#F59E0B`.

### Drag / drop

Slight elevation while dragging; drop target soft lime wash `rgba(212,255,79,.025)`. No rotation circus / lime glow.

### Deal Detail Drawer

Sections: Deal intelligence · Deal details · Pipeline stage progress · Next action · Quotation status · Recent activity. Lime CTAs only where primary (e.g. Create Quote / Schedule follow-up). Course targets: `pipeline-board`, `pipeline-deal-card`, `pipeline-deal-drawer`, etc.

### Dark

Page `#0B0D0C` family · cards `#111411` · raised `#151815` · borders `#272C27` · text `#F7F8F5` / `#B1B7AE`. WhatsApp stays `#25D366`.

## 16f. Company Leads

Route: `/client/leads` · Shell: the same `CompanyWorkspaceShell` as Dashboard, Team, and Pipeline · Full product docs: [SEGMIQ_COMPANY_LEADS.md](./SEGMIQ_COMPANY_LEADS.md).

Company Leads is a **table-first acquisition and qualification workspace**. A Lead is not a Deal and must not contribute commercial Pipeline metrics before the canonical Create Deal flow succeeds.

### Information hierarchy

1. Breadcrumb **COMPANY / LEADS** · title **Leads** · supporting copy · compact lime **Add Lead**
2. Exactly six KPI cards: New Leads, Hot Leads, Contacted, Qualified, Conversion Rate, Avg. Response Time
3. One Leads table card (left ~70%) + selected Lead detail panel (right ~360–410px / 28–30%)
4. No lower analytics, source charts, funnels, or Pipeline graphics

### Table and panel pattern

| Element | Spec |
|---|---|
| Tabs | All Leads · New · Hot · Contacted · Qualified · Not Qualified; thin lime underline, no pills |
| Toolbar | Search · Filters · Source · Owner · Sort inside the table card |
| Columns | Checkbox · Lead · Source · Contact · Status · Lead score · Owner · Created · Actions |
| Rows | 58–62px, subtle separators, no zebra striping or hover scale |
| Selected row | `rgba(212,255,79,.16)` light · `.08` dark |
| Panel order | Header → contact actions → score/signals → about → customer need → next action → footer |
| Footer | View full details + lime Create Deal; Open Deal when one already exists |

Hot is score intent (`70+`), not lifecycle. New / Contacted / Qualified / Not Qualified are lifecycle views. A high-scoring Not Qualified record is not included in the actionable Hot count.

Do not auto-select the first Lead. At ≥1280px the selected panel is inline and top-aligned with the table; below 1280px it overlays; below 768px the table becomes Lead cards and the panel becomes a full-height sheet.

## 16g. Company Customers

Route: `/client/customers` · Shell: `CompanyWorkspaceShell` · Full product docs: [SEGMIQ_COMPANY_CUSTOMERS.md](./SEGMIQ_COMPANY_CUSTOMERS.md).

Company Customers is a table-first relationship directory. One Customer is one canonical Customer-lifecycle contact and can own many Deals.

| Element | Spec |
|---|---|
| Header | `COMPANY / CUSTOMERS` · Customers · compact lime Add Customer |
| KPIs | Exactly five: Total Customers, Companies, Individuals, Active Deals, Total Pipeline Value |
| Tabs | All Customers · Companies · Individuals · Recent; thin lime underline |
| Toolbar | Search · Filters · Customer Type · Owner · Sort, inside the table card |
| Columns | Checkbox · Customer · Type · Contact · Location · Owner · Last Interaction · Active Deals · Customer Value · Actions |
| Rows | 58–62px; soft lime selected state; no zebra striping or scale |
| Panel order | Header → contact actions → overview → commercial metrics → recent activity → footer |
| Footer | View full details + lime View Deals `(N)` |

Customer Value is won value; Total Pipeline Value is active Deal value. Unknown estimates remain unknown and never become `$0`. Do not show Lead score, intent, qualification, Deal health, invoices, payments, a favourite star, or an invented Customer status.

No Customer auto-selection. Use `?customer=<id>`. Inline panel at ≥1280px, overlay below, full-height sheet below 768px; mobile uses Customer cards. Light/dark colors inherit the Sales token system.

## 17. Guided Learning

Interactive SegmiQ 2.0 course (not a third-party tour widget). Full behavior: [`docs/SEGMIQ_INTERACTIVE_TRAINING.md`](./SEGMIQ_INTERACTIVE_TRAINING.md).

### Surfaces

| Element | Spec |
|---------|------|
| Welcome modal | 600–680px, surface `#FFFFFF` / dark `#111411`, border `#E4E7EC` / `#272C27`, title 28–32px / 650–700 |
| Overlay | `rgba(15, 23, 42, .45)` light; slightly deeper dark — target stays visible |
| Target ring | 2px `#D4FF4F` + `box-shadow: 0 0 0 3px rgba(212,255,79,.25)` |
| Coachmark | 300–360px desktop; 12–14px radius; thin border; small shadow; heading 16–18px |
| Mobile coach | Bottom sheet under safe-area; target remains tappable |
| Practice badge | Small lime soft pill + “Actions here don’t affect your real sales data.” |
| Progress card | Compact Dashboard card; hideable; removed when course completed |
| HUD | Compact “SegmiQ 2.0 Course · Lesson N of 7 · Pause” |

### Z-index

`--sales-z-course-overlay` 90 · coach 92 · modal 95 (below toast 100).

### Rules

No glassmorphism, neon borders, or purple gradients. Inherit active light/dark theme. Action steps have no Next substitute.

## Company Calendar

The Company Calendar is a team sales execution workspace: six KPI cards using the shared Company Customers hierarchy, one dominant bordered Calendar card, and a 300px right agenda rail.

- Week is the primary desktop view: sticky Team member column × Sunday–Saturday day columns. Every permitted salesperson remains visible even with no activity.
- Team cells show at most two readable event cards plus `+ N more`; manager rows are about 148px and scroll inside the Calendar card.
- Controls stay inside the main card: previous, next, Today, date range, Day/Week/Month/Agenda, then structured Filters. Team scope sits directly below and scopes KPIs too.
- Event cards use soft semantic type tints, 8px radius, a readable 10–11px time/title/entity hierarchy, full-detail tooltips, and no scale hover. Overdue overrides the tint with a red execution state; at risk adds an amber edge.
- Month is a manager overview with type counts, attention state, and owner avatars. Day and Agenda are grouped/identified by salesperson.
- The right rail is one surface with mini month, selected-date team agenda, and Upcoming. Selecting an event converts that same rail into Event Detail.
- Mobile is agenda-first with a horizontal date strip and team grouping. Tablet moves the right rail into a drawer.
- Dark surfaces use Company tokens, subtle grid borders, and purpose-built low-opacity event tints.

## Salesperson WhatsApp Sales Hub patterns

Route: `/sales/inbox` · Full product rules: [SEGMIQ_WHATSAPP_SALES_HUB.md](./SEGMIQ_WHATSAPP_SALES_HUB.md).

The salesperson hub is one integrated, full-height three-pane selling workspace after a compact header. It has no KPI strip and no lower analytics. On large desktop the queue is approximately 330-360px, intelligence 390-430px, and chat owns the remaining width. At compact desktop widths those side panes reduce to approximately 300-320px and 340-370px. Intelligence becomes an overlay below 1280px; mobile uses queue → chat → intelligence as single panes.

| Surface | Salesperson rule |
|---|---|
| Queue filters | All, Mine when meaningful, Needs reply, Follow-up due; real score, waiting, quote, assignment, no-Deal, and Deal-stage filters in an advanced popover |
| Conversation row | Flat ~80px row; Lead lifecycle + intent before conversion, Deal stage after conversion; real budget/value only |
| Chat header | Lead lifecycle, intent, budget before Deal; Deal stage and canonical Deal value after Deal |
| Action strip | Directly under the header; reuse quick reply, asset, note, call, and canonical Lead/Deal actions |
| Messages | Incoming neutral bordered; outgoing restrained lime; bounded history with explicit older-message paging |
| Composer | Anchored; attachment, existing session enforcement, compact read-only/claim state when unavailable |
| Lead rail | Identity → score/reasons → real AI briefing when available → qualification → readiness/Create Deal → follow-up → ownership |
| Deal rail | Identity → commercial → deterministic health → stage → next action → quote → activity → ownership |

Lead score is qualification intelligence, not a close probability. After conversion, Deal health replaces Lead score as the primary signal. Deal health is deterministic and operational; value always comes from `getDealCommercialValue()`. Do not invent AI text, quote status, owner, probability, value, source, or activity.

Both themes use Sales tokens. Lime is reserved for selection, focus, progress, and the primary action; WhatsApp green remains channel identity. Pane collapse is persisted, rows do not scale on hover, and course targets remain stable. Message, record-detail, and AI requests fail independently so auxiliary intelligence cannot block conversation work.

## Company WhatsApp Sales Hub patterns

The Company WhatsApp Sales Hub uses the Company workspace shell with a compact page header followed immediately by one full-height integrated inbox. It has no KPI row and no analytics modules below the workspace. At 1280px and above the list and context widths are resizable (approximately 300â€“350px and 310â€“380px); the chat owns all remaining space. At 1100â€“1279px the context becomes an overlay drawer, and below 1100px the existing single-pane flow applies.

- `ConversationRow`: dense avatar/name/preview/time layout with real relationship state, unread badge, neutral hover, and a soft lime selected wash with a 3px indicator.
- `ChatHeader`: contact identity on the left; owner identity and authorized owner control on the right.
- `ConversationToolbar`: compact Add Note, Create/View Deal and View Lead actions immediately below the header. Assignment is consolidated into the owner control in the header.
- `MessageBubble`: incoming messages use a bordered neutral surface; outgoing messages use a low-opacity lime tint. Width remains content-aware and capped by the chat layout.
- `Composer`: independently anchored to the center panel with icon-triggered quick replies/assets, message input, a compact lime send control and an amber service-window notice when required. Company mode has no permanent action strip.
- `ConversationInsightRail`: one continuous scroll pane with Customer Overview, Conversation Insights, Related Records, Team Activity and Call/Schedule/More Quick Actions in this exact order. It may collapse from the chat header.
- `ConversationInsightMetric`: a compact 2×2 grid for first contact, message count, first response and deterministic conversation status.
- `TeamActivityFeed`: three recent meaningful sales events with actor, action and time; never presence, page-view or typing surveillance.
- Mobile inbox: single-pane list → chat → intelligence navigation. Global bottom navigation hides in chat/intelligence so it cannot cover the composer.

Use sales design tokens for both themes. Reserve SegmiQ lime for primary action, selection and focus; reserve WhatsApp green for channel identity.
