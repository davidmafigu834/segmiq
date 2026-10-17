# SegmiQ Real Estate UI design system

This describes the patterns that are actually in the Real Estate frontend after UI Phases 1–6. It is not a new theme. Future Real Estate screens should use these components and the existing `sales-*` tokens.

Brand references stay near-black `#0C0C0C` and lime `#D4FF4F`, through the sales tokens. Do not paint operational pages in lime.

## Typography

Implemented in `components/real-estate/ui/primitives.tsx` (`RePageHeader`, `ReSection`) and the sales type scale.

| Role | Size | Where |
|---|---|---|
| Page title, phone | The mobile app header, about 16px | `ReMobileHeaderTitle`. Do not repeat it in the page. |
| Page title, home | 17px on a phone, 26px from `layout:` | `RePageHeader` with `mobileTitle` on My Day, where the header is the wordmark |
| Page title, desktop | 26px, weight 600 | `RePageHeader` at `layout:` |
| Section title | 15px, weight 600 | `ReSection` |
| Record title, phone | 15px | List and attention rows |
| Body | 13–14px | Descriptions and table cells |
| Metadata | 12–13px | Muted secondary lines |
| Metric value, phone | 22px | `ReStatCard` below `sm` |
| Metric value, desktop | 24px | `ReStatCard` from `sm` |

Long titles use `overflow-wrap: anywhere` and `min-w-0`. Page descriptions clamp to two lines below `sm`.

## Spacing

Tokens in `app/globals.css` under `.sales-dashboard-premium`:

- `--re-card-pad`: 16px, 20px from 640px
- `--re-section-gap`: 16px, 20px from 640px
- `--re-radius-card`: `var(--sales-radius-lg)`
- `--re-radius-control`: `var(--sales-radius-sm)`
- `--re-drawer-width`: 500px

Page gutters come from the sales shell, not a second padding system.

## Surfaces

`ReSection` is the standard bordered surface: sales surface background, subtle border, radius from `--re-radius-card`. Do not nest a card inside another card when a divider is enough.

`ReStatCard` and `ReMetricGrid` are the metric row. On a phone the supporting line is hidden, and `ReMetricOverview` keeps the full set behind one Show control. Desktop shows the grid directly. One tone system. No rainbow KPI sets.

## Colour and status

Use `components/sales/ui/Badge` through `ReStatusBadge`. Colour is paired with text.

Do not style these as success:

- A reported commission receipt (that is not verified).
- An uploaded document (that is not verified).
- An accepted offer (that is not a completed sale).
- An accepted rental application (that is not a completed tenancy).

## Buttons

`components/sales/ui/Button` and `salesMenuTriggerClass`. One primary action per header or card. Secondary actions use the outline or ghost variant, or `ReActionMenu`.

Touch height on phone actions: at least 44px (`min-h-11`).

## Inputs

Acquisition and buyer forms use `acqFieldClass` and `acqLabelClass` from `components/real-estate/acquisition/acquisition-ui.tsx`. Do not add a third field style for Real Estate forms.

## Page headers

`RePageHeader` carries the page actions. On a phone its heading is hidden, because `ReMobileHeaderTitle` already names the screen. Pass `mobileTitle` only when the mobile header is the wordmark, as on My Day.

The same rule applies to `CompanyDashboardHeader` when the company mobile header already names that route. The company dashboard home keeps its greeting.

Agent routes (`/sales/...`) turn the sales shell header off (`showDefaultHeader={false}`).

Manager routes use `CompanyReShell` or `CompanyWorkspaceShell` with `businessType="real_estate"`.

On a phone, Real Estate operational shells set `data-re-workspace="true"`, hide the dotted wave, and use a flat full-width canvas. The page stack is not a centered column, and horizontal padding is a single 16px gutter. Marketing pages and the desktop canvas are unchanged. The bottom navigation uses a solid `var(--sales-surface)` so lists do not show through it.

## Tables

Desktop tables use the sales `DataTable` or a plain table inside `hidden ... md:block` / `lg:block` with `overflow-x-auto` on that wrapper only.

Phone lists for the main workspaces are cards in the same component, fed by the same fetch. Do not mount a second request for the phone layout.

## Mobile cards

Pattern used by listings, transactions, buyers, offers, viewings, commissions, developments, and marketing:

- Primary line: name or property.
- Second line: status or place.
- Third line: the numbers that matter, in words.
- One visible action.
- Overflow actions in `ReActionMenu`.

## Action menus

`components/real-estate/ui/ReActionMenu.tsx`.

- Below 768px (`RE_MOBILE_QUERY`): bottom `ReSheet`.
- At 768px and up: portalled dropdown, aligned to the end.
- The trigger stops click propagation so a parent row does not also navigate.
- Empty action lists render nothing.
- Destructive actions are separated.

## Detail drawers and sheets

`components/real-estate/ui/ReSheet.tsx`.

- `placement="drawer"`: right drawer on desktop, full-height sheet on a phone.
- `placement="bottom"`: bottom sheet for filters and action lists.
- Escape, focus trap, and scroll lock live in this component.
- Render it only while open.

## Filter sheets

`ReFilterSheet` in the same primitives file. Footer actions are Clear and Apply. A filter control must change the query the screen already supports.

## Confirmation dialogs

High-impact actions use the existing confirm dialog or `ReSheet`, with a specific verb: Accept offer, Confirm handover, Verify document, Reject document. Do not label those Save.

## Mobile navigation

Real Estate uses the sales shell:

- Top bar and bottom nav hide at 1100px (`app/globals.css`).
- Bottom nav padding is `--sales-mobile-content-pb` on `.sales-mobile-scroll`.
- Full-screen chat sets `data-hide-mobile-nav="true"` through `useSalesMobileChrome`, which removes the bottom nav and reduces the scroll padding to the safe area.
- WhatsApp intelligence on a phone is a full-screen sheet inside the salesperson workspace.

## Breakpoints in source

- 640px: card padding steps up.
- 768px: `RE_MOBILE_QUERY` flips menus from sheets to dropdowns. Several tables switch from cards to tables at `md`.
- 1100px: sales `layout:` breakpoint. Mobile chrome hides. Inbox becomes multi-pane.

## Empty, loading, and error

`ReEmptyState`, `ReErrorState`, `ReSkeletonRows`, and `RePartialNotice` in `components/real-estate/ui/primitives.tsx`.

`ReEmptyState` is one title, one short explanation, and one button when there is a next step. Pass `framed` when it is not already inside a section. Do not give the surrounding section the same title.

A failed request uses `ReErrorState` with retry. It must not render zeros. `RePartialNotice` stays visible when an API reports incomplete or truncated data.

## Accessibility

- `re-focus` and `--re-focus-ring` for focus.
- Menus and sheets expose labels and `aria-expanded`.
- Status is text plus colour.
- Sheet motion collapses under `prefers-reduced-motion`.
