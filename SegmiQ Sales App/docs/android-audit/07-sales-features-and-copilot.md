# 07 — Sales features and Sales Copilot

All features below run on **local demo data only**; report 04 explains why there is no backend. "Functional demo" means the interaction works on the device against fictional data.

## 1. Leads

| Capability | Status | Evidence |
|---|---|---|
| Lead list | **Functional demo.** Every local customer, not paged | `features/CustomerScreens.kt` lines 20–29; V `16` |
| Lead search | **Functional demo.** Substring match on name, company and phone | line 25 |
| Lead filters | **Not implemented.** No status, source, owner or date filters | — |
| Lead detail | **Functional demo.** Overview, Timeline, Notes and Deals tabs | lines 86–139; V `17`–`20` |
| Add lead | **Functional demo.** Name, company and phone with validation; persists across restarts | lines 161–179; V `33b`, `36b` |
| Edit lead | **Not implemented** | — |
| Lead ownership | **Hard-coded.** "Assigned to Alex" / "Alex Demo" for every lead | lines 93, 109 |
| Notes | **Functional demo.** Add a text note; it appears on the Notes and Timeline tabs | `SalesViewModel.kt` line 43 |
| Activity | **Partial.** The Timeline merges local drafts, call reviews and notes under one hard-coded "Sample enquiry received" card, with no timestamps or ordering | lines 124–131 |
| Lead conversion (lead → deal) | **Not implemented** | — |
| Claim or transfer | **Not implemented** | — |

## 2. Sales Inbox

| Capability | Status | Evidence |
|---|---|---|
| Conversation list | **Functional demo.** Customers with at least one message, showing the last message | lines 44–62; V `04` |
| Search | **Functional demo** | line 53 |
| Filters | **Partial.** "Follow-ups" works; **"Mine" does nothing**; "All" is the default | lines 50, 52–55 |
| Thread view | **Functional demo.** Bubbles aligned by direction | lines 69–79; V `05` |
| Send message | **Not implemented.** "Save draft on device" stores an outgoing local message labelled "Local draft". The text says sending "require[s] verified SegmiQ messaging-provider capabilities" | lines 80–82 |
| Attachments, voice notes, templates, quick replies | **Not implemented** | — |
| Real-time updates / unread counts | **Not implemented** | — |
| Conversation status (resolve, reopen, transfer) | **Not implemented** | — |

Channel: the list says "Sample WhatsApp conversations · provider not connected". The Android app has no WhatsApp integration. The web platform already has a WhatsApp backend (Meta Cloud, coexistence and a QR gateway, per the web audit). **Android must reuse it through SegmiQ endpoints, not integrate WhatsApp separately.**

## 3. Pipeline and opportunities

| Capability | Status | Evidence |
|---|---|---|
| Stage display | **Functional demo.** Stage label on each card plus stage filter chips | `features/WorkspaceScreens.kt` lines 177–191; V `13` |
| Opportunity list | **Functional demo**, but read from the static `DemoFixtures.opportunities`, **not** from persisted state | lines 173–178 |
| Deal detail | **Functional demo** (read-only): stage, title, value, customer, next action | lines 194–204; V `14` |
| Opportunity value | **Display only**, USD via `Locale.US` | line 167 |
| Stage transitions | **Not implemented.** The deal says "Stage changes require the organisation's live workflow configuration" | line 201 |
| Won / lost | **Not implemented** | — |
| Industry-specific stages | **Not implemented.** One hard-coded list: All, Discovery, Proposal, Negotiation | `core/data/SalesRepository.kt` line 50 |

The pipeline summary text "3 active opportunities" is a hard-coded string (line 175), not a count.

## 4. Quotations

| Capability | Status |
|---|---|
| Quote list | **Not implemented.** The Quotations page is an empty state: "Quotation service not connected" (`SalesApp.kt` line 168; V `29`) |
| Quote builder | **Not implemented** |
| Product selection | **Not implemented** |
| Quote PDF | **Not implemented** |
| Send quotation | **Not implemented** |
| Quote status | **Not implemented.** `QuotationReference(id, customerId, title, status)` is declared only (`BackendContracts.kt` line 28) |
| Customer acceptance | **Not implemented** |

Five entry points lead to this empty page:
- quick actions "Create quotation";
- the customer "Quote" button;
- the Deal "Quotations" row;
- the Call review "Prepare quotation" row;
- the More "Quotations" row.

## 5. Tasks and meetings

| Capability | Status | Evidence |
|---|---|---|
| Task list with Today / Upcoming / My tasks / Completed | **Functional demo**, unit-tested (`SalesRulesTest`, `MainScreenViewModelTest`) | `WorkspaceScreens.kt` lines 127–137; `SalesRepository.kt` lines 52–59 |
| Complete / uncomplete a task | **Functional demo**, persisted | `SalesViewModel.kt` line 42 |
| Create follow-up | **Functional demo.** The due date is **free text**; no reminder is scheduled | `CustomerScreens.kt` line 155 |
| Due-date logic | **Text-based.** "Today" means the due text starts with "Today", so tasks never roll over and real dates are not supported | `SalesRepository.kt` lines 52–58 |
| "My tasks" | Same as all open tasks. There is no ownership | line 57 |
| Meetings list and detail | **Functional demo.** Two fixtures plus locally scheduled meetings | `WorkspaceScreens.kt` lines 140–165 |
| Calendar | **Not implemented.** The `calendar` route reuses the Meetings list | `SalesApp.kt` line 131 |

## 6. Sales Copilot

| Item | Finding | Evidence |
|---|---|---|
| Copilot screen | Exists at route `copilot` | `SalesApp.kt` lines 154–167; V `28` |
| Daily recommendations | **Generated locally by rule.** One card per open task, with the reason "Why: this action is scheduled for {due}" | lines 159–165 |
| Customer context | Only a "Review customer" link | line 163 |
| Suggested tasks | **Not implemented.** Cards restate existing tasks; nothing new is suggested | — |
| Follow-up recommendations | **Not implemented** | — |
| Opportunity insights | **Not implemented** | — |
| Review and approval actions | **Not implemented.** No approve, dismiss, snooze or complete. `Recommendation.requiresReview = true` is declared but unused | `BackendContracts.kt` line 30 |
| Data models | `Recommendation(id, customerId, title, reason, requiresReview)`, `CopilotRepository.recommendations(scope)`; declared only | `BackendContracts.kt` lines 30–31 |
| Backend integration | **None** | — |
| Error states | None specific | — |
| My Day nudge | "A nudge from Sales Copilot: {n} priorities need your attention" links to the Copilot screen | `WorkspaceScreens.kt` line 101 |

**Classification: generated locally by simple rules from demo tasks.** The recommendations are not hard-coded strings, not retrieved from the SegmiQ backend, and not produced by any AI service. The screen states "Rule-based suggestions from local demo tasks. No AI service is connected" (line 157), so it is honest.

**Reuse direction (supplied web context):** the web platform already has Sales Copilot work items. Per the web audit these are Bearer-enabled: `GET /api/sales/dashboard/workspace` and `POST /api/sales/copilot/work-items/{id}`, which returns 409 when an item is stale. Android should render those work items and send approve, dismiss, snooze and complete actions back. **It should not build a separate recommendation engine.** The local `Recommendation` model will need fields for the server's work-item type, status, version (for 409 handling) and payload.

## 7. Summary of functional and placeholder behaviour

| Area | Works locally | Placeholder / missing |
|---|---|---|
| Leads | List, search, add (validated), detail tabs, notes | Edit, filters, ownership, conversion, claim/transfer, real activity |
| Inbox | List, search, Follow-ups filter, thread view, local drafts | **"Mine" filter**, sending, media, templates, status, real time |
| Pipeline | Stage filter, deal detail view | Stage moves, won/lost, editing, persistence, industry stages |
| Quotations | — | Everything |
| Tasks | Filters, complete, create (free-text due) | Real dates, reminders, ownership, server sync |
| Copilot | Rule-based list from open tasks | Real work items, approve/dismiss/snooze/complete |
