# Real Estate UI/UX Redesign — Phase 2
## Property Acquisition

Frontend only. No migrations, API routes, stage rules, mandate rules, offer, transaction or commission code was changed. No build, dev server, full typecheck, full lint, Docker, local Supabase, push or deploy was run.

---

## 1. Hallmark skill use

- Read `.cursor/skills/hallmark/SKILL.md` and the redesign verb in `references/verbs/redesign.md` before editing.
- `design.md` is the locked system. Phase 1 already set app pages to Workbench, modern-minimal, Segmiq sales tokens. This phase does not pick a new theme, font or accent.
- New acquisition screens carry the Hallmark stamps used in Phase 1.
- `.hallmark/log.json` has a new first entry for this phase.
- Anti-slop: no hero, no lime-filled panels, no decorative gradients, no invented metrics, no fake agent names. Lime stays on the primary create/approve actions via the existing button style.

## 2. Design foundation reused

Phase 1 primitives, unchanged:

- `RePageHeader`, `ReSection`, `ReStatCard`, `ReMetricGrid`
- `ReStatusBadge`, `ReWorkItem`, `ReRowAction`, `ReEmptyState`, `ReErrorState`, `ReSkeletonRows`, `RePartialNotice`
- `ReSheet`, `ReFilterSheet`, `ReDetailList`
- `ReActionMenu` (desktop dropdown, mobile bottom sheet)
- `--re-*` tokens and `.re-focus` from `app/globals.css`
- `salesMenuTriggerClass` for primary and secondary buttons

Sales pages set `showDefaultHeader={false}` so the shell title and the page header are not stacked. Client pages already hide the shell header.

## 3. Files modified

- `components/real-estate/acquisition/AcquisitionWorkspace.tsx`
- `components/real-estate/acquisition/AcquisitionDetail.tsx`
- `components/real-estate/acquisition/AcquisitionLists.tsx`
- `components/real-estate/acquisition/MandateActions.tsx`
- `app/sales/acquisitions/page.tsx`
- `app/sales/acquisitions/[opportunityId]/page.tsx`
- `app/sales/owners/page.tsx`
- `app/sales/inspections/page.tsx`
- `app/sales/mandates/page.tsx`
- `.hallmark/log.json`

Client routes (`/client/acquisitions`, `/client/owners`, `/client/inspections`, `/client/mandates`) already render these same components. They pick up the redesign without route edits. Manager detail still passes `canReview`.

## 4. Components created

- `components/real-estate/acquisition/acquisition-ui.tsx` — shared field classes and labels for intent, stage, price type, inspection status and mandate status, plus a client-side call to the existing `assertStageChange` / `isMandateCurrentlyValid` / `conversionDecision` helpers.

No second visual language and no new backend module.

## 5. Opportunity list design

`AcquisitionWorkspace` is the list for both agent and manager.

- Header: **Property opportunities**, the specified subtitle, List/Pipeline switch (selected state is near-black, not lime), lime **New opportunity**.
- Summary uses the existing overview only: Active, In progress, Overdue follow-ups, Converted, Lost. If the overview fails, cards show "Couldn't load", not 0. An incomplete overview shows a partial notice.
- Inspections upcoming and mandates awaiting review are not in that overview payload, so they are not shown.
- Desktop: fixed table — property and intent, owner ("Owner not recorded" when empty), stage badge (human labels, not enums), last update, next step with overdue styling, Open plus a menu.
- Mobile: stacked `ReWorkItem` cards, no table.
- Row click opens the opportunity. The menu stops the click.
- Search still hits the existing `q` query on Enter. Stage and intent filters still hit the server. On small screens they move into `ReFilterSheet` (Clear / Apply). Closing without Apply keeps the previous filters.
- Empty, loading skeleton and error-with-retry states. A failed list is not shown as an empty list.
- The assigned-agent column is omitted. The list payload has an agent id and no name. A raw id would not be a useful cell.

## 6. Pipeline design

- Desktop: one column per existing acquisition stage, about 272px, count, compact cards (place, owner, intent, next step). The board scrolls sideways. The page does not.
- Only `status === "active"` cards sit in columns, which is the previous rule.
- Mobile: a horizontal stage chooser with the stage name and count. The page shows cards for the selected stage only. Ten columns are not rendered on a phone.
- No drag-and-drop. The previous board was links only, and dropping a card onto Mandate secured must not create a mandate. Stage changes stay on the opportunity, through the existing action.

## 7. Opportunity detail redesign

`AcquisitionDetail`, same props. Agent (`canReview` false) and manager (`canReview` true) share the layout. Manager-only mandate decisions and the listing exception stay gated by `canReview`.

- Back link, location as the title, stage badge, intent, reference.
- One primary action that depends on the current stage and uses an existing path: Record contact, Continue inspection (scrolls to the form), Discuss mandate, Record price, Prepare listing, or Open listing when a draft exists.
- Menu: Change stage, Record owner contact, Inspection form, Put on hold, Reopen, Mark lost. Lost asks for a reason in a sheet. Hold and reopen call the existing outcome action.
- Main column plus a side rail from the `layout` breakpoint (1100px). Below that, one column, with the next step near the top.
- Sections: progress, owner (call and WhatsApp only when a phone is already on the record), next step, inspection, pricing, mandate, listing preparation, activity.
- Rail: summary and a "Still missing" list built only from empty phone, empty location, no completed inspection, and no in-date approved mandate.

### Stage control

Change stage opens a bottom sheet. Each stage uses `assertStageChange` with evidence derived the same way the server does (inspection statuses, `isMandateCurrentlyValid`). Blocked stages show the real requirement text. The click still goes to the server, which remains the authority.

`submitted_for_approval` needs the listing's approval status, and that field is not on the opportunity payload. If a listing id exists, that stage stays clickable and the requirement is shown, rather than hiding a move the server might allow.

## 8. Property owners redesign

`OwnerList` on `/sales/owners` and `/client/owners`.

- Header, search across the loaded names (the owners endpoint returns the actor's full set, not a page).
- Cards: name, up to three suburbs from the linked opportunities, property count, active count.
- View opens a detail sheet of that contact's opportunities (location, intent, status, open). Call and WhatsApp only when `owner_phone` is on one of those rows.
- "New opportunity" goes to `?new=1`. It does not pretend the owner is pre-attached. The create API has no contact-id field on this form.
- `?contactId=` still opens that owner, which the old list linked to and then ignored.
- Empty copy explains that owners come from opportunities.

There is no separate owner profile API. The sheet is the grouping the endpoint already returns.

## 9. Inspections redesign

`InspectionList`. No New inspection button. Creation still happens on an opportunity, and the empty state says so and links there.

- Filters on the loaded rows: All, Upcoming (scheduled, confirmed, rescheduled), Completed, Cancelled, Needs attention (incomplete, or an upcoming status whose scheduled time is already past).
- If the API reports `incomplete`, a notice says the list may be short, so the filter is not treated as the full agency.
- Desktop table and mobile cards. Unfinished inspections (draft, in progress, incomplete) use **Continue**, which opens the opportunity where the form lives. The list payload has no owner name, so owner is not invented.
- Errors are shown with retry. A failed load is not an empty list.

## 10. Mobile inspection and photo experience

On the opportunity, the inspection is one form so jumping sections cannot drop what was typed.

- A horizontal section chooser jumps to Property, Details, Utilities, Condition, Photos, Documents, Notes.
- Labels are visible. Bedrooms and bathrooms use a numeric keyboard. Amounts use a decimal keyboard.
- Save inspection is explicit. There is no autosave. The save body is unchanged, including not sending an inspection id, so saving still follows the previous create/update path.
- Photos: "Take or upload a photo" uses `accept="image/*"` and `capture="environment"`. The file input is disabled while an upload is in flight. The new photo is not shown until `photo` action succeeds and the record reloads.
- Gallery: 2 columns on a phone, 3 from `sm`, 4:3 crop, full-size preview in a sheet. Images use the existing authenticated company-document download URL. There is no remove action because no delete-photo route exists. Photos still attach to the latest inspection, as before.
- A caption-only row is shown when a photo has no document id, instead of a broken image.

## 11. Pricing history

- Section title **Pricing and valuation**, with the latest figure labelled by price type (owner asking, informal estimate, professional valuation, proposed marketing, agreed listing). Currency is the value stored on the row.
- History is a chronological list (API order) with type, amount, date, note, and an evidence line for professional valuations. The copy says an attachment is not a verified valuation.
- The record form is the same payload, including `currency: "USD"` which the previous form always sent. Professional valuation still asks for a report or a valuer reference. The server still rejects unauthorised staff.

## 12. Mandate review and renewal

List (`MandateList`) and the actions on both the list sheet and the opportunity.

- Header differs for a manager (`canReview` from the API) and an agent.
- Filters on the loaded rows: Pending review (the previous "needs attention" set), Active, Expiring, Expired, Rejected or revoked, Legacy unverified, All. `expiring_soon` is the computed display status from the API, not a stored status. An incomplete load is called out so filters are not described as complete.
- Desktop table and mobile cards. Review opens a detail sheet: type, dates, evidence wording that does not call the file legally valid, then the actions.
- Approve is a two-step confirmation on the record, not a bare link. Reject still requires a reason. Renew is the same renewal form (new mandate, previous dates shown, evidence, submit flag). Revoke opens a sheet that names the effect and requires a reason and effective date.
- Agents do not see approve, reject or revoke. Those flags are unchanged (`canReview`, renewable, revocable).

## 13. Listing preparation

Uses the existing `conversionDecision` helper.

- No listing and no valid mandate, and the viewer is not a manager: the button is not shown. The section shows the helper's own error, including the manager-exception sentence.
- Manager without a valid mandate: **Prepare listing** stays available and still sends `managerOverride: canReview`.
- A `converted_listing_id` shows **Open listing draft**, not a second create. The sales link remains `/sales/listings`, matching the previous redirect. The manager link remains `/client/listings/{id}`.
- Opportunity status `converted` (set when a listing is approved) shows **Listing approved** and does not say the property is on the market.

## 14. Follow-up UI

The next step on the opportunity is `next_action_at`. Overdue uses the same timestamp comparison as the overview. It is shown near the top of the detail and on list/pipeline cards.

There is no separate follow-up task endpoint. **Record contact** is the existing `contact` action. The sheet can set a note, a next time, and "owner is interested". The copy says this marks the owner as contacted, because that action also moves a new opportunity to Owner contacted. It is not labelled as a silent task creator.

Activity history lists the existing events. Completed events stay in the list.

## 15. Three-dot menu behavior

`ReActionMenu` from Phase 1: anchored dropdown on desktop, bottom sheet on mobile, Escape and focus handling from that component, click stopped on the wrapper.

- Opportunity list: Open, Put on hold, Mark lost (reason sheet). Hold and lost are hidden as disabled once the record is already in that state or converted.
- Opportunity detail: the menu in section 7. The primary action stays outside the menu.
- Owner: View, New opportunity, and Call / WhatsApp only with a phone.
- Inspection rows use a visible Open or Continue. A menu is not added for reschedule or cancel because those are fields on the inspection form, not list endpoints.
- Mandate cards: View mandate, and Open opportunity when an opportunity id exists. Submit, renew and revoke stay on the detail sheet so they are not fired from a one-line menu.

## 16. Detail drawer behavior

`ReSheet` drawer (about 500px on desktop, full height on a phone) for owner properties, mandate review, and photo preview. Stage change, new opportunity, record contact, mark lost, revoke, and mobile filters use the bottom placement. Footers hold the decision buttons so they are not buried in the scroll.

## 17. Filter behavior

- Opportunities: stage and intent are server filters. Mobile uses Apply / Clear. Search is unchanged (Enter sends `q`).
- Inspections and mandates: filters run on the rows the endpoint already returned, with an incomplete-data notice when the API says the set is partial. They are not described as server-side slices.
- Owners: name search on the loaded list.

## 18. Desktop responsive design

- Lists become tables from 768px. Below that, cards.
- Opportunity detail becomes 8/4 columns at the 1100px `layout` breakpoint.
- Pipeline columns scroll inside their own row.
- Forms use two or three columns from `sm` and one column below that.
- Page shells use `min-w-0` and `overflow-x-clip` so a scrolling pipeline cannot drag the whole page sideways.

## 19. Mobile responsive design

- Page padding includes the sales bottom-nav height plus a little extra, so the last row is not covered.
- Touch targets on filters, section jumps, row actions and form buttons are at least 44px.
- New opportunity, stage change, contact, lost and revoke are sheets, not a 550px dialog.
- Inspection sections are a sideways chip row. The form itself is one column.
- Photo grid is two columns. Preview uses `object-contain` and a max height.
- Mandate decisions sit in the sheet, with approve and reject visually distinct.

This was checked in source only. It has not been opened in a browser.

## 20. Backend and permission preservation

Unchanged: acquisition services, stage evidence rules, mandate review/renew/revoke services, listing conversion, document upload (`presign` plus company-document storage), idempotency key on create, duplicate-contact confirmation, salesperson vs manager route guards.

The UI calls the same endpoints:

- `GET/POST /api/clients/{id}/acquisitions` and `/overview`
- `GET /acquisitions/{opportunityId}`
- `POST /acquisitions/{opportunityId}/actions` with the same action names and bodies
- `GET /owners`, `GET /inspections`, `GET/POST /mandates`

`canReview` still comes from the mandate list response and from the manager detail page. Agent pages still pass `canReview={false}`.

## 21. Lightweight tests run

IDE diagnostics (`ReadLints`) on the acquisition components and the four edited sales pages: no errors.

No `tsc`, lint, unit tests, browser pass, or production build.

## 22. Known limitations

- Assigned agent names are not on the opportunity list, so the column and any reassignment picker are omitted. Reassign exists on the server and needs an agent id this screen does not have a directory for.
- Recording a contact is the only way to set the next step, and it updates contact state.
- Saving an inspection does not target an existing inspection id. Continuing an inspection opens the form; saving follows the previous request.
- Photos attach to the latest inspection. There is no delete.
- New price rows still send currency `USD`, as the old form did. History shows each row's own currency.
- Owner "New opportunity" does not prefill the contact.
- Stage "Submitted for listing approval" cannot know the listing approval status until the server answers.
- Inspection and mandate filters are only as complete as the loaded payload.
- Sales listing open still goes to `/sales/listings`, not a specific draft URL. That was the previous redirect.
- No visual check on a phone or in either theme.

## 23. Manual Vercel preview testing checklist

Agent (`/sales/...`) and manager (`/client/...`):

- [ ] Opportunities: summary matches the old counts; a failed overview shows "Couldn't load".
- [ ] Search, stage and intent change the list. Mobile Apply applies; closing the sheet does not.
- [ ] List row opens the record. The menu does not. Hold and lost behave, and lost requires a reason.
- [ ] Pipeline: desktop columns scroll on their own. Phone shows one stage at a time.
- [ ] New opportunity from the button and from `?new=1`. Duplicate contact warning still appears. Success opens the new record.
- [ ] Detail: primary action matches the stage. Change stage shows a requirement and the server still rejects a stage without evidence.
- [ ] Call and WhatsApp only when a phone exists.
- [ ] Record contact sets the next step and, on a new opportunity, moves the stage to Owner contacted.
- [ ] Inspection save, section jumps, and photo upload. A failed upload shows an error and no fake thumbnail. Preview opens and closes.
- [ ] Price history labels stay distinct. A professional valuation without evidence is rejected by the server.
- [ ] Mandate list filters. Manager can approve (confirm step), reject with a reason, renew, and revoke. Agent cannot see those decisions.
- [ ] Prepare listing is blocked without a mandate for an agent, and still available as the manager exception. An existing draft opens instead of creating another.
- [ ] Owners search, owner sheet, and `?contactId=` deep link.
- [ ] 360px and 390px: no page-level sideways scroll, bottom nav does not cover the last action, sheets clear the home indicator.
- [ ] Trades or Solar company: these routes still redirect away. Dashboards from Phase 1 are unchanged.

## 24. UI Phase 3 readiness

Buyer and tenant sales can reuse `RePageHeader`, `ReSection`, `ReWorkItem`, `ReSheet`, `ReFilterSheet` and `ReActionMenu` the same way.

Do not treat acquisition inspections as viewings. The inspection list is labelled as assessments. Viewings should keep their own records and a visibly different empty state.

Phase 4 owns the property register. This phase only links an opportunity to the existing listing draft or approved listing.
