# Real Estate mobile UI rescue

Screenshot-based correction of the deployed phone layouts. No backend, permission, or API changes.

## 1. Screenshots reviewed

The screenshots were not attached to this session. The corrections follow the written findings for My Day, listings, opportunities, owners, inspections, mandates, buyers and tenants, matching, and viewings.

## 2. Hallmark guidance applied

Read `.cursor/skills/hallmark/SKILL.md` and the locked `design.md`. This stays on Workbench, modern-minimal, and the existing sales tokens. No new theme, no `tokens.css`, no decorative hero. Phone hierarchy is: the app header names the screen, then the next action, then the records.

Pre-emit critique: P5 H4 E4 S4 R4 V4.

## 3. Shared layout problems found

- The mobile header already named the page, and `RePageHeader` or `CompanyDashboardHeader` repeated it.
- `SegmiQDotWave` painted a tall dotted band on operational canvases.
- The bottom bar used a 95% mix, so scrolling rows showed through the labels.
- Metric cards reserved a supporting line even when it only restated the label.
- Empty states repeated the same title on the section and inside it, often inside a tall panel.
- Listings reserved a 660px panel on the phone, which pushed property rows down.

## 4. Shared components modified

- `RePageHeader` hides its heading on a phone unless `mobileTitle` is set.
- `ReSection` can hide a long description below the `layout` breakpoint.
- `ReStatCard` is shorter on a phone and drops the supporting line there.
- `ReMetricOverview` is a Show/Hide control on a phone and a plain grid from `md`.
- `ReEmptyState` is compact, with an optional `framed` surface and no nested duplicate title.
- `ReWorkItem` stacks the open action under the record on a phone so the name is not squeezed into a side column.

## 5. Mobile header changes

`ReMobileHeaderTitle` remains the phone title for named routes. Page content no longer repeats it. My Day keeps a 17px title and the date because that home header is the wordmark. The company dashboard home still shows its greeting. Other Real Estate company headers hide the large title when the mobile bar already names that route.

## 6. Hero removal

Shells used by Real Estate set `data-re-workspace="true"`. Below 1100px the dotted wave is not rendered there. Marketing pages do not use that attribute. Desktop canvases still have the wave.

## 7. Bottom navigation correction

`.sales-mobile-bottom-nav` and the dark mobile top bar now use a solid `var(--sales-surface)` instead of a translucent sidebar mix. The five destinations are unchanged. Full-screen chat still sets `data-hide-mobile-nav="true"` and reduces scroll padding to the safe area. Content padding remains `--sales-mobile-content-pb`.

## 8. Empty-state redesign

Opportunities, buyers, viewings, inspections, mandates, and owners no longer wrap an empty state in a section with the same heading. Each state is one title, one explanation, and one real button: New opportunity, Add buyer / tenant, Open buyer searches, or Open property opportunities. Filtered viewings and mandates name the selected view.

## 9. Metric-card redesign

Phone metrics sit behind Overview, after the working list on opportunities, buyers, and listings. Desktop grids stay above the list. Five listing counts use a two-column set with the fifth count on one full-width line, so it is not a tall leftover card. Supporting lines such as "Status is active" are desktop-only.

Active buyers and active tenants are people, not searches. Viewings scheduled can be non-zero while those people counts are zero, because a booked visit is not the same figure. That definition is on the metric info control. The numbers were not changed.

## 10. Button and tab improvements

List/Pipeline and Customers/Pipeline are fixed-height segmented controls. Matching direction is two single-line labels: "Properties for a buyer" and "Buyers for a property". Status tabs use one line and scroll. Search and Filters sit on one row. Add listing sits with search, not as a second page title.

## 11. Dashboard correction

My Day keeps the date and the attention count, then the attention list. Snapshot metrics are behind "My sales snapshot" on a phone. Attention rows stack the open action under the customer instead of a narrow side column. The existing preview and "Show all" control are unchanged.

## 12. Listings correction

The company page no longer repeats Listings under the app header or as a second Add listing. Status tabs can scroll, with a fade at the end so a cut-off tab reads as more statuses. Search, type, and Add listing share a row. The tall phone panel height is desktop-only. Listing overview is after the property list on a phone.

## 13. Opportunities correction

Phone order is List/Pipeline and New opportunity, then search and Filters, then the records or the single empty state. The five counts stay available under Opportunity overview and return above the list from `md`.

## 14. Buyers and tenants correction

Phone order is Customers/Pipeline and Add buyer / tenant, then search and Filters, then customers or one empty state. The four counts stay under Buyer and tenant overview. The long team sentence is desktop-only.

## 15. Matching correction

The direction control is two short labels. The search section is "Select buyer search", and Find properties shows "Finding…" while the existing request runs. Buyer demand insights no longer render an empty gap grid. View insights loads the same report.

## 16. Viewings correction

Upcoming, Today, Completed, Cancelled, and All stay as compact scrolling tabs. The empty state names the selected tab once and offers Open buyer searches. Schedule from a search remains the header action. Appointments are still booked from a buyer search.

## 17. Inspections correction

The line "These are not buyer viewings" is gone. Tabs stay All, Upcoming, Completed, Cancelled, and Needs attention. The empty state says inspections are scheduled from property opportunities and links there.

## 18. Mandates correction

The paragraph about manager approve, reject, renew, and revoke actions is gone. Pending review still opens first. An empty pending view says "No mandates awaiting review". Existing review controls are unchanged.

## 19. Owners correction

Search, then owners or one empty state. New opportunity is a primary button to the existing opportunity flow. There is no separate owner database.

## 20. Desktop regression considerations

Headings, descriptions, and full metric grids return at `md` or `layout` (1100px). Listing panel height, company greetings on the dashboard home, and desktop tables are unchanged. Phone-only stacking on `ReWorkItem` returns to a row from `sm`.

## 21. Other-industry isolation

The wave hide is limited to `data-re-workspace="true"`. Solar, trades, and tyre canvases do not set that attribute. The solid bottom bar is shared chrome, so those apps also stop showing content through the nav. Their page titles and KPIs were not restyled.

## 22. Files changed

- `components/real-estate/ui/primitives.tsx`
- `components/real-estate/AgentDailyWorkspace.tsx`
- `components/real-estate/ListingsManager.tsx`
- `components/real-estate/listings/CompanyListingsPage.tsx`
- `components/real-estate/acquisition/AcquisitionWorkspace.tsx`
- `components/real-estate/acquisition/AcquisitionLists.tsx`
- `components/real-estate/buyers/BuyerSalesWorkspace.tsx`
- `components/real-estate/buyers/MatchingWorkspace.tsx`
- `components/real-estate/buyers/SalesViewingsList.tsx`
- `components/dashboard/company/CompanyWorkspaceShell.tsx`
- `components/dashboard/company/CompanyDashboardHeader.tsx`
- `components/sales/shell/SalesAppShell.tsx`
- `app/globals.css`
- `docs/design/REAL_ESTATE_UI_DESIGN_SYSTEM.md`
- `.hallmark/log.json`

## 23. Lightweight tests performed

Source inspection of the header, shell, metric, empty-state, and list compositions. No local build, lint, dev server, or browser pass.

## 24. Known remaining issues

- Phone layout was not checked on the Samsung device. Vercel is the next visual check.
- Company viewings, offers, and transactions still use their existing tables and KPI cards above the list on desktop. Their repeated mobile titles are hidden when the app header already names the route.
- Commissions and handover were not in the screenshot set and were not recomposed.
- A booked viewing can still be counted while active buyer and tenant people are zero. The labels now say what those figures are. The queries were not changed.

## 25. Vercel screenshot acceptance checklist

- One title in the mobile header. No second large heading under it, except My Day.
- No dotted wave on listings, opportunities, buyers, matching, viewings, inspections, mandates, or owners.
- Attention rows on My Day are readable, with the action under the name.
- Listings status names are whole words, and a property row is visible without a tall empty panel above it.
- Opportunities and buyers show search, then records or one empty state. Overview is optional.
- Matching direction labels stay on one line. Demand insights do not show an empty grid.
- Viewings, inspections, mandates, and owners show one empty title and one button.
- The last row can scroll clear of the bottom bar, and the bar does not show the row through its labels.
