# Real Estate UI Phase 4 — Agency operations

## 1. Executive summary

Agency operations now sits on the same workbench as the earlier real-estate phases. The screens that were still plain forms — commissions and staff handover — were rebuilt as operational workspaces. The property register and transaction workspace already had tables, mobile rows, status badges and detail panels; those were tightened rather than replaced, so the listing form, approval flow and transaction engine stay intact.

Managers and agents still see different commission data. The server decides that. The agent page no longer repeats the shell title, and its summary is limited to the figures the own-allocation payload returns.

No browser check and no Vercel build were run.

## 2. Hallmark skill confirmation

Hallmark v1.1.0 was read at `.cursor/skills/hallmark/SKILL.md`. `design.md` still locks this product to Workbench, modern-minimal, and the Segmiq CRM theme. No new theme and no `tokens.css` were added.

Financial screens stay on neutral surfaces. Reported receipt and verified receipt are not the same badge treatment. A Phase 4 entry was prepended to `.hallmark/log.json`. The file parses as JSON.

## 3. Existing design system reused

- `RePageHeader`, `ReSection`, `ReMetricGrid`, `ReStatCard`, `ReStatusBadge`
- `ReEmptyState`, `ReErrorState`, `ReSkeletonRows`, `RePartialNotice`
- `ReSheet` for handover confirmation
- `acqFieldClass` and `acqLabelClass` for handover selects
- `salesMenuTriggerClass` for the handover primary actions
- Existing sales `DataTable`, `Badge`, `Button`, and `CompanyKpiCard` on listings and transactions
- `AgencyAttention`, already built on the Phase 1 work rows

## 4. Files created

- `docs/implementation/REAL_ESTATE_UI_PHASE_4_AGENCY_OPERATIONS.md`

No new UI component files. Suggested names such as `PropertyRegisterTable` were not added, because the register and transaction lists already own those layouts.

## 5. Files modified

- `components/real-estate/agency/CommissionsWorkspace.tsx`
- `components/real-estate/agency/HandoverWorkspace.tsx`
- `components/real-estate/ListingsManager.tsx`
- `components/real-estate/listings/CompanyListingsPage.tsx`
- `components/real-estate/transactions/TransactionsWorkspace.tsx`
- `components/real-estate/transactions/TransactionOperations.tsx`
- `components/real-estate/transactions/CompanyTransactionsPage.tsx`
- `components/real-estate/reports/CompanyReReportsPage.tsx`
- `app/sales/listings/page.tsx`
- `app/sales/transactions/page.tsx`
- `app/sales/commissions/page.tsx`
- `app/client/agency/team/page.tsx`
- `.hallmark/log.json`

## 6. Property register desktop

`/sales/listings` and `/client/listings` both render `ListingsManager`. The desktop table, status tabs, KPI cards, approval actions, and create/edit sheet were already in place and were not replaced.

The manager frame copy is now “Manage your agency property inventory, availability and activity.” The salesperson shell uses the same idea, limited to inventory that person can work with. Availability, mandate, agent, and activity counts still come from the listing row and the register endpoint. An accepted offer is not shown as a completed sale.

## 7. Property register mobile

The phone list was a truncated one-line row. It now wraps the property name, shows type and price at body size, keeps the availability and mandate badges, and labels the row action **View property**. The whole card still opens the existing preview. There is no second page-level horizontal scroll.

## 8. Property details and action menus

The register preview remains `ListingRegisterDetails`: photo, price, availability, approval, mandate, agents, activity counts, issues, and the existing links. Activity counts do not expand into buyer names. Edit, approve, and delete stay on the existing controls. A new three-dot menu was not added on top of those controls, because the row already has edit and the preview already has the working destinations.

## 9. Transaction lists

`/sales/transactions` uses `TransactionsWorkspace` with variant `agent`. `/client/transactions` uses the company frame around the same workspace. Tabs, KPI cards, and the desktop table were already there.

The phone card now leads with the property, then the permitted customer and the agreed amount, then **Open transaction**. Status stays a separate badge. The salesperson subtitle is “Manage the property transactions you are working on.” The manager subtitle is “Monitor deals, outstanding requirements and transaction progress.”

## 10. Transaction detail workspace

Opening a row still uses the existing detail panel and `?open=`. Milestones, documents, people, activities, and the commission summary stay inside `TransactionOperations`. This phase did not create a second transaction page.

## 11. Milestone UI

Milestone rows, assignee names, and completion actions are the existing tab. Completion still goes through `POST /agency`. The `commission_settled` restriction stays on the server. The loading state is now a skeleton instead of a single “Loading…” line.

## 12. Document upload and review

Upload, view, replacement, verify, reject, and request-replacement were already wired to the document route and `review_document`. The form already says an upload awaits review and that a payment screenshot is not proof of payment. Review buttons stay on the document row for people with `reviewDocuments`. They were not moved, because hiding them in a menu would make verification harder to find on a deal file.

## 13. Deal participants

The people tab still lists participants and roles from the transaction payload, with the existing add and end-participation actions. Ending participation is the current action, not a delete of history.

## 14. Collaboration requests

Collaboration requests remain on the existing transaction and agency actions. This phase did not add a second request inbox. Approving a participant does not claim access to WhatsApp.

## 15. Manager commissions

`/client/commissions` is `CommissionsWorkspace` without `mineOnly`. The header is **Commissions**, with the earnings, allocation, verification and payout line.

The summary uses the ledger totals the API returns:

- Earned
- Verified received, with reported received named beside it
- Approved outstanding
- Paid to agents

Projected, invoiced, and approved allocation amounts stay in a line under the cards so they are not mistaken for cash. Legacy unverified cents are a warning, not part of the cards. If `incomplete` is set, the page says the figures are not the complete ledger.

Each record shows the property or transaction, the gross amount in the record currency, and a status badge. Reported and verified are not the same tone. The allocation rows and the earn, invoice, approve, report, verify, dispute, and cancel actions are unchanged.

## 16. Financial KPI definitions displayed

The API `totals.definition` is printed under the cards. The UI does not recompute cents. Money is `cents / 100` formatted with the record currency. When a currency is missing, the number is shown without a hardcoded USD prefix.

A failed load shows the error and a retry. It does not paint zeros.

## 17. Commission allocation interface

`CommissionSetup` is still the create form under the list, and only when `finance` is true. It still uses the existing beneficiary picker, percentage or fixed basis, and `allocateCommission` / `grossCommissionCents` from the domain helper. This phase did not replace that form with a new calculator.

## 18. Commission approvals

**Approve allocations** remains a finance action on the commission card. It posts `commission_status` with `approve_allocations`. The UI does not add an approve button for an agent viewing only their own allocations, because `finance` is false in that payload.

## 19. Receipt verification

**Report receipt** and **Verify receipt** stay separate buttons. Verify is shown only when `canVerifyReceipt` is true. The success text for a report still says it is not verified yet.

## 20. Partial and full payouts

Allocation rows still show amount, payout, and outstanding from the existing allocation fields, and the payout action is unchanged. Partial progress is the difference the API already returns. This phase did not add a new payout form.

## 21. Commission disputes

Open disputes still render in `DisputeList` above the records. Opening a dispute and a finance review still post `dispute` and `review_dispute`. A disputed status uses the warning badge, not a paid badge.

## 22. Agent My commissions

`/sales/commissions` passes `mineOnly`. The shell header is hidden so the workspace title is the only one. The cards are:

- My allocations (the payload `projectedCents` for that scope)
- Approved
- Outstanding
- Paid, labelled as verified payouts

The empty state tells the agent their allocations appear when recorded. Record commission, verify receipt, and cancel stay off this view because they require `finance` or `canVerifyReceipt`. Colleague allocations are only present if the API includes them. The own-allocation scope does not.

## 23. Team management

`/client/team` is still the shared `CompanyTeamPage` used by other industries. It was not restyled, so solar, trades, and construction team management stay as they are.

Real-estate staff movement lives on `/client/agency/team`.

## 24. Staff capabilities

Capability grants are still enforced by the agency API (`finance`, `canVerifyReceipt`, `reviewDocuments`, and the other flags on the transaction payload). This phase did not add a new permission editor. The team directory remains the place account roles are managed.

## 25. Handover preview and confirmation

`HandoverWorkspace` is now a stepped workspace.

1. Choose the person and the default replacement from the staff list the API returns. No user ids are typed.
2. Review assignments groups the preview by category, with select-all, a per-category replacement, and expandable records.
3. **Confirm handover** opens a sheet naming both people and the selected count. Confirm posts the same `handover` body as before, including fingerprint and selected keys.

Incomplete and unavailable categories use the warning notice. The copy does not say every assignment was found. The unchanged list (sourcing credit, commission history, WhatsApp, and whatever else the API returns) stays visible.

## 26. Handover results and retry

A 409 with `drift` shows **Handover preview is out of date**, with **Refresh preview** and **Continue with my selection** (`acceptChanges: true`). The UI does not report success in that case.

The result line still states moved, skipped, and failed counts. History rows show applied, skipped, and failed of the total. A partial or in-progress handover keeps **Retry failed items**, which posts `handover_retry` for that handover id only.

## 27. Reports and analytics

`/client/reports` for real estate still renders `CompanyReReportsPage` and `RealEstateReportsWorkspace`. That workspace already loads the operations report and shows enquiries, viewings, listings, transactions, and commission with `CompanyKpiCard`. The page description now says current stock and period activity are different. The report request is still the existing 30-day operations report. No new report endpoints or growth arrows were added.

## 28. Agency attention integration

`AgencyAttention` was already on the Phase 1 manager dashboard. Each item has a specific action: review mandate, review listing, open offers, open transaction, review documents, verify payment, review commission, open handover. It was not rebuilt.

## 29. Three-dot menu design

Handover and commissions use the visible primary action plus the existing labelled buttons for financial decisions, because those decisions need an amount or a reason and should not be buried. Listing and transaction rows open the existing detail. New menus were not stacked on top of working row actions.

## 30. More details and detail drawers

Property preview and transaction detail stay the existing panels. Handover confirmation is one `ReSheet`, not a generic more-information dialog. Commission records expand in place with the allocation breakdown.

## 31. Filter interactions

Listing status and type filters, and transaction tabs, are unchanged and still filter the loaded workspace. Commission paging uses the existing page query. Handover does not add decorative filters. Report period controls were not invented beyond the operations report the page already requests.

## 32. Loading, empty and error states

Commissions: skeleton while the first payload is absent, error with retry, empty copy that differs for an agent and a manager, incomplete-ledger notice.

Handover: error alert, empty preview, incomplete warning, drift warning, partial history that is not a single success badge.

Transactions: operations tab uses a skeleton while the payload loads, and shows the API error if it fails.

## 33. Desktop responsive behavior

Commission metrics are a four-up grid from the small breakpoint. Handover people fields are two columns from `md`. Listing and transaction tables stay the existing desktop tables. The handover confirmation drawer is the shared sheet, which is a side drawer from `md`.

## 34. Mobile responsive behavior

Listing and transaction cards are one column and wrap long names. Commission amounts use a 22px figure instead of a squeezed table. Handover groups stack, with 44px checks and selects. Page shells keep the existing bottom-nav padding. The confirm sheet uses the shared safe-area footer.

## 35. Accessibility

Handover selects have labels. The drift and error states use alerts or the error component. Status badges include text. Commission amount fields keep their existing labels. Sheets keep the shared dialog, focus trap, and Escape behaviour.

## 36. Existing API and permission preservation

No migrations, RLS, commission maths, transaction transitions, or other industries were edited.

Still in use:

- `GET/POST /api/clients/[clientId]/agency` for commissions, handover, transaction operations, and attention
- `GET /listings` and `GET /listings/register`
- `POST /transactions/[transactionId]/documents`
- The operations report used by the reports page

`finance`, `canVerifyReceipt`, and `reviewDocuments` still come from the server. The agent commission page does not send manager actions.

## 37. Lightweight tests executed

`.hallmark/log.json` was parsed with Node. It is valid JSON.

No component test runner was started.

## 38. Tests not executed

Not run:

- `npm run build`, `next build`, Vercel build
- dev server or localhost
- full-project TypeScript or ESLint
- browser verification

## 39. Known limitations

- The property register and transaction workspace were already designed. This phase changed their mobile rows and page copy, not the create-listing form or the transaction state machine.
- Document review actions remain on the document row.
- The commission create form is the existing setup block, shown only to finance users.
- `/client/team` is shared across industries and was left alone.
- Reports still use the existing operations report. There are no new acquisition, demand, or team-ranking tabs.
- Listing and transaction lists still follow their existing caps. This phase does not raise them.
- Money display divides integer cents by 100 for reading. It does not submit that division back as a new amount.

## 40. Manual Vercel preview visual QA checklist

- Property list on a phone: wrapped address, price, availability, mandate, View property.
- Transaction list on a phone: property first, amount readable, Open transaction.
- Manager commissions: earned, verified received, outstanding, and paid are separate. Legacy and incomplete warnings show when the API sets them.
- Agent commissions: no record-commission or verify-receipt control.
- Report a receipt and confirm the status is not labelled verified until verify is used.
- Handover: pick two people, review groups, confirm in the sheet, and confirm a drift response asks for a refresh.
- A partial handover offers retry only for that handover.
- Reports page still loads the existing operations figures.
- Manager dashboard attention items still open the right workspace.

## 41. UI Phase 5 readiness

The shared header, section, sheet, and financial summary components now cover commissions and handover as well as buyers and acquisition. A later phase can take the WhatsApp sales hub, or a deeper pass on document review and the shared team directory, without rebuilding these ledgers.

Leave messaging, session access, and provider sending for that later phase. Handover copy already states that WhatsApp sessions are not transferred.
