# Real-estate compliance mobile contracts

Schema version: 1

Base path: `GET /api/sales/app/compliance`

This contract is implemented in the web API. It is not a statement that a production Android build is already calling it.

## Authentication

Send the existing SegmiQ sales bearer token. Cookie sessions are also accepted by the shared resolver. The organisation is taken from the token. A `clientId` query parameter is ignored. The API does not accept an actor id from the client as proof of permission.

A missing or invalid token returns `401` with `code: UNAUTHORIZED`.

## Query

| Parameter | Required | Meaning |
| --- | --- | --- |
| `context` | Yes | `buyer`, `seller`, `property` or `transaction` |
| `contactId` | For buyer or seller | Existing contact id in the caller's organisation |
| `listingId` | For property | Existing listing id |
| `transactionId` | For transaction | Existing transaction id |

## Response

```json
{
  "schemaVersion": 1,
  "context": "buyer",
  "caseId": null,
  "enforced": false,
  "summary": {
    "schemaVersion": 1,
    "statusLabel": "Documents needed",
    "readiness": "not_started",
    "nextAction": "Open the checklist.",
    "missingCount": 0
  }
}
```

`statusLabel` is safe for a salesperson. Restricted reviews are returned as “Additional review required” and do not include the internal reason. `missingCount` is a count, not a document.

`enforced` is true only when the case was opened under an active organisation policy. Sample checklists are not enforced by default.

## Permissions

The caller needs `compliance.read` in their own organisation. Salespeople only receive a case they are allowed to see. Review, policy, finance and conveyancing mutations are not part of this read contract. Those actions stay on the authenticated web routes and require the manager capabilities.

## Errors

| HTTP | code | When |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Context is missing |
| 401 | `UNAUTHORIZED` | No trusted session |
| 403 | | The caller cannot view the case |
| 404 | `NOT_FOUND` | The record is outside the organisation, or the workspace is not real estate |
| 503 | `COMPLIANCE_FOUNDATION_UNAVAILABLE` | The foundation migration is not available |

## Out of scope for this contract

Creating invitations, uploading bytes, recording decisions and reading raw identity numbers are web flows in Phase 1. A later mobile contract can add them only with the same server-side permission checks. The Android app must not read Supabase directly.
