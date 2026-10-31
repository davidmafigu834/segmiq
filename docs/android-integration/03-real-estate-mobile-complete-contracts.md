# Real Estate native Android complete contracts (contract version 1)

Base reviewed revision: `2d4e71d59a4fa0adc40cb3d5d9a4ed4890130672`.
This contract describes the working-tree integration sprint on 2026-10-31, including the
pre-existing compliance safety work. It is source readiness, not deployed attestation.
The Android report used the same base revision; all correct Milestone B services are reused.

## Shared conventions

Use `Authorization: Bearer <Sales JWT>` on HTTPS APIs. Derive clientId from bootstrap, never
from a different account's cache. Server session registry, MFA, role, tenant and billing guards
remain in force. No Supabase key, cookie bridge or unrestricted proxy is used.
Bootstrap includes `release:{contractVersion:1,revision:string|null,deployedVerification:"NOT_ATTESTED"}`.
The revision is VERCEL_GIT_COMMIT_SHA or SEGMIQ_RELEASE_REVISION when set. Missing revision is
null. A revision or capability flag never proves deployment acceptance.

IDs are opaque stable strings (UUID-validated on write DTOs). JSON null is distinct from an
omitted patch field. Timestamps are ISO-8601 with a timezone; never send a device-local naive
time. Monetary values are JSON numbers, finite and positive for offers, nonnegative for
deposits; currency is a server-validated three-letter code, not a display symbol.
Errors retain `{error:string}` and optional code/warning/details. Handle HTTP 400 invalid input,
401 authentication, 402 subscription, 403 permission/private data/cross-tenant, 404 absent or
not visible, 409 revision/transition/overlap, 503 dependency/migration/storage unavailable.
Never sign out on a 503. Preserve the auth-specific codes in 01-auth-and-bootstrap.md.
Permitted actions are scoped candidates: server transition, compliance, financial and revision
checks still apply when invoked. Android never computes authoritative completion decisions.

Prefix P = `/api/clients/{clientId}` below. Responses are JSON unless stated otherwise.

## Properties, Buyers, matching, inquiries

The exact Property/BuyerSearch DTOs, pagination and write validation remain in
02-real-estate-properties-buyers.md. Existing endpoints:

- GET/POST P/listings; GET/PATCH/DELETE P/listings/{listingId}.
- GET/POST P/buyer-searches; GET/PATCH P/buyer-searches/{searchId}.
- GET P/matching?searchId=... or ?listingId=....
- GET /api/sales/leads; GET /api/leads/{leadId}; existing timeline/internal-note/follow-up APIs.

Agent directories remain own-search scoped; approved company properties plus own draft/pending
properties are visible. Private buyer identity needs ownership or a currently valid property-
specific accepted introduction. Full private search access does not follow from an introduction.
Property read DTOs exclude owner/document/acquisition columns. AgentId cannot widen a scope.
Existing inquiry contracts are preserved rather than duplicated into a Real Estate mobile model.

## Property images

GET P/listings/{listingId}/images/{index} -> `{url:string,expiresAt:ISO,expiresInSeconds?:number}`.
Bearer Property DTO gives `images:[{index,cover,endpoint}]`, photos:[], legacyImagesGated:boolean.
Array index zero is cover. Gaps remain visible when older references cannot be delivered.
Authorization precedes signing. Registered keys must belong to the same organisation AND
property under clients/{clientId}/listings/{listingId}/photos/, safe jpg/jpeg/png/webp/avif only.
A distinct private listing bucket is mandatory. HEAD validates positive size <=20 MiB and
stored MIME matching the expected type; missing/oversized/mismatched objects are not signed.
Image bytes still require signature validation during the approved migration/upload process.
Signed URLs last 300 seconds; refetch metadata to renew. Download without the Sales JWT,
accept only the configured private account's HTTPS R2 signed host, do not follow arbitrary
host redirects or forward credentials. No resizing or transformation is implied.
IMAGE_UNAVAILABLE/409 means reference migration is required; 503 means unavailable storage.
Legacy public images are never returned to Bearer clients. Public originals may remain
reachable independently until the approved storage migration removes/revokes them.

## Viewings

GET P/viewings supports contact_id, listing_id, from, to, id. Bearer clients additionally use
page (default 1), limit (default 80, maximum 500). The bounded source scan checks up to 5000
rows before access filtering. Response:
`{viewings:Viewing[],timezone:string,page,limit,total,incomplete:boolean}`.
Total describes authorized rows in the scanned subset; incomplete prohibits an exhaustive claim.
GET P/viewings/{viewingId} -> `{viewing:Viewing,timezone}` or 404.
Viewing fields: id, listing_id, agent_id, scheduled_at, status, listing (nullable/absent on FK
fallback), access, confirmation_status, updated_at, created_at, reschedule_count.
Full access adds contact_id, buyer_search_id, contact, instructions, feedback_text,
feedback_sentiment, outcome, cancel_reason, follow_up_at where stored.
Listing-only participants receive no buyer ID, search ID, contact, instructions or feedback.
`permittedActions:string[]` contains reschedule_viewing/viewing_outcome only for an eligible
linked full-access viewing. `notificationEffects.customerNotification=NONE_ON_READ`.
Search reassignment no longer gives the previous viewing agent private search access.
Fallback reads keep tenant and candidate filters; detail repeats the same read policy.

POST P/buyer-sales/actions is the mobile write path. The exact discriminated DTOs follow.
viewing: require a stable Idempotency-Key header (8..200 characters) for mobile requests.
A replay must match search, property, agent, time and instructions and is reauthorized against
current search ownership. A changed payload with the same key returns 409. Database uniqueness
prevents simultaneous same-key inserts; after a transient concurrent response, retry the same
key. A new key is not a replay. Date/time must be a future timezone-qualified ISO timestamp.
409 with warning is a scheduling overlap; repeat only after user confirmation with confirmOverlap.
The service checks tenant, own search, approved available property and booking-agent scope.
Modern bookings never fall back to a schema that discards search/instructions/idempotency.

- viewing success: 201 `{ok:true,viewing,warning?,idempotent?,notificationEffects:{customerNotification:"NOT_REQUESTED",provider:null}}`.
- reschedule_viewing success: `{ok:true,warning?,unchanged?,notificationEffects:{customerNotification:"NOT_REQUESTED",provider:null}}`.
- viewing_outcome success: `{ok:true,status,outcome,idempotent?,notificationEffects:{customerNotification:"NOT_REQUESTED",provider:null}}`.

Viewings have status-transition protection; viewing creation idempotency is not a distributed
booking-slot lock. General rescheduling does not currently carry a separate client revision.
The legacy POST/PATCH P/viewings remains web-only; a Bearer request receives 405
USE_OWNED_SEARCH_ACTION. Legacy web create can request WhatsApp confirmation and completed
viewings can request feedback; privacy checks now precede legacy booking notifications.
A service request is not proof of provider delivery. Native mobile never calls this path.
Mobile cancellation is not fabricated as a viewing outcome: use only documented outcomes;
a dedicated notification-safe cancellation action remains gated.

## Introductions

GET P/buyer-sales/introductions -> `{ok:true,items:Introduction[]}`, up to 100 source rows.
GET P/buyer-sales/introductions/{introductionId} -> `{introduction:Introduction}`.
Items: id,status,createdAt,decidedAt,legacyDecision,listingId,listingLabel,searchId,
requestingAgentName,responsibleAgentName,unassigned,requirementsSummary,matchReasons,strength,
eligible,eligibilityReason,waitingCopy,canApprove,canDecline,ownRequest,contactName,phone.
Sent items are ownRequest=true; received reviewable items are canApprove/canDecline. Detail
queries the requested ID before projection, so it does not disappear beyond the list ceiling.
Create/review use buyer-sales/actions. Decline requires a nonblank reason. Decisions condition
on status=requested; repeated or racing decisions return 409. Self-approval and stale reviewer
access are denied. An accepted disclosure is tied to requester/property/search/current owner
and live matchability. Decisions generate existing in-app requester notifications AFTER the
successful update; no automatic customer WhatsApp is requested by these actions.
No client revision field is invented: pending status is the decision concurrency token.

## Offers and negotiation

GET P/offers filters tab, listing_id, contact_id, lead_id, agent_id, q, min, max, from, to.
Response `{offers:OfferListRow[],summary,agents,byAgent,multiOfferListings,listCompleteness}`.
The service source ceiling is 500; listCompleteness={bounded:true,sourceLimit:500,exhaustive:false}.
Do not treat a filtered count as a tenant-wide exact count. Page/cursor are not supported.
Agents see their own buyer/listing participation. Managers retain company scope. Detail no
longer fetches siblings under a forged manager actor, so competing buyer-agent amounts and
history do not leak through siblingActive.
GET P/offers/{offerId} -> `{ok:true,offer,events,listing,contact,siblingActive,commission}`.
Offer is the stored offer snapshot plus effective status, agent names, permittedActions.
Events: id,eventType,label,amount,amountLabel,note,createdAt,createdByName. commission is null
unless the established role permits it. Related listing/contact are nullable.
POST P/offers uses the exact create schema below -> `{offer}`.
PATCH P/offers/{offerId} uses the exact schema below -> `{offer,notifyAvailable,siblingActiveCount}`.
Native PATCH requires expected_updated_at equal to the detail snapshot's updated_at.
A stale value returns 409; state updates compare-and-swap the stored revision. Accept requires
the existing re_accept_offer RPC and fails closed with 503 if unavailable. Atomic acceptance
reserves the property and prevents competing reservations. Original/current values and event
history are preserved. The separate notification route is not enabled for mobile in this sprint:
notifyAvailable is an opportunity, never proof a customer notification was sent.
Creation has no new generic idempotency claim: native financial create must not blindly retry
an ambiguous response. Reconcile existing offers first; acceptance/revision operations use
stored state/revisions. Server transitions remain authoritative.

## Transactions, milestones and documents

GET P/transactions filters tab,q,agent_id -> `{rows,counts,listCompleteness}`. Source ceiling
500; exhaustive=false. GET P/transactions/{transactionId} ->
`{ok:true,transaction,milestones,events,listing,contact}`. The transaction includes
permittedActions and transitionValidation=SERVER_REQUIRED. Milestones include id,key,label,
status,dueAt,completedAt,notes,sortOrder,updatedAt. No phone/participant context is returned
before transaction authorization. Agent responses remove commission keys/events/milestones
recursively, including mutation responses.
GET P/transactions/{transactionId}/workspace reuses transactionOperations: permission/slice,
milestones, participants, visible document metadata, activities and names; commission data is
removed for agents. Stored private storage keys are not returned in this projection.
POST P/transactions body `{offer_id:UUID}` starts or returns an accepted-offer transaction.
Creation AND replay revalidate current transaction/offer participation. Response
`{transaction,created:boolean}`. Existing uniqueness/reservation constraints govern duplicate
starts; Android does not construct a completed transaction locally.
PATCH P/transactions/{transactionId} uses the exact schema below. Native requests require
expected_updated_at. update_milestone ALSO requires expected_milestone_updated_at (the
milestone's updatedAt). Notes/deposit/agreement/date updates and milestones compare-and-swap
timestamps. A stale revision returns 409 without a successful write.
start_progress/complete/cancel/fallen_through with native revisions require the reviewed
re_mobile_transition_transaction wrapper. It row-locks, checks actor/participation/revision,
then delegates to existing compliance-safe transaction functions. Missing wrapper -> 503.
The SQL is an UNAPPLIED REVIEW PROPOSAL in sql/mobile-transaction-revision-proposal.sql.
An applied migration and synthetic concurrent database test are required before enabling
financial progression. Existing compliance prerequisites still gate completion.

GET P/transactions/{transactionId}/documents?documentLinkId=UUID ->
`{url,expiresInSeconds:300,expiresAt}` after transaction document visibility and path ownership.
POST same path takes multipart file,category,visibility?,milestoneId?,replacesDocumentLinkId?.
4 MiB maximum. Native uploads require signature-verified PDF/JPEG/PNG/WebP/HEIC; Word uploads remain web-only (native 415). These stored files are attachment downloads; content signature validation is not malware certification.
Uploads are awaiting review, never automatically verified. A distinct private document bucket
is required. Existing public-bucket document copies must be migrated/revoked with approval.

## Compliance

GET/POST P/compliance/cases; GET/PATCH P/compliance/cases/{caseId};
GET/POST P/compliance/cases/{caseId}/documents/{docId} are Bearer-aware through the SAME
privileged COMPLIANCE scope check used for web/support access. The actor is derived from
that check's context, not a separate cookie identity. Support access remains read-only;
review still requires real compliance-review entitlement and company policy.
List filters: tab,q,agent_id,reviewer_id,risk,entity_type,status,offer_id,lead_id; bounded at 300.
Detail includes case/contact/listing/offer/parties/documents/events,canCollect,canReview,
seeInternal,completeness,nextUpload and existing redaction. Agent review/internal details
remain restricted. Exact create/action schema excerpts are below.
Document GET -> `{url,expiresAt,expiresInSeconds:300}`. POST accepts multipart file up to 20 MiB,
allowed PDF/JPEG/PNG/WebP/HEIC/HEIF with content signature checking, or authorised JSON
`{reuse_storage_key:string}` from an accessible source case. Cross-tenant/path reuse is denied.
Upload leaves evidence status=received and does not grant accepted/approved status.
Private-document storage configuration is mandatory; keys never become public media links.
Signed links may remain usable for their 300-second TTL after later revocation; clear private
caches on logout/account switch, never place documents in public gallery/device shared folders.

## Salesperson calendar

GET /api/sales/calendar?from=ISO&to=ISO&page=1&limit=100 is read-only and uses the salesperson
actor guard. Maximum window 93 days, limit maximum 500. Response:
`{events:Event[],timezone,page,limit,total,incomplete:true,completenessReason,viewingsIncomplete,
sourceCoverage:[FOLLOW_UP,CALL,QUOTE_REVIEW,VIEWING],standaloneMeetingsSupported:false}`.
Event: id,type,startAt:ISO|null,endAt:null,allDay:boolean,date:YYYY-MM-DD|null,timezone,
relatedEntity:{type,id},title,permittedActions:[] . Date-only follow-ups remain organisation-local
calendar dates and have no fabricated time/duration. Timed callbacks/viewings are instants.
IDs use source prefixes and are deduplicated. Viewing labels contain no private buyer context.
Existing task/callback caps make this a bounded feed; it is NOT advertised as a full standalone
appointments/meetings database. The manager calendar guard is unchanged. Managers who sell
receive their own salesperson feed, not an unrestricted manager-calendar workaround.

## Capabilities and release gates

Additive featureFlags: realEstateViewingsRead,realEstateViewingsWrite,realEstateOffers,
realEstateTransactionsRead,realEstateTransactionsWrite,realEstateIntroductions,
realEstateComplianceRead,salespersonCalendarRead. Require the Real Estate experience and
ALLOWED salesAccess; compliance additionally requires actual compliance.read permission.
Existing Milestone B flags remain. Flags describe source endpoint/actor support; per-resource
permittedActions, migrations and rollout acceptance still decide usable operations. Financial
transitions and private storage must not be enabled solely from these broad module flags.

## Exact request validation schemas

These are verbatim schema excerpts from the source at this sprint. UUIDs and strings are placeholders, not credentials.

### app/api/clients/[clientId]/buyer-sales/actions/route.ts

```ts
const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("interest"),
    searchId: z.string().uuid(),
    listingId: z.string().uuid(),
    state: z.enum(INTEREST_STATES),
    rejectionReason: z.enum(REJECTION_REASONS).nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
  }),
  z.object({
    action: z.literal("viewing"),
    searchId: z.string().uuid(),
    listingId: z.string().uuid(),
    scheduledAt: z.string().datetime({ offset: true }),
    confirmationStatus: z.enum(["tentative", "awaiting_confirmation", "confirmed"]).optional(),
    instructions: z.string().max(2000).nullable().optional(),
    confirmOverlap: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("reschedule_viewing"),
    viewingId: z.string().uuid(),
    scheduledAt: z.string().datetime({ offset: true }),
    confirmOverlap: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("viewing_outcome"),
    viewingId: z.string().uuid(),
    outcome: z.enum(VIEWING_OUTCOMES),
    note: z.string().max(2000).nullable().optional(),
  }),
  z.object({
    action: z.literal("rental_application"),
    searchId: z.string().uuid(),
    listingId: z.string().uuid(),
    notes: z.string().max(2000).nullable().optional(),
  }),
  z.object({
    action: z.literal("deposit"),
    applicationId: z.string().uuid(),
    depositAction: z.enum(["report", "verify"]),
  }),
  z.object({
    action: z.literal("link_enquiry"),
    searchId: z.string().uuid(),
    leadId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("introduction"),
    listingId: z.string().uuid(),
    searchId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("review_introduction"),
    introductionId: z.string().uuid(),
    decision: z.enum(["accepted", "declined"]),
    decisionReason: z.string().max(500).nullable().optional(),
  }),
]);
```

### app/api/clients/[clientId]/offers/route.ts

```ts
const createSchema = z.object({
  listing_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable().optional(),
  buyer_search_id: z.string().uuid().nullable().optional(),
  amount: z.number().finite().positive(),
  currency: z.string().min(3).max(3).optional(),
  conditions: z.string().max(5000).nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  submit: z.boolean().optional(),
});
```

### app/api/clients/[clientId]/offers/[offerId]/route.ts

```ts
const patchSchema = z.object({
  action: z.enum(["submit", "counter", "revise", "accept", "reject", "withdraw", "note", "edit_draft"]),
  amount: z.number().finite().positive().nullable().optional(),
  note: z.string().max(5000).nullable().optional(),
  conditions: z.string().max(5000).nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  reason: z.string().max(2000).nullable().optional(),
  expected_updated_at: z.string().nullable().optional(),
});
```

### app/api/clients/[clientId]/transactions/[transactionId]/route.ts

```ts
const patchSchema = z.object({
  action: z.enum(TXN_ACTIONS),
  expected_updated_at:z.string().datetime({offset:true}).optional(),
  expected_milestone_updated_at:z.string().datetime({offset:true}).optional(),
  deposit_amount: z.number().finite().nonnegative().nullable().optional(),
  reason: z.string().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  listing_pct: z.number().finite().min(0).max(100).nullable().optional(),
  selling_pct: z.number().finite().min(0).max(100).nullable().optional(),
  expected_completion_date: z.string().nullable().optional(),
  milestone_id: z.string().uuid().optional(),
  status: z.enum(RE_MILESTONE_STATUSES).optional(),
});
```

### app/api/clients/[clientId]/compliance/cases/route.ts

```ts
const createSchema = z.object({
  contact_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable().optional(),
  offer_id: z.string().uuid().nullable().optional(),
  listing_id: z.string().uuid().nullable().optional(),
  entity_type: z.enum(["individual", "corporate"]).optional(),
});
```

### app/api/clients/[clientId]/compliance/cases/[caseId]/route.ts

```ts
const patchSchema = z.object({
  action: z.enum([
    "update_profile",
    "add_party",
    "remove_party",
    "submit_review",
    "start_review",
    "request_info",
    "require_edd",
    "set_risk",
    "approve",
    "restrict",
    "reject",
    "review_document",
    "reopen",
    "note",
  ]),
  entity_type: z.enum(["individual", "corporate"]).optional(),
  cdd_profile: z.record(z.unknown()).optional(),
  full_name: z.string().optional(),
  relationship_type: z.string().optional(),
  notes: z.string().optional(),
  party_id: z.string().uuid().optional(),
  reason: z.string().optional(),
  risk_level: z.enum(["unclassified", "low", "medium", "high"]).optional(),
  factors: z.unknown().optional(),
  document_id: z.string().uuid().optional(),
  decision: z.enum(["accepted", "rejected"]).optional(),
  note: z.string().optional(),
  internal: z.boolean().optional(),
});
```

## Referenced write enums and response projections

These excerpts resolve named schema constants and stored response-row types above.

```ts
export const VIEWING_OUTCOMES = [
  "interested",
  "considering",
  "second_viewing",
  "wants_offer",
  "too_expensive",
  "location_unsuitable",
  "condition",
  "not_interested",
  "no_show",
] as const;
```

```ts
export const INTEREST_STATES = [
  "matched",
  "recommended",
  "sent",
  "interested",
  "not_interested",
  "viewing_requested",
  "viewing_completed",
  "offer",
] as const;
```

```ts
export const REJECTION_REASONS = [
  "wrong_location",
  "above_budget",
  "too_small",
  "condition",
  "layout",
  "financing",
  "changed_plans",
  "other",
] as const;
```

```ts
export const RE_MILESTONE_STATUSES = [
  "pending",
  "in_progress",
  "done",
  "skipped",
  "blocked",
] as const;
```

```ts
const TXN_ACTIONS = [
  "start_progress",
  "complete",
  "fallen_through",
  "cancel",
  "record_deposit",
  "sign_agreement",
  "update_commission",
  "update_notes",
  "set_expected_completion",
  "update_milestone",
] as const;
```

### OfferListRow

```ts
export type OfferListRow = {
  id: string;
  listingId: string;
  propertyLabel: string;
  listingPrice: number | null;
  listingPriceLabel: string | null;
  listingStatus: string;
  buyerName: string | null;
  contactId: string;
  leadId: string | null;
  currentAmount: number;
  originalAmount: number;
  currentAmountLabel: string;
  currency: string;
  status: ReOfferStatus;
  statusLabel: string;
  agentId: string | null;
  agentName: string | null;
  lastActivityAt: string;
  lastActivityLabel: string;
  lastEventLabel: string | null;
  nextActionLabel: string;
  expiryDate: string | null;
  complianceStatus: string | null;
  complianceLabel: string | null;
};
```

### OfferEventRow

```ts
export type OfferEventRow = {
  id: string;
  eventType: ReOfferEventType;
  label: string;
  amount: number | null;
  amountLabel: string | null;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
};
```

### TransactionListRow

```ts
export type TransactionListRow = {
  id: string;
  listingId: string;
  propertyLabel: string;
  buyerName: string | null;
  contactId: string;
  leadId: string | null;
  offerId: string | null;
  status: ReTransactionStatus;
  statusLabel: string;
  transactionType: ReTransactionType;
  agreedPrice: number;
  agreedPriceLabel: string;
  currency: string;
  agentId: string | null;
  agentName: string | null;
  expectedCompletionDate: string | null;
  milestonesDone: number;
  milestonesTotal: number;
  commissionTotalLabel: string | null;
  updatedAt: string;
};
```

### TransactionMilestoneRow

```ts
export type TransactionMilestoneRow = {
  id: string;
  key: ReMilestoneKey;
  label: string;
  status: ReMilestoneStatus;
  dueAt: string | null;
  completedAt: string | null;
  notes: string | null;
  sortOrder: number;
};
```

### TransactionEventRow

```ts
export type TransactionEventRow = {
  id: string;
  eventType: ReTxnEventType;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
};
```

### IntroductionQueueItem

```ts
export type IntroductionQueueItem = {
  id: string;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  legacyDecision: boolean;
  listingId: string;
  listingLabel: string;
  searchId: string;
  requestingAgentName: string;
  responsibleAgentName: string | null;
  unassigned: boolean;
  requirementsSummary: string;
  matchReasons: string[];
  strength: string | null;
  eligible: boolean;
  eligibilityReason: string | null;
  waitingCopy: string;
  canApprove: boolean;
  canDecline: boolean;
  ownRequest: boolean;
  contactName: string | null;
  phone: string | null;
};
```
