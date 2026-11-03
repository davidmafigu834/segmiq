# Real-estate compliance Phase 1 architecture

Phase 1 extends the existing real-estate CDD workflow. It does not create a second buyer, property or transaction database, and it does not call a model provider.

## Existing systems reused

| Concern | Source of truth |
| --- | --- |
| Organisation | `clients.id`. Every compliance row is scoped by `client_id`. |
| Authentication | NextAuth cookies and the existing mobile bearer resolver in `lib/auth/resolveApiAuth.ts`. |
| Roles | `CLIENT_MANAGER` and `SALESPERSON`, plus `can_review_compliance` when review is restricted. |
| Permissions | `lib/auth/rbac`. New capabilities sit beside `compliance.read` and `compliance.review`. |
| Buyers | `contacts` and `real_estate_buyer_searches`. Buyer verification is a section on the existing buyer search. |
| Sellers | `contacts` and `real_estate_listing_parties`. A seller identity is not copied per property. |
| Listings | `listings` and the existing approval transition. Publication still requires `approval_status = approved`. |
| Offers and transactions | `real_estate_offers` and `real_estate_transactions`. The accepted-offer case remains the transaction CDD case. |
| Documents | Private R2 via `lib/real-estate/private-document-storage.ts`. Keys stay under `clients/{org}/compliance/`. |
| Audit | Append-only `compliance_case_events`. |
| Notifications | `notifications.type = COMPLIANCE_ALERT`. |
| Tasks | `compliance_work_items`. Completing one does not verify a requirement. The sales task list remains lead-derived. |
| Marketing pages | `listingMarketingGate`. A compliance block is added only when listing-readiness enforcement is explicitly on. |

## Data model

Additive migration: `supabase/migrations/20261103195500_re_compliance_management_foundation.sql`.

- `compliance_cases.context` is `buyer`, `seller`, `property` or `transaction`. Existing rows stay `transaction`.
- `compliance_policy_versions` stores a reviewed template version and an enforcement JSON object. Enforcement defaults off.
- `compliance_case_requirements` is the requirement state machine.
- `compliance_evidence_versions` keeps every uploaded version. Content is not replaced in place.
- `compliance_invitations` stores a hash of the public token.
- `compliance_invitation_sessions` stores a hash of the email code.
- `compliance_work_items` is the follow-up list.
- Transaction columns `legal_route`, `compliance_readiness`, `legal_transfer_status` and `payment_evidence_status` are independent of `real_estate_transactions.status`.

Direct Data API access is revoked. The service role is used by server routes after an authorisation check.

## Policy engine

`lib/real-estate/compliance-management/engine.ts` is deterministic. Templates for individual and company purchasers and sellers, listing readiness, residential sale, title-deed transfer, cession and basic completion are labelled sample checklists. A title-deed item does not apply to a cession route. Nothing in the sample becomes a gate until a manager saves a reviewed policy version and turns on an enforcement flag.

## State machines

Requirement states: not started, awaiting information, submitted, under review, more information required, verified, rejected, waived, not applicable.

An upload moves a requirement to submitted. It never verifies it. Waiver requires the template to allow it, an independent reviewer and a reason. The reviewer cannot be the case creator, the buyer agent or the submitter. That rule is repeated in `compliance_requirement_decide_atomic`.

Case status continues to use the existing CDD statuses. Readiness (`not_started`, `incomplete`, `under_review`, `action_required`, `approved`, `escalated`) is derived from requirement states and is not the commercial stage.

Payment evidence moves `reported` to `proof_uploaded` to `under_verification` to `independently_confirmed`. Proof cannot skip to confirmed. Legal transfer becomes `registered` only from an authorised registration or cession-confirmation milestone. Handover does not register a transfer.

## Permissions

| Capability | Salesperson | Manager |
| --- | --- | --- |
| View summary | Yes, own cases | Yes |
| Request documents | Yes | Yes |
| Review, approve, correct | No | Yes, and only flagged users when that setting is on |
| Escalate and read restricted detail | No | Yes |
| Policy, finance verification, conveyancing | No | Yes |
| Audit | No | Yes |

Support Access remains read-only and receives summary plus audit, not escalation detail or review actions.

## API

Authenticated organisation routes:

- `GET/POST /api/clients/{clientId}/compliance/subjects`
- `GET/POST /api/clients/{clientId}/compliance/centre`

Public route, token in the body, no account:

- `POST /api/public/compliance-invitations`

Mobile route, session organisation only:

- `GET /api/sales/app/compliance`

## Storage

Files are written to the private document bucket. The database stores the object key and a SHA-256 checksum, not a public URL. `scan_status` stays `unscanned` until a malware scanner is connected. Versions cannot be deleted through the normal path.

## Audit and security

Events store an action summary, not an identity number or file bytes. Confidential escalation events are hidden from salespeople. Invitation tokens and email codes are hashed with the server secret. Public pages send `Referrer-Policy: no-referrer`. Cross-tenant reads filter on `client_id` and return not found.

## Future AI boundary

Phase 1 has no model call and no AI verification status. A later observer may attach notes to an evidence version. It must not update `compliance_case_requirements.state` or `compliance_cases.status`. Human decisions recorded through the atomic function remain authoritative.
