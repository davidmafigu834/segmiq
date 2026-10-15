# BSA Mobility demonstration — implementation report

Date: 14 October 2026

This report describes the vehicle-hire demonstration template added to the existing SegmiQ Demo Engine. It does not enable guest access, and it does not create a BSA Mobility workspace row in the shared database.

## 1. Business understanding and information sources

BSA Mobility Solutions is treated as a Harare executive-mobility, luxury vehicle-hire, and chauffeur business. The demonstration uses the positioning supplied for this work: “The Apex of Motion.”

Sources used:

- The implementation brief, including the published marketing examples and the public company reference `https://zw.linkedin.com/company/blackwood-strategic-advisory`.
- A fetch of `https://www.bsamobility.co.zw/` during this work. The returned homepage was thin: it presented premium car rental, chauffeur and self-drive, and a contact phone. It did not provide a fleet register, a current price list, availability, insurance terms, deposits, or staff names.
- LinkedIn was not used as a staff directory. The two salesperson names in the demonstration are fictional placeholders.

Published marketing examples used only where the brief identified them:

- Mercedes-Benz E400 standard hire: USD 200 per day.
- Mercedes-Benz E400 unlimited-mileage option: USD 300 per day, recorded as an advertised alternative and not used as a line item.
- Pickup or drop: USD 50 per trip.
- Mercedes-Benz C-Class: advertised from USD 149.99. The pricing unit is unconfirmed, so the demonstration does not multiply that figure. Those quotations stay at price on request.

No fleet registration numbers, insurance terms, deposits, driver assignments, or date-specific availability were invented. Vehicles are not described as confirmed for a date. Figures that are not those published examples are labelled illustrative demonstration figures, or the record is price on request. Catalogue stock is 0 so the product list does not imply a vehicle is free.

The demonstration does not use BSA’s real phone number, and it does not include a generated logo. No logo file was added.

## 2. Demo architecture and reuse of the existing engine

The template sits inside the existing demo provider. It does not add a second application, production CRM tables, or a new industry enum.

Identity:

- Industry: `vehicle_hire`
- Scenario: `bsa_mobility`
- Slug reserved for a future workspace row: `bsa-mobility`
- Timezone: `Africa/Harare`
- Id prefix: `bsa`

Relevant pieces:

- `lib/demo/template-catalog.ts` holds template identity only. It does not import dataset builders, so Middleware does not load Node `crypto` through demo id generation.
- `lib/demo/provider.ts` selects `buildRossiDataset` or `buildBsaDataset`.
- `lib/demo/industries/vehicle-hire/bsa/` holds the BSA identity, dataset, and company-brain snapshot.
- Guest redemption uses the template’s default persona (`tariro` for BSA, `tinashe` for Rossi).
- Invitations may be created for any registered template, but only for a client whose `workspace_mode` is already `demo`. There is no BSA `clients` row, so an invitation cannot be issued yet.
- Company brain loading returns the BSA snapshot for `vehicle_hire` / `bsa_mobility`. An unknown demo workspace returns an empty fictional snapshot and does not fall through to Rossi or to production brain tables.
- Deal stages stay `QUALIFIED`, `SCOPING`, `PROPOSAL_SENT`, `NEGOTIATING`, `WON`, and `LOST`. Vehicle-hire labels are applied only in demo views. Rossi labels are unchanged.

Dates are relative to the current Africa/Harare day, using the existing demo date helpers.

## 3. Fictional team structure

Exactly two salesperson personas:

| Persona | Role in the demo | Work |
| --- | --- | --- |
| Tariro Dube | Salesperson | Airport transfers, corporate hire, executive chauffeur, repeat corporate accounts |
| Munashe Moyo | Salesperson | Luxury hire, weddings and events, SUV hire, premium enquiries |

An additional **Owner view** persona uses the existing client-manager role. It is an overview seat for the demonstration. It is not counted in salesperson performance, and it is not a claim that BSA employs a separate manager.

Each salesperson dashboard is filtered to that person’s leads, deals, tasks, and activities. The owner view sees both. Contact emails are null. Phones are non-routable `+263000…` numbers.

## 4. Vehicle and service catalogue

Catalogue rows are demonstration products, not a live fleet.

| Item | Demonstration price treatment |
| --- | --- |
| Mercedes-Benz E400 | Published example, USD 200 per day |
| Airport pickup or drop | Published example, USD 50 per trip |
| Mercedes-Benz C-Class | Price on request. Advertised “from USD 149.99” is noted, and the unit is not assumed |
| Toyota Prado | Price on request |
| Toyota Hilux Travo Overland Plus | Price on request in the catalogue. One open quotation uses a labelled illustrative day figure |
| Bentley Bentayga | Price on request in the catalogue. The wedding draft uses a labelled illustrative figure |
| Rolls-Royce Phantom | Price on request. No amount is stored |
| Cooler box | Optional add-on, no price |
| Child seat | Optional request, no price |

Stock is 0. Descriptions state that availability is not confirmed.

## 5. Sample enquiries and opportunities

The dataset is 28 fictional enquiries: 16 qualified opportunities and 12 enquiry-only leads. Of the 16 opportunities, 5 are confirmed fictional bookings, 2 are lost, and 9 remain open. Seven quotations exist. Dashboard totals are derived from these records and from the visitor’s session mutations.

Named journeys:

| Journey | Customer | Salesperson | Stage label | Commercial treatment |
| --- | --- | --- | --- | --- |
| A | Ruvimbo Ncube | Tariro Dube | Quote sent | BSA-1042. Two published E400 days at USD 200 plus one published pickup at USD 50. Total USD 450. Follow-up is due before the requested arrival. Availability is not confirmed |
| B | Tariro and Brian M. | Munashe Moyo | Availability check | BSA-1039 is a draft. Illustrative wedding-day figure, not a published rate. Venue time and chauffeur preference are still open |
| C | Mavambo Consulting | Tariro Dube | Follow-up | BSA-1036 sent. Illustrative premium-SUV quotation. Approval deadline is overdue |
| D | Farai Nyathi | Munashe Moyo | Follow-up | BSA-1033 sent. Four-day Hilux comparison, cooler box at no price. Customer is still comparing |
| E | Lumen Event Studio | Munashe Moyo | Availability check | Rolls-Royce Phantom. Estimated value is empty. Waiting on organiser approval |
| F | Northgate Advisory | Tariro Dube | Trip details collected | Repeat account. Earlier fictional airport booking is won. A new arrival-time enquiry is open and not yet quoted |

Other open work includes a Prado availability check, a C-Class price-on-request draft, and a viewed illustrative SUV quotation. Lost reasons are “Price” (Allan Pfende) and “Travel date no longer required” (Blessing Hove). Twelve further enquiries cover unanswered WhatsApp, delayed callbacks, comparison shopping, and requests that are not ready to book.

Confirmed fictional bookings, all in the current demonstration month:

- Chipo Mare, one published E400 day, USD 200.
- Northgate Advisory, four earlier airport trips at the published USD 50 example, USD 200 total.
- Simba Moyo, one published pickup, USD 50.
- Kudzi Ndlovu, Hilux booking, illustrative USD 360.
- Harare Chamber Dinner, evening chauffeur, illustrative USD 180.

Won values are stored on the deal records. They are not a separate hardcoded dashboard total.

## 6. Simulated WhatsApp scenarios

Ten conversation threads are stored in the fictional dataset, including the Ruvimbo exchange from the brief. Each thread starts with a system line stating that it is a simulated demonstration and that nothing was sent to a real phone.

The guest allowlist does not include the WhatsApp Sales Hub. A guest therefore cannot open the inbox. The deal page, which a salesperson guest can open, shows enquiry activity and the quotation, and demonstration mode hides the live WhatsApp action. Simulated replies are not implemented as a guest action. No Meta Cloud API call, QR pairing, or message to a real number is made.

## 7. Quotation and follow-up capability

Quotations reuse the existing quotation shape. Every BSA quotation note says it is a fictional demonstration. Terms state that availability, insurance, deposits, and driver assignment are not confirmed. There is no PDF, public token, or send action.

Follow-ups are records on the dataset, with relative due dates:

- Ruvimbo quotation follow-up, due today.
- Mavambo approval call, overdue.
- Bentley availability confirmation, due today.
- Farai comparison follow-up, overdue.
- Northgate repeat-arrival confirmation, due tomorrow.
- Unanswered airport enquiry, wedding-date question, callback, and event-date tasks.
- Completed post-booking notes on the won journeys.

A guest cannot create or complete a task. The mutation log can represent follow-up changes, but no guest API is allowlisted for them, and nothing is written to production task tables.

## 8. Sales pipeline configuration

Existing deal stages, with vehicle-hire labels:

1. New enquiries that are not yet opportunities stay as leads.
2. `QUALIFIED` — Trip details collected.
3. `SCOPING` — Availability check.
4. `PROPOSAL_SENT` — Quote sent.
5. `NEGOTIATING` — Follow-up.
6. `WON` — Booking confirmed.
7. `LOST` — Lost.

There is no separate fulfilment workflow. A guest salesperson can change an allowed deal’s stage. That change is appended to `demo_session_mutations` for that visitor’s session. It does not update production `deals`. The owner view reads the same session-adjusted dataset.

## 9. Dashboard and reporting behaviour

Salesperson and owner dashboards are built from `summariseDemo` and from the visible records.

Computed examples:

- Open pipeline value and won value come from deal records.
- Quotes awaiting a response come from sent or viewed quotations.
- Follow-ups due and overdue come from follow-up records.
- Source mix is counted from lead sources.
- Conversion is won bookings divided by won plus lost bookings in this dataset.
- Team rows are Tariro and Munashe only.
- Deals with no price stay in an “awaiting estimate” count instead of being given a number.

No sales quota is invented. Earlier months on the revenue chart are 0 because this dataset is a single 30-day window. The workday clock on the salesperson plan is a fixed demonstration label, not a live clock.

The owner opening copy, when the guest status payload includes the template intro, is:

- BSA Mobility Solutions
- “Your sales operations, organised in one place.”
- “Explore how your two-person sales team could manage enquiries, quotations, follow-ups and bookings using SegmiQ.”

The workspace chip continues to say “Fictional demonstration.” Lead scores are priority bands inside the demonstration. They are not predictions.

The manager guest can open `/client/dashboard` only. The salesperson guest can open `/sales/dashboard`, `/sales/pipeline`, and `/sales/deals/:id`. Other company pages, including the pipeline and quotation screens linked from some manager cards, remain outside the guest allowlist.

## 10. Implemented guest interactions

These already existed for Rossi and now resolve against whichever registered template the workspace uses:

- Redeem an invitation into an HttpOnly session cookie, when guest access is enabled.
- Land as the template’s default salesperson, or as the owner view if that persona is selected.
- Switch persona inside the same session.
- Reset that visitor’s own mutations.
- Read the allowlisted dashboard, pipeline, and deal.
- Change a deal stage. The write goes to the session mutation log.

Persona switching does not clear the mutation log. Two sessions do not share mutations because each session has its own log, and the dataset is cloned before mutations are applied.

## 11. Unsupported or deferred interactions

- No BSA `clients` row exists. Guest invitations cannot be created until that row is separately authorised.
- Guest access remains off unless `SEGMQ_DEMO_DATABASE=shared`, `SEGMQ_DEMO_SCHEMA=20261012194500`, and `SEGMQ_DEMO_GUEST_ACCESS=enabled`. `SEGMQ_DEPLOYMENT=demo` must stay unset on this shared application.
- WhatsApp Sales Hub is not on the guest allowlist. Simulated replies are not a guest action.
- Creating or sending a quotation is not a guest action. Existing quotations are read-only in the deal payload. `canSend` is false.
- Creating or completing a follow-up is not a guest action.
- The Rossi guest journey has not been verified in a browser. BSA must not be treated as production-ready, and unattended public access must not be enabled.
- This session did not open the BSA screens in a browser.

## 12. Security and isolation verification

Preserved:

- Guest session token hashing, expiry, and revocation.
- Request-scoped guest context.
- Session mutation isolation.
- Pinned workspace lookup.
- The guest page and API allowlist. It was not widened for BSA.
- Production repository guards and integration egress guards.

Isolation intended by the design:

- Rossi ids use the `rossi` prefix. BSA ids use the `bsa` prefix. A unit test checks that the two lead-id sets do not overlap.
- A guest load is refused when the workspace template is not the registered one for that client.
- Unknown scenarios do not materialise a dataset.
- Applying a stage change clones the dataset. A second copy, and the original, stay on the previous stage.
- Fictional deals are not inserted into production `deals`.
- No external provider is called for a simulated message.

The guest-session migration `20261012194500` was not reapplied.

## 13. Test results and build status

Unit tests, run with:

`npx tsx --test tests/demo-bsa-mobility.test.ts tests/demo-workspace.test.ts tests/demo-guest-edge-crypto.test.ts tests/demo-guest-foundation.test.ts tests/demo-guest-journey.test.ts`

Result: 46 passed, 0 failed. That includes the BSA dataset, salesperson isolation, dashboard totals, Rossi behaviour, guest token hashing, and the Middleware crypto check. These are not browser tests.

`tsc --noEmit` was started and produced no result. It was stopped after it sat with no output for about half an hour while the machine was under memory pressure. It is not a pass.

`next build` was not run for these changes. No browser pass was performed.

## 14. Remaining steps before a secure BSA invitation

Do not do these until they are explicitly authorised. Guest access on the shared Vercel deployment stays off until then.

1. Review and insert one fictional `clients` row for BSA Mobility Solutions with `workspace_mode = demo`, `demo_industry = vehicle_hire`, and `demo_scenario = bsa_mobility`. Do not attach real BSA customer records. Do not change any paying customer’s workspace mode.
2. Confirm the three guest flags on the deployment that will serve the link: `SEGMQ_DEMO_DATABASE=shared`, `SEGMQ_DEMO_SCHEMA=20261012194500`, `SEGMQ_DEMO_GUEST_ACCESS=enabled`. Do not set `SEGMQ_DEPLOYMENT=demo`.
3. As a super-admin, with no demo cookie, `POST /api/agency/demos/invitations` with that new client id. Copy the returned URL once. The raw token is not stored.
4. Open the link while signed out. Confirm the chip says BSA Mobility Solutions and “Fictional demonstration,” Tariro’s book does not contain Munashe’s customers, the owner view shows both, and a stage change survives refresh and persona switch but does not appear in a second invitation.
5. Revoke the invitation when the rehearsal ends.

Until step 1 is authorised, BSA cannot be opened through `/demo/<token>`.
