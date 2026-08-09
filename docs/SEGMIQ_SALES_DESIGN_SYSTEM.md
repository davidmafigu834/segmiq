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

**Shadows:**

| Token | Use |
|-------|-----|
| `--sales-shadow-card` | Cards |
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

**Sizes:** sm **32** · md **40** · lg **48**

### Inputs

White surface, `#D0D5DD` border, lime focus ring. `invalid` → red border + `FieldError`.  
`SearchInput` supports optional `shortcutHint` (⌘K).

### Badges

`appearance`: `soft` (default) · `outline` · `solid`  
`LeadScoreBadge`: Hot red · Warm amber · **Cold blue** (info)

### Cards

`standard` · `interactive` · `selected` (lime soft) · `attention` (danger soft) · `compact` · `flat`

### Controls

- Checkbox: lime fill + white check  
- Radio: lime center  
- Switch: lime track when on  
- Tabs: lime underline  
- Segmented: **solid lime** active segment  

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

Focus ring `--sales-focus-ring`. Icon buttons require `aria-label`. Prefer 44px touch targets on mobile primary actions.

## 9. Do / Don't

| Do | Don't |
|----|-------|
| Compose from `sales/ui` | One-off button hex |
| Use `--sales-*` | Scatter raw hex in new work |
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
| `--sales-mobile-header-height` | Top bar (64px) |
| `--sales-mobile-nav-height` | Bottom nav (72px) |
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
- Tables → cards below `md` where lists exist (Leads, Quotes, Won & Lost, Reports Sources).
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
