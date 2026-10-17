# Real estate buyer introduction audit

Evidence is from source inspection on 17 October 2026. No application code, schema, production data, or deployment was changed. No local server, build, or browser pass was run. UI behaviour below is what the components do, not a live click-through.

**Partially Working**

A salesperson can save an introduction request. The row records the organisation, listing, buyer search, requester, and the search’s assigned agent at that moment. Status starts as `requested`. Repeating a pending or accepted request does not create a second row. A declined request cannot be reset by asking again.

That is the working half. Nothing in the product lists the request, notifies anyone, or lets the responsible agent or a manager approve it from a screen. Approval exists only as `review_introduction` on the buyer-sales actions API. After a successful approval, the requester still cannot open the buyer search, schedule a viewing, or join a deal. Name and phone appear only if that listing is reloaded and the search is still a live match. An unassigned buyer has no salesperson reviewer. The request can sit in `requested` with nobody responsible for it.

A second, older listing page bypasses this gate and can show buyer name, phone, and email, then offer Send and Create offer, without an introduction.

---

## 1. Executive summary

The card in production — Private buyer, managed by Unassigned, match reasons joined with “ · ”, then Introduction requested — is `ListingRegisterDetails`. “Introduction requested” is local React state. A refresh clears it, because the matching response only returns introductions that are already `accepted` for the current user.

Who receives an unassigned request: nobody. `owning_agent_id` is stored as null. No notification row is inserted. Agency Attention does not query introductions. No component calls `review_introduction`.

Who can approve it in the API: a `CLIENT_MANAGER` or `SUPER_ADMIN` in the same organisation, including the manager who created the request. A salesperson cannot approve an unassigned request. There is no screen for that approval.

Assigned buyers are the same, except the snapshot owner is also allowed to call the review API. They still have nowhere to see the request.

Approval does not create a transaction, a commission split, a collaboration participant, or a WhatsApp session share. It also does not grant buyer-search access. `loadOwnedSearch` still returns 403 for a salesperson who is not the current assignee.

## 2. Overall workflow status

| Stage | Status |
| --- | --- |
| Private match on a listing | Works. Name and phone are null for a salesperson who is not the assignee and has no accepted introduction. |
| Request introduction | Works. Row is inserted or the existing pending/accepted row is returned. |
| Tell the requester the request was saved | Local toast and label only. Lost on refresh. Pending and declined are not loaded back. |
| Deliver the request to the owner or a manager | Not implemented. |
| Review queue | Not implemented. API only. |
| Approve or decline from the product | Not implemented. |
| Inform the requester of the decision | Not implemented. |
| Reveal authorised contact on the match card | Works only after a fresh match load, and only while the search still matches a live listing. |
| Open the search, viewing, offer, or deal from that approval | Not granted by the introduction. |
| Keep WhatsApp off this workflow | The introduction functions do not send WhatsApp. A separate listing endpoint can. |

## 3. Exact Request Introduction execution path

The production wording matches the listing register, not Property matching.

`ListingRegisterDetails` (`components/real-estate/listings/ListingRegisterDetails.tsx`):

- Title is `match.contactName ?? "Private buyer"`.
- Strength badge prints the raw value `strong`, `alternative`, or `partial`. The words “Strong match” are the user’s description of that badge. Property matching (`MatchingWorkspace`) is the screen that literally renders “Strong match”, and its hidden title is “Matching buyer search”, not “Private buyer”.
- “Managed by {match.managedBy}”.
- Up to three reasons joined with ` · `.
- Button label is “Request an introduction”. After a 2xx response the same card shows “Introduction requested”.

`requestIntroduction` posts:

```json
{ "action": "introduction", "listingId": "<listing uuid>", "searchId": "<search uuid>" }
```

to `POST /api/clients/{clientId}/buyer-sales/actions`. No `Idempotency-Key` header. The route validates the body with Zod (`action`, `listingId`, `searchId` as UUIDs) and calls `requestBuyerIntroduction`. Success is HTTP 201, including when the row already existed.

`requestBuyerIntroduction` (`lib/real-estate/buyer-sales-service.ts`, from line 1069):

1. `sameOrg`: `SUPER_ADMIN`, or `actor.clientId === clientId`. Otherwise 403.
2. Load the search by id and `client_id`. Missing search is 404 “Search not found.”
3. If `assigned_agent_id === actor.id`, 400 “You already manage this search.” This applies to managers as well as salespeople.
4. Load the listing by id and `client_id`. Missing listing is 404.
5. Load an existing introduction for the same client, listing, search, and requester.
6. Status `requested` or `accepted`: return that row, still as HTTP 201. No new row.
7. Status `declined`: 409 “The agent managing this buyer declined this introduction.” The row is not reset.
8. Otherwise upsert `status: "requested"`, `requesting_agent_id: actor.id`, `owning_agent_id: search.assigned_agent_id` (null when unassigned), conflict target `listing_id,search_id,requesting_agent_id`.

Not checked at request time: search status, pipeline stage, listing availability, listing agent, whether the requester is active, or whether anyone can review the row. No search event is written. No match notification is written. No WhatsApp call is made.

The listing card does not show a “Sending…” label. The button disables while `busy` is true. Failure uses the page toast with the API error string. Success toast: “Introduction requested. The agent managing this buyer will decide.” That sentence is wrong when `managedBy` is Unassigned, because no agent is stored as the owner.

`MatchingWorkspace` posts the same body. It shows “Sending…”, then local “Introduction requested”. A 409 is shown in the page error. It does not read `status` from the response, so an already-accepted row is labelled “Introduction requested”.

`buyersForListing` selects introductions only to build a set of `accepted` search ids for `requesting_agent_id = actor.id`. Pending and declined rows are discarded. After refresh, `canRequestIntroduction` is true again and the button returns. Clicking it again is a no-op success while pending or accepted, and a 409 toast after decline.

## 4. Database schema and constraints

`real_estate_buyer_introductions` in `supabase/migrations/20261016120000_real_estate_phase3_buyer_sales.sql`:

| Column | Rule |
| --- | --- |
| `id` | UUID primary key |
| `client_id` | Required, cascades with the organisation |
| `listing_id` | Required, cascades with the listing |
| `search_id` | Required, cascades with the buyer search |
| `requesting_agent_id` | Nullable user, `ON DELETE SET NULL` |
| `owning_agent_id` | Nullable user, `ON DELETE SET NULL`. Snapshot of `assigned_agent_id` at request time |
| `status` | `requested` (default), `accepted`, or `declined` |
| `created_at` | Set on insert. Not updated on decision |

Unique `(listing_id, search_id, requesting_agent_id)`. Index `(client_id, owning_agent_id, status)`.

There is no `decided_by`, `decided_at`, decline reason, or updated timestamp. RLS is enabled and the table is revoked from `public`, `anon`, and `authenticated`. Access is through the service role in the API.

`20261016220000_real_estate_final_corrections.sql` does not alter this table.

`real_estate_buyer_searches.assigned_agent_id` is nullable (`20261016013000_real_estate_phase1_foundation.sql`). Deleting the user sets it null. The phase 1 backfill inserts legacy searches without `assigned_agent_id`. Those rows are `active` when the contact has a buy-side or tenant-side lead, which is enough for matching.

## 5. Assigned buyer handling

Agent B’s search has `assigned_agent_id = Agent B`. Agent A requests an introduction from Agent A’s listing.

The row stores `requesting_agent_id = Agent A` and `owning_agent_id = Agent B`, status `requested`. Agent A is not the owner, so the self-request check passes.

Agent B is allowed to call `reviewBuyerIntroduction` because `owning_agent_id === actor.id`. A manager in the same organisation is also allowed. Agent A is not, unless Agent A is a manager.

Agent B has no page, drawer, bell item, or Attention row that loads this table. The match-notification counter on the salesperson home counts `real_estate_match_notifications` for that agent. Those rows are created by `discoverMatchesForListing` when a listing matches a search. They are not created by an introduction request, and they do not carry a link to an introduction id.

## 6. Unassigned buyer handling

This is a real data state, not only a label.

- The column is nullable.
- Legacy backfill never sets it.
- `ON DELETE SET NULL` clears it when the user row is deleted.
- `updateBuyerSearch` writes `assigned_agent_id` whenever the patch includes the field. The “only a manager can reassign” check runs only when `assignedAgentId` is truthy. A salesperson who currently owns the search can send `null` and clear the assignee.
- `createBuyerSearch` always sets `assigned_agent_id` to the creator, salesperson or manager. New searches from that form are assigned. Unassigned matches are legacy rows, cleared assignees, or deleted users.

`buyersForListing` sets `managedBy` to the user’s name, or “Another agent” if the id has no name in the organisation, or “Unassigned” when the id is null. The matching API does return a null assignee, and the UI prints Unassigned.

`requestBuyerIntroduction` accepts that search. `owning_agent_id` is stored null. The request is not rejected.

## 7. Reviewer identification

`reviewBuyerIntroduction` (from line 1127):

- Load the introduction by id and `client_id`. Missing row is 404. The error does not include buyer name or phone.
- Allow the action when `isManager` (`CLIENT_MANAGER` or `SUPER_ADMIN`) or `owning_agent_id === actor.id`.
- Otherwise 403 “Forbidden.”
- Update `status` to `accepted` or `declined`. No other column changes.

When `owning_agent_id` is null, the salesperson branch fails. Only a manager can decide. The manager does not have to assign an agent first. Approval does not require an owner.

The check uses the snapshot on the introduction, not the search’s current `assigned_agent_id`. It does not check that the actor is not the requester. A manager who requested an introduction to someone else’s search, or to an unassigned search, can approve their own request.

There is no “responsible reviewer” field the UI can show. The toast guesses “the agent managing this buyer” from copy, not from the stored owner.

## 8. Manager approval functionality

The API supports a manager decision. The product does not.

`agencyAttentionFeed` loads mandates, listing approvals, offers, commissions, handovers, idle transactions, and documents. It does not query `real_estate_buyer_introductions`.

Searches of `components/real-estate` found no `review_introduction` call and no list of introduction rows. Property matching, Buyer & Tenant Sales, and the listing register only send `action: "introduction"`.

A manager therefore cannot see requesting agent, buyer-search summary, property, match explanation, requested date, or decision history. Approve and Decline are not on any screen. A manager who can see the match card sees the buyer’s name and phone immediately, because `canSeeBuyerContact` returns true for `CLIENT_MANAGER` and `SUPER_ADMIN` without an introduction. That is manager visibility of the match, not a review of the request. The card sets `canRequestIntroduction` to false for them, so the manager does not even see “Introduction requested” on that card.

`requireClientAccessFromRequest` checks organisation access only. It does not apply a read-only manager gate. A manager who is not a selling user can still post `review_introduction` if they know the id.

## 9. Agent approval functionality

The assigned owner may post `review_introduction`. No salesperson screen calls it.

The owner cannot approve from the buyer search page, because that page never loads introductions. The listing agent cannot approve their own request unless they are a manager.

The wrong salesperson, meaning anyone who is not the snapshot owner and not a manager, receives 403.

Already decided rows can be flipped. Accepted can become declined and declined can become accepted. There is no 409 for a second decision. Collaboration review in `reviewCollaborationRequest` does refuse a second decision. Introduction review does not.

## 10. Notification delivery

No notification is created when an introduction is requested or decided.

`real_estate_match_notifications` is a different workflow. `discoverMatchesForListing` inserts `client_id`, `listing_id`, `search_id`, `agent_id` (the search assignee, or null), `fingerprint`, `strength`, and `reasons`. It does not insert buyer name or phone. The comment on the table says these are internal alerts, not a WhatsApp send. The salesperson priority feed counts those rows for `agent_id = actor.id` over seven days. A null `agent_id` matches nobody. Those rows are not introduction requests, are not in a notification bell, and do not deep-link to a review screen.

Agency Attention does not include them. There is no unread flag on an introduction. A decision does not notify the requester.

No introduction path calls `notifyPropertyMatch`.

## 11. Requester status updates

The requester is told only what the browser remembers.

| Server status | After refresh on the listing card |
| --- | --- |
| `requested` | Button returns. The pending state is gone. |
| `accepted` | Name and phone are filled when the search still matches. The card links to the search. |
| `declined` | Button returns. The next click shows the 409 toast. The card never says declined. |

There is no “Awaiting review by the responsible agent or agency manager.” The success toast names an agent even when the buyer is unassigned. There is no reviewer name, no requested date, and no decision date.

Property matching has the same local-only pending label, and it mislabels an already accepted response as requested.

## 12. Approval behavior

`POST` body: `{ "action": "review_introduction", "introductionId": "<uuid>", "decision": "accepted" }`.

Who may approve: snapshot owner, or a manager in that organisation. The route’s organisation check runs first.

What changes: `status` becomes `accepted`. Reviewer id and decision time are not stored.

What the requester gains on the next `buyersForListing` or matching load:

- `canSeeBuyerContact` is true because `introductionAccepted` is true for that requester and that listing’s accepted set.
- `contactName` and `phone` are returned.
- `canRequestIntroduction` becomes false.

The listing card then shows the name and a link, “Open search to schedule a viewing”. That link is not backed by access. `getBuyerSearchBundle` calls `loadOwnedSearch` first. A salesperson who is not `assigned_agent_id` gets 403 before contact visibility is considered. `getBuyerSearchBundle` also passes `introductionAccepted: true` unconditionally, so it never consults the introduction table. The flag cannot help a non-owner, and it would show contact to an owner or manager even without an acceptance.

`scheduleSearchViewing` uses `loadOwnedSearch`. An accepted introduction does not allow the requester to book a viewing.

Offer creation (`lib/real-estate/offer-service.ts`) checks the contact is in the organisation and `canCreateOfferForAssignment`. It does not read introductions. With no lead, a salesperson in the organisation may create an offer for any contact id. That permission is not granted by the introduction, and it is also not withheld until approval. See section 17.

No transaction participant is inserted. No commission row is created. `reviewCollaborationRequest` inserts a participant for `transaction_participation` and `listing_assistance` only. Kind `buyer_introduction` on `real_estate_collaboration_requests` is a separate table and is not what the listing button writes. The listing collaboration button sends `kind: "listing_assistance"`. Approving an introduction does not approve a collaboration request.

WhatsApp inbox access is unchanged.

## 13. Decline behavior

`decision: "declined"` sets `status` to `declined`. No reason column exists. The API accepts no reason.

The requesting agent does not see a declined badge. Buyer name and phone stay null on the match payload, because only `accepted` fills the set. The next request returns 409. Both UIs surface `json.error`, so the toast or page error shows the decline sentence. They do not explain that the decision cannot be reconsidered, and they put the button back, which invites another click.

There is no reconsider action. A manager can still post `review_introduction` with `accepted` on the same id, because review does not lock a decided row. That is an API override, not a product flow, and it leaves no history.

The 409 copy says “The agent managing this buyer declined this introduction” even when a manager declined an unassigned search and no agent manages it.

## 14. Duplicate protection

Uniqueness includes the requesting agent. Agent A and Agent C each get their own row for the same listing and search. One approval does not add the other agent to the accepted set. `buyersForListing` filters introductions with `requesting_agent_id = actor.id`.

The same agent cannot insert a second pending row. The service returns the existing pending or accepted row. The unique index is the backstop. Postgres would still allow multiple rows if `requesting_agent_id` were null, but the service always writes `actor.id`.

A repeat request does not change `declined` back to `requested`.

## 15. Concurrent requests

Two agents at the same time create two rows. They are decided independently.

The same agent twice: both requests read, then both upsert the same conflict key with `status: "requested"`. The unique index keeps one row. A unique-violation that escapes the upsert becomes HTTP 500 with the database message. The happy path is one row.

One agent’s acceptance does not satisfy the other agent’s `canSeeBuyerContact` check.

## 16. Permission checks

| Action | Rule |
| --- | --- |
| Request | Same organisation. Search and listing belong to that organisation. Requester is not the current assignee. |
| Review | Same organisation via the route. Actor is the snapshot owner or a manager. |
| See name and phone on a match | Manager, current assignee, or accepted introduction for this requester on this listing. |
| Open the search | Manager, or salesperson who is the current assignee. Introduction is ignored. |
| Schedule a viewing on the search | Same as open. |
| Create an offer | Organisation member. Salesperson is allowed when the lead is unassigned or assigned to them. Introduction is ignored. |
| Send a WhatsApp property match | Separate route. See section 21. |

The review check does not re-read the search assignee, search status, or listing status. It does not reject a requester approving their own row when the requester is a manager.

## 17. Buyer privacy

`canSeeBuyerContact` (`lib/real-estate/buyer-match.ts`):

- `SUPER_ADMIN` or `CLIENT_MANAGER`: true.
- `ownerAgentId === requesterId`: true.
- Else the boolean `introductionAccepted`.

Before a request, a salesperson who is not the owner receives `contactName: null` and `phone: null` from `buyersForListing`. The card says Private buyer.

While pending, the accepted set does not include the search, so name and phone stay null. The request itself does not return contact fields.

After acceptance, the next match load for that requester and listing returns name and phone. It does not return email. It does not return the contact id.

After decline, name and phone stay null on that payload.

Guessing a search id: `GET` buyer-search bundle uses `loadOwnedSearch`. Another salesperson in the organisation gets 403. A search id from another organisation gets 404, because the query filters `client_id`. Introduction errors say “Search not found.” or “Request not found.” They do not include the buyer.

Querying introductions for a different listing does not reveal the other listing’s acceptance. The accepted set is per listing and per requester.

Manager match responses include every matched buyer’s name and phone. That is role policy, not a leak through the salesperson payload. There is no manager-only introduction list that dumps buyers to salespeople.

Two paths ignore this gate:

1. `GET /api/clients/{clientId}/listings/{listingId}` loads every contact in the organisation, keeps contacts that are in `loadExplicitDemandContactIds` (buy-side and tenant-side leads, plus every active buyer search) and pass `contactMatchesListing` on the contact’s legacy budget, bedroom, and area columns, then returns `id`, `name`, `phone`, and `email` to any organisation member. `ListingDetailView` renders them and offers Create offer and Send. No introduction check. This is the older listing page, not the Private buyer card, but it is a live matching surface.

2. `GET /api/contacts/list` returns `name` and `phone` for contacts in the organisation with no salesperson ownership filter.

A salesperson who only uses the new match card does not receive the phone from that card before approval. A salesperson who opens the older listing detail, or the contact list, can. That breaks the expectation that the introduction is what authorises buyer contact.

## 18. Cross-tenant protections

Request and review are under `/api/clients/{clientId}/...`. `requireClientAccessFromRequest` uses `canAccessClient`. Search and listing lookups add `.eq("client_id", clientId)`. An introduction id from another organisation is 404 inside this client. `explainSearchListing` drops pairs whose search and listing `clientId` differ, so matching does not cross organisations.

RLS revoke means the browser cannot read `real_estate_buyer_introductions` with the anon or authenticated key. The service role is what the API uses, and the API scopes by client.

This does not fix the same-organisation contact leak in section 17.

## 19. Reassignment and archived-record behavior

| Change while pending | What the code does |
| --- | --- |
| Buyer reassigned from B to C | The introduction keeps `owning_agent_id = B`. B can still approve. C cannot, unless C is a manager. The match card shows C’s name as “Managed by”. The toast and the 409 text still talk about “the agent managing this buyer”, which is now C, who cannot decide. |
| Assignee cleared | Snapshot owner, if any, can still decide. The card shows Unassigned. |
| Search paused, closed, or completed | `coarseStatusForStage` sets status off `active`. `searchIsMatchable` then excludes it. The introduction row is left pending. Review does not look at search status, so the API can still accept it. After acceptance the match list no longer includes the search, so the requester never sees the name on the card. |
| Listing sold, let, or withdrawn | `isListingLive` requires `approval_status = approved` and `status = available`. `buyersForListing` returns an empty list and the notice “Only an approved available listing is matched to buyers.” Review can still accept the row. The requester has no match card left on which to see the contact. |
| Contact archived | Not checked. The introduction remains. Contact name lookup is a separate read at match time. |
| Requester deactivated | The user id stays on the row (`ON DELETE SET NULL` applies to delete, not deactivate). Review does not check `is_active`. If the user can no longer authenticate, nobody is told, and a manager can still decide via the API. |
| Owner deactivated | Same. Snapshot id remains. If they cannot sign in, only a manager can decide, and only via the API. |
| User deleted | `requesting_agent_id` or `owning_agent_id` becomes null. A null owner leaves manager-only review. |

No code path marks these requests stale. There is no notification to expire.

## 20. After-approval collaboration

| Desired step | Supported by an accepted introduction |
| --- | --- |
| See name and phone on the match card | Yes, after reload, while the search still matches a live listing. |
| Open buyer search | No. 403 for a non-owner salesperson. The listing link still says “Open search to schedule a viewing”. |
| Contact the assigned agent | No action is added. The card does not show the owner’s phone. |
| View the matching property | The requester already had the listing. Approval adds nothing here. |
| Record property interest | No introduction hook. |
| Schedule a viewing | No. `scheduleSearchViewing` requires search ownership. |
| Create an offer | Not unlocked by the introduction. Separately, offer create already allows an in-org salesperson when the lead is unassigned. |
| Add a collaborating agent or a deal participant | No. |
| Open a collaboration detail | No introduction detail screen. |
| Commission split | Not created. |

The practical journey after approval is a name and a phone number on a card, plus a link that the server rejects.

## 21. WhatsApp isolation

`requestBuyerIntroduction` and `reviewBuyerIntroduction` do not read or write WhatsApp sessions and do not call `notifyPropertyMatch`.

`POST /api/clients/{clientId}/listings/{listingId}/send-match` does call `notifyPropertyMatch` to `contact.phone`. For a salesperson it allows the send when any of these is true: the contact has a search assigned to them, a lead assigned to them, or an **accepted** introduction for this listing, this requester, and this contact. A pending introduction does not pass. Managers are not given that salesperson check.

`ListingDetailView` and the inquiry Matches tab call `send-match`. The introduction request button does not. Approval of an introduction does not send a message by itself. Once accepted, a caller who has the contact id can send the template. The new match payload does not include contact id. The old listing GET does.

Accepted introduction is therefore an authorization input to a buyer WhatsApp send. It is not an automatic send. Inbox history is not attached to the introduction.

## 22. Mobile UI behavior

Not browser-tested. From the source:

The listing register card is a `px-3 py-2` row. The buyer name uses `truncate`. The request control is a `text-[12px]` button with no `min-h-11` and no loading label. Register facts use `grid-cols-2`, which stays two columns on a narrow screen. It does not use `ReSection`, `ReStatusBadge`, `ReSheet`, `ReEmptyState`, or `ReErrorState`. Errors go to a toast that can be missed. Pending, approved, and declined are not status badges.

Property matching uses `ReSection`, `ReStatusBadge`, `ReEmptyState`, and a `min-h-11` request button with “Sending…”. The pending label is still local. Match reasons are joined with spaces, so a long reason string wraps as one line of copy. There is no review sheet.

There are no approval controls, so mobile decision UX does not exist. More Actions on the listing register is a wrap of small buttons, not an introduction review menu.

## 23. UI design deficiencies

These are gaps against the existing sales workbench, not a new visual system.

- The pending label over-claims. It says the managing agent will decide, including when the buyer is Unassigned.
- Decision state is not durable in the UI. Pending and declined look like “not requested” after refresh.
- The listing strength badge shows `strong` rather than a readable status. Property matching already has “Strong match”.
- The post-approval link promises a viewing the server will refuse.
- There is no review surface, so a manager cannot decide without leaving the product and calling the API.
- The listing request control misses loading, and its success state dies on navigation. Error is a toast, not an inline status.
- Touch target on the listing card is the text line, not a 44px control.
- `grid-cols-2` register metadata will crowd a phone.
- No empty or error state explains an unassigned buyer who cannot be reviewed.

A later pass should stay on `sales-*` tokens and the existing `ReSection`, `ReStatusBadge`, `ReActionMenu`, `ReSheet`, `ReEmptyState`, and `ReErrorState` components. Do not add a parallel badge or sheet system. Copy to aim at, once a reviewer actually exists:

- Pending: “Introduction pending” and “Awaiting review by the responsible agent or agency manager.” Name the reviewer when `owning_agent_id` is set. When it is null, say the agency manager.
- Approved: “Introduction approved” and only the actions the server allows.
- Declined: “Introduction declined”. Keep the buyer private. Do not show the request button as if it will work.

## 24. Exact relevant files and functions

| Piece | Location |
| --- | --- |
| Listing card and request button | `components/real-estate/listings/ListingRegisterDetails.tsx` `requestIntroduction` |
| Property matching card | `components/real-estate/buyers/MatchingWorkspace.tsx` `requestIntroduction` |
| Actions route | `app/api/clients/[clientId]/buyer-sales/actions/route.ts` actions `introduction` and `review_introduction` |
| Matching GET | `app/api/clients/[clientId]/matching/route.ts` |
| Request, review, match payload, search access | `lib/real-estate/buyer-sales-service.ts` `requestBuyerIntroduction`, `reviewBuyerIntroduction`, `buyersForListing`, `loadOwnedSearch`, `getBuyerSearchBundle`, `scheduleSearchViewing`, `updateBuyerSearch` |
| Contact visibility and match eligibility | `lib/real-estate/buyer-match.ts` `canSeeBuyerContact`, `searchIsMatchable`, `explainSearchListing` |
| Live listing rule | `lib/real-estate/listings.ts` `isListingLive` |
| Schema | `supabase/migrations/20261016120000_real_estate_phase3_buyer_sales.sql` |
| Nullable assignee and legacy backfill | `supabase/migrations/20261016013000_real_estate_phase1_foundation.sql` |
| Match alerts, not introduction delivery | `discoverMatchesForListing`, `real_estate_match_notifications` |
| Manager attention | `lib/real-estate/agency-service.ts` `agencyAttentionFeed` |
| Other collaboration table | `createCollaborationRequest`, `reviewCollaborationRequest` |
| Older match list with phone and Send | `app/api/clients/[clientId]/listings/[listingId]/route.ts` GET, `components/real-estate/ListingDetailView.tsx` |
| WhatsApp property match | `app/api/clients/[clientId]/listings/[listingId]/send-match/route.ts` |
| Offer create without introduction | `lib/real-estate/offer-service.ts`, `canCreateOfferForAssignment` |
| Organisation contact list | `app/api/contacts/list/route.ts` |

## 25. Existing test coverage

`tests/real-estate-phase3.test.ts` covers `canSeeBuyerContact` with four assertions: hidden from another salesperson, visible to the owner, visible to a manager, visible after `introductionAccepted: true`. It also tests that match-notification pairs are deduped by listing, search, and fingerprint. That is not an introduction test.

No test calls `requestBuyerIntroduction` or `reviewBuyerIntroduction`. No test covers unassigned owner, 409 after decline, unique rows per requester, snapshot owner after reassignment, search 403 after acceptance, or the listing GET contact payload.

## 26. Missing integration tests

Needed before treating the workflow as done:

- Request creates one row with the right requester, search, listing, organisation, and null owner.
- Second pending request returns the same row and does not insert.
- Declined request returns 409 and stays declined.
- Two requesters get two rows. Accepting one does not reveal the buyer to the other.
- Salesperson cannot review. Snapshot owner can. Manager can. Requester who is a salesperson cannot.
- Unassigned request is reviewable by a manager and not by a salesperson.
- After reassignment, the old snapshot owner can review and the new assignee cannot.
- Accepted introduction reveals name and phone on `buyersForListing` and does not reveal them on another listing.
- Accepted introduction still 403s `getBuyerSearchBundle` and `scheduleSearchViewing` for the requester.
- Closed search and sold listing do not leave a match card that exposes the buyer, and review behaviour is explicit.
- Cross-organisation search id and introduction id return 404.
- Listing GET and `send-match` do not return or message a buyer the caller is not allowed to see.
- No WhatsApp send on request or on review.

## 27. Critical blockers

1. **Unassigned buyer has no reviewer in the product.** The row is stored with a null owner. No salesperson can approve it. No manager screen lists it. No notification is sent. It can remain `requested` indefinitely. This matches the live card “Managed by Unassigned / Introduction requested”. High-priority workflow defect.

2. **Assigned buyer has an API reviewer and no delivery.** The owner is stored, and the owner may post a decision, but nothing tells them or shows them the request.

3. **Approval does not start collaboration.** The requester does not gain search, viewing, or deal access. The UI link says they can open the search to schedule a viewing. The server forbids it.

4. **Requester status is not durable.** Pending and declined disappear on refresh. The success copy names an agent who may not exist.

5. **Buyer contact is enforceable on the new match card and not on the older listing GET or the contact list.** Name, phone, and email can appear, and Send / Create offer are offered, without an introduction. High privacy defect beside this workflow.

6. **A manager can approve their own request, and any decided row can be flipped,** with no reviewer id, time, or reason.

## 28. Recommended implementation phases

Do not start these in this audit. Order:

1. **Stop the contact leak** on listing GET and align `send-match` and offer creation with the same rule as `canSeeBuyerContact`. Until that is true, introduction privacy is not what the product enforces.

2. **Review queue for managers and owners.** One list, tenant-scoped, of `status = requested`. Show requester, buyer summary the reviewer is allowed to see, listing, match reasons, and requested date. Approve and Decline. Unassigned rows appear for managers. Assigned rows appear for the snapshot owner and for managers. Do not let the requester decide. Record `decided_by` and `decided_at`. Keep a single decision unless a manager override is explicit.

3. **Notify the reviewer and the requester** inside the existing in-app notification path. Link the notification to the introduction id. Do not put the buyer phone in the notification. Do not send WhatsApp to the buyer.

4. **Persist status on the match card** from the server: pending, approved, declined. Fix the unassigned copy. Remove the viewing link until `loadOwnedSearch` would allow it, or teach search access to honour an accepted introduction for read-only contact and viewing on that listing only.

5. **Revalidate at decision time:** search still active and matchable, listing still available, requester still active. If the assignee changed, decide whether the snapshot owner or the current owner reviews, and show that person. Do not leave both, or neither, able to act without a rule.

6. **After approval, only the actions that were authorised:** show name and phone, let the requester open a read-only search, and schedule a viewing on that listing if product wants that. Do not grant search edit, WhatsApp history, a transaction participant, or a commission split.

Phase 2 can list rows with the current table. Phases 2 and 5 need columns for reviewer, decision time, and an optional decline reason if those must be stored. See section 29.

## 29. Whether new database migrations are required

Not for a first review queue. `status`, `owning_agent_id`, `requesting_agent_id`, `listing_id`, `search_id`, `client_id`, and `created_at` are enough to list pending requests and to accept or decline.

A migration is required if the product must store who decided, when, and why, or if decided rows must be immutable in the database rather than only in the service. Those columns do not exist today. The unique key should stay as `(listing_id, search_id, requesting_agent_id)`. Do not drop it. Do not add a key that collapses two agents into one row.

No migration fixes the missing UI, the missing notification, or the listing GET exposure.

## 30. Final recommendation

Treat introduction as a saved request, not as agent collaboration. Ship the privacy fix and a real review queue before any further matching UX. The unassigned case is a blocker: the request the user sees has no responsible reviewer and no place where a manager can act.

Keep buyer introduction separate from transaction participants and commission. Keep WhatsApp off the request and the decision. If an accepted introduction is allowed to authorise `send-match`, that send must stay a deliberate click by someone who was granted this buyer, and it must not open the inbox.

---

## Scenario matrix

### 1. Assigned buyer — request created

- **Expected:** One `requested` row. Owner is Agent B. Agent B is told.
- **Current:** Row is created with `owning_agent_id` = B. Nobody is told. Requester sees a local “Introduction requested”.
- **Code:** `requestBuyerIntroduction`. UI: `ListingRegisterDetails.requestIntroduction`.
- **Tests:** None.
- **Missing:** Delivery and a durable pending label.
- **Security:** Low on this step. Contact stays hidden in the new match payload.
- **Correction:** Notify B and show the row on B’s queue.
- **Severity:** High.

### 2. Unassigned buyer — request created

- **Expected:** Request stays reviewable by an agency manager.
- **Current:** Row is created with `owning_agent_id` null. No manager list. No notification. API review works only if a manager already has the introduction id.
- **Code:** `requestBuyerIntroduction` writes `search.assigned_agent_id`. Legacy inserts omit that column. `buyersForListing` prints Unassigned.
- **Tests:** None.
- **Missing:** A manager queue and a named reviewer.
- **Security:** The request can sit forever. Contact stays hidden on the new card. The old listing GET can still show the phone.
- **Correction:** Manager queue for null `owning_agent_id`. This is the workflow blocker.
- **Severity:** Blocker.

### 3. Assigned buyer — owner approval

- **Expected:** B approves. Status, reviewer, and time are stored. A is told. A receives only the authorised fields.
- **Current:** B can `POST review_introduction` if B knows the id. No screen. Status flips to `accepted`. Reviewer and time are not stored. A is not told. A later match reload returns name and phone.
- **Code:** `reviewBuyerIntroduction`. Visibility: `buyersForListing` accepted set.
- **Tests:** `canSeeBuyerContact` with `introductionAccepted: true` only.
- **Missing:** UI, audit columns, requester notice.
- **Security:** Medium. Any later call can flip the decision.
- **Correction:** Owner queue, single decision, store reviewer and time.
- **Severity:** High.

### 4. Unassigned buyer — manager approval

- **Expected:** A manager approves without first assigning an agent.
- **Current:** The API allows a manager while `owning_agent_id` is null. No screen lists the row. The manager match card does not show the request, because managers already see the contact and `canRequestIntroduction` is false.
- **Code:** `reviewBuyerIntroduction` manager branch. `canSeeBuyerContact` manager short-circuit.
- **Tests:** Manager visibility only, not the review function.
- **Missing:** The entire manager review experience in section 7.
- **Security:** A manager can approve a request they created.
- **Correction:** Pending list for managers. Block self-approval.
- **Severity:** Blocker.

### 5. Owner declines

- **Expected:** Status declined, reason optional, A sees declined, buyer stays private, repeat request does not reset the row.
- **Current:** API sets `declined` with no reason and no reviewer. A does not see declined until they click again and get 409. Buyer stays private on the new match payload. Repeat does not reset.
- **Code:** `reviewBuyerIntroduction`. 409 in `requestBuyerIntroduction`.
- **Tests:** None.
- **Missing:** Declined badge, reason, explanation that it cannot be re-requested.
- **Security:** Low if the UI keeps hiding the contact. The button returning is a product bug, not a privacy reset.
- **Correction:** Return status on the match payload and render it.
- **Severity:** High.

### 6. Manager declines

- **Expected:** Same as owner decline, including for an unassigned buyer.
- **Current:** Same API update. 409 text still says “the agent managing this buyer” when no agent does. No manager UI.
- **Code:** Same functions. Toast and error string are fixed copy.
- **Tests:** None.
- **Missing:** Manager decline control and accurate copy.
- **Security:** Same as scenario 5. Decided rows can later be flipped to accepted.
- **Correction:** Lock the decision. Fix the 409 sentence.
- **Severity:** High.

### 7. Duplicate pending request

- **Expected:** Same row returned. No second insert.
- **Current:** Supported. HTTP 201 with the existing row. UI shows success again.
- **Code:** Existing-status branch and unique `(listing_id, search_id, requesting_agent_id)`.
- **Tests:** None.
- **Missing:** UI should not pretend a new request was sent.
- **Security:** Low.
- **Correction:** Return the current status and render it. Keep the unique key.
- **Severity:** Low.

### 8. Duplicate accepted request

- **Expected:** Do not create another row or downgrade acceptance.
- **Current:** Supported. The accepted row is returned and status is left alone.
- **Code:** Same branch as pending.
- **Tests:** None.
- **Missing:** MatchingWorkspace labels that response “Introduction requested”.
- **Security:** Low.
- **Correction:** Render `accepted` from the server.
- **Severity:** Medium.

### 9. Re-request after decline

- **Expected:** 409. Status stays declined. UI explains that.
- **Current:** 409 and the row is unchanged. The button is shown again after refresh. The error text is shown. It does not say the decision is final.
- **Code:** `existing?.status === "declined"`.
- **Tests:** None.
- **Missing:** A declined state that does not look clickable.
- **Security:** The reset loop is already blocked. Do not remove the 409.
- **Correction:** Hide the button when status is declined. Keep the 409.
- **Severity:** Medium.

### 10. Concurrent requests by two agents

- **Expected:** Two rows. Independent decisions. One approval does not reveal the buyer to the other agent.
- **Current:** Supported by the unique key including `requesting_agent_id`, and by filtering the accepted set on `actor.id`.
- **Code:** Upsert conflict target. `buyersForListing` introduction query.
- **Tests:** None.
- **Missing:** Tests. A race on the same agent relies on upsert. A unique error would surface as 500.
- **Security:** Low if the filter stays. Do not change the unique key to listing+search only.
- **Correction:** Add a regression test. Map unique violations to the existing-row response.
- **Severity:** Low.

### 11. Buyer reassigned while pending

- **Expected:** The current owner or a manager can review. The card shows the current owner. Stale rights are not enough on their own.
- **Current:** The snapshot owner can still approve. The new owner cannot, unless they are a manager. The card shows the new owner. No notification is updated, because none was sent.
- **Code:** Review uses `row.owning_agent_id`. `managedBy` uses the live `assigned_agent_id`. `updateBuyerSearch` can change the assignee.
- **Tests:** None.
- **Missing:** A rule for which person is the reviewer after reassignment, and a re-check at decision time.
- **Security:** Medium. The previous owner keeps approval rights with no audit of who decided.
- **Correction:** Re-read the current assignee at decision time, or store both and show who may act.
- **Severity:** High.

### 12. Buyer search closed while pending

- **Expected:** The request should not be approvable into a collaboration on a closed search, or the UI should say it is no longer eligible.
- **Current:** Matching drops the search (`searchIsMatchable`). The introduction stays `requested`. Review does not look at status and can still accept. After acceptance the match card is gone, so the requester is not shown the contact there.
- **Code:** `searchIsMatchable`, `candidateSearches` (`status = active`), `reviewBuyerIntroduction`.
- **Tests:** None.
- **Missing:** Decision-time eligibility.
- **Security:** Low for the new card. The accepted row still exists and can authorise `send-match` if the caller has the contact id.
- **Correction:** Reject or expire the review when the search is not matchable, and do not let that acceptance authorise a send.
- **Severity:** Medium.

### 13. Listing sold while pending

- **Expected:** Same as a closed search. Do not leave a hidden accepted grant.
- **Current:** `buyersForListing` returns no matches when the listing is not approved and available. Review can still set `accepted`.
- **Code:** `isListingLive`.
- **Tests:** None.
- **Missing:** Decision-time listing check.
- **Security:** Same latent `send-match` grant as scenario 12.
- **Correction:** Revalidate listing status inside `reviewBuyerIntroduction`.
- **Severity:** Medium.

### 14. Requesting agent deactivated

- **Expected:** The request is withdrawn or a manager is told. A deactivated user cannot keep a live ask.
- **Current:** The row stays `requested`. Deactivation does not null the user id. Review does not check `is_active`. No one is notified.
- **Code:** FK `ON DELETE SET NULL` only. Review has no user-status check.
- **Tests:** None.
- **Missing:** Eligibility check and a manager queue so someone can close it.
- **Security:** Low by itself. The request remains an open approval with no owner when combined with scenario 2.
- **Correction:** Ignore or auto-close requests whose requester is inactive. Show the rest to a manager.
- **Severity:** Medium.

### 15. Cross-tenant request

- **Expected:** 403 or 404. No search, listing, or introduction from another organisation.
- **Current:** Route organisation check, then `client_id` filters. Wrong-org search or listing is 404. Wrong-org introduction id is 404. Matching drops mismatched `clientId`.
- **Code:** `sameOrg`, `requireClientAccessFromRequest`, `explainSearchListing`.
- **Tests:** None at the service layer.
- **Missing:** An integration test.
- **Security:** The introduction path holds. Same-org contact list and listing GET are the actual exposure.
- **Correction:** Keep the client filters. Add a test. Fix same-org leaks separately.
- **Severity:** Low for this path.

### 16. Unauthorised agent attempts approval

- **Expected:** 403. Status unchanged.
- **Current:** 403 when the actor is not a manager and not the snapshot owner. Status is not updated.
- **Code:** `reviewBuyerIntroduction` owner check.
- **Tests:** None.
- **Missing:** A test. Also missing: requester-manager self-approval is allowed and should not be.
- **Security:** The wrong salesperson is blocked. The manager requester is not.
- **Correction:** Reject review when `actor.id === requesting_agent_id`.
- **Severity:** Medium.

### 17. Requester checks status

- **Expected:** Pending, approved, or declined from the server, including who reviews a pending request.
- **Current:** The match query throws away every introduction that is not `accepted` for this user. The card remembers pending only until refresh.
- **Code:** `buyersForListing` accepted set. Local `introduced` / `requested` state.
- **Tests:** None.
- **Missing:** Return `introductionStatus` and a reviewer label.
- **Security:** Low. The gap causes repeat clicks and a misleading success toast.
- **Correction:** Include status on each match. Stop using local-only state as the source of truth.
- **Severity:** High.

### 18. Requester receives approved buyer details

- **Expected:** Name and phone on the authorised card only.
- **Current:** True for `buyersForListing` after reload, for that listing and that requester, while the search still matches. The search page does not use this grant. Managers already saw the contact.
- **Code:** `canSeeBuyerContact` inside `buyersForListing`.
- **Tests:** The unit helper only.
- **Missing:** A service test that another agent and another listing stay hidden.
- **Security:** The new payload is scoped. Listing GET is not.
- **Correction:** Keep the accepted-set filter. Stop the other endpoints from returning the same phone.
- **Severity:** High, because of the parallel endpoint, not because of this function.

### 19. Requester attempts unauthorised edit

- **Expected:** 403 on search update, viewing, and any buyer edit.
- **Current:** `loadOwnedSearch` 403s a salesperson who is not the assignee. Introduction acceptance is not consulted. `getBuyerSearchBundle` never reaches its contact check for that user.
- **Code:** `loadOwnedSearch`, `updateBuyerSearch`, `scheduleSearchViewing`.
- **Tests:** None.
- **Missing:** The product still links “Open search to schedule a viewing”.
- **Security:** Edit is blocked. The gap is a broken promise, not an edit hole, on this path.
- **Correction:** Remove the link, or add a read-only search view that checks the accepted introduction and still forbids edits.
- **Severity:** Medium.

### 20. Requester tries to access WhatsApp history

- **Expected:** No session, no history, no automatic buyer message.
- **Current:** Introduction request and review do not touch WhatsApp sessions. They do not send a message. `send-match` will message the buyer’s phone when the caller has an accepted introduction and a contact id, or when the caller already owns the search or lead. `ListingDetailView` shows Send on the old match list without waiting for that introduction.
- **Code:** `send-match/route.ts`, `notifyPropertyMatch`, `ListingDetailView.sendMatch`.
- **Tests:** None found for this coupling.
- **Missing:** A guarantee that the old match list cannot send around the introduction rule.
- **Security:** High. Phone numbers and a Send action are available on the old listing page. Inbox history is not granted by the introduction row.
- **Correction:** Filter listing GET matches with `canSeeBuyerContact`. Call `send-match` only for buyers that check already allows, and never from the introduction request itself.
- **Severity:** High.

---

**Partially Working**

The database insert, the organisation checks, the per-requester unique key, the decline lock against a casual re-request, and the new match card’s decision to hide name and phone are real and are in the code paths above. The collaboration lifecycle is not. For the card in production — private buyer, unassigned, introduction requested — no employee is notified, no manager has a queue, and approval would not let the two agents work the buyer together.
