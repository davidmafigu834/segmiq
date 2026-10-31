# Phase 6 Real Estate activation matrix

Observed production revision `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6` at `https://www.segmiq.com`, contract version 1, salesperson role only. `NOT_ATTESTED` remains the server's own label. Status values below are limited to what this probe and the Android manifest actually establish.

| Module | Backend deployed | Contract verified | Privacy evidence | Android connected | Live read active | Live write active | Blocker |
|---|---|---|---|---|---|---|---|
| Auth / bootstrap | Yes, revision above | Match, schema 1 | Logout then `SESSION_REVOKED`; anonymous `TOKEN_INVALID` | Existing session flow | Bootstrap read verified | Sign-in and logout only | None for this salesperson session |
| Properties | Yes | List and detail match; price, status, description, agent, paging | Own organisation only; foreign path `CROSS_TENANT_ACCESS`; no second agent | Yes | Yes, salesperson | No listing-management adapter | Cross-agent visibility not observed |
| Property photos | Endpoint deployed | `409 IMAGE_UNAVAILABLE` | No signed URL was issued | Adapter remains gated | No | No | Private object migration and `privateListingImageDelivery=false` |
| Buyers | Yes | List and detail match, including requirements | Own searches included contact fields; second salesperson unavailable | Yes | Yes, salesperson | No | No second-agent redaction sample; response is not `no-store` |
| Matching | Yes | `200` with empty `matches` and coverage flags | No foreign listing in the empty feed | Yes | Yes, salesperson | No write API | No live explanation row was returned |
| Viewings | Yes | List and detail match; 5 rows, all `access=full` | No `listing_only` row observed | Yes | Yes, salesperson | No | Booking, overlap, and notification effects not executed |
| Calendar | Yes | Window returned the partial-feed contract | No event titles stored; coverage flags read | Yes | Yes, labelled partial | Read only | `incomplete=true`; standalone meetings unsupported |
| Introductions | Yes | `200` with `items` | No second reviewer observed | Yes | Yes, salesperson | No | Decisions not executed; response is not `no-store` |
| Offers | Yes | `200`, zero rows, bounded and not exhaustive | Competing offers not present to inspect | Yes | Yes, salesperson, bounded | No | Empty bounded feed; no financial write |
| Transactions | Yes | `200`, zero rows, bounded and not exhaustive | Participant redaction not present to inspect | Yes | Yes, salesperson, bounded | No | Financial completion and documents remain gated |
| Compliance / documents | Not accepted for mobile | Not called | Not collected | No live adapter | No | No | Storage, grants, and acceptance still required |
| General Sales | Unchanged | Existing shared APIs | Existing scope checks | Preserved | Existing inquiries, tasks, Copilot | Existing task actions only | Not re-verified against customer mutations |
| Solar | Unchanged | Bootstrap would resolve Solar separately | Android manifest rejects Solar | Isolated | No Real Estate manifest | No | Out of scope |
