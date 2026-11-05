# Real Estate Phase 0 foundation report

Date: 5 November 2026. This phase recovered five truncated source files, re-ran isolated checks, inspected the live database catalog without changing it, and mapped the three agency PDFs that were supplied. It did not add client intake, request tables, document generation, schema changes, or the workflow redesign.

No commit, push, migration, production write, or message was made.

## 1. Revision and pre-existing work

| Item | Result |
|---|---|
| Branch | `feat/real-estate-compliance` |
| HEAD | `869fbde991a952de8593848b576e12e0295f89a9` — “Scan compliance documents before a reviewer can open them.” Same revision as the 5 November audit. It was rechecked, not assumed. |
| Instructions | No root `AGENTS.md`. |
| Working tree | Still dirty. About 243 status lines remain, including Android, solar, and other Real Estate edits. Those were not reverted. |
| Backup | Before recovery, working copies, `git diff` patches, and `git show HEAD` exports were saved outside the repository at `D:\Users\ddsta\Documents\segmiq-phase0-backup-20261105`. That folder is not part of the commit set. It also holds extracted PDF text and must not be committed. |

The index blob for each of the five files was the same size as `HEAD` before recovery. There was no staged variant and no uncommitted addition inside those files. Each unstaged diff was a deletion of the whole file (`0` lines added). No commit message or comment documents an intentional removal. The newest history for each file is `HEAD` or an earlier commit on this branch.

## 2. Five-file recovery

Recovery used `git restore --worktree --source=HEAD` on each path. The index already matched `HEAD`, so this did not change the index content or any other path. After recovery, `git hash-object` of each worktree file equals `HEAD:<path>`.

The two-byte `policy.ts` backup is the two bytes `0D 0A` (a blank line). The panel and migration files were also 2 bytes with a full-file deletion diff. That is truncation, not a newer edit.

| File | Finding before recovery | Evidence | Action | Before → after | Remaining uncertainty |
|---|---|---|---|---|---|
| `app/api/clients/[clientId]/buyer-searches/route.ts` | Empty | Worktree 0 bytes. Diff `0/95`. Index and HEAD both 4,586 bytes. Last commit `420579d`. | Restored from HEAD. | 0 bytes → blob `5815d7cc`, identical to HEAD. | None for content. |
| `app/api/clients/[clientId]/listings/[listingId]/route.ts` | Empty | Worktree 0 bytes. Diff `0/255`. Index and HEAD both 10,977 bytes. Last commit `420579d`. | Restored from HEAD. | 0 bytes → blob `2b0b6f5b`, identical to HEAD. | None for content. |
| `lib/real-estate/agent-listing-pages/policy.ts` | Blank line only | Worktree 2 bytes (`0D 0A`). Diff `0/593`. Index and HEAD both 23,399 bytes. Last commit `5392d03`. | Restored from HEAD. | 2 bytes → blob `a0876119`, identical to HEAD. | None for content. |
| `components/real-estate/compliance/ContextCompliancePanel.tsx` | Blank line only | Worktree 2 bytes. Diff `0/326`. Index and HEAD both 17,413 bytes. Last commit `869fbde`. | Restored from HEAD. | 2 bytes → blob `dea6954a`, identical to HEAD. | None for content. |
| `supabase/migrations/20261103195500_re_compliance_management_foundation.sql` | Blank line only | Worktree 2 bytes. Diff `0/366`. Index and HEAD both 18,836 bytes. Introduced in `98f19e7`. | Restored the source file from HEAD. SQL was not applied. | 2 bytes → blob `28aae877`, identical to HEAD. | The database already has a migration named `re_compliance_management_foundation`. Restoring the file does not change that history. |

`git status` briefly still listed three of the restored paths even though their hashes matched HEAD. `git diff` for them was empty. A stat refresh cleared that false dirty flag. It did not stage or discard the unrelated dirty files.

## 3. Checks and limits

The five test files do not load `.env.local`. They use in-memory data or read source text. They were run with the editor’s Node and the repo’s `tsx`:

`tsx --test tests/real-estate-acquisition.test.ts tests/real-estate-offers.test.ts tests/compliance-remediation.test.ts tests/real-estate-phase3.test.ts tests/real-estate-gating.test.ts`

Fresh result: **65 passed, 0 failed**, 12 suites, about 7.0 seconds. The previous failure, “scopes buyer queries by organisation and does not send match WhatsApp”, passed. It reads `app/api/clients/[clientId]/listings/[listingId]/route.ts` and looks for `discoverMatchesForListing`, which is present again.

`tsc --noEmit` was then run for the project. It exited 2. The recovered files do not appear in the error list. The errors that were reported are `TS2306: File is not a module` for files this phase did not touch:

- `lib/auth/roles.ts` — worktree 0 bytes, HEAD 1,105 bytes, diff `0/26`
- `components/dashboard/company/settings/CompanySettingsPage.tsx` — worktree 0 bytes, HEAD 15,058 bytes, diff `0/382`
- `lib/settings/company-settings-data.ts` — worktree 0 bytes, HEAD 5,376 bytes, diff `0/130`
- `lib/mobile/sales-app/experience.ts` — worktree 2 bytes, HEAD 2,876 bytes, diff `0/71`

Those look like the same truncation pattern. They were left unchanged because they were outside the confirmed five-file list. A full typecheck or production build cannot pass while `roles.ts` is empty. That is a pre-existing workspace problem, not a failure introduced by this recovery.

These checks do not authenticate a user, submit a form, or prove production behaviour.

## 4. Isolated environment

Rechecked configuration without printing secrets:

- `NEXT_PUBLIC_SUPABASE_URL` host is `gnnqzboaeezzevlwwryp.supabase.co`.
- `DATABASE_URL` is a Supabase Postgres URL for that hosted project.
- `SUPABASE_SERVICE_ROLE_KEY` is set.
- Resend API key and from-address are set, so a normal local server can send email.
- A Meta WhatsApp access token is set. `META_WHATSAPP_TOKEN` is absent.
- `COMPLIANCE_CLAMAV_HOST` and `RE_AGENCY_OPERATIONS` are absent.
- Docker, the Supabase CLI, and `psql` are not installed.
- Existing docs describe an isolated organisation as a requirement. They do not provide a local stack or a second project in this workspace. The Supabase account still has one project, `leadstaq`.

No local or test stack was created. Creating one would need new tooling or a new hosted project, and this phase does not authorise a paid project or a production migration. Journey verification is **blocked**.

Outbound delivery was not exercised. No email or WhatsApp message was sent.

### Catalog check, not a migration-name guess

Read-only catalog queries on `gnnqzboaeezzevlwwryp` (no customer rows):

| Object from `20261022113000_compliance_phase1_safety_baseline.sql` | In the database |
|---|---|
| Foreign keys `compliance_docs_case_tenant_fk`, `real_estate_transactions_compliance_case_tenant_fk`, `compliance_parties_case_tenant_fk`, `compliance_events_case_tenant_fk` | Absent |
| Unique index `uq_compliance_cases_client_id_id` | Absent |
| Triggers `compliance_cases_validate_context`, `real_estate_transactions_validate_compliance_context`, `compliance_events_append_only` | Absent |
| Functions `compliance_validate_context_tenant`, `compliance_prevent_event_mutation`, `compliance_apply_mutation_atomic` | Absent |
| Columns `compliance_case_events.before_state`, `after_state`, `request_id` | Absent |
| `compliance_cases.submitted_by`, `compliance_case_events.confidential` | Present |

`submitted_by` and `confidential` are also added by the later foundation migration, whose name `re_compliance_management_foundation` is in the applied migration list. Their presence does not mean the safety-baseline file was applied. The baseline’s tenant foreign keys, append-only trigger, and validation function are absent. This phase did not apply that file.

`re_accept_offer` is present in `public`. The earlier uncertainty about a missing accept function does not apply to this database. The route can still hide a transaction failure: `app/api/clients/[clientId]/offers/[offerId]/route.ts` calls `startOrGetTransactionFromOffer` and ignores both a thrown error and a returned `{ ok: false }`. The HTTP response can say the offer was accepted when no transaction row was created. A later accept click still reaches that call, because an already reserving offer returns success from `mutateRealEstateOffer` and the route then tries the transaction again. Nothing records the missed attempt or opens a task. Leave the automatic `pending_compliance` creation in place. A later phase should surface the failure and keep an explicit retry on the existing idempotent function. Offer acceptance, transaction completion, and verified payment stay separate.

## 5. Document comparison

Supplied and read:

- `MANDATE_TO_SALE_FORM_PDF.pdf` — titled “OPEN MANDATE TO SALE”, 2 pages, Landlords Junction Properties.
- `LANDLORDS_JUNCTION_SOLE_MANDATE_FORM_2026.pdf` — titled “SOLE MANDATE”, 1 page, same agency.
- `OFFER_LETTER_2026_UPDATED.pdf` — titled “PROPERTY OFFER TO PURCHASE”, 2 pages, same agency.

Not supplied: `property mANAGEMENT CONTRACT.docx`. That comparison stays blocked. The viewing form was not supplied. Its wording and required fields stay unresolved.

Letterhead names the agency, directors, phone numbers, and a Bulawayo office. Those are this agency’s template identity. Phone numbers are not copied here and must not become platform data.

Fee, VAT, and commission sentences are this agency’s template text. They are not platform defaults and this audit does not treat them as a legal ruling. The two mandate forms do not even cite the fee the same way: the open form states a fee scale plus VAT on the commission, and the sole form states a scale that it says is above a statutory minimum, with a different instrument citation. Store each as the text of the selected template version.

### Open mandate versus sole mandate

The open form collects a property description, title particulars, seller identity, company parties, and source-of-funds questions. The sole form does not. The sole form collects an exclusivity period tied to the signature date. The open form collects a start date and an end date and does not state a two-month exclusive period.

| Field group | Open mandate form | Sole mandate form | Who supplies or confirms it | Existing record | Gap |
|---|---|---|---|---|---|
| Property address | Blank line | Blank line | Client confirms. Agent may start from the conversation. | Opportunity `address` / listing `address` | Same idea, two forms. |
| Registered owner | Blank line | Blank line | Client, then reviewer | `contacts` plus listing party `owner` | One contact cannot also be the company. |
| Owner residential address and mobile | Not in the property block. Mobile is in seller details. | Both on the face of the form | Client | `contacts` phone. No separate residential address on the opportunity. | Sole form asks for the owner’s home address. Open form asks for present residential address later. |
| Property category | Land, House, Cluster/Townhouse, Industrial, Commercial, Farm, Other | Not asked | Client or agent | Listing `property_category` uses house, apartment, townhouse, residential stand, commercial, industrial, agricultural, other | Labels do not match one-for-one. Cluster/Townhouse is not “townhouse” without a decision. Land is not the same as residential stand. |
| Property rights | Full title, sectional title, share transfer, cession | Not asked | Client, reviewer confirms the route | Compliance `legal_route` understands title deed and cession, not share transfer or sectional title as named values | Do not collapse these four into one listing field. |
| Title or share-certificate number | Blank line | Not asked | Client supplies the number. Reviewer accepts the document. | Compliance evidence type `title_deed`. No column on the mandate. | Number and document are evidence, not a marketing fact. |
| Property description | Free text | Not asked | Client or agent | Listing `description`, opportunity `property_description` | Listing description is a later copy, not the mandate text. |
| Occupation | Owner occupied or tenant occupied, plus occupant name and cell | Not asked | Client | No occupant fields on the opportunity or mandate | A tenant occupant is not the owner contact. |
| Mandate start and end | Two blank dates | Not asked. Exclusivity runs “a minimum period of two month” from the signature date, then continues until the owner varies it in writing. | Client signs. Agent does not invent the duration. | `real_estate_mandates.start_date` and `expiry_date` | Sole continuation is not an end date. A blank expiry must not be stored as a fixed term. |
| Mandate price, in words, and payment mode | USD amount, words, cash / electronic transfer / other | Not asked | Client states the authority price. Agency does not silently replace it with the asking price. | `real_estate_price_discussions` can store `owner_asking` or `agreed_marketing`. Mandate has no price column. | “Mandate price” and “asking price before commission” are both on the open form. They are different lines. |
| Asking price before commission | Separate line | The only price line | Client | Opportunity `expected_price` or a price discussion | Do not copy this into offer amount or transaction price. |
| Seller identity | Title, surname, name, nationality, identity number, marital status, spouse, occupation, industry, position, cell, employer, email, residential address, employer address | Not on this form | Client, reviewer later accepts identity evidence | Compliance individual fields. Contact has name, phone, email only. | Spouse and employer are not contact columns. |
| Source of funds and PEP | Free text and yes/no | Not asked | Client states. Reviewer decides. A yes is not a legal finding. | Compliance `source_of_funds_status` and PEP evidence. Restricted from listing copy. | The mandate upload must not publish these answers on the listing. |
| Company | Company name, address, industry, email, numbers, representative name, representative identity number, position, contact address, contact number | Only the surety sentence if the owner is a company | Client. Representative is a different person from the company. | `compliance_related_parties`: director, beneficial owner, authorised representative. Listing party `authorised_representative`. | The opportunity still has one `contact_id`. |
| Company evidence | Directors’ identity, resolution to sell, shareholders at or above 10% with identity copies, CR16 and beneficial owners (three lines) | Not asked | Client uploads. Reviewer accepts. | Compliance document types for registration, identity, and representative authority | Threshold “10%” is this form’s instruction, not a platform rule. |
| Signature, witness, negotiator, place and date | Owner or representative, one witness, sales negotiator | Same three roles | Signers sign. Negotiator is the agent. | Mandate `document_id` and `responsible_agent_id`. No witness columns. | A file upload is not a signature. |
| Commission and marketing clauses | Agency wording, including social-media advertising and a sold board | Agency wording, plus exclusive agency and a tail if the agency introduced the purchaser. Sold-board period is stated as not more than two months. | Agency-controlled template text. Not typed by the client as a new rule. | Not stored as structured mandate terms. `terms` exists on renewal rows. | Keep the approved template snapshot. Do not copy either clause set into every organisation. |

Listing facts the open form still does not collect: bedrooms, bathrooms, size, photographs, and a marketing description beyond the free-text property description. The sole form collects even less. Those listing facts stay a separate collection. They must not be required to save the mandate.

### Offer letter

| Field group | On the form | Who supplies or confirms it | Existing record | Distinction |
|---|---|---|---|---|
| Purchaser name | “I/we” line | Buyer | `contacts` and `real_estate_offers.contact_id` | Not the seller. |
| Property “commonly known as” | One line | Agent selects the listing. Buyer confirms the wording. | Listing address / suburb | Not necessarily the title-deed description on the open mandate. |
| Purchase sum, figures and words | Two lines | Buyer | `original_offer_amount` and `current_offer_amount` | Words are not stored. A counter must not erase the original amount. |
| Payable on or before | Date | Buyer proposes. Parties confirm. | Not a column. Could sit in `conditions` only as unstructured text. | Not the offer-open date. |
| Conditions | Four numbered blanks | Buyer proposes. Reviewer and seller respond. | `conditions` text | Four lines are not a structured list. |
| Administration fee sentence | 1% of the selling price, minimum stated in US dollars | Agency template. Buyer acknowledges by signing. | Not an offer column | “Selling price” may differ from the offer sum, the asking price, and the mandate price. Do not make the percentage a platform constant. |
| Offer open until | Blank | Buyer or the signed template. Not a platform duration. | `expiry_date`. `effectiveOfferStatus` uses that date. | Empty means no computed expiry. |
| Purchaser signature, date offered, witness | Yes | Buyer and witness | No signature or witness record | |
| Seller signature, date accepted, witness | Yes | Seller and witness. This is the seller’s decision. | Offer status `accepted` and `accepted_at` are agent-recorded today. | Signing is not transaction completion and not payment verification. |
| Sales negotiator | Named | Agent, system can fill the responsible agent | `buyer_agent_id` / `listing_agent_id` | The form has one negotiator line, not two agents. |
| Purchaser identity | Same personal block as the open mandate’s seller block, including spouse, employer, source of funds, and PEP | Buyer states. Reviewer accepts evidence. | Compliance buyer case | Must not be visible to the seller with the offer PDF. |
| Purchaser company | Company name, address, industry, email, numbers, representative, identity number, position, addresses | Buyer. Representative is separate. | Compliance related parties | The offer row has one `contact_id`. |
| Contract declaration | The form says acceptance results in a legally admissible contract | Template wording | Offer status only | Do not treat the status `accepted` as that legal conclusion. |

The offer form does not collect buyer search preferences, a viewing, or a deposit schedule. It does not repeat the mandate’s title-deed fields.

### What can be reused

- Opportunity, contact, contact role, listing party, mandate dates and type, price discussions, offer amounts, offer expiry, offer events, and compliance identity evidence.
- `ContextCompliancePanel`, restored in this phase, already mounts on the owner, buyer, listing, and transaction screens.
- `RePageHeader`, `ReSection`, `ReStatusBadge`, `ReActionMenu`, and `ReSheet`, with existing `sales-*` tokens.
- Sales Inbox can start an opportunity. Sending a link can stay an agent action. Automatic WhatsApp delivery is a separate step. A shared phone number is not identity and must not open someone else’s prefilled profile.

## 6. Remaining blockers

**Code**

- `lib/auth/roles.ts`, `CompanySettingsPage.tsx`, `lib/settings/company-settings-data.ts`, and `lib/mobile/sales-app/experience.ts` are still empty or a blank line. `tsc --noEmit` fails on them. They were not part of this recovery.
- The offer-accept route still ignores a failed transaction bootstrap.
- No client-request record, template renderer, witness fields, or company party on the opportunity. Those are later design work, not this phase.

**Environment**

- Local configuration points at the live `leadstaq` project and can send email and WhatsApp.
- No Docker, Supabase CLI, second project, or documented local database is available.
- Safety-baseline tenant constraints and `compliance_validate_context_tenant` are absent on the live database. They were not applied.
- ClamAV is unset. The scan route is not in `vercel.json`.

**Missing documents**

- Property management contract.
- Viewing form.

**Business decisions**

- Whether the seller-visible property for the first release is the acquisition opportunity, which needs no gate change, or a non-matchable listing draft. Matching already requires `approval_status = approved` and a market status of `available` or `reserved` (`listingBecomesMatchable`). The mandate gate in `conversionDecision` should stay on the path that prepares a market listing.
- How to store the sole mandate’s “two months from signature, then until varied in writing” without pretending it is a single end date.
- How to store the open form’s two prices and the offer form’s sum, payable-by date, and offer-open date as different facts.
- Whether cluster/townhouse, land, sectional title, and share transfer need new category or legal-route values.
- Whether the first client link is pasted by the agent. Authentication of a returning client is a separate design. Phone match is not that design.
- The agency fee, VAT, and administration-fee sentences stay inside the approved template.

## 7. Readiness for the seller-intake slice

The five-file truncation no longer blocks that slice. The relevant unit checks are green, and the recovered files match `HEAD`.

The slice is not ready to implement in this workspace until two prerequisites are met:

1. Recover or explicitly accept the other empty modules, at least `lib/auth/roles.ts`, so `tsc --noEmit` can pass. That recovery was not authorised in this phase.
2. An isolated database and message capture exist before any journey that writes records or sends a link. This checkout cannot provide that.

Journey verification remains blocked. Do not start the slice against project `gnnqzboaeezzevlwwryp`.

## 8. Proposed seller-slice scope for a later phase

Agent starts from Property Opportunities or the existing WhatsApp opportunity action, chooses this organisation’s open or sole template, and receives a link to copy into WhatsApp. Automatic delivery is out of scope.

The seller opens the link on a phone, saves, resumes, and submits. A correction asks only for the rejected groups. Review creates or updates the contact, adds the seller or landlord role as unverified, creates or updates the acquisition opportunity, and stores the mandate file as submitted or awaiting evidence. The opportunity is the seller-visible property. Preparing a market listing continues to require an approved mandate or the existing manager exception. Mandate approval and listing approval stay later actions.

Reuse `createAcquisitionOpportunity`, `saveMandate`, the owner portfolio, `ContextCompliancePanel`, `ReSheet`, and the Sales Inbox opportunity action. Company name and representative stay separate parties when the form says the owner is a company. Identity, PEP, and source-of-funds answers stay on the compliance case, not on the listing.

Out of scope for that first slice: offer PDF, viewing form, management accounting, applying the safety-baseline migration, and turning on listing-publication enforcement.

## What changed, what was verified, what is blocked

Changed: the five truncated files were restored from `HEAD` after an external backup. Their worktree hashes match that commit. Nothing else was edited except this report.

Verified: 65 of 65 isolated tests passed, including the listing-route check that failed in the audit. Catalog reads show the safety-baseline constraints and validation function are absent, while `re_accept_offer` is present. The three supplied PDFs were mapped. The open form is the fuller identity and property form. The sole form is the exclusivity form. Their prices, dates, and fee sentences are not interchangeable.

Blocked: authenticated journeys, because the app still points at the live project and no isolated stack is installed. The management contract and the viewing form. A clean project typecheck, because four other files are still empty. Seller-intake implementation was not started.
