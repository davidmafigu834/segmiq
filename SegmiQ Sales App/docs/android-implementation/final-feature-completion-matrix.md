# SegmiQ Sales Android — feature completion matrix

1 November 2026. "Production verified" means this sprint called the deployed API with an authorised session. It does not mean the October audit. Synthetic tests are not production verification.

| Feature | Previous status | Current status | API connected | UI functional | Tested | Production verified | Remaining blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sign-in, MFA, session | Working | Unchanged | Yes | Yes | Yes | Not re-checked this sprint | None in app code |
| Login on a short window | Forgot password clipped | Compact layout, logo kept, architecture image collapsed | n/a | Yes | Instrumented | n/a | None |
| More-menu status | "Continue on web" for native modules | Native / gated / web-only / unavailable | Uses bootstrap + `EstateAccess` | Yes | Unit | Not re-checked | None |
| Estate reads (properties, buyers, matches, viewings, introductions, offers, transactions, calendar) | Accepted for revision `7e743eb…` | Same pin | Yes, when the pin matches | Yes | Unit + instrumented synthetic | Not re-checked this sprint | No test account in this session |
| Estate writes | Adapters present, acceptance empty | Forms added for listing, introduction, offer. Gate unchanged | Yes, only after acceptance | Controls hidden while gated | Unit, synthetic HTTP | No | Independent write acceptance per operation |
| Buyer phone | Hidden even when returned | Shown only when the payload includes it. `ACTION_DIAL` | Yes | Yes | Unit | Not re-checked | None when the server redacts |
| Calendar unknown types | Dropped | Read-only card, or open when the type is known | Yes | Yes | Unit | Not re-checked | None |
| Sales Copilot `simulated` / `notice` | Ignored | Simulated copy is explicit | Yes | Yes | Unit | Not re-checked | None |
| Estate error text | Generic only | Specific when the kind is safe; generic for 5xx | Yes | Yes | Unit + instrumented | n/a | None |
| WhatsApp directory | Missing | Native list, search, filters, unread when `unread > 0` | `GET /api/inbox/conversations` | Yes | Unit + `InboxCaptureTest` | No | Live session not used |
| WhatsApp thread | Missing | Native bubbles, time, delivery only if status is documented | `GET .../messages` | Yes | `InboxCaptureTest` | No | Opening the route marks some notifications read on the server |
| Send message | Missing | Pending, failure keeps draft, accepted is not "delivered" | `POST /api/leads/{id}/send-message` | Yes | Unit + synthetic 502 | No | Do not treat accept as delivery |
| Quick replies | Missing | Inserted into the composer | `GET /api/inbox/quick-replies` | Yes | Decode path | No | None beyond a live session |
| Transfer to support | Missing | Stated as web-only | Not called | Honest unavailable | UI assertion | n/a | Route requires a browser cookie session |
| Attachments | Missing | Received MIME label only | Read fields only | Honest unavailable for send | Thread render | n/a | No salesperson upload route on `send-message` |
| Inquiry → inbox | Dead control | Opens `live/inbox/{leadId}` | Same inbox API | Yes | Shell test requests the directory | No | None for navigation |
| Inquiry → buyer / property / viewing / offer | Not linked | Empty state. No guessed ids | Relationship route not called | Honest empty | Not a live link | No | Cookie-session relationship route |
| Listing create / edit | Missing | Form, review, `permittedActions.edit` | POST/PATCH listings | Hidden until write acceptance | Synthetic acceptance test | No | Write acceptance |
| Introduction request | Review only | Request form, no phone reveal | `action: "introduction"` | Hidden until write acceptance | Synthetic | No | Write acceptance. Self-approval still server-side |
| Offer create | Decisions only | Decimal form, `submit` defaults off | `POST /api/clients/{org}/offers` | Hidden until write acceptance | Synthetic | No | Write acceptance and concurrency evidence |
| Viewing overlap | Always `confirmOverlap: false` | Second explicit confirm sends `true` with the same key | Existing schedule route | Yes | Unit | No | Write acceptance for scheduling |
| Transactions | Read + milestones | Unchanged. No financial completion | Read route | Yes | Existing | Not re-checked | No invented completion API |
| Compliance documents | Forbidden locally | Unchanged | Not enabled | Unavailable | Existing gate | No | Protected storage acceptance |
| Private listing images | Unloaded | Unchanged | Host stays null | Unavailable | Existing | No | Storage acceptance |
| Dialer review timing | Review opened with the dial intent | Review after leave and return | Notes and follow-up routes | Yes | Unit + emulator capture | No | Handset call not performed |
| Meeting recorder | Working, `propertyId` always null | Listing id when an authorised listing is chosen | Local only | Yes | Emulator capture started, paused, saved, played | n/a | No upload contract. No physical device |
| In-app notifications | Not called | List, refresh, lead/introduction navigation | `GET /api/notifications` | Yes | Unit | No | Not push. No FCM token API |
| Real-estate home counts | Easy to mislabel | Shown only from the matching server field | Dashboard + estate reads when open | Yes | Shell test | Not re-checked | Partial pages are not called totals |
| Fictional preview | Easy to confuse with stock | Persistent fictional banner. `demo-` ids still rejected | No server writes | Yes | Workflow UI test | n/a | None |
| Solar | Isolated | Unchanged. Inbox tab can open the same WhatsApp screens when the module is granted | Same inbox API | Not expanded | Navigation unit test | No | Solar product work was out of scope |
