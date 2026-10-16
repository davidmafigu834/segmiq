# Real Estate UI/UX Redesign — Phase 1 Report

Scope: frontend only, Real Estate workspaces only (`business_type = real_estate`). No migrations, API routes, commission maths, offer transitions, mandate rules or permission checks were changed. No build, dev server, full `tsc`, full lint, Docker, local Supabase, push or deploy was run.

---

## 1. Hallmark located and followed

- Skill read from `.cursor/skills/hallmark/SKILL.md` before any UI code was written, together with the project's locked system in `design.md`.
- Mode: **app redesign** inside an existing locked design system (`design.md` → Workbench macrostructure, modern-minimal genre). No new theme was invented.
- New RE surfaces carry the Hallmark stamps:
  - `/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */`
  - `/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */`
  - Present in `components/real-estate/AgentDailyWorkspace.tsx` and `components/real-estate/agency/AgencyOverview.tsx`.
- `.hallmark/log.json` has a new first entry (`scope: "app"`, Workbench, `design_system: design.md`).
- Anti-slop rules applied: no hero/"Welcome" block, no gradients/glow/glass, no rainbow KPI tiles, no emoji, no decorative animation, icons at 16–18px inside 32px tiles, lime used only for the primary create action and the current/selected mark.

## 2. Design direction

"Calm operational workbench." The agent screen answers *what do I do next*, the manager screen answers *where does the agency need me*. Hierarchy comes from typography, spacing and grouping, not colour.

- Neutral cards on the existing `sales-*` surfaces, hairline dividers, near-black primary text.
- One lime moment per screen (the primary create button) plus the active navigation mark.
- Urgency is expressed with the existing warning/danger badge tones, and only where the data says something is overdue or due today.
- Desktop: 12-column grid at the `layout:` breakpoint (1100px), roughly 2/3 work + 1/3 context. Mobile: single column in the priority order specified in the brief.

## 3. Tokens

Appended to the end of `app/globals.css` (67 lines, nothing existing edited). Scoped to `.sales-dashboard-premium, .sales-modal-premium, .sales-menu-surface` so Solar/Construction/Trades/Tyre pages are not affected.

| Token | Value |
| --- | --- |
| `--re-card-pad` | 16px, 20px from 640px |
| `--re-section-gap` | 16 / 20 / 24px by breakpoint |
| `--re-radius-card`, `--re-radius-control` | card and control radii |
| `--re-drawer-width` | 500px (drawer clamps to `min(500px, 100vw)`) |
| `--re-focus-ring` | 2px surface + 2px primary-text ring |

Also: `.re-focus:focus-visible` ring utility, and keyframes `re-sheet-up`, `re-drawer-in`, `re-fade-in`. Drawer slide only applies at ≥768px; `prefers-reduced-motion` falls back to a fade.

## 4. Components

New shared RE primitives in `components/real-estate/ui/` (barrel: `index.ts`):

- `primitives.tsx`
  - `RePageHeader`, `ReSection` (card with `h2` + count + action), `ReViewAll`, `ReInfoTip`
  - `ReStatCard` (loading skeleton / "—" + "Couldn't load" on error), `ReMetricGrid`, `ReFigureList`
  - `ReStatusBadge` + `ReUrgency`, `ReRowIcon`, `ReWorkItem`, `ReRowAction`, `ReList`, `ReGroupLabel`
  - `ReEmptyState`, `ReErrorState` (retry), `RePartialNotice`, `ReSkeletonRows`, `ReLoadState`
  - `useMediaQuery`, `RE_MOBILE_QUERY`, `RE_FOCUS`
- `ReSheet.tsx` — `ReSheet` (right drawer on desktop, full-height or bottom sheet on mobile), `ReDetailList`, `ReFilterSheet`.
- `ReActionMenu.tsx` — `ReActionMenu` (desktop dropdown / mobile bottom sheet), `ReQuickActions` (primary + "More actions").
- `useReFetch.ts` — section-level GET hook with `loading | error | ready`, abort + sequence guard, HTTP status exposed. Non-OK responses are errors, never empty data.

New navigation pieces in `components/real-estate/navigation/`:

- `ReSidebarSections.tsx` — grouped, collapsible, persisted sidebar sections + `ReWorkspaceContext`.
- `ReMobileMenuSheet.tsx` — full-height grouped mobile menu.
- `ReMobileHeaderTitle.tsx` — page title + back link for nested routes.

## 5. Salesperson dashboard changes

File: `components/real-estate/AgentDailyWorkspace.tsx` (rewritten), mounted from `components/dashboard/sales/SalesDashboard.tsx`.

- **Header**: "Today's work" (desktop) / "My day" (mobile), date as context. Primary **New opportunity** (lime) plus a secondary group: Add buyer or tenant, Add inquiry, Find properties, Schedule viewing, Log call. On mobile a single "+ New" button opens a bottom sheet with the same actions.
- **Needs your attention** (visual centre, description as specified). Merged from data the page already loads plus the existing buyer-reports priorities:
  - inquiry priorities (existing sort preserved), offers needing attention, compliance actions, transactions needing attention, and buyer-search match/follow-up items;
  - buyer-report offers are de-duplicated against offers already in the list;
  - grouped as Overdue / Due today / Waiting on a decision / Opportunities;
  - 8-item preview with "Show all N"; per-row overflow menu with "Mark follow-up done" (existing PATCH);
  - if buyer-reports fails, a partial notice with Retry is shown instead of silently dropping items.
- **My sales snapshot**: New inquiries, Follow-ups due, Viewings today, Offers in progress (each links to its list; offers card shows loading/error state).
- **Today's schedule**: viewings and follow-ups merged, overdue first, then by time; date-only items show "Today". Open and Done actions.
- **My active work**: Buyers & tenants (shown separately, not summed), Property opportunities, Transactions in progress (steps done), each with View all.
- Sales Copilot is kept, embedded under the work area with an `h2` instead of a second page greeting.
- Existing overlays retained: inquiry workspace, offer detail panel, compliance case panel.

## 6. Manager dashboard changes

File: `components/real-estate/agency/AgencyOverview.tsx` (new), mounted by `components/dashboard/company/CompanyDashboard.tsx` when `data.businessType === "real_estate"`. The non-RE dashboard body is unchanged.

- **Header**: "Agency overview", breadcrumb "Agency / Overview", `{agency name} · {date}`. Primary Add inquiry; secondary New property opportunity, Add buyer or tenant, Schedule viewing, Add team member (`/client/team?invite=1` opens the existing invite dialog).
- **Executive metrics**: Available listings, Active buyer & tenant searches (labelled "searches, not people"), Viewings scheduled, Transactions in progress.
- **Management attention**: `AgencyAttentionPanel` (rewritten `AgencyAttention.tsx`) — category filter chips (Approvals / Deals & documents / Finance / Team), 6-item preview with "Show all N", note when a type hits the API's 20-row cap. Listing and transaction rows now deep-link to the record.
- **Transactions in progress**: desktop fixed-layout table (no horizontal scroll), mobile rows. Clicking a property opens the detail drawer.
- **Today / upcoming**: existing team calendar card.
- **Business operations**: Property acquisition / Buyer & tenant sales / Agency operations summary cards. Counts derived from the attention feed show "20+" at the cap rather than an exact-looking number.
- **Commission overview**: Projected, Verified received, Approved not paid, Paid to staff as separate rows with "Don't add them together". Only shown with finance access and organisation scope; 503 → "isn't switched on", 403 → limited access. Currency code only shown when every record is in one currency; otherwise a mixed-currency note. Legacy unverified amounts reported separately; incomplete data warned.
- **Team activity**: average first response plus a workload table in alphabetical order (no ranking), "Unassigned" last.
- **Agency demand insights**: top 5 unmatched demand gaps with the API's definition text, linking to matching.
- **Inquiries & reporting**: every previous dashboard widget is still rendered (focus areas, weekly and daily reports, agent visibility, team performance, funnel, sources, pipeline, deals at risk, revenue trend, recent activity).
- Demo / fictional mode: no live API calls; sections show "Live agency data isn't shown in the demo".

## 7. Sidebar

Files: `components/sales/navigation/SalesSidebar.tsx`, `components/company/navigation/CompanySidebar.tsx` (RE branch only; Trades branch untouched).

- Workspace context under the logo: "Agent workspace · Real Estate" or "{agency} · Real Estate · Manager".
- Group labels (Property acquisition, Buyer & tenant sales, Agency operations, More tools, System); main group has no header.
- Groups collapse/expand; state persisted in `localStorage` (`segmiq-re-nav-groups-sales`, `-drawer`, `-company`); More tools and System start collapsed; the group containing the active page auto-expands; a dot marks a collapsed group holding the active page.
- Scrollable item list with a sticky Help & Support footer.
- Collapsed rail: hairline separators between groups, tooltips on items and footer.
- `SALES_NAV_SECTION_LABEL.agency` renamed "Agency" → "Agency operations" (only used by RE).

## 8. Mobile navigation

- **Header** (`SalesMobileTopBar.tsx`, `CompanyMobileTopBar.tsx`): in RE shows the wordmark on home, otherwise the current page title from the nav config, with a 44px back link on nested routes. Theme toggle moved into the Menu to keep the bar uncrowded. Non-RE output unchanged.
- **Bottom nav** (`SalesBottomNav.tsx`, `CompanyBottomNav.tsx`): Home, Inbox, Properties, Activities, Menu. In RE: 11px labels with no wrapping, no lime emphasis on Inbox, `aria-haspopup` on Menu. Safe-area padding was already present and is kept.
- **Menu** (`ReMobileMenuSheet.tsx`): full-height sheet, groups Property acquisition / Buyer & tenant sales / Agency operations / More tools / System, collapsible, current page highlighted, 48px rows, body scroll locked, closes on navigation, Appearance toggle included. Built from the same role-aware nav config as the sidebar, so manager-only destinations stay hidden from salespeople.

## 9. Quick actions

- `ReQuickActions`: lime primary + neutral "More actions" dropdown on ≥640px; a single "+ New" button opening a bottom sheet on mobile.
- All actions go to existing flows only:
  - `?new=1` on `/sales|client/acquisitions` and `/sales|client/buyers` opens the existing create dialog (small mount effect added to `AcquisitionWorkspace.tsx` and `BuyerSalesWorkspace.tsx`; the param is removed from the URL afterwards).
  - Add inquiry opens the existing Add-to-hub sheet; Log call opens the existing log sheet.
  - "Schedule viewing" routes to buyers (agent) / viewings (manager) and says so in its description, because viewings are booked from a buyer search; no new booking flow was invented.

## 10. Detail drawer

`ReSheet` (`placement="drawer"`): right drawer `min(var(--re-drawer-width, 500px), 100vw)` on ≥768px, full-height sheet on mobile. Portal, focus trap with focus restore, Escape closes, backdrop click closes, body scroll lock, safe-area padding, sticky footer. Used for the manager transaction preview (`ReDetailList` + "Open transaction" → `/client/transactions?open={id}`, which the existing transactions workspace already handles).

## 11. Overflow menu

`ReActionMenu`: desktop uses the existing `DropdownMenu` (portal, Escape, arrow keys, align end) with destructive items separated; mobile uses a bottom `ReSheet` with 48px rows. Click events are stopped at the wrapper so opening a row menu never triggers the row itself. Used on agent attention rows.

## 12. Filters

- `ReFilterSheet` primitive: mobile filter sheet with sticky Clear all / Apply and Close, active-count in the title.
- Attention category filters on the manager dashboard use `aria-pressed` chips (selected = near-black fill, not lime).
- Phase 1 does not retrofit `ReFilterSheet` into the existing list pages (Buyers, Listings, Offers, etc.); that is Phase 2 work.

## 13. States

- Every live section has loading (skeleton rows), error (message + Retry) and empty (specific copy) states.
- Failed loads show "—" / "Couldn't load", never 0.
- Partial data: buyer-reports failure on the agent dashboard, and `incomplete` flags from acquisitions, operations, demand and commissions, each show a visible notice.
- API caps are shown as "20+" instead of an exact-looking count.

## 14. File list

New:
- `components/real-estate/ui/primitives.tsx`
- `components/real-estate/ui/ReSheet.tsx`
- `components/real-estate/ui/ReActionMenu.tsx`
- `components/real-estate/ui/useReFetch.ts`
- `components/real-estate/ui/index.ts`
- `components/real-estate/navigation/ReSidebarSections.tsx`
- `components/real-estate/navigation/ReMobileMenuSheet.tsx`
- `components/real-estate/navigation/ReMobileHeaderTitle.tsx`
- `components/real-estate/agency/AgencyOverview.tsx`
- `docs/implementation/REAL_ESTATE_UI_PHASE_1_REPORT.md`

Modified:
- `app/globals.css` (append only)
- `components/real-estate/AgentDailyWorkspace.tsx`
- `components/real-estate/agency/AgencyAttention.tsx`
- `components/real-estate/acquisition/AcquisitionWorkspace.tsx`
- `components/real-estate/buyers/BuyerSalesWorkspace.tsx`
- `components/dashboard/company/CompanyDashboard.tsx`
- `components/dashboard/sales/SalesDashboard.tsx`
- `components/dashboard/sales/DashboardHeader.tsx`
- `components/dashboard/sales/SalesCopilotDailyWorkspace.tsx`
- `components/sales/navigation/SalesSidebar.tsx`
- `components/sales/navigation/SalesMoreSheet.tsx`
- `components/sales/navigation/SalesBottomNav.tsx`
- `components/sales/navigation/SalesMobileTopBar.tsx`
- `components/company/navigation/CompanySidebar.tsx`
- `components/company/navigation/CompanyBottomNav.tsx`
- `components/company/navigation/CompanyMobileTopBar.tsx`
- `lib/sales/navigation/sales-nav-config.ts`
- `.hallmark/log.json`

`components/real-estate/BuyerSearchPriorities.tsx` is no longer imported by the agent dashboard; the file was left in place.

## 15. Functionality preserved

- No API routes, services, migrations or RLS touched. Only existing endpoints are called: `buyer-reports` (default, `operations`, `demand`), `buyer-searches?metrics=1`, `acquisitions/overview`, `transactions?tab=active`, `agency?view=attention`, `agency`.
- Manager-only reports are only requested from the manager dashboard; the API still enforces access.
- All previous manager widgets still render on the RE dashboard. `AgencyAttention` keeps its old `{clientId}` wrapper export.
- Trades/Solar/Construction/Tyre: sidebar, bottom nav, mobile header and dashboard body render the same as before.

Bugs fixed along the way (worth checking on Vercel):
1. **RE agent mobile Menu was nearly empty** — it only listed the sales/tools sections. It now shows all RE groups.
2. **Dashboard "Add inquiry/lead" button did nothing** in `SalesDashboard` — the Add-to-hub sheet was opened but never rendered. It is now rendered. This also fixes the button for Trades salespeople.
3. **Management attention was not on the live manager dashboard** — it was only mounted in the unused legacy `ClientDashboardMain`. It is now the centre of the RE manager overview.

## 16. Responsive behaviour

- <640px: single column; "+ New" sheet; 2-column metric grid; all rows ≥44px tap height; tables replaced by stacked rows (transactions) or fixed-layout narrow tables (workload, 3 columns).
- 640–1099px: quick actions inline; Business operations in 2 columns; transactions table from 768px.
- ≥1100px (`layout:`): 12-column grid.
  - Agent: metrics row, then attention (2/3) beside schedule (1/3), then active work.
  - Manager: metrics row, attention 8 + calendar 4, transactions 8 + commission 4, operations full width, team 6 + demand 6, then reporting.
- Mobile DOM order (manager): attention → metrics → transactions → upcoming activity → operations → commission → team → demand → reports. Desktop order is set with `layout:order-*` so screen-reader order matches mobile.

## 17. Tests performed

- `ReadLints` (IDE diagnostics) on every new and modified file: no errors.
- Source review: prop names checked against `CompanyDashboardHeader`, `CompanyTeamCalendarCard`, `CompanyFocusAreasCard`, `CompanyTeamPerformanceCard`, `CompanyFunnelCard` and `CompanyLeadSourcesCard`; KPI ids checked against `get-company-sales-dashboard-data.ts`; commission totals checked against `commissionTotals()` and `listCommissions()`; `/client/team?invite=1` confirmed to open the invite dialog; callers of components with changed props checked.
- `git diff --stat` review: 18 files modified, plus the new files listed in section 14.

## 18. Tests not performed

- No `npm run build`, `next build`, `vercel build`, dev server or localhost.
- No full TypeScript compile and no full-project lint. Type correctness rests on IDE diagnostics and manual review only.
- No unit, e2e or visual regression tests run.
- **No visual browser validation.** Nothing has been looked at rendered, on any screen size, in either theme.
- No push or deploy.

## 19. Manual Vercel QA checklist

Run on a preview deployment with a Real Estate agency plus one Trades/Solar company for regression.

Agent (salesperson) dashboard — `/sales/dashboard`:
- [ ] Desktop: "Today's work" header with lime New opportunity and More actions; each action opens the right flow (`?new=1` opens the create dialog, then the param disappears from the URL).
- [ ] Add inquiry opens the Add-to-hub sheet; Log call opens the log sheet.
- [ ] Needs your attention: grouped Overdue / Due today / Waiting / Opportunities; no duplicate offers; "Show all" works; row menu "Mark follow-up done" works and the row updates.
- [ ] Snapshot cards link correctly; counts match the list pages; block `buyer-searches` in DevTools and confirm "Couldn't load", not 0.
- [ ] Schedule ordering (overdue first) and Done/Open actions.
- [ ] Active work: buyers and tenants shown separately.
- [ ] Mobile (~390px): "My day", "+ New" sheet, attention before metrics, 2-column metrics, no horizontal scroll.

Manager dashboard — `/client/dashboard`:
- [ ] "Agency overview" header; quick actions work; Add team member opens the invite dialog.
- [ ] Management attention filter chips, "Show all", cap note when a type has 20+ items, deep links (listing, transaction).
- [ ] Transactions table on desktop; rows on mobile; drawer opens at ~500px, Escape closes and focus returns; "Open transaction" opens that record.
- [ ] Commission overview: finance user sees four separate figures; a non-finance manager sees the limited-access message; a workspace with agency ops disabled shows "isn't switched on"; mixed-currency agency shows the mixed note.
- [ ] Team activity in alphabetical order, no ranking language.
- [ ] Demand insights link to matching.
- [ ] All previous reporting widgets present below.
- [ ] Demo/fictional workspace shows demo notes and makes no failing API calls.

Navigation:
- [ ] RE desktop sidebar: workspace context, group labels, collapse/expand persists across reloads, active group auto-expands, collapsed rail tooltips, sticky Help footer, long lists scroll.
- [ ] RE mobile header: title correct per page; back link on nested pages (e.g. a buyer search detail).
- [ ] RE bottom nav: labels don't wrap at 320px; Menu opens the full-height grouped menu; current page highlighted; navigating closes it; background doesn't scroll.
- [ ] Salesperson menu shows no manager-only items; manager menu shows agency operations.
- [ ] Light and dark themes: contrast of badges, chips, focus rings, drawer backdrop.
- [ ] Keyboard: Tab through dashboard, dropdowns (arrow keys, Escape), sheets trap focus.

Regression (Trades/Solar company):
- [ ] Sidebar, bottom nav, mobile header and company dashboard look as before.
- [ ] Salesperson "Add lead" button on the dashboard now opens the Add-to-hub sheet (it previously did nothing).

## 20. Phase 2 readiness

Ready to build on:
- Shared primitives (`ReSection`, `ReWorkItem`, `ReStatCard`, `ReSheet`, `ReActionMenu`, `ReFilterSheet`, `useReFetch`) are generic and can be dropped into list and detail pages.

Suggested Phase 2 work:
- Apply `ReFilterSheet` and `ReActionMenu` to Buyers, Listings, Offers, Viewings, Acquisitions and Transactions list pages.
- Move existing record side-panels (offer, compliance, inquiry) onto `ReSheet` for consistent drawer behaviour.
- Decide whether to delete `BuyerSearchPriorities.tsx` and the legacy `ClientDashboardMain.tsx`.
- Consider a dedicated "today" endpoint so the agent dashboard needs fewer parallel requests.
- Add a short `design.md` note documenting the RE primitives and the `--re-*` tokens once they have been visually approved on Vercel.
