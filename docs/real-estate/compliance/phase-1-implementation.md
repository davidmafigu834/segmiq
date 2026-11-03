# Real-estate compliance Phase 1 implementation

Implemented in the existing web application. The foundation migration was applied to the leadstaq database. The web application was not deployed.

## Features implemented

- Four contexts on the existing `compliance_cases` record: buyer, seller, property and transaction.
- Versioned sample checklists and an explicit policy activation flow. Sample items are not enforced for existing agencies.
- Requirement decisions through `compliance_requirement_decide_atomic`, including independent-review and waiver checks.
- Secure invitation creation, hashed tokens, email one-time codes, revocation and a public submission page.
- Evidence versions in private storage. A new file does not delete the previous one and does not verify the requirement.
- Listing publication continues to use the existing approval gate. It is additionally blocked only when a listing-readiness policy has `listing_publication: true`.
- Transaction workspace shows commercial stage, compliance readiness, legal transfer and payment evidence as separate facts.
- Compliance Centre for the queue, policy versions and audit.
- Buyer verification on the buyer search page and listing compliance on the property page.
- Mobile summary at `GET /api/sales/app/compliance`.
- Work items that can be completed without verifying the underlying requirement.

## Database changes

`supabase/migrations/20261103195500_re_compliance_management_foundation.sql`

The migration is additive. It does not seed approvals and does not turn enforcement on. It is applied on leadstaq as `re_compliance_management_foundation`. Existing cases stay on the transaction context with enforcement off.

## Routes and screens

| Surface | Route |
| --- | --- |
| Manager queue and policies | `/client/compliance/centre` |
| Existing CDD cases | `/client/compliance` |
| Agent compliance | `/sales/compliance` |
| Buyer verification | Existing buyer search detail |
| Listing compliance | Existing property detail |
| Transaction compliance | Existing transaction operations |
| Customer form | `/verify/c/{token}` |

## Workflows covered

An agent can open a checklist, choose requirements and create a request. The customer receives a code only when Resend is configured and the contact has an email. After the code is accepted, the form can be submitted. The requirement becomes submitted. A manager verifies, rejects or requests a change. The audit row records the action without the identity number.

A restricted escalation uses the existing enhanced-review action and notifies only users flagged `can_review_compliance`. Agents see “Additional review required”.

## Tests

`tests/compliance-management.test.ts` covers applicability, state transitions, self-approval, waivers, payment versus confirmation, legal transfer versus handover, invitation expiry and revocation, token comparison, reuse rules, masking and the listing gate. That file passed 18 tests. Combined with the existing compliance and agent-listing tests, 63 passed and none failed.

The existing compliance safety tests were not weakened.

Typecheck of the compliance, navigation, middleware and listing changes is clean. A full `tsc --noEmit` run while the dev server was rewriting `.next` reported two missing generated files (`app/api/security/csp-report/route.ts` and `app/dev/listing-preview/page.ts`). Those are Next's generated type stubs, not compliance source.

## Known blockers

- The foundation migration is applied on leadstaq. A live invitation stays closed until the customer enters the Resend verification code. An unknown token does not open the form.
- Document requests use the existing Resend setup (`RESEND_API_KEY` and `RESEND_FROM_EMAIL`, sender `notifications@segmiq.com`). A code is sent only when the contact has an email address. Phone-only contacts are not given an open form, and WhatsApp is not used as a substitute.
- No malware scanner is connected. Files remain `unscanned`.
- Conveyancer access is an internal milestone record. There is no external lawyer portal.
- Sales activities stay on the lead task model. Compliance follow-ups live in `compliance_work_items` and do not verify a requirement.
- Signed-in Compliance Centre, buyer, property and transaction screens were not exercised in the browser. Opening `/sales/compliance` without a session redirects to login. The customer form was exercised.

## Screenshots

Captured in the local browser against the running app, using synthetic sample data only:

- Invitation intro at `/verify/c/{token}`.
- Individual buyer form, including an empty-submit validation error.
- Company buyer form, with registered name, beneficial owner and registration document kept separate.
- Sample submission confirmation. The sample path stores nothing and does not mark a requirement verified. It is available only when `NODE_ENV` is not production.
- Mobile width 390px: the form, file input and actions stay in one column.
- Unknown invitation after the public API responds: the form stays closed and the page says document requests are not available yet.

Authenticated review, buyer, property and transaction screenshots still need a signed-in real-estate session.

## Deployment requirements

1. The foundation migration is applied on leadstaq. Do not run a full `supabase db push` over the rest of the local history.
2. Confirm the private document bucket is separate from public listing photos.
3. Resend is already configured. The contact still needs an email address before a code can be sent.
4. Have a qualified reviewer activate each policy version. Do not enable listing publication enforcement until that review is recorded.
5. Do not backfill fictional approvals onto live customers.

## Production acceptance

The database foundation is applied on leadstaq. Policy enforcement stays off, and no customer case was approved. The web application still needs a reviewed deploy before agents use the new screens in production. No customer documents were uploaded.
