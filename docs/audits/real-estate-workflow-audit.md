# Real Estate workflow audit

Audit date: 5 November 2026. Scope is the current SegmiQ Real Estate application and the proposed client-completed seller, viewing, and offer journeys. This is a product and workflow audit. It does not decide legal, tax, or mandate-clause correctness.

No application code, migration, permission, deployment, or customer record was changed.

## 1. Executive finding

Agents already have persistent records for owners, acquisition opportunities, mandates, listings, buyer searches, property interests, viewings, offers, and transactions. The repeated work is real: the agent types the customer and property facts, uploads a finished file, and later re-enters offer terms. There is no client link that collects a seller mandate, a viewing form, or an offer and then creates those records after review.

The closest client path is the compliance invitation at `/verify/c/[token]`. It is email-and-code access for due-diligence evidence on an existing compliance case. It does not create a seller, a property, a viewing, or an offer. The public property page can accept a viewing *request*, and the server tells the visitor it is not a booked viewing. That request becomes an inquiry, not a `viewings` row and not a buyer search.

The domain model can carry the proposed journeys after review. A new client-request record is needed so a link is bound on the server to one organisation, one responsible agent, one purpose, and the property or search it concerns. Compliance invitations should not be overloaded for mandates and offers. Company, representative, owner, and signer are not separate parties on the acquisition record today. Signed-document snapshots, agency PDF templates, witnesses, and seller-only offer access are missing.

Saving an intake must not be treated as mandate approval, listing approval, a confirmed viewing, offer acceptance, transaction completion, or payment verification. The current code already keeps most of those statuses apart. Two exceptions matter: preparing a listing draft currently requires an approved mandate or a manager exception, and accepting an offer also tries to start a transaction.

Local source is not a safe place to build the next slice until the emptied working-tree files below are restored from the current commit. Those files are empty on disk and still present in `869fbde`.

## 2. Environment and evidence

| Item | Evidence |
|---|---|
| Repository instructions | No `AGENTS.md` at the repository root. README describes Next.js 14, Supabase, and NextAuth. |
| Branch | `feat/real-estate-compliance` |
| Revision | `869fbde991a952de8593848b576e12e0295f89a9` — “Scan compliance documents before a reviewer can open them.” |
| Working tree | Dirty and preserved. It includes a large Android and solar set plus Real Estate edits. This audit did not revert or stage those changes. |
| Application database | `.env.local` sets `NEXTAUTH_URL` to localhost and `NEXT_PUBLIC_SUPABASE_URL` to project `gnnqzboaeezzevlwwryp`. The Supabase account has one project, named `leadstaq`, in `eu-west-1`, status `ACTIVE_HEALTHY`. A local server would read and write that database. |
| What was not run | No dev server, no browser journey, no production SQL against customer rows, no document upload, no WhatsApp or email send, no migration, no permission change, no deploy. |
| Applied database state | Read-only migration list on `gnnqzboaeezzevlwwryp`. Names include `real_estate_vertical`, `real_estate_offers`, `real_estate_marketing`, `real_estate_compliance`, `real_estate_transactions_after_sales`, `real_estate_phase1_foundation` through `real_estate_final_corrections`, `agent_listing_pages`, `re_compliance_management_foundation`, `re_compliance_customer_message`, and `re_compliance_scan_lifecycle`. |
| Migration file not in that applied list | `supabase/migrations/20261022113000_compliance_phase1_safety_baseline.sql` is in the repo and is not in the applied-name list. Its header says it is additive and not auto-applied. |
| Deployed application | Not inspected. Vercel cron configuration was read from `vercel.json` only. |
| Isolated tests | Cursor’s Node ran `tsx --test` on `tests/real-estate-acquisition.test.ts`, `tests/real-estate-offers.test.ts`, `tests/compliance-remediation.test.ts`, `tests/real-estate-phase3.test.ts`, and `tests/real-estate-gating.test.ts`. Result: 64 passed, 1 failed. The failure reads the empty working-tree file `app/api/clients/[clientId]/listings/[listingId]/route.ts` and expects `discoverMatchesForListing`. These tests use in-memory data or source text. They are not a customer-to-reviewer journey. |
| Agency PDFs and DOCX | Not in the workspace and not attached. Comparison of clauses, fees, tax wording, and requested evidence is **unavailable**. |

### Working-tree files that are empty while HEAD still has them

`git rev-parse HEAD:<path>` returns a blob for each of these. The working copies are empty:

- `app/api/clients/[clientId]/buyer-searches/route.ts` — the Buyers screen calls this route to list and create searches.
- `app/api/clients/[clientId]/listings/[listingId]/route.ts` — listing detail writes and match discovery.
- `lib/real-estate/agent-listing-pages/policy.ts` — imported by the public listing service and share routes.
- `components/real-estate/compliance/ContextCompliancePanel.tsx` — imported by owner, buyer, listing, and transaction screens.
- `supabase/migrations/20261103195500_re_compliance_management_foundation.sql` — the local file is empty. The same migration name is already applied on the database, so this is a source-tree problem, not proof that the database lacks the foundation.

Service modules for acquisition, buyer sales, viewings, offers, transactions, and compliance invitations still contain their logic. The empty route and policy files mean the working tree cannot serve those screens even though the services exist.

Local email delivery variables for Resend are present. `COMPLIANCE_CLAMAV_HOST` is not set in `.env.local`. `RE_AGENCY_OPERATIONS` is unset, and `lib/real-estate/feature-flags.ts` treats that as agency operations enabled. Deployed values of those variables were not read.

## 3. Workflow inventory

Roles used by these journeys, from `lib/real-estate/deal-access.ts`: `SALESPERSON`, `CLIENT_MANAGER`, and `SUPER_ADMIN`. Mandate review is limited to an agency manager (`CLIENT_MANAGER` or `SUPER_ADMIN`) in the same organisation (`canReviewMandate` in `lib/real-estate/acquisition-plan.ts`).

### Agent sidebar

`lib/sales/navigation/sales-nav-config.ts` adds Real Estate sections only when the organisation is `real_estate`.

| Label | Route |
|---|---|
| Sales Inbox | `/sales` inbox entry, labelled Sales Inbox |
| Property Opportunities | `/sales/acquisitions` |
| Property Owners | `/sales/owners` |
| Inspections | `/sales/inspections` |
| Mandates | `/sales/mandates` |
| Buyers & Tenants | `/sales/buyers` |
| Introductions | `/sales/buyers/introductions` |
| Property Matching | `/sales/matching` |
| Viewings | `/sales/viewings` |
| Offers & Deals | `/sales/offers` |
| Property Listings | `/sales/listings` |
| My Shared Listings | `/sales/shared-listings` |
| My Transactions | `/sales/transactions` |
| Compliance | `/sales/compliance` |

### Company sidebar

`REAL_ESTATE_COMPANY_NAVIGATION` in `lib/sales/navigation/company-nav-config.ts` mirrors those journeys under `/client/...`, and adds Compliance Centre (`/client/compliance/centre`), Compliance Cases, Reviews, Listing pages, and Documents.

### Persistent model

Names below are the tables in the migrations, not proposed replacements.

| Record | Table | Role in the current product |
|---|---|---|
| Person | `contacts` | Name, phone, email. One person can hold several role rows. |
| Role | `real_estate_contact_roles` | `buyer`, `tenant`, `seller`, `landlord`. Unique per organisation, contact, and role. |
| Opportunity | `real_estate_acquisition_opportunities` | One property pursuit. Optional `contact_id`, agent, intent `sale` / `rent` / `unknown`. |
| Owner inspection | `real_estate_inspections` | Not a buyer viewing. |
| Price history | `real_estate_price_discussions` | Asking, estimate, valuation, proposed listing, agreed marketing. |
| Mandate | `real_estate_mandates` | Type `sole` / `joint` / `open`, dates, evidence status, review status, `document_id`. |
| Listing | `listings` | Agency property register. `approval_status` is separate from market `status`. |
| Listing party | `real_estate_listing_parties` | `owner` or `authorised_representative`. |
| Buyer search | `real_estate_buyer_searches` | One search. A contact may have more than one, except the legacy unique index. |
| Interest | `real_estate_property_interests` | After final corrections, unique per search and listing. |
| Viewing | `viewings` | Appointment. `buyer_search_id`, `confirmation_status`, `outcome`. |
| Offer | `real_estate_offers` plus `real_estate_offer_events` | Amounts, conditions text, expiry date, status history. |
| Transaction | `real_estate_transactions` plus milestones and events | Starts at `pending_compliance`. |
| Compliance | `compliance_cases`, requirements, invitations, evidence versions, related parties | Due diligence. Company directors and beneficial owners live here. |
| Public listing request | `re_listing_public_submissions` | Enquiry or viewing request from a property page. |

`leads.deal_side` can be `buy_side`, `sell_side`, `landlord_side`, or `tenant_side`. `leads.offer_amount` / `leads.offer_status` are a legacy snapshot. The offer service writes the dedicated offer tables and then mirrors a coarse status onto the lead.

### API and services that still contain the journey logic

- Acquisition: `app/api/clients/[clientId]/acquisitions/route.ts`, `.../acquisitions/[opportunityId]/actions/route.ts`, `lib/real-estate/acquisition-service.ts`.
- Buyers: `lib/real-estate/buyer-sales-service.ts`. List/create HTTP route file is empty in the working tree. `app/api/clients/[clientId]/buyer-sales/actions/route.ts` still schedules viewings.
- Viewings: `lib/real-estate/viewing-service.ts`. Public request: `app/api/public/listing-pages/viewing/route.ts`.
- Offers: `app/api/clients/[clientId]/offers/route.ts`, `.../offers/[offerId]/route.ts`, `lib/real-estate/offer-service.ts`, `lib/real-estate/offers.ts`.
- Transactions: `lib/real-estate/transaction-service.ts`.
- Compliance links: `lib/real-estate/compliance-management/service.ts`, `app/api/public/compliance-invitations/route.ts`, `app/verify/c/[token]/page.tsx`.
- Jobs: `app/api/cron/check-followups/route.ts` calls `executeViewingReminders()` and is scheduled in `vercel.json` every minute. `app/api/cron/viewing-reminders/route.ts` and `app/api/cron/compliance-scan/route.ts` exist and are not entries in `vercel.json`.

UI primitives to reuse, present in `components/real-estate/ui/`: `RePageHeader`, `ReSection`, `ReStatusBadge`, `ReActionMenu`, `ReSheet`. Acquisition and buyer create sheets already use them and `sales-*` tokens.

`app/portal/**` is the customer project portal, not a Real Estate form portal. `app/offer/[token]` and `lib/cloud/render-project-pdf.ts` belong to platform sales and project PDFs, not agency offer letters.

## 4. Current journeys

### 4.1 Seller acquisition

**Entry.** Agent: Property Opportunities, or Sales Inbox via `components/inbox/AcquisitionConversationActions.tsx`. Manager: `/client/acquisitions`. The inbox action says creating the opportunity does not send a message.

**What the agent types.** The new-opportunity sheet asks for name and/or phone, suburb or city, sale/rent/unknown, source, next action, and notes (`AcquisitionWorkspace.tsx`). Server rule `quickOpportunityReady` requires a person (existing contact, name, or phone) and a place (suburb, city, address, or location note). A full seller profile and a full property record are not required. WhatsApp creation sends the conversation’s contact, name, phone, location, `source: "whatsapp"`, and `leadId`.

**Handler.** `POST /api/clients/[clientId]/acquisitions` → `createAcquisitionOpportunity`. Organisation is checked. A salesperson later sees only opportunities they are assigned to or sourced. Idempotency-Key replays the same opportunity.

**Records.** Inserts `real_estate_acquisition_opportunities`. If no contact id is supplied, it searches up to 200 contacts. A similar phone (7 digits, suffix match) or the same name returns 409 with up to five ids, names, and phones for the signed-in agent. It does not merge. The agent can select the contact or tick “create a new contact”. A new `contacts` row is then created and, for sale or rent, `syncClassification` records seller or landlord. That duplicate check is not identity proof, and it is not shown to the public.

**What is still typed later.** On the opportunity: inspection facts, price discussions, mandate type, start, expiry, and a file upload. `uploadEvidence` stores a company document and the mandate stores `document_id`. There is no generated mandate PDF and no client form.

**Mandate.** `saveMandate` writes type, dates, document, and status `draft`, `awaiting_evidence`, or `submitted`. Submitting does not require a file on the first mandate. Approval is a separate `reviewMandate` by a manager. Approval sets evidence to `verified` and the opportunity stage to `mandate_secured`. It does not approve the listing. Legacy listing mandate columns become `legacy_unverified` and cannot be approved in place. Expiry is the recorded `expiry_date`, evaluated by `effectiveMandateStatus`, not a fixed number of days. Renewal is a new row linked by `previous_mandate_id` and needs its own evidence and review.

**Listing.** `prepareListingFromAcquisition` inserts one `listings` row with `approval_status: "draft"` and `status: "reserved"`, links `acquisition_opportunity_id`, and adds the contact as listing party `owner` with verification `reported`. A second call returns the existing listing. The draft is refused unless a current approved mandate exists or a manager passes an explicit exception. Listing approval is a later status. When approval happens, `markAcquisitionConvertedFromListing` marks the opportunity converted and can move the listing from `reserved` to `available`.

**After completion.** The owner portfolio groups opportunities by `contact_id`, so one person can show several properties. The agency register is the `listings` row created at conversion, not a second property. Until conversion, the property is only an opportunity. Outstanding listing fields (bedrooms, bathrooms, size, description, photos, category, price) are not on the mandate form. Price can be copied from the latest `agreed_marketing` discussion or `expected_price`.

**Failure and correction.** Validation errors stay on the sheet. Duplicate contacts require a choice. Lost and on-hold need a reason. There is no “send this back to the seller” path.

This journey is persistent, not mock data. It was not clicked through against the live database.

### 4.2 Buyer searches and viewings

**Entry.** Buyers & Tenants. The create sheet says a name and buy/rent is enough. It also offers phone, property categories, suburb, budget, bedrooms, and a follow-up. `createBuyerSearch` requires a name when no contact is selected, and buy or rent. A similar phone returns 409 and the sheet can use the existing contact or create another. The contact receives role `buyer` or `tenant` with verification `unverified`.

**Working-tree break.** The screen posts to `/api/clients/[clientId]/buyer-searches`, and that route file is empty. The service function still exists. HEAD still has the route. This audit did not call it.

**Several searches and properties.** A contact can have multiple `real_estate_buyer_searches`. The final-corrections migration, which is applied, makes an interest unique per search and listing rather than once per person and listing. `scheduleSearchViewing` writes `viewings.buyer_search_id` and sets that search’s interest to `viewing_requested`. Completing a viewing updates that interest and does not close the buyer’s other searches. Unit tests assert that an accepted or rejected offer does not complete the search. Offer acceptance records a search event whose note says the search stays open.

**Agent-booked viewing.** The agent chooses a live listing and a future time. Default `confirmation_status` is `awaiting_confirmation`. The insert status is still `scheduled`, so “scheduled” is not the same as confirmed. `createScheduledViewing` notifies the customer only when `notifyCustomer !== false` and the contact has a phone. The search booking calls it with `notifyCustomer: false`. Duplicate same contact, listing, and time returns 409. An idempotency key replays the same booking and rejects a different payload. Overlapping agent bookings warn unless confirmed.

**Public property page.** `POST /api/public/listing-pages/viewing` accepts name, phone, message, and preferred time. The response text says the request is not booked until the agency confirms, and `viewingConfirmed` is false. `submitPublicForm` stores `re_listing_public_submissions` and creates or attaches a lead. It does not insert `viewings` or a buyer search. The public JSON does not return an existing profile. Internally, `findOpenLeadByPhone` can attach the request to an open lead with the same phone inside that organisation. A shared number can therefore join an existing conversation. It is not treated as proof of identity, and it is not a reason to show that profile to the sender.

**Inbox.** `ConversationList` has a `viewing_requests` filter for the Real Estate hub. `AgentActionCards` can approve a viewing from an agent card when a date, time, and listing id are present. That path can send a message. It is separate from the buyer-search booking path.

**Follow-up.** `offerAttentionItems` and acquisition overview surface overdue next actions. Viewing reminders run inside the already scheduled `check-followups` cron. This audit did not observe a reminder being delivered.

### 4.3 Offers and transactions

**Entry.** Offers & Deals, `CreateOfferSheet`. The agent selects a listing and a buyer contact, then types amount, currency, conditions, expiry date, and notes. Prefill can pass listing, contact, and lead ids. It does not copy a previous offer’s terms into a client form. There is no buyer link.

**Create.** `createRealEstateOffer` checks the listing and contact belong to the organisation, the listing is open to offers, and the agent may act for that buyer (`canCreateOfferForPrivateBuyer`). Status is `draft` or `submitted`. Optional `buyer_search_id` is written in a second update. History is `real_estate_offer_events`.

**Negotiation.** `mutateRealEstateOffer` supports counter, revise, accept, reject, withdraw, and note. A counter keeps `original_offer_amount` and changes `current_offer_amount`. Concurrent edits fail when `expected_updated_at` does not match, and mobile clients must send that revision. Accepting uses `re_accept_offer` when the database function exists; if it is missing, the service returns “Atomic offer acceptance is not deployed.” Accept can reserve the listing. Another reserving offer blocks acceptance. Sibling offers are not auto-rejected.

**Expiry.** `effectiveOfferStatus` treats an active offer as expired after the stored `expiry_date` end of day. There is no fixed duration and no expiry cron. An offer with no date does not expire by this rule.

**What acceptance does.** The offer patch route, after a successful accept, calls `startOrGetTransactionFromOffer` and ignores failure so the offer accept still returns. The transaction copies listing, contact, agents, currency, and `current_offer_amount` into `agreed_price`, status `pending_compliance`. A second call returns the existing transaction. Completion and payment are later transaction and `payment_evidence_status` transitions. Uploading payment proof sets proof uploaded. `confirmPayment` does not treat the upload as confirmed payment. The unit test “payment proof requires a stored file and cannot skip confirmation” passed.

**Documents.** No Real Estate offer PDF, template version, or witness fields were found. Conditions are one text field. Seller presentation is an agent action in the product, not a seller link that shows only that offer. Platform agreement signers and `app/offer/[token]` are a different product.

**Private buyers.** Introduction review hides another agent’s buyer phone until an introduction is accepted. The phase 3 unit test for that rule passed. It was not observed in a live session.

### 4.4 Property management, separately

There is no rent ledger, maintenance workflow, or management-contract generator.

What exists, and can be reused for owner and property intake:

- Acquisition intent `rent` classifies the contact as `landlord`.
- Listing `transaction_type` includes `property_management`, with status `under_management`.
- `real_estate_rental_applications` records a rental application and a deposit status. Reporting a deposit does not verify it.
- Transactions of type `rental` or `property_management` use rental milestones.
- Commission templates use a rental basis for both rental and property management.

A management agreement would need the same client-request, review, and document-snapshot foundation as a sale mandate. It should not become a rent-accounting product in that slice. Platform DOCX/PDF signing is for SegmiQ’s own customer agreements, not a landlord contract.

## 5. Agency-document mapping

The four reference files were not available. No clause, fee, tax line, declaration, or evidence list from those files is mapped. The viewing form was not supplied and is not invented here.

The table maps the **proposed** logical groups onto current records. “Who” is the intended supplier in the proposal. “Current capture” is what the product does now.

| Source section / field | Who supplies or confirms it | Existing record / field | Current capture point | Reuse opportunity | Missing capability |
|---|---|---|---|---|---|
| Responsible agent and organisation | System, from the signed-in agent | `assigned_agent_id`, `client_id` on the opportunity, search, mandate, offer | Set on create. Not typed by the client. | Keep server-side assignment. | A client link that preserves this binding. |
| Open or sole mandate choice | Agent selects the agency template | `real_estate_mandates.mandate_type` (`sole`, `joint`, `open`) | Agent dropdown on the opportunity. Same fields for every type. | Store the chosen type on the request. | No template file, version, or different field set per type. Joint exists in the product and was not in the proposal. |
| Mandate start and expiry | Agent now. Recorded dates, not a fixed term. | `start_date`, `expiry_date` | Agent date inputs. `effectiveMandateStatus` uses those dates. | Keep date columns. Do not invent a duration. | Client cannot confirm them. Open and sole collect the same dates. |
| Individual identity | Client, then reviewer | `contacts` name/phone/email. Compliance fields `legal_name`, date of birth, nationality, identification. | Agent types name and phone. Compliance form collects legal identity only after a case and an email invitation. | Reuse contact plus compliance individual requirements for evidence. | Intake does not create the compliance case or collect identity. |
| Company, representative, owner, signer | Separate parties | `compliance_related_parties` types director, beneficial owner, authorised representative. Listing party `owner` or `authorised_representative`. | Compliance case UI, not the mandate form. | Reuse related parties and listing parties. | The opportunity has one contact. It cannot represent a company and its signer as different records. |
| Property location and intent | Client confirms, agent may start with a fragment | Opportunity suburb, city, address, `property_intent` | Agent sheet or WhatsApp location. | Opportunity already allows a thin start. | No client correction of these fields. |
| Listing facts the mandate form does not collect | Agent or client, once | `listings` price, bedrooms, bathrooms, `size_sqm`, description, photos, `property_category`, address | Copied partially when a draft listing is prepared from the inspection and price discussion. | One `listings` row is both the seller’s property and the register entry. | Draft creation waits for an approved mandate. Photos and category are not on the mandate. |
| Mandate file | Agent uploads a finished file | `real_estate_mandates.document_id` | File input on the mandate section. Upload does not approve. | Keep document id and mandate events. | No generated PDF, no snapshot that later profile edits cannot change, no signer or witness. |
| Mandate review, evidence, listing approval | Different reviewers | Mandate `status` and `evidence_status`. Listing `approval_status`. | Separate actions. Tests reject “mandate secured” without an approved unexpired mandate. | Keep the separate statuses. | Client submission cannot land as “awaiting review” without the agent retyping. |
| Buyer identity and search | Client supplies missing facts. Agent already knows some. | `contacts`, `real_estate_buyer_searches` | Agent create sheet, then the search detail. | One person, many searches. | No buyer form link. Working-tree buyer route is empty. |
| Property interest | System after review, per search and listing | `real_estate_property_interests` | Set when a viewing is booked or feedback is saved. | Applied unique index is per search and listing. | Public viewing request does not write this row. |
| Viewing request versus confirmed appointment | Client requests. Agent confirms. | `viewings.confirmation_status`, `status`, `scheduled_at` | Agent books a future time. Public page creates a lead only. | `awaiting_confirmation` already exists. | No client viewing form. Request is not a `viewings` row. |
| Viewing feedback | Agent records it today | `viewings.feedback_text`, `outcome`, interest state | `completeSearchViewing` | Keep it on the viewing and that search’s interest. | No client feedback link. |
| Offer amount, currency, conditions, expiry | Buyer confirms missing terms. Agent prepares. | `original_offer_amount`, `current_offer_amount`, `currency`, `conditions`, `expiry_date` | Agent sheet. Expiry is the entered date. | Reuse the offer and its event history. | No buyer link, no structured terms, no PDF, no witnesses. |
| Seller response, counter, signatures | Seller response is a reviewer decision. Signatures are not collected. | Offer status `countered`, `negotiating`, `accepted`, `rejected`, `withdrawn` | Agent records the response. | Event history preserves the original amount. | No seller link limited to that offer. No signature or witness evidence. |
| Accepted terms into the transaction | System copies amount and parties | `real_estate_transactions.agreed_price` and party ids | Accept handler tries to start the transaction. | Reuse `startOrGetTransactionFromOffer`. | Conditions text is not a structured transaction term. Accept currently starts the transaction immediately. |
| Payment and completion | Authorised staff | Transaction status, milestones, `payment_evidence_status` | Transaction workspace. | Already distinct from offer acceptance. | Not part of client intake. |
| Management owner and agreement | Same intake foundation. Agreement file does not exist. | Rent intent, landlord role, `property_management` listing | Same acquisition sheet with intent rent. | Reuse opportunity, contact role, listing draft. | No management-contract template or rent ledger. Out of scope to design one here. |

Repeated prices: opportunity `expected_price`, price-discussion amount, listing `price`, offer original and current amounts, lead `offer_amount`, and transaction `agreed_price` are different facts. They must not be copied over each other silently. Repeated dates: mandate start/expiry, offer `expiry_date`, viewing `scheduled_at`, and public `preferred_at` are different. Repeated contact fields: opportunity `owner_name` / `owner_phone` are denormalised copies of the contact and can drift.

## 6. Capability matrix

| Capability | Current behaviour | Code evidence | Runtime / test evidence | Status | Reuse or change |
|---|---|---|---|---|---|
| Thin seller start | Name or phone plus a place creates an opportunity and contact. | `quickOpportunityReady`, `createAcquisitionOpportunity` | Unit test “saves an incomplete opportunity” passed. No live click-through. | IMPLEMENTED BUT UNVERIFIED | Reuse. Add a client request instead of more agent fields. |
| WhatsApp opportunity | Inbox creates the opportunity and does not send a message. | `AcquisitionConversationActions.tsx` | Source only. | IMPLEMENTED BUT UNVERIFIED | Reuse as the agent start. Delivery of a client link is separate and missing. |
| Duplicate people | Similar phone or same name returns candidates to the agent. Confirm creates another contact. Scan is 200 rows. | `duplicateContactCandidates` | Unit test “does not merge a possible duplicate” passed. | PARTIAL | Keep the confirm step. Do not show candidates to the client. Widen the scan. |
| Several properties per owner | Portfolio counts opportunities per contact. | `listOwnerPortfolio` | Unit test “keeps three properties on one contact” passed. | IMPLEMENTED BUT UNVERIFIED | Reuse. |
| Mandate types and recorded dates | Sole, joint, and open share one form. Validity uses stored dates. | `saveMandate`, `effectiveMandateStatus` | Unit test for expired and legacy mandates passed. | PARTIAL | Reuse columns. Templates and client completion are missing. |
| Mandate review separate from listing approval | Manager decision. Draft listing needs an approved mandate or a manager exception. | `reviewMandate`, `conversionDecision` | Unit tests for stage evidence and one listing passed. | IMPLEMENTED BUT UNVERIFIED | Change the draft rule so intake review can create a draft without approving the mandate. |
| Client mandate / seller form | No public seller form. | No route writes a mandate from a token. | Not applicable. | MISSING | New request flow. |
| Buyer search with several properties | Searches, per-search interests, viewing `buyer_search_id`. | Buyer service and applied final-corrections indexes. | Lifecycle unit tests passed. HTTP route file is empty. | PARTIAL | Restore the route. Reuse the model. |
| Confirmed viewing distinct from a request | Agent booking defaults to awaiting confirmation. Public request creates a lead and says it is not booked. | `scheduleSearchViewing`, public viewing route | Source inspection. Duplicate-click unit test passed. | PARTIAL | Add a reviewed request that becomes a viewing only when the agent confirms. |
| Offer history, expiry, reservation | Counters keep the original amount. Expiry is computed from `expiry_date`. Accept can reserve the listing. | `offers.ts`, `offer-service.ts` | Offer unit tests passed, including “computes expiry without a cron”. | IMPLEMENTED BUT UNVERIFIED | Reuse. Add client confirmation and a document snapshot. |
| Offer PDF and witnesses | Not in the Real Estate offer service. | Search of `lib/real-estate` found no offer renderer. | Source inspection. | MISSING | New template rendering. Do not use the project Puppeteer PDF as the agency offer letter without a reviewed mapping. |
| Transaction from accepted offer | Accept tries to create `pending_compliance` and copies the current amount. | Offer patch route and `startOrGetTransactionFromOffer` | Source inspection. Payment unit test passed. | PARTIAL | Keep distinct completion and payment. Decide whether accept should only prepare the transaction. |
| Compliance client link | Email required. OTP email. Token hash. Correction revokes the matching open invite. Session cookie is httpOnly, 30 minutes, path `/`. | `invitationDeliveryPrecheck`, `createDocumentInvitation`, `publicInvitationAction` | Remediation unit tests passed, including correction replacement and cookie path. No email was sent. | PARTIAL | Copy the token, correction, and audit pattern. Do not reuse the case payload for mandates. |
| Phone-only invitation | Refused. The error asks for an email. Phone is stored but not used as access. | `invitationDeliveryPrecheck` | Unit test “refused before it is created when email delivery cannot work” passed. | MISSING | A later channel decision. Do not treat phone possession as identity. |
| Evidence scan and download | Download allowed only when `scan_status` is `clean`. Other states are blocked. Scanner is ClamAV. | `evidenceAccessDecision`, `openCaseEvidence`, `scanner.ts` | Unit test “unscanned and quarantined files are not downloadable” passed. Local ClamAV host is unset. Scan cron is not in `vercel.json`. | PARTIAL | Reuse the gate for identity files. Do not apply it to public listing photos. |
| Listing publication enforcement | Extra compliance block runs only when an active `listing_readiness` policy has `listing_publication` true. Missing table means the current listing gate remains. | `listingCompliancePublication` | Source inspection. Not queried per organisation. | IMPLEMENTED BUT UNVERIFIED | Leave enforcement opt-in. |
| Safety-baseline migration | File exists. Name absent from the applied migration list. | `20261022113000_compliance_phase1_safety_baseline.sql` | Applied-list read. | BLOCKED | Confirm constraints before relying on them. Do not apply during this audit. |
| Sales Inbox, tasks, offer attention | Inbox can start an opportunity and filter viewing requests. Acquisition overview lists overdue next actions. Offer attention includes expiry and counters. | Inbox components, `acquisitionOverview`, `offerAttentionItems` | Source and offer unit tests. | PARTIAL | Point these at returned submissions when that record exists. Do not add a second notification system. |
| Context review UI | `ContextCompliancePanel` is mounted on owner, buyer, listing, and transaction screens. The component file is empty in the working tree. | Imports in those screens. | Working tree read. HEAD blob still exists. | BLOCKED | Restore the file before any review-in-context slice. |
| End-to-end client to reviewer | Not run. Local app points at the live project. | Environment check. | No journey observation. | BLOCKED | Needs an isolated database and synthetic people. |

Previous reports said customer submissions, correction links, phone-only invites, document download, scanning, and authenticated journeys were blocked or unverified. Current source shows email invitations, correction replacement, save/submit actions, and a quarantine download gate are implemented and covered by unit tests. Phone-only access is still refused. Scanning depends on ClamAV and an unscheduled scan route. No authenticated customer journey was observed in this audit. Unit-test passes are not that journey.

## 7. Ranked friction and gaps

### Sales administration

1. The agent collects seller, property, buyer, and offer facts that the client could confirm once.
2. WhatsApp can start an opportunity and does not carry a form link back to the client.
3. Public viewing requests land in the inquiry inbox, then the agent creates the buyer and the appointment elsewhere.
4. Offer terms are typed by the agent, then the seller response is typed again.

### Document handling

1. Mandates are uploaded files, not generated from an approved template.
2. No snapshot separates a signed file from a later profile edit.
3. No offer PDF, witness, or signer evidence on the Real Estate offer.
4. Open and sole mandates collect the same three fields and a file. Listing facts are a later form.

### Data relationships

1. One contact cannot represent a company and its signer separately on the opportunity.
2. Phone similarity suggests a duplicate to an agent and can attach a public request to an open lead. It must not be shown to the other party as proof of who they are.
3. Several prices and dates mean different things and are easy to copy across by mistake.
4. A listing draft cannot be prepared until the mandate is approved, so intake review cannot create the draft the proposal describes.
5. Accepting an offer also starts the transaction.

### Access and compliance

1. Compliance links are email-only and bound to a case, which is the right isolation for identity evidence and the wrong container for a mandate.
2. Identity, PEP, source-of-funds, and company evidence must stay off the public listing. The compliance store is private. Listing photos are a different store. The emptied policy module is what the public page uses to keep that split.
3. A salesperson sees their own opportunities, searches, and assigned cases. Managers review mandates. Buyer phone disclosure waits on an accepted introduction in the service rules.
4. `20261022113000_compliance_phase1_safety_baseline.sql` is not in the applied migration list.

### Release verification

1. Empty working-tree route, policy, panel, and migration files. HEAD still has them. Local screens that import them cannot run.
2. No isolated database, so no synthetic client-to-reviewer run.
3. The only Supabase project is the live `leadstaq` database.
4. ClamAV is unset locally, and the compliance scan route is not in `vercel.json`.
5. Offer acceptance depends on the `re_accept_offer` database function. This audit did not call it.

## 8. Proposed connected workflow

Reuse the records in section 3. Add a client request only because no current table binds an untrusted link to an organisation, agent, purpose, and subject without using a compliance case.

Suggested request, judged necessary by this audit:

- Organisation, responsible agent, purpose (`seller_intake`, `viewing`, `offer`, later `management_intake`).
- Subject ids the server sets: opportunity and/or listing, buyer search, offer. The client does not submit these ids.
- Template key and version chosen by the agent from that organisation’s approved templates.
- Status: draft link, opened, in progress, submitted, changes requested, accepted, withdrawn, expired, revoked.
- A token hash, expiry, and revocation, following the compliance invitation pattern.
- Submitted field groups and file ids, plus the correction instruction that the client sees. Internal notes stay off the link.
- The domain rows created on accept, so a retry finds them instead of inserting again.

On seller accept: create or update the contact, add seller or landlord role as `unverified`, create or update the opportunity, create the draft listing and owner party, and store the mandate as `submitted` or `awaiting_evidence`. Do not set mandate `approved`, listing `approved`, or evidence `verified`.

On viewing accept: create or update the buyer and search, link the interest to that search and listing, and insert a viewing with `confirmation_status` `awaiting_confirmation`. Confirmed and completed stay agent actions.

On offer accept by the reviewer: create the offer from confirmed terms, generate the PDF from the selected template version, and keep it attached to the offer. Seller access is a separate link to that document version, not the buyer profile. Transaction creation stays a distinct action unless the business explicitly wants the current auto-start.

Company representation needs the compliance related-party records, or listing parties, written at review. A single contact name is not enough.

Do not add tables for searches, viewings, offers, or transactions. Do not add a new visual theme or a second task system. Returned submissions should appear in the existing acquisition, viewing, and offer attention lists and in Sales Inbox.

## 9. Staged implementation plan

Each slice is usable only when client input, review, record linking, the relevant document, and the next agent action work, including the failure cases below. None of that was demonstrated end to end in this audit.

**Blocker for every slice.** Restore the emptied working-tree files from `869fbde` without discarding other local work. Use an isolated database. Do not run journeys against project `gnnqzboaeezzevlwwryp`.

**Slice A — seller intake.** Agent starts from Property Opportunities or the WhatsApp opportunity action, picks open or sole, and sends a link. The seller can save, resume, and submit. Review creates the contact, role, opportunity, draft listing, and mandate file link. Next action is mandate review, still unapproved.

Acceptance:

- An existing contact can be chosen by the agent. An uncertain match does not merge and does not reveal the other profile to the client.
- A company and its representative are stored as separate parties.
- Two submits and two reviewers do not create two people, two listings, or two mandates.
- A correction asks only for the rejected groups and keeps the rest.
- An expired or revoked link cannot submit.
- Another organisation’s agent cannot open the submission.
- The draft listing is the same row the owner list and the register will show, with listing approval still draft.
- Mandate approval and listing approval remain separate.

Depends on: request record, mobile form, review screen using `ReSheet` and the existing opportunity page. Blocked by the empty compliance context panel if review is embedded there, and by the live-database constraint.

**Slice B — viewing.** Agent picks a listing and sends a viewing request. Review creates or updates the buyer and links the search, interest, and unconfirmed viewing. Next action is the agent confirming time.

Acceptance:

- One buyer can hold two searches and two viewings on different listings, with feedback on the matching search.
- A second property does not overwrite the first interest.
- Submission does not set the viewing completed or confirmed.
- Duplicate submits do not create two buyers.
- Public listing-page requests stay inquiries until an agent promotes them. They must not gain this new behaviour by accident.
- A shared phone does not display the existing buyer to the new sender.

Depends on Slice A’s request mechanics and on restoring `buyer-searches/route.ts`. The public page also needs `policy.ts` restored before it can be regression-tested.

**Slice C — offer.** Agent prepares the request from the buyer and listing. The buyer confirms missing terms. The server fills the approved template and stores that version. The agent reviews it and sends the seller a link to that version only. Next action is the seller response on the existing offer.

Acceptance:

- Amendments append offer events and do not destroy the original amount or the previous PDF.
- Expiry follows the offer’s `expiry_date`.
- A seller link cannot read the buyer’s identity file or other searches.
- Accepting the commercial terms does not mark the transaction complete or the payment verified.
- Witness fields appear only when that template version requires them.

Depends on A and B for the people and property links. Blocked by the absence of an agency template file and by the uninspected `re_accept_offer` function.

**Slice D — management intake only.** Reuse Slice A with intent rent and role landlord. Generate the management agreement only when an organisation template exists. Stop before rent accounting, maintenance, and arrears.

**Explicitly not in these slices.** Applying `20261022113000`, turning on listing-publication enforcement, scheduling ClamAV, or redesigning the shell.

## 10. Unanswered business questions

These are not answered by the repository:

- The viewing form’s wording, declarations, and required fields. It was not supplied.
- Which fees, durations, and evidence items differ between the open mandate and the sole mandate. The product stores both types and collects the same fields. The PDFs were not available to compare.
- Whether a company seller is signed by a named representative, a director, or both, and whether witnesses are required on mandates and offers.
- Whether offer acceptance should keep starting a `pending_compliance` transaction, which the code does now, or only copy terms into a draft the agent starts later.
- Whether the first client channel is email, WhatsApp, or a link the agent pastes. The compliance implementation can email a code. It cannot authenticate by phone alone. WhatsApp delivery of a form link does not exist on the acquisition action.
- Who may approve a client submission, a mandate, and a listing when the responsible agent is also a manager.
- How long a client link stays valid, and whether one correction link replaces the previous one, which is what compliance invitations do.
- Whether a public property-page viewing request should later become this reviewed viewing, or remain a separate inquiry.
- Whether `20261022113000_compliance_phase1_safety_baseline.sql` was intentionally left unapplied.

Resolved from the repository, so they are not open product guesses:

- One person can be buyer and seller through separate role rows.
- One owner can have several opportunities, and one buyer can have several searches.
- Interests are per search and listing once the applied final-corrections migration is in force.
- Mandate and offer expiry are stored dates, not a platform-wide number of days.
- Listing approval, mandate approval, viewing confirmation, offer acceptance, transaction completion, and payment confirmation are already different statuses, with the two couplings described above.
- Identity evidence is a compliance case. Marketing copy and listing photos are not that case.
