# SegmiQ Real Estate — UI Phase 6
## Final design consistency and source-level QA

Date: 17 October 2026

This pass inspected the Real Estate UI from Phases 1–5 and corrected a small set of source-level layout problems. It did not redraw every screen. No browser, localhost, build, or Vercel check was run. Visual QA below is pending on the deployed app.

## 1. Executive summary

The Real Estate workspace already shares one system: `RePageHeader`, `ReSection`, `ReSheet`, `ReActionMenu`, sales tokens, and the sales mobile shell. Phase 6 did not replace that system.

Corrected in source:

- Page titles on phones are 22px, and the supporting line clamps to two lines so the header does not consume the first screen.
- Transaction document review actions stack as full-width controls on a narrow screen. Verify, reject, and request replacement stay the same API calls.
- Developments, marketing properties, and marketing-by-agent no longer rely on a wide table as the only phone layout. The same rows render as cards under `md`.

Left as they were, because they already follow the system or because changing them would touch other industries or backend rules:

- Agent and manager dashboards, sidebar, and bottom nav from Phase 1.
- Acquisition, buyer, viewing, and offer workspaces from Phases 2 and 3.
- Commission ledger, handover, and reports from Phase 4.
- WhatsApp shell, bubbles, and sales-tools sheet from Phase 5.
- Shared `/client/team`.

## 2. Hallmark skill confirmation

Read `.cursor/skills/hallmark/SKILL.md` (v1.1.0) earlier in this redesign, and `design.md` remains the locked system: Workbench, modern-minimal, Segmiq CRM. This phase did not pick a new macrostructure. `.hallmark/log.json` has a Phase 6 entry. No `tokens.css` was emitted.

## 3. Screen inventory

Routes below are the Real Estate pair. Agent pages live under `/sales`. Manager pages live under `/client`. Shell pages set `showDefaultHeader={false}` when the screen renders `RePageHeader`.

| Route | Screen | Role | Main UI | Mobile layout | Phase |
|---|---|---|---|---|---|
| `/sales/dashboard`, `/client/dashboard` | Today's work / Agency overview | Agent, manager | Phase 1 dashboard | Priority stack | 1 |
| `/sales/acquisitions`, `/client/acquisitions` | Property opportunities | Both | `AcquisitionWorkspace` | Cards plus stage scroller | 2 |
| `/sales/acquisitions/[id]`, `/client/acquisitions/[id]` | Opportunity | Both | `AcquisitionDetail` | Stacked sections | 2 |
| `/sales/owners`, `/client/owners` | Owners | Both | Acquisition lists | Cards | 2 |
| `/sales/inspections`, `/client/inspections` | Inspections | Both | Acquisition lists | Cards | 2 |
| `/sales/mandates`, `/client/mandates` | Mandates | Both | Acquisition lists | Cards | 2 |
| `/sales/buyers`, `/client/buyers` | Buyers and tenants | Both | `BuyerSalesWorkspace` | Cards; table from `md` | 3 |
| `/sales/buyers/[id]`, `/client/buyers/[id]` | Search | Both | `BuyerSearchDetail` | Stacked | 3 |
| `/sales/matching`, `/client/matching` | Matching | Both | `MatchingWorkspace` | Stacked results | 3 |
| `/sales/viewings`, `/client/viewings` | Viewings | Both | Viewings tables and `SalesViewingsList` | Cards; table from `lg` on the company card | 3 |
| `/sales/offers`, `/client/offers` | Offers | Both | `OffersWorkspace` | Cards; table from `md` | 3 |
| `/sales/listings`, `/client/listings` | Property listings | Both | `ListingsManager` | Cards; table from `md` | 4 |
| `/client/listings/[id]` | Listing | Manager | Listing detail | Existing detail | 4 |
| `/sales/transactions`, `/client/transactions` | Transactions | Both | `TransactionsWorkspace` | Cards; table from `md` | 4 |
| `/sales/commissions`, `/client/commissions` | Commissions | Agent vs manager | `CommissionsWorkspace` | Metric row and records | 4 |
| `/client/agency/team` | Staff handover | Manager | `HandoverWorkspace` | Steps and groups | 4 |
| `/client/team` | Team directory | Manager | `CompanyTeamPage` | Shared across industries | Not restyled |
| `/client/reports`, `/sales/reports` | Reports | Manager, agent | `RealEstateReportsWorkspace` where gated | Existing report | 4 |
| `/sales/inbox`, `/client/inbox` | WhatsApp Sales Hub | Both | `TeamInbox` | One pane; chat hides bottom nav | 5 |
| `/client/developments` | Developments | Manager | `DevelopmentsManager` | Cards added in this phase | 6 |
| `/client/marketing` | Marketing | Manager | `RealEstateMarketingWorkspace` | Property and agent cards added in this phase | 6 |

Nested interactions that are not their own routes: inspection form, mandate review, offer accept/reject, transaction documents and participants, commission setup, handover confirm, Copilot draft, and sales-tools sheet.

## 4. Design system findings

Corrected: page title size and description clamp now match the written scale.

Open: some older surfaces (`DevelopmentsManager` cards, marketing tables) still use `workspace-card` rather than `ReSection`. They now share type size and spacing more closely, but they are not on the Real Estate section component.

## 5. Global navigation corrections

None. The sales sidebar and Real Estate mobile destinations from Phase 1 were left in place. Other industries still use their own nav.

## 6. Mobile header corrections

Corrected: `RePageHeader` title is 22px below 1100px and 26px from the layout breakpoint. Descriptions clamp to two lines under `sm`.

Open: the WhatsApp list header is a separate component (`SalespersonHubHeader`) and already uses a 22px Inbox title. It was not changed again.

## 7. Mobile bottom navigation corrections

None. `.sales-mobile-scroll` already reserves `--sales-mobile-content-pb`. Full-screen chat sets `data-hide-mobile-nav` and drops that padding to the safe area. Keyboard behaviour still depends on the existing visual-viewport hook and is not browser-verified.

## 8. Typography improvements

Corrected: shared Real Estate page titles. Section titles stay 15px.

Open: chat bubbles stay at 15px on phones from Phase 5. Dashboard type was not retuned.

## 9. Spacing improvements

No global spacing token change. Card padding remains `--re-card-pad`.

## 10. Card design consistency

Developments and marketing rows now use the same phone hierarchy as the other registers: name, context, one line of figures, and a 44px action where an action exists.

## 11. Desktop table improvements

Desktop tables for developments, marketing properties, and marketing agents are unchanged and hidden below `md`.

## 12. Mobile card improvements

Corrected for developments, marketing properties, and marketing agents.

Already present, not redrawn: listings, transactions, offers, buyers, viewings, commissions.

## 13. Three-dot menus

`ReActionMenu` already switches to a bottom sheet under 768px and a portalled menu above that. Phase 6 did not add placeholder actions.

Open: the WhatsApp header menu is the inbox dropdown, restyled in Phase 5 as a bottom sheet under 1100px. It was not rebuilt.

## 14. More Details interactions

No control labelled More Information was found under `components/real-estate`. Primary actions stay on the row (View property, Open transaction, and the equivalents from earlier phases).

## 15. Drawers

`ReSheet` remains the shared drawer and sheet. No width change. Transaction detail stays in the existing workspace, not a new drawer.

## 16. Filter sheets

Existing `ReFilterSheet` usages were not given new filters. A filter that the API does not apply was not added.

## 17. Forms

Document upload and review stay on the transaction document tab. Review buttons are full width on a phone. The commission setup block was not redrawn.

## 18. Confirmations

Document reject and replacement still require a reason before those buttons enable. Labels are now "Verify document", "Request replacement", and "Reject document". The request bodies are unchanged.

## 19. Loading, empty, and error states

No change. `ReEmptyState`, `ReErrorState`, `ReSkeletonRows`, and `RePartialNotice` remain the standard. Empty marketing or development lists still use their existing copy.

## 20. Status indicators

No badge remapping. Phase 4 commission tones and Phase 3 offer copy still apply: accepted is not sold, reported is not verified, uploaded is not verified.

## 21. Agent dashboard findings

Inspected through the Phase 1 report and the shared header. No P0 source defect was found in this pass. Not redrawn. Browser check pending.

## 22. Manager dashboard findings

Agency attention still routes to the existing review targets. Not redrawn. Browser check pending.

## 23. Property Acquisition findings

Lists, pipeline, inspections, and mandates were left as Phase 2 built them. Known limits that remain: opportunity rows do not show an agent name because the list payload does not include one; new price rows still send currency `USD` as the previous form did; inspection save still follows the existing request.

## 24. Buyer and tenant sales findings

Directory, matching, viewings, and offers were left as Phase 3 built them. Known limits that remain: the buyer directory is one page when the API ignores page size; match links do not invent a currency symbol; an accepted offer is not labelled as a completed sale.

## 25. Agency Operations findings

Register, transactions, commissions, handover, and reports were left as Phase 4 built them, except the document review controls. `/client/team` is still the shared directory. Reports are still the existing operations report, not new tabs.

## 26. WhatsApp Sales Hub findings

Phase 5 surfaces were not redrawn. Conversation list, bubbles, composer, sales tools, and Copilot draft confirmation remain. Media, quick replies, and QR pairing were already recorded as not redesigned.

## 27. Chat keyboard and composer considerations

Source still uses the salesperson full-screen thread, `100dvh` on the sales shell, safe-area padding, and bottom-nav hiding while a chat is open. Whether the keyboard covers the composer has not been checked on a device.

## 28. Financial screen clarity

No change to commission labels or cent display. Agent and manager commission views stay separate. This pass did not open the commission form.

## 29. Accessibility findings

Corrected: development edit and delete controls on a phone are 44px and named with the development. Document review controls meet `min-h-11`.

Open: desktop table icon buttons in developments remain the previous smaller hit area.

## 30. Permission and privacy preservation

No role checks were widened. Document review still renders only when `review` is true. Marketing links stay on `/client/listings`. No new fields are shown.

## 31. Performance considerations

Phone cards reuse the rows already loaded for the table. No second fetch was added.

## 32. Files created

- `docs/implementation/REAL_ESTATE_UI_PHASE_6_FINAL_QA.md`
- `docs/design/REAL_ESTATE_UI_DESIGN_SYSTEM.md`

## 33. Files modified

- `components/real-estate/ui/primitives.tsx`
- `components/real-estate/transactions/TransactionOperations.tsx`
- `components/real-estate/DevelopmentsManager.tsx`
- `components/real-estate/marketing/RealEstateMarketingWorkspace.tsx`
- `.hallmark/log.json`

## 34. Targeted tests executed

Source review of the edited JSX. No test runner was started.

## 35. Tests not executed

- `npm run build`, `next build`, Vercel build
- dev server or localhost
- full-project TypeScript or ESLint
- browser or device passes
- `git diff --check` (a previous check on this machine stalled; it was not repeated)

## 36. Known limitations

- This is not a pixel audit. Overflow, keyboard, and safe-area behaviour still need a Vercel preview.
- Shared team management was not restyled.
- Commission creation, milestone assignment, and participant pickers were not redrawn.
- Listing and transaction result caps are unchanged.
- Price discussion create still sends `USD` when that is what the existing form sends.

## 37. Issues requiring Vercel preview verification

- Page title at 360px does not collide with the shell.
- Description clamp does not hide a warning the user must see. Descriptions today are introductory, not errors.
- Document review buttons do not sit under the bottom nav.
- Developments and marketing cards show the same counts as the desktop table.
- Chat composer with the keyboard open.
- Bottom nav does not cover the last card on listings, transactions, commissions, and handover.

## 38. Manual device-width QA matrix

Pending. Review on the Vercel deployment. Do not treat this table as passed.

| Screen | 360 | 390 | 430 | 768 | 1280 | 1440 | Role |
|---|---|---|---|---|---|---|---|
| Agent dashboard | Pending | Pending | Pending | Pending | Pending | Pending | Agent |
| Manager dashboard | Pending | Pending | Pending | Pending | Pending | Pending | Manager |
| Opportunities | Pending | Pending | Pending | Pending | Pending | Pending | Both |
| Buyers and matching | Pending | Pending | Pending | Pending | Pending | Pending | Both |
| Viewings and offers | Pending | Pending | Pending | Pending | Pending | Pending | Both |
| Listings and transactions | Pending | Pending | Pending | Pending | Pending | Pending | Both |
| Commissions and handover | Pending | Pending | Pending | Pending | Pending | Pending | Split by role |
| Reports | Pending | Pending | Pending | Pending | Pending | Pending | Manager |
| Inbox and sales tools | Pending | Pending | Pending | Pending | Pending | Pending | Both |
| Developments and marketing | Pending | Pending | Pending | Pending | Pending | Pending | Manager |

## 39. Remaining issues

P0: none found in source during this pass. Not proven in a browser.

P1 open: chat keyboard overlap and any shell-header clipping can only be confirmed on a device. Source already accounts for them and was not changed again.

P2 open: commission setup form, shared team directory, and report tabs were not brought onto `ReSection`. Document review is still on the document row rather than a separate review sheet.

P3 open: developments desktop icon buttons are smaller than the phone targets. Marketing desktop tables keep their previous density.

## 40. Final source-level release assessment

The Real Estate UI is one product in source: shared header, sheet, menu, badge, and shell. Phase 6 fixed the shared title scale, the document review hit area, and three phone tables that had no card layout.

It is not visually signed off. The developer still needs to walk the Vercel preview at the widths in section 38 before calling the interface finished.
