# SegmiQ Sales — backend versus Android gap matrix

Audit date: 2026-10-31. Commit `7e743eb`. “Backend exists” means a route is in this repository. Production deployment of that route was not re-probed with a salesperson token in this pass. Android’s real-estate gate additionally requires revision `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6` on `https://www.segmiq.com:443`. Bootstrap reports `deployedVerification: NOT_ATTESTED` from `mobileReleaseEvidence()` regardless of the Android read list.

Gap owners: Codex / Android, Cursor / Backend, Deployment / DevOps, Product decision, External provider, Device testing.

| Feature | Backend exists | Android UI | Android repository | Production integration | Security / rollout | Gap owner |
|---|---|---|---|---|---|---|
| Sign in | `POST /api/sales/app/auth` | Login screen | `AuthRepository.signIn` | Wired to www.segmiq.com. Not signed in this pass. | MFA and role checks are server-side. | Device testing |
| MFA | `POST /api/auth/mfa/login` | MFA screen | `completeMfa` | Wired. Not exercised. | Enrolment required ends the restricted token. | Device testing |
| Logout | `POST /api/auth/session/logout` | Confirm dialogs | `signOut` | Wired. | Local recordings wiped. | Device testing |
| Bootstrap and experience | `GET /api/sales/app/bootstrap` | Root gate | `LiveSalesApi.bootstrap` | Wired. | Subscription and sales-operations blocks. Revision pin is an extra Android gate. | Product decision if the pin should track every deploy |
| Dashboard and daily workspace | `GET /api/sales/dashboard`, `GET /api/sales/dashboard/workspace` | General My Day and real-estate home metrics | `LiveSalesApi` | Wired for inquiries and follow-ups. Home does not call estate lists. | Sales session. | Codex / Android only if viewing counts are added from existing list routes |
| Leads directory and detail | `GET /api/sales/leads`, `GET/PATCH /api/leads/{id}`, notes, timeline | General and real-estate inquiry UI | `LiveSalesApi` | Wired. | `leadModification` must be set or edit controls hide. | Device testing |
| Create lead | `POST /api/contacts` | Add inquiry / lead | `createLead` | Wired, including 409 duplicate. | Assigned to the caller. | Device testing |
| Tasks | `GET /api/sales/tasks` | Tasks | `LiveSalesApi.tasks` | Wired. Completion is a lead follow-up clear, not a separate task API. | Mine view only. | Product decision if a richer task model is required |
| Copilot work items | `POST /api/sales/copilot/work-items/{id}` | Copilot cards | `copilotAction` | Wired. `simulated` and `notice` ignored in UI. | Quotations and appointments stay on the web by client policy. | Codex / Android |
| Contact lookup | `GET /api/contacts/lookup` | Live dialer | `lookupContact` | Wired. | Does not upload the address book. | Device testing |
| Pipeline stage change | `PATCH /api/deals/{dealId}` exists | Read-only snapshot | Not called | Not integrated | Unknown whether salesperson mobile should move stages. | Product decision |
| Quotations | Platform quote routes exist. Not used as the salesperson mobile contract. | Unavailable screen | None | Not integrated | Copilot already refuses quote drafts on device. | Product decision |
| Properties read | `GET /api/clients/{org}/listings` and `/{id}` | Estate server list and detail | `EstateRepository.properties` | Coded. Executes only when the Android acceptance matches. | Scope check on `client_id`. | Device testing on the pinned revision |
| Property photos | `GET …/listings/{id}/images/{index}` | Gallery with neutral fallback | `image` plus `PrivateListingImageClient` | Flag stays false without the acceptance JSON. Android host is null. | Private bucket, signed host, no public fallback. | Deployment / DevOps, then Codex / Android to pin the host |
| Property create | `POST /api/clients/{org}/listings` | None | None | Not called | Server permission still applies. | Codex / Android |
| Property edit flags | Detail includes `permittedActions` | Not rendered | Not called | Not called | Must follow server flags. | Codex / Android |
| Buyers read and matches | `GET …/buyer-searches`, `GET …/matching` | Directory, detail, matches | `EstateRepository` | Coded behind the read gate. | Server redacts other agents’ buyers. | Device testing |
| Buyer requirement write | `PATCH …/buyer-searches/{id}` | Sheet exists, hidden | `updateRequirements` | Blocked by empty `writes` set. | Server rechecks the search. | Product decision, then Codex / Android acceptance line |
| Buyer phone | Returned on the buyer DTO when allowed | Not shown | Field is decoded | UI drops it. | Must not show a phone the server omitted. | Codex / Android |
| Viewings read | `GET …/viewings` | List and detail | `viewings` | Coded behind the read gate. | `listing_only` hides buyer fields. | Device testing |
| Viewing write | `POST …/buyer-sales/actions` | Sheet exists, hidden | `scheduleViewing`, `rescheduleViewing`, `viewingOutcome` | Blocked by the write gate. `confirmOverlap` always false. | Idempotency key required by the server for mobile viewing create. The client sends one. | Product decision, then Codex / Android for overlap confirm |
| Introductions read | `GET …/buyer-sales/introductions` | List and detail | `introductions` | Coded behind the read gate. | Phone is null until the server allows disclosure. | Device testing |
| Introduction decision | `action: review_introduction` on the actions route | Buttons exist, hidden | `reviewIntroduction` | Blocked by the write gate. | Client also requires `canApprove` or `canDecline` and refuses own requests. | Product decision |
| Introduction request | `action: introduction` on the actions route | None on the live client. Demo only. | No live method | Not called | Must not disclose the other agent’s contact. | Codex / Android |
| Offers read | `GET …/offers` and `/{id}` | List, detail, history | `offers` | Coded. Lists may be non-exhaustive and the UI says so. | Commission-like fields are stripped for salespeople in `transactionMobileDto`; offer money is returned. | Device testing |
| Offer decisions | `PATCH …/offers/{id}` | Buttons exist, hidden | `mutateOffer` | Blocked by the write gate. Uses `expected_updated_at`. | Server `offerPermittedActions`. | Product decision |
| Offer create | `POST …/offers` | None | None | Not called | Server permission. | Codex / Android |
| Transactions read | `GET …/transactions` and `/{id}` | List, milestones | `transactions` | Coded. | Salesperson responses strip commission keys. | Device testing |
| Transaction notes | `PATCH …/transactions/{id}` `update_notes` | Button exists, hidden | `transactionNote` | Blocked by the write gate. | No financial completion adapter, on purpose. | Product decision |
| Transaction milestone edit | Not added as an Android action. Server may support more on the transaction route. | Display only | None | Not called | Do not add completion until product asks. | Product decision |
| Compliance documents | `GET/POST /api/clients/{org}/compliance/cases…` | No module route. Repository returns a local forbidden. | No HTTP call | Not integrated | `realEstateComplianceRead` plus `compliance.read`. Private files need the same storage bar as photos. | Product decision, then Codex / Android |
| Sales calendar | `GET /api/sales/calendar` | Day strip | `calendar` | Coded behind the read gate. Non-viewing, non-lead events are dropped in the UI. | Feed itself says standalone meetings are unsupported. | Codex / Android to show the dropped rows |
| Real-estate lead link | `GET/POST /api/clients/{org}/leads/{leadId}/real-estate` | Inquiry screen opens directories instead | Not called | Not integrated | Must not assume a search id. | Codex / Android after reading that payload |
| WhatsApp list and thread | `GET /api/inbox/conversations`, `GET …/{leadId}/messages` | Unavailable module | None | Not called | Session must be salesperson or selling manager. | Codex / Android |
| WhatsApp text send | `POST /api/leads/{leadId}/send-message` | None | None | Not called | `canModifyLead`. Demo workspaces short-circuit on the server. | Codex / Android |
| WhatsApp transfer and quick replies | `POST …/transfer-support`, `GET/POST /api/inbox/quick-replies` | None | None | Not called | Server guards. | Codex / Android, after the thread exists |
| In-app notification rows | `GET /api/notifications` | Screen explains push is absent. Does not load this route. | None | Not called | User-scoped rows. | Codex / Android |
| Push device token | No route found | Explicitly not implemented | None | Not integrated | Do not invent FCM. | Cursor / Backend and External provider |
| Meeting upload and transcript | No route found | Copy says unavailable | Local file only | Not integrated | Audio stays on device. | Cursor / Backend before any client upload |
| Acquisitions, inspections, owners, mandates, commissions | Routes exist under `/api/clients/{org}/…` | Unavailable navigation rows | None | Not called | Not in the Android acceptance list. | Product decision |
| Solar pipeline and visits | Not wired to a mobile client | Unavailable screens | None | Not integrated | Experience flag only. | Product decision |
| Local reminders | None (device alarm) | Notifications screen | `SalesNotifier` | On-device only | One alarm, account stamp. | Device testing |
| Microphone recording | None | Live recorder | `MeetingRecorder` | On-device only | Consent checkbox. No customer name on the notification. | Device testing |

## Do not rebuild

These server pieces already exist and should be called, not rewritten: bootstrap, auth, MFA, leads, tasks, Copilot work items, contact lookup, listings, buyer searches, matching, viewings, introductions, offers, transactions, the buyer-sales actions route, the sales calendar, inbox conversations, and `send-message`.

## Android gates that are not missing backend

Empty `EstateAcceptance.writes`, null `privateImageHost`, and the revision pin are release controls in the app. A newer production SHA than `7e743eb` turns accepted reads back into the gate even if the routes still work. Updating that pin is a product and security decision, not a new API.
