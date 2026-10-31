# 09 — Web versus Android gap analysis

## 0. How to read this

- **Web status** is **supplied audit context**. It comes from the earlier read-only audit of the SegmiQ web repository, `../../audits/salesperson-android/` (reports 00–11). It was not re-verified against the web code during this Android audit.
- **Android status** is verified in this audit, using the status vocabulary below.
- Backend endpoint names are quoted from that web audit. Where the web audit marked an endpoint **Cookie**, it does not accept the mobile Bearer token yet and needs a backend change before Android can use it.

**Android status vocabulary:**
- Implemented and verified
- Implemented but unverified
- Functional demo
- Visual only
- Partial
- Broken
- Not implemented

**Priority vocabulary:** Critical, High, Medium, Low.

## 1. Context that shapes every row

| Fact (web, supplied) | Consequence for Android |
|---|---|
| Three salesperson experiences: General, Solar and Real Estate. Real estate is selected by `clients.business_type='real_estate'`, solar by `clients.sales_workflow_preset='SOLAR_INSTALLATION'`, and real estate wins. All other industries (construction, wholesale, machinery, automotive…) get General | Android has one hard-coded general experience (report 02 §5) |
| Solo mode is a home-dashboard variant | Android has no solo concept |
| Salesperson access: `SALESPERSON` plus `CLIENT_MANAGER` with `also_sells` | Android has no roles |
| `POST /api/sales/app/auth` issues a 14-day MOBILE Bearer token; many core sales APIs accept it | Android has no networking |
| Several general and most real-estate endpoints are cookie-only | Backend work is needed before those Android screens can be live |
| Android must use SegmiQ APIs, never Supabase directly | Android touches neither today (good) |
| No native FCM push on the web | Push is new backend work |
| No meeting recording or SIM call recording on the web | Recording is new backend and new native work |
| An **existing Capacitor Android app** (`sales-app/` in the web repo) already uses the Bearer API, polls notifications and queues calls offline | Its network contracts and offline call queue are a working reference. The native app should match its API usage rather than rediscover it |

## 2. Shared and general-sales features

| Feature | Web status (supplied) | Android status | Gap | Backend dependency | Priority |
|---|---|---|---|---|---|
| Sign-in (email + password) | Integrated; Bearer issuer `POST /api/sales/app/auth` | Not implemented | Whole login flow, token storage, session restore | Exists (Bearer) | Critical |
| MFA challenge | Integrated (`/api/auth/mfa/login`, `channel:"mobile_sales"`); MFA path skips the role check (web S-finding) | Not implemented | MFA state and UI | Exists; fix the role check server-side | Critical |
| Logout / session revocation | Integrated (MOBILE session row) | Not implemented ("Leave demo" keeps data) | Logout endpoint call, local wipe, 401 handling | Exists | Critical |
| Role / organisation / industry resolution | Server-side; no single mobile bootstrap endpoint | Not implemented | Experience resolver | **New** `GET /api/sales/app/bootstrap` recommended | Critical |
| My Day / dashboard | Integrated; Bearer `GET /api/sales/dashboard`, `/dashboard/workspace` | Functional demo | Bind to real data; drop the hard-coded meeting card and name | Exists (Bearer) | Critical |
| Leads list + search | Integrated; Bearer `GET /api/sales/leads`, `/api/sales/app/leads` | Functional demo | Paging, filters, ownership | Exists (Bearer); the web lacks server paging | Critical |
| Lead detail + edit | Integrated; Bearer `GET/PATCH /api/leads/{id}` | Functional demo (read-only, hard-coded owner) | Edit, real owner and status | Exists (Bearer) | Critical |
| Lead timeline + internal notes | Integrated; Bearer `GET …/timeline`, `POST …/internal-note` | Partial (local notes, sample timeline) | Real timeline, timestamps | Exists (Bearer) | High |
| Add lead / contact with duplicate lookup | Integrated; Bearer `POST /api/contacts`, `GET /api/contacts/lookup` | Functional demo (no duplicate check) | Duplicate lookup, normalisation | Exists (Bearer) | Critical |
| Claim / transfer lead | Integrated; **Cookie** | Not implemented | Endpoint plus UI | Backend change (Bearer) | High |
| Log call / outcome | Integrated; Bearer `POST /api/leads/{id}/log-call` | Functional demo (simulated, local) | Real dial intent, post-call capture, outbox | Exists (Bearer) | Critical |
| WhatsApp inbox list | Integrated; Bearer `GET /api/inbox/conversations` (no paging) | Functional demo (fixtures) | Real list, paging, unread | Exists (Bearer); paging needed | Critical |
| Chat thread + send text/media | Integrated; Bearer messages (cursor), `send-message`, `send-media` + presign | Partial (local drafts only) | Sending, media, templates | Exists (Bearer) | Critical |
| Conversation status (resolve/reopen/transfer) | Integrated; **Cookie** | Not implemented | — | Backend change | High |
| Inbox "Mine" filter | Exists on the web | **Visual only** (no effect) | Implement against server filter | Exists | Medium |
| Tasks | Integrated; Bearer `GET /api/sales/tasks?view=`; complete via `PATCH /api/leads/{id}` | Functional demo (text dates) | Real dates, ownership, sync | Exists (Bearer) | Critical |
| Reminders | No native reminders | Not implemented | Local reminders | None for local | High |
| Calendar | Server-rendered page; **no JSON endpoint** | Not implemented (alias of Meetings) | Agenda view | **New** endpoint | High |
| Pipeline board | Server-rendered; deals list **Cookie** `GET /api/deals` | Functional demo (static, read-only) | Real deals, stage list from config | Backend change for the list | Critical |
| Deal detail + stage move + won/lost | Integrated; Bearer `GET/PATCH /api/deals/{id}` | Functional demo (read-only) | Stage moves, close won/lost | Exists (Bearer) | Critical |
| Lead → deal conversion | Integrated; Bearer `POST /api/leads/{id}/create-deal` | Not implemented | — | Exists (Bearer) | Critical |
| Quotations list / builder / PDF / send | Integrated; Bearer `GET /api/sales/quotes`, `POST /api/leads/{id}/quotations`, `PATCH /api/quotations/{id}`, `…/pdf`, `…/send` | Visual only (empty state) | Whole feature | Exists (Bearer) | High |
| Sales Copilot work items | Integrated; Bearer `POST /api/sales/copilot/work-items/{id}` (409 on stale) | Functional demo (rule-based from local tasks) | Render real work items; approve, dismiss, snooze, complete | Exists (Bearer) | Critical |
| Notifications feed | Integrated; Bearer `GET /api/notifications`, mark-all-read | Visual only | Feed, deep links | Exists (Bearer) | High |
| Push notifications | **Not on the web** | Not implemented | Token registry, FCM | **New** backend | High |
| Global search | **Cookie** `/api/search` | Partial (local customer search) | — | Backend change | High |
| Profile / password / avatar | **Cookie** `/api/users/me*` | Not implemented | — | Backend change | Medium |
| Won & Lost, Goals | Integrated; Bearer | Not implemented | — | Exists | Medium |
| Social inbox (Messenger / Instagram) | Integrated for enabled companies | Not implemented | — | Exists (auth per web report 07) | Medium |
| Currency and time zone | Web hard-codes USD in places; no stored org currency | Hard-coded USD (`Locale.US`) | Server-provided currency | **New** (bootstrap) | High |
| Solo mode home | Integrated (dashboard variant) | Not implemented | — | Exists | Low |

## 3. Solar features

| Feature | Web status (supplied) | Android status | Gap | Backend dependency | Priority |
|---|---|---|---|---|---|
| Solar pipeline (10 derived stages, gated transitions) | Integrated; Bearer `GET/POST /api/sales/solar-workflow` | Not implemented | Solar stage list; show server gate errors | Exists (Bearer) | Critical (for solar orgs) |
| Solar stage cue on lead and inbox | Integrated | Not implemented | — | Same | High |
| Pre-sale site visit + 7-section assessment + photos | Integrated; Bearer `/api/sales/site-visits/{id}/assessment`, `/photos` | Not implemented | Camera, offline draft | Exists (Bearer) | High |
| Solar quote templates | Integrated (quotations) | Not implemented | Depends on quotations | Exists | High |
| Projects (read-only) / My work | Integrated (`/api/work-projects/*`) | Not implemented | — | Exists | Medium |
| Installation, QA, commissioning, handover | Manager / project work | Not applicable to salesperson | Leave on web | — | Low |

## 4. Real estate features

| Feature | Web status (supplied) | Android status | Gap | Backend dependency | Priority |
|---|---|---|---|---|---|
| Agent home (`AgentDailyWorkspace`) | Server loader; Bearer JSON not confirmed | Not implemented | — | Likely a new JSON endpoint | Critical (for RE orgs) |
| Inquiries + inquiry workspace | **Cookie** | Not implemented | — | Backend change | Critical |
| Property listings (+ photos) | Integrated; writes **Cookie**; no listing detail page on the web | Not implemented | Listing list/detail, camera upload | Backend change for writes | Critical |
| Buyers & tenants, buyer searches | Integrated; auth mixed | Not implemented | — | Partly | Critical |
| Viewings | **Cookie**; booking messages the customer immediately; bookable for any contact (web S-finding) | Not implemented | — | Backend change and security fix first | Critical |
| Offers & negotiation | **Cookie**; exposes competing offers (web S-finding) | Not implemented | — | Security fix first | Critical |
| Matching / send to buyer | Send **Cookie** | Not implemented | — | Backend change | High |
| Introductions | Integrated | Not implemented | — | Exists | High |
| Acquisitions, inspections, transactions, compliance documents | Mixed; several **Cookie** | Not implemented | Document capture | Backend changes | High |
| Owners, mandates, commissions | Integrated / partial | Not implemented | — | Exists | Medium |

## 5. Shared native-only features (no web equivalent)

| Feature | Web status (supplied) | Android status | Gap | Backend dependency | Priority |
|---|---|---|---|---|---|
| Place a real phone call | Web uses `tel:` links; Capacitor app dials and queues logs | Not implemented (simulated) | `ACTION_DIAL` plus post-call capture | `log-call` exists | Critical |
| Default dialer (`ROLE_DIALER`, `InCallService`) | Not applicable | Not implemented | Large scope; probably not needed | None | Low (product decision) |
| Device contacts search / import | Not on the web | Not implemented | `READ_CONTACTS`, normalisation, dedupe | Contacts lookup exists | Medium |
| Two-sided SIM call recording | **Does not exist** | Not implemented; not feasible for ordinary apps | Requires VoIP or a provider; product decision | **New** | Low until a route is chosen |
| Meeting recording | **Does not exist** | Visual only | Recorder, storage, upload | **New** upload and storage | High |
| Transcription and insights | **Does not exist** | Interfaces only | Server-side transcription feeding Copilot | **New** | Medium |
| Offline-first cache + outbox | Not applicable (Capacitor app queues calls only) | Not implemented | Room cache, WorkManager outbox | Idempotency on writes | High |
| Biometric unlock | Not applicable | Not implemented | — | None | Low |

## 6. Overall gap summary

| Dimension | Web (supplied) | Android (verified) |
|---|---|---|
| Authentication | Mobile Bearer login exists | None |
| Data | Real, organisation-scoped | Fictional, single device |
| Experiences | General, Solar, Real Estate (+ solo) | One general demo |
| Calling | Click-to-call + call logging | Simulation |
| Messaging | WhatsApp send/receive | Local drafts |
| Pipeline | Editable (general + solar) | Read-only fixtures |
| Quotations | Full | Empty state |
| Copilot | Server work items | Local rules |
| Notifications | In-app feed, no push | Static screen |
| Recording | None | Setup form only |

**Bottom line:** the Android project is a well-behaved, honest **UI prototype of the general experience**. It does not yet use any web capability. It is ahead of the web only in its native layout and its declared contracts for future features.
