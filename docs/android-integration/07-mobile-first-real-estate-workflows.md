# Mobile-first Real Estate workflows (contract version 1)

These operations reuse the website services. Bearer authentication is `Authorization: Bearer <Sales JWT>` on HTTPS. `clientId` comes from bootstrap. Cookie sessions keep the previous website payloads. A Bearer response uses the projections below.

Prefix `P` is `/api/clients/{clientId}`. Errors stay `{error, code?}`. 401 authentication, 403 permission or another organisation, 404 absent in this organisation, 409 conflict, 413 photograph too large, 415 unsupported photograph, 503 storage or schema unavailable. Do not sign out on 503.

There is no stored listing title and no stored listing currency. Show `address` as the heading. Buyer currency is the search `currency` field. There is no separate features column on a listing; narrative goes in `description`. Buyer features are `features` on the search. The rules score is weighted points (`scoreMeaning: "rules_points"`). It is not a probability and not an AI score.

## Buyer creation and editing

A buyer is a customer `contacts` row plus one `real_estate_buyer_searches` row. Creating a search does not create a second buyer database.

`POST P/buyer-searches` body:

```json
{
  "name": "Amina Moyo",
  "phone": "+263700000001",
  "confirmNewContact": false,
  "intent": "purchase",
  "propertyType": "house",
  "propertyCategories": ["house"],
  "locations": ["Avondale"],
  "budgetMin": 40000,
  "budgetMax": 90000,
  "currency": "USD",
  "bedrooms": 3,
  "bathrooms": 2,
  "features": "Garden",
  "notes": "Needs parking",
  "leadId": null
}
```

`intent` is required: `purchase` or `rental`. Supply `contactId` to attach an existing customer, or `name` to create one. A similar phone without `confirmNewContact: true` returns 409 and `duplicates: [{id, name}]`. Confirming creates a new contact; it does not merge. The signed-in user becomes `assigned_agent_id`. Agents cannot assign a colleague on create. Managers reassign later.

Bearer `201`:

```json
{
  "search": {
    "id": "6f1c2a40-8b1e-4c1a-9d2a-0c5e8a1b2c30",
    "client_id": "org",
    "contact_id": "contact",
    "contact_name": "Amina Moyo",
    "phone": "+263700000001",
    "assigned_agent_id": "agent",
    "intent": "purchase",
    "property_type": "house",
    "property_categories": ["house"],
    "locations": ["Avondale"],
    "budget_min": 40000,
    "budget_max": 90000,
    "currency": "USD",
    "bedrooms": 3,
    "bathrooms": 2,
    "features": "Garden",
    "other_requirements": "Needs parking",
    "pipeline_stage": "new_enquiry",
    "status": "active",
    "permittedActions": ["edit"]
  }
}
```

`id` is the buyer-search id. `status` is the coarse state (`active` for a new enquiry). `pipeline_stage` is the website stage. Phone is present only for the assigned agent or a manager. Another agent receives `id`, `status`, `pipeline_stage`, `assigned_agent_id` and `permittedActions: []`.

`GET P/buyer-searches/{searchId}` is owner or manager. A Bearer body keeps the website bundle and replaces `search` with this projection. `PATCH` uses the website patch schema (`pipelineStage`, budgets, `locations`, `bedrooms`, `bathrooms`, `notes`, `features`, `assignedAgentId`, and the other fields in `buyer-searches/[searchId]/route.ts`). `assignedAgentId` is manager-only (403 for an agent). Bearer PATCH returns `{search}` in the same projection.

List remains `GET P/buyer-searches`. Agents see only searches assigned to them. `agentId` cannot widen that.

## Listing creation and editing

`POST P/listings` requires `transaction_type`: `sale`, `rental`, `new_development`, or `property_management`.

```json
{
  "transaction_type": "sale",
  "approval_status": "draft",
  "status": "available",
  "property_category": "house",
  "price": 85000,
  "address": "12 Second Street",
  "suburb": "Avondale",
  "bedrooms": 3,
  "bathrooms": 2,
  "size_sqm": 180,
  "description": "Single-storey house with a garden."
}
```

Permitted create behaviour:

| Actor | `approval_status` sent | Stored approval | Can set another `agent_id` |
|---|---|---|---|
| Salesperson | omitted or anything except `draft` | `pending_approval` | No. 403 `FORBIDDEN` |
| Salesperson | `draft` | `draft` | No |
| Salesperson | `approved` or `rejected` | Forced to `pending_approval` | No |
| Manager | `approved` (default) | `approved` | Yes, if that user is active in this organisation |
| Manager | `draft` | `draft` | Yes |

`status` is availability (`available`, `under_offer`, `reserved`, `sold`, `let`, `rented`, `under_management`). Approval is separate. A salesperson listing is not live, and is not matched, until a manager sets `approval_status` to `approved`. Sold, let and rented still require the existing compliance checkpoint on PATCH.

Agents may PATCH only their own `draft` or `pending_approval` rows. They cannot approve, reject, delete, or edit an approved listing. Managers may approve, reject, reassign and delete. Bearer create and PATCH return `listingReadDto` (`photos: []`, `images`, `legacyImagesGated`, `permittedActions`). Do not send public photo URLs. A Bearer body that includes `photos` which are not already private keys for this listing returns 400 `USE_PRIVATE_IMAGE_UPLOAD`. Create has no listing id yet, so Bearer create must omit `photos`.

`permittedActions` is `{read, edit, approve, delete}`. `edit: true` is the only signal that the draft form and photograph upload will be accepted.

## Listing photograph upload

`POST P/listings/{listingId}/images` as `multipart/form-data`.

| Part / header | Rule |
|---|---|
| `file` | Required. JPEG, PNG, WebP or AVIF by file signature, not by the filename. |
| `cover` | Optional. `"true"` places this photograph at index 0. Otherwise it is appended. |
| `Idempotency-Key` | Optional, 8 to 200 characters. The same key replaces the same object and does not add a second row. |
| Size | 1 byte to 20 MiB. Larger is 413 `PAYLOAD_TOO_LARGE`. |
| HEIC | 415 `UNSUPPORTED_MEDIA`. Convert on the phone before upload. |

The actor must have `permittedActions.edit`. Storage must be the configured private listing bucket, distinct from the public media bucket. If it is missing, the response is 503 `STORAGE_UNAVAILABLE` and nothing is written to public storage. Order is the `photos` array. Index 0 is the cover. Maximum 50 photographs.

`201` (or `200` when the idempotency key already existed):

```json
{
  "listing": { "id": "listing", "photos": [], "images": [{ "index": 0, "cover": true, "endpoint": "/api/clients/org/listings/listing/images/0" }], "legacyImagesGated": false },
  "image": { "index": 0, "cover": true, "endpoint": "/api/clients/org/listings/listing/images/0" },
  "idempotent": false
}
```

`GET` that endpoint returns `{url, expiresAt, expiresInSeconds: 300}`. Download the URL without the Sales JWT. Legacy public URLs are not returned to Bearer clients. This change does not migrate or delete old public objects.

## Listing to matched buyers

`GET P/matching?listingId={listingId}`

Only an approved `available` listing produces matches. Otherwise `{ok: true, matches: [], notice}`. Each match:

```json
{
  "searchId": "search",
  "listingId": "listing",
  "strength": "strong",
  "score": 85,
  "scoreMeaning": "rules_points",
  "reasons": ["Location matches Avondale", "Within the stated budget"],
  "hardPassed": ["Sale listing", "Approved and available"],
  "budgetCompatible": true,
  "locationCompatible": true,
  "requirementsCompatible": true,
  "searchStatus": "active",
  "relationship": "other_agent",
  "managedBy": "Other Agent",
  "contactName": null,
  "phone": null,
  "introductionStatus": null,
  "canRequestIntroduction": true,
  "permittedActions": ["request_introduction"],
  "introductionNote": null
}
```

`relationship` is `own`, `introduced`, `other_agent`, or `unassigned`.

| `permittedActions` | Meaning |
|---|---|
| `open_buyer` | This agent or a manager may open the buyer search. |
| `request_introduction` | Call `action: "introduction"`. Identity stays hidden. |
| `view_introduced_contact` | An accepted introduction reveals name and phone for this property only. |
| `[]` | Pending, declined, or no further action. |

For another agent's buyer the response does not include phone, name, budget figures, preferred areas, features or notes. `reasons` describe the listing fit. `score` is the existing weighted total. `incomplete: true` means the scan stopped at the existing ceiling.

`GET P/matching?searchId=` remains the owned-search direction and still includes the listing read DTO.

## Introductions

Create, list, detail and decision use the existing services.

`POST P/buyer-sales/actions`

```json
{ "action": "introduction", "listingId": "listing", "searchId": "search" }
```

`201 {ok: true, introduction}`. The caller cannot request an introduction to a search they already manage (400). A declined pair cannot be requested again (409). An open or accepted request returns the existing row.

`GET P/buyer-sales/introductions` returns `{ok: true, items}` for requests the caller sent or may review. Detail is `GET P/buyer-sales/introductions/{introductionId}`.

Decision:

```json
{ "action": "review_introduction", "introductionId": "intro", "decision": "declined", "decisionReason": "Buyer already viewed this street." }
```

`decision` is `accepted` or `declined`. Decline requires a non-blank reason (400). Only `requested` can be decided (409 on a repeat or a race). The requester cannot approve or decline their own request (403). After reassignment, the previous owner cannot decide (403). An inactive assignee falls through to a manager. Acceptance also requires a live listing and a matchable search (409 otherwise).

Before acceptance, the requesting agent gets `contactName: null`, `phone: null`, and `requirementsSummary: ""`. The reviewing owner still sees the requirement summary. After a valid acceptance, the requester sees name and phone for that property. The introduction does not open the full buyer-search bundle. Decisions write an in-app notification to the requester. They do not send customer WhatsApp.

## Viewings

Use `POST P/buyer-sales/actions`. Do not call `POST P/viewings` with a Bearer token (405 `USE_OWNED_SEARCH_ACTION`).

Book:

```json
{
  "action": "viewing",
  "searchId": "search",
  "listingId": "listing",
  "scheduledAt": "2026-12-01T11:00:00.000+02:00",
  "confirmationStatus": "awaiting_confirmation",
  "instructions": "Meet at the gate",
  "confirmOverlap": false
}
```

Header `Idempotency-Key` is required for Bearer, 8 to 200 characters. The search must belong to the caller. The listing must be visible and approved-available. `scheduledAt` must be a future timestamp with a timezone offset. The organisation timezone is returned on `GET P/viewings` as `timezone`; send the offset explicitly rather than a naive local time.

`201`:

```json
{
  "ok": true,
  "viewing": { "id": "viewing-id" },
  "notificationEffects": { "customerNotification": "NOT_REQUESTED", "provider": null }
}
```

The same key and the same search, listing, agent, time and instructions returns the original viewing with `idempotent: true`. A different payload with that key is 409. A scheduling overlap is 409 with `warning`; repeat only after the user confirms, with `confirmOverlap: true`.

Reschedule:

```json
{ "action": "reschedule_viewing", "viewingId": "viewing-id", "scheduledAt": "2026-12-02T11:00:00.000+02:00", "confirmOverlap": false }
```

The stored confirmation becomes `rescheduled`. A changed booking must still be in the future. A lost race is 409.

Outcome:

```json
{ "action": "viewing_outcome", "viewingId": "viewing-id", "outcome": "interested", "note": "Asked for a second visit" }
```

`outcome` is one of `interested`, `considering`, `second_viewing`, `wants_offer`, `too_expensive`, `location_unsuitable`, `condition`, `not_interested`, `no_show`. These actions do not send a customer notification.

## Inquiry relationships

`GET P/leads/{leadId}/real-estate` accepts the same Bearer guard as the other client routes, then the existing lead-read check. The workspace adds `buyerSearchId`. `linkedListing.id` is the property link. `viewings[].id` and `interested[].id` are the related records. Phone on that workspace is the inquiry the caller is already allowed to read.

Link a lead to a buyer search the caller owns:

```json
{ "action": "link_enquiry", "searchId": "search", "leadId": "lead" }
```

The lead and the search must share a customer contact (400 otherwise). This sets `leads.buyer_search_id` and the buy-side or tenant-side deal side. It does not create a second search.

`PATCH` on the same inquiry route still links `linked_listing_id` for the property. Stage values that the website derives from viewings or offers are rejected with 400.

## Conversation-context Sales Copilot

Copilot stays on the conversation. There is no second engine.

`GET /api/sales/copilot/conversations/{leadId}`

The lead id is the conversation id. `canReadLead` allows the assigned salesperson or a manager in that organisation. Another organisation is 404. The response now includes:

```json
{
  "conversation": { "leadId": "lead", "scope": "assigned_conversation" },
  "customerDelivery": "NOT_PERFORMED",
  "sendsCustomerMessage": false,
  "approvalRequired": true,
  "suggestedResponsesAreDrafts": true,
  "feature": "Sales Copilot",
  "analysis": { "status": "idle", "summary": null, "updatedAt": null, "error": null },
  "items": []
}
```

`analysis.summary` is the stored conversation summary. Each item is an existing work item: `id`, `actionType`, `title`, `explanation`, `queue`, `reviewStatus`, `primaryLabel`, `evidence`, `missing`, `proposedAt`. Suggested reply text inside a work item is a draft. `POST /api/sales/copilot/work-items/{itemId}` with `action` of `approve`, `dismiss`, `snooze`, `retry`, `complete`, or `choose` reviews that item. Approve can save a follow-up or a quotation draft. It does not call WhatsApp and it does not send a customer message. Dismiss ignores the suggestion. A stale conversation returns 409 `stale`. Demo sessions return `simulated: true` and change nothing.
