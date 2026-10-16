# Real Estate UI Phase 3 — Buyer and tenant sales

## 1. Executive summary

The buyer and tenant sales screens now use the same workbench as the Phase 1 dashboards and the Phase 2 acquisition workspace. Agents get a customer directory, a search workspace, property matching in both directions, and an appointment list. The underlying search, match, viewing, offer, introduction, and deposit services were not changed.

This is a presentation pass over existing records. It does not add a second CRM, a second matcher, or a second calendar.

The offer workspace was already a negotiation screen with status tabs, currency formatting, accept confirmation, reject reasons, counters, and a link into the transaction workspace. That behaviour was left in place. A line was added so an accepted offer is not read as a completed sale.

Manager viewings already use the company viewing workspace (tabs, detail panel, schedule sheet, masked contacts). That page was not rebuilt.

No browser check and no Vercel build were run.

## 2. Hallmark skill confirmation

Hallmark v1.1.0 was read at `.cursor/skills/hallmark/SKILL.md`. `design.md` still locks the product to Workbench, modern-minimal, and the Segmiq CRM theme. Diversification is inverted: these pages share that system. No `tokens.css` and no new theme were added.

Surfaces stay neutral. Lime is not used as a card wash. Status is text plus a badge. Match scores are labelled as match scores. Empty states name the missing record and the next real action.

A Phase 3 entry was prepended to `.hallmark/log.json` (`scope: app`, Workbench, `design.md`). The file parses as JSON.

## 3. Existing design components reused

From `components/real-estate/ui`:

- `RePageHeader`, `ReSection`, `ReMetricGrid`, `ReStatCard`, `ReStatusBadge`
- `ReEmptyState`, `ReErrorState`, `ReSkeletonRows`, `RePartialNotice`
- `ReSheet`, `ReFilterSheet`, `ReDetailList`, `ReActionMenu`
- `salesMenuTriggerClass` for primary and secondary buttons
- `acqFieldClass` and `acqLabelClass` from the Phase 2 acquisition form styles, so search forms match opportunity forms

Sales pages that now own a `RePageHeader` set `showDefaultHeader={false}` so the shell title is not repeated: buyers, buyer search, matching, and viewings.

## 4. Files modified

- `components/real-estate/buyers/BuyerSalesWorkspace.tsx`
- `components/real-estate/buyers/BuyerSearchDetail.tsx`
- `components/real-estate/buyers/MatchingWorkspace.tsx`
- `components/real-estate/buyers/SalesViewingsList.tsx`
- `components/inbox/BuyerConversationActions.tsx`
- `components/real-estate/offers/OffersWorkspace.tsx`
- `app/sales/buyers/page.tsx`
- `app/sales/buyers/[searchId]/page.tsx`
- `app/sales/matching/page.tsx`
- `app/sales/viewings/page.tsx`
- `app/sales/offers/page.tsx`
- `app/client/buyers/[searchId]/page.tsx`
- `.hallmark/log.json`

## 5. New components created

None. The suggested card and sheet names were implemented inside the existing workspace files so each action stays next to the request it already sends. Splitting them into a dozen files would not change the API.

## 6. Buyers and tenants directory

`BuyerSalesWorkspace` is the directory for `/sales/buyers` and `/client/buyers`.

Header: **Buyers & tenants**, with the supporting line from the brief, and **Add buyer / tenant**. Customers and Pipeline switch the view. There is no welcome banner.

Metrics come from `GET /buyer-searches?metrics=1`: active buyers, active tenants, viewings scheduled, follow-ups due. Buyers and tenants are people. They are not added together. A failed metrics request shows an em dash, not a fake zero. Viewings scheduled links to the viewings route.

The manager operations report (`buyer-reports?report=operations`) still loads only when the API allows it. The line now states buyers and tenants as people, then active, paused, and no-next-action search counts. Agent ids from that report are not printed as names. A 403 stays silent, as before.

Desktop, from the `md` breakpoint up, is a table of searches: customer, requirement summary, agent, stage, next follow-up, Open search. A person with three searches is three rows that share a name and a search count. Requirements are not merged.

Below `md`, the same data is a stacked customer card: name, buyer/tenant label, search count, one requirement line, budget, stage, next follow-up, and one text action. The three-dot menu holds Open, Find matching properties, and Call or WhatsApp only when the list payload includes a phone. The list API already withholds the phone unless the viewer is a manager or the assigned agent.

Filters that the list API already understands stay: text search, intent, stage, location, follow-up due. On a phone they open in `ReFilterSheet`. Pipeline view uses the existing eight stages. Mobile shows one stage at a time. Desktop keeps the columns. Nothing is dragged between columns.

If `total` is greater than the returned page, a notice says the page is incomplete. The list route does not read a page size, so the directory cannot ask for more than the service default.

## 7. Customer profile and multiple searches

There is no separate contact-profile route. The customer view is the search detail plus the other searches for that contact.

The detail loads `GET /buyer-searches?contactId=`. Each other search is its own link, with intent, location, budget, and stage. Opening one does not rewrite another.

The directory card states the count. The desktop table repeats the customer name on each search row instead of collapsing the requirements into one line.

## 8. Buyer search detail

`BuyerSearchDetail` is the workspace for `/sales/buyers/[searchId]` and `/client/buyers/[searchId]`.

The header names the customer and the search, shows buying or renting, the stage, and the created date when the record has one. The primary action is **Find matching properties**. Edit requirements, follow-up, stage, and schedule viewing sit in the more-actions menu.

From the `layout` breakpoint (1100px) the page is a main column and a side rail. On a phone the rail comes first: who the customer is, the next follow-up, and the current stage. Requirements, matches, considered properties, viewings, offers or applications, and activity follow.

The rail shows the phone only when the bundle includes it, with Call and WhatsApp. Counts for recommended-or-sent interests, completed viewings, and offers that are not rejected, withdrawn, or expired are counted from that bundle. They are not a lead score.

## 9. Requirements form

Requirements are read as facts: intent and type, location, budget (with the record currency when it exists), and bedrooms. **Additional search requirements** expands bathrooms, timeframe, move-in, lease length, features, notes, and the above-budget flag when those values exist. It does not open an empty dialog.

**Edit requirements** opens a sheet. Save still patches the search: budget, locations, bedrooms, bathrooms, timeframe, notes, allow-above-budget, categories when they changed, and lease months plus move-in date on a rental search. Those fields already exist on the patch schema.

Create search remains a sheet (`ReSheet`, full screen on a phone, drawer from `md`). Name and buy-or-rent are enough. Property type, suburb, budget, bedrooms, and an optional follow-up are progressive. A 409 with duplicates stays in the sheet: use the existing contact, or create a new one with `confirmNewContact`. Contacts are not merged automatically. The assigned-agent field is not on the create schema, so the form does not pretend to assign someone.

## 10. Stage selection

**Change stage** opens a bottom sheet. Choosing an active stage patches `pipelineStage` only. Pause and close ask for a reason and send it as `closureReason`. The stage change does not create a viewing, an offer, or a transaction, and it does not touch another search.

## 11. Property matching

`MatchingWorkspace` is `/sales/matching` and `/client/matching`.

Two directions, both already on `GET /matching`:

- Find properties for a customer (`searchId`)
- Find buyers for a property (`listingId`)

The raw id boxes are gone. Active searches come from the buyer-search list. Available listings come from `GET /listings?status=available&limit=80`. Each chooser is a searchable bottom sheet. Picking a row runs the existing match request.

Results are one-column cards on a phone and two columns from `md`. A missing photo is a neutral “No photograph” block, not a generated image. Price is the recorded number. Currency is not invented when the match payload has none.

If the matcher returns `notice` or `incomplete`, that text is shown. An empty result says no suitable properties were found and links to listings. It does not say every match was found.

## 12. Match explanations

Strength is shown as Strong match, Partial match, or Alternative, from the matcher’s `strength`. `score`, when present, is labelled **Match score** and the copy says it is not a chance of closing. Reasons are the `reasons` array from the API. The detail sheet is titled from the property and lists those reasons. The UI does not write its own “different suburb” or “above budget” lines.

## 13. Reverse buyer matching and privacy

Buyer results show the contact name and phone only when the match payload includes them. Otherwise the card says **Matching buyer search** and names the managing agent. **Request introduction** posts `{ action: "introduction", listingId, searchId }`. After a successful post the card says **Introduction requested**. A refusal, including a declined introduction, is the API error. The button does not invent a second request flow.

An agent who can already see the search gets **Open search** instead of an introduction request, which is the previous rule (`canRequestIntroduction` is false when the contact is visible).

## 14. Property interests and rejection sheets

Interest labels use the existing states: Matched, Recommended, Sent, Interested, Not interested, Viewing requested, Viewing completed, Offer.

**Not interested** opens **Why isn't this property suitable?** The property is not rejected until a reason from `REJECTION_REASONS` is chosen and **Save feedback** is pressed. Other can include a note, which the interest action already accepts. The mutation is still `{ action: "interest", state: "not_interested", rejectionReason }` for this `searchId` only.

## 15. Recommendation interface

**Recommend property** opens a confirmation that names the customer and the property and states that the action records a recommendation and does not send WhatsApp. Confirm posts `state: "recommended"`. A recommended interest is labelled as recorded here, not as sent. **Sent** is shown only when the stored state is `sent`.

## 16. Viewings workspace

The salesperson route `/sales/viewings` uses `SalesViewingsList`.

Header: **Property viewings**. New appointments are not created from this list, because a viewing has to stay tied to a search. The header links to buyers and tenants.

The list is appointment cards: time, property, date, customer name as returned (already masked by the API), status, and confirmation as separate badges. Outcome, when stored, is a third badge with a readable label. Filters are Upcoming, Today, Completed, Cancelled, and All, applied to the loaded rows. If the API sets `incomplete`, the page says the filters only cover what loaded.

The manager route `/client/viewings` is still `CompanyViewingsPage`. It already has team tabs, a detail panel, scheduling, and contact masking. It was not restyled in this pass.

## 17. Scheduling and rescheduling

On the search, **Schedule viewing** is a sheet: property (from matches and non-rejected interests), date and time, instructions. It posts the existing `viewing` action with `confirmOverlap: false`. If the API returns a 409 with `warning`, the sheet shows that warning and offers **Change time** or **Continue anyway**. Continue anyway resubmits the same body with `confirmOverlap: true`. A duplicate-viewing 409 that has no warning is shown as an error, not as an override.

**Reschedule** on the search uses `reschedule_viewing`, which updates the same viewing. On the salesperson list, reschedule uses `PATCH /viewings?id=` with `scheduled_at` and `confirm_overlap`, which is the access-checked viewing update and also keeps the same row. Neither path creates a second viewing or sends a customer message.

Cancel on the salesperson list asks for a reason and sends `status: "cancelled"` with `cancel_reason`. Confirm sends `confirmation_status: "confirmed"`. Both are hidden when `access` is `listing_only`, matching `canChangeViewing`.

## 18. Viewing feedback

**Record viewing outcome** opens a grouped radio list of `VIEWING_OUTCOMES` with readable labels: interested, considering, second viewing, wants to make an offer, too expensive, location unsuitable, property condition, not interested, did not attend. Save posts `viewing_outcome` once. The search screen does not send a second rejection mutation. After a save, wants-to-offer and second-viewing show a next step the agent can take. They do not create an offer or another viewing.

Listing-only viewers can attempt outcome recording. If the service refuses, the error is shown.

## 19. Offers and deals

`/sales/offers` and the company offers page still render `OffersWorkspace` and `OfferDetailPanel`. Those already provide:

- status tabs (active, awaiting seller, negotiating, accepted, closed)
- a desktop table and a phone card list
- `formatOfferMoney` with the offer currency
- create, submit, revise, counter, withdraw
- accept confirmation that says acceptance may mark the property Under Offer and is not a completed sale
- reject with a reason
- **Open transaction workspace** when a transaction exists

This phase did not replace that workspace. The sales page subtitle and a line under the tabs now say an accepted offer is not a completed sale.

Search detail lists the offers returned on the bundle (status, currency, amount) and links to the offers workspace. It does not mark an accepted offer as a completed sale.

## 20. Offer negotiation history

Unchanged. `OfferDetailPanel` already lists the recorded offer events with actor, amount, and note. This phase did not rewrite that timeline or merge events into a generated story.

## 21. Offer acceptance and rejection dialogs

Unchanged, apart from the existing accept copy already stating this is not a completed sale. Accept and reject remain confirmation sheets in `OfferDetailPanel`, not three-dot toggles. Rejecting an offer is not wired to closing the buyer search.

## 22. Rental applications

Rental-only blocks stay on a rental search. The application sheet posts `rental_application` and states that submission does not mark the property let. Status labels are Submitted, Under review, Accepted, Declined.

Deposit labels are distinct: **Deposit expected** (neutral), **Deposit reported** (warning), **Deposit verified** (success). The copy says a reported deposit is not verified cash. **Report deposit** posts `depositAction: "report"`. **Mark deposit verified** is rendered only on the manager search page (`canVerifyDeposit`). The salesperson page does not show it. There is no application accept/decline action in the buyer-sales API, so the UI does not invent one.

## 23. Manager demand reporting

On the matching page, **Buyer demand insights** loads `buyer-reports?report=demand`. A 403 says the gaps are visible to managers. The definition string from the API is shown. Each gap card uses location, intent, property type, search count, distinct contacts in that group, eligible listings, and unmatched searches. People are not summed across groups, because one person can appear in more than one group. If `incomplete` is set, the page says the scan stopped at the existing limit. **View property opportunities** links to acquisitions. It does not create an opportunity.

## 24. Three-dot menu system

Menus use `ReActionMenu`: anchored dropdown on desktop, bottom sheet on a phone, with `stopPropagation` so the row does not also navigate.

- Customer: open the lead search, find properties, call and WhatsApp only when a phone was returned
- Search: edit requirements, add follow-up, change stage, schedule viewing
- Match: explanation, open listings, mark interested, not interested, schedule viewing
- Viewing: details, and for full access confirm, reschedule, and cancel; record outcome for the loaded row

Destructive cancel is separated in the menu. Actions that the current access cannot perform are omitted rather than left dead.

## 25. More details and detail drawers

Additional requirements expand in place. Match explanation, recommend confirmation, rejection, stage, requirement edit, viewing schedule, reschedule, outcome, and rental application each use one `ReSheet`. A second sheet replaces the first. There is no generic More information button.

Property links go to the listings index for the same area as the offers link (`/sales/listings` or `/client/listings`). The match payload does not include a per-listing route, so the UI does not invent one.

## 26. Filters

Buyer directory filters are the query params the list route already applies. Phone: search field plus a filter sheet with Clear and Apply. Desktop: the same controls inline.

Viewing filters are client-side on the loaded page and are labelled as such when the response is incomplete.

Matching uses the search or listing chooser rather than extra match-strength filters, because the match route does not accept those filters.

Offer filters remain the ones already in `OffersWorkspace`.

## 27. Mobile UX

Directory cards, match cards, and viewing cards are single column, with wrapping names and 44px targets. Create, edit, stage, rejection, outcome, schedule, and choosers use `ReSheet`, which is full screen on a phone and a drawer from `md`, with safe-area padding on the footer. The pages add bottom padding for the existing sales bottom navigation. They do not render a second bar.

The desktop buyer table is `hidden` below `md`. Pipeline columns are `hidden` below `md`; the phone shows one stage.

## 28. Accessibility

Sheets keep the existing dialog role, label, focus trap, and Escape handling. View switches and stage chips use `aria-pressed` or tabs. Icon menus have names that include the record. Status is a text badge, not colour alone. Form fields have visible labels. Overlap warnings use `role="alert"`.

## 29. Backend functionality preserved

No migrations, RLS, matcher, offer transitions, listing availability, commissions, WhatsApp sending, auth, or other industries were edited.

Calls that remain as they were:

- `POST /buyer-searches` including duplicate confirmation
- `PATCH /buyer-searches/:id` for requirements, stage, closure reason, and follow-up
- `POST /buyer-sales/actions` for interest, viewing, reschedule, viewing outcome, rental application, deposit, and introduction
- `GET /matching` for both directions
- `GET /viewings` and `PATCH /viewings?id=`
- `GET /buyer-reports` for operations and demand
- `GET /listings?status=available`

## 30. Lightweight tests executed

IDE diagnostics were read for the edited buyer, matching, viewing, inbox, offers, and sales page files. No issues were reported.

`.hallmark/log.json` was parsed with Node. It is valid JSON.

## 31. Tests not executed

Not run, by the machine limit on this phase:

- `npm run build`, `next build`, `vercel build`
- `npm run dev`, `next dev`, localhost
- full-project TypeScript
- full-project ESLint
- test suites
- Docker or local Supabase
- a browser pass
- a Vercel deployment

Visual QA is for the Vercel deployment.

## 32. Known limitations

- The buyer list route ignores a page size. The directory and the matching search chooser show one page and say so when `total` is larger.
- The listing chooser is the first 80 available listings from the listings API. A listing that is available but not approved still appears; the matcher returns its own notice when the listing is not live.
- There is no contact profile URL. Other searches are links on the open search.
- Create search cannot assign an agent. That field is not on the create schema.
- Match cards do not prefix a currency symbol when the match listing has no currency.
- Open property goes to the listings index, not a listing-id route.
- Application accept and decline are not in the buyer-sales actions, so they are not buttons.
- Manager viewings, offer creation, and offer negotiation history were already built and were not redrawn.
- The inbox buyer actions still link to `/sales/buyers` and `/sales/matching`. The messaging layout was not redesigned.
- Scheduling from the viewing list is intentionally absent. Appointments start from a search.

## 33. Manual Vercel visual QA checklist

- Buyers directory at 360px and at desktop: metrics, customer cards, desktop table, filter sheet, create sheet, duplicate-contact choice.
- A customer with two searches: the count on the card, two desktop rows, and separate links on the search.
- Search detail on a phone: name, requirement, and next action before the match list. Stage sheet does not create a viewing.
- Edit requirements and confirm the saved budget and locations.
- Matching both ways. A capped result shows the API notice. A masked buyer shows no phone and offers Request introduction.
- Recommend confirmation does not mention a sent message. Not interested requires a reason.
- Schedule a viewing, hit an overlap warning, change the time, and only then continue if the warning is real.
- Record a viewing outcome and confirm no second viewing or offer appears by itself.
- Offers: accepted still reads as accepted, and the transaction link is the existing one.
- A rental search: application copy, and deposit expected / reported / verified look different. Verify is absent for a salesperson.
- Manager demand cards, and the acquisitions link, do not create an opportunity.

## 34. Phase 4 UI readiness

The buyer, match, and salesperson viewing screens now share the Phase 1 header, section, sheet, menu, and empty-state components. A later UI phase can restyle listings or transactions with those same pieces without reworking these flows.

Leave the WhatsApp Sales Hub for its own phase. This phase only aligned the buyer-search controls inside the existing conversation rail and kept “record a recommendation” separate from “send a message.”
