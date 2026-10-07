# SegmiQ package functionality audit

**Audit date:** 22 September 2026  
**Auditor role:** senior product engineer / QA (read-only)  
**Authorisation:** audit and report only. No product changes, price revisions, subscription writes, live provider connections, or publication of packages.

This report audits the **proposed** Starter / Growth / Scale commercial table against what exists in this repository. Feature names in UI or code are not treated as proof that the advertised workflow works.

---

## 1. Executive verdict

**SegmiQ cannot truthfully publish and fulfil this exact package table today.**

| Proposed plan | Verdict | Why |
|---------------|---------|-----|
| **Starter ($19)** | **Narrow the wording; fix before selling as stated.** Core CRM (contacts/leads/pipeline/quotations/products/packages/dashboard/reports) is implemented in this repo and unit-tested at helper/contract level. It is **not** a fully exercised customer workflow in this audit. Shared WhatsApp is a real dual-transport hub in code, **not** live-delivery verified. “Tasks” is follow-up scheduling, not a task system. Salespeople are redirected to a **missing** customers route. |
| **Growth ($29)** | **Narrow the wording; inherit Starter blockers; hold several channel/AI claims pending verification.** Additional surfaces exist (Social Inbox, daily focus, draft replies, documents, weekly team reports, journeys, won/lost). Instagram is a **separate** path from Facebook and was not live-proven. “Sales automation” is predefined journeys + reminders, not a workflow builder. Win/loss is lost-reason aggregation, not win-reason insight. Daily focus is **rule-based**, not generative AI. None of these features are Growth-plan gated on the server. |
| **Scale ($49)** | **Hold Scale as a differentiated package.** There is no substantiated Scale-only product layer. Multi-team and branch management were **not found**. Configurable management views were **not found**. Priority support during published hours is **operationally unconfirmed**. Forecasting exists as stage-weighted lead math, not advanced deal-reconciled prediction. Company reports already exist as the Starter “standard reports” surface. Quotation approval exists as a **product** capability, not a Scale entitlement, and authenticated PDF download is not approval-gated. |

**Inspected source revision (not asserted as deployed):**

- Repository: `git@github.com:davidmafigu834/segmiq.git`
- Branch: `main` (tracks `origin/main`)
- Commit: `83ffa27eb9eae5cad02a24c46c235a5c6f35f07a` — *Fill the weekly report dashboard card so the right side is not empty.* (2026-09-21)
- Uncommitted work at audit time: marketing/legal/auth copy plus local logs/temp files. Those edits were **not** treated as evidence that package features exist or work. CRM/billing catalogue in committed code remains Starter $99 / Growth $199 / Scale $349.
- This audit does **not** establish that commit `83ffa27` is what production currently serves.

**Environments used:**

| Environment | Used? | Notes |
|-------------|-------|--------|
| Local source + unit tests | Yes | `npx tsx --test …` — 275 tests in two batches, 0 failures. No live database. |
| Local `.env.local` | Present, **not used** | File exists. Contents were not read. Using it could have hit a live Supabase/Meta/WhatsApp tenant. |
| Logged-in customer workflow (browser) | **Blocked** | Would require authenticating against whatever `.env.local` points at. Audit forbids connecting real customer accounts or sending real messages. |
| Staging | Not identified as a separate inspectable environment | |
| Production | **Not verified** | Deployment, cron, Meta app review, R2, and gateway ops for this revision are unverified. |
| Isolated second organisation HTTP IDOR | **Blocked** | No authorised multi-tenant runtime. Isolation is code-supported (and some unit tests), not live-exercised. |
| WhatsApp gateway live QR / Meta Cloud send | **Blocked** | No authorised test number; sending to real recipients forbidden. |

**AGENTS.md:** not present at the repo root. Scope was taken from `README.md`, `docs/*`, `.github/README.md`, and `.cursor/rules/hallmark.mdc` (design skill; not product-packaging evidence).

**Stack as found (not invented):**

- App: Next.js 14 App Router, TypeScript, Tailwind, Zustand (`package.json`, `README.md`)
- Auth: NextAuth.js; roles `SUPER_ADMIN` | `CLIENT_MANAGER` | `SALESPERSON` (`types/index.ts:1`)
- Data: Supabase PostgreSQL via service-role admin client
- Object storage: Cloudflare R2 (`lib/storage/r2.ts`); README also documents Supabase buckets for older assets
- Background work: Vercel cron in `vercel.json` (`/api/cron/daily`, `check-followups`, `weekly-digest`, `health`, `whatsapp-campaigns`, `weekly-team-report`)
- WhatsApp: Meta Cloud API in-app + in-repo Baileys gateway (`services/whatsapp-gateway`, `npm run gateway:whatsapp`) — separate always-on process, same git repo
- Companion packages in this repo: `sales-app/`, `field-app/` (out of proposed CRM seat table)
- Tests: `npm test` → `tsx --test tests/*.test.ts` (unit/contract tests; generally **no live DB or providers**)

**Cross-cutting commercial finding (not a product-functionality failure):** the proposed $19 / $29 / $49 all-role seat model, and plan-based feature entitlements, are **not implemented**. Existing catalogue is $99 / $199 / $349 with **salesperson-only** seats and almost no server feature gates. Working features must not be labelled “missing” solely because the proposed price gate is absent. See §5.

**Agentic AI add-on:** customer-facing agent runtime exists as per-tenant settings (default `enabled: false`) plus RBAC (`agent.use` / `agent.manage`). It is **not** a billed add-on SKU and is **not** included in these CRM seat prices. Growth “internal AI assistance” (drafts, weekly report narrative, document Q&A) is a different surface and is also **not** plan-gated.

---

## 2. Complete feature matrix

Statuses used exactly as specified.

**Inheritance:** Growth rows assume Starter claims; Scale rows assume Starter + Growth. A lower-tier Partial / unverified item remains a blocker for the higher package.

| ID | Plan | Claim | Product status | Verification status | Plan enforcement | Evidence (abbrev.) | Publication decision |
|----|------|-------|----------------|---------------------|------------------|--------------------|----------------------|
| **S01** | Starter | Contacts: create, edit, retrieve, associate; persistence; role-appropriate visibility | **Partial** | **Code-supported only** | **Absent, unclear or not applicable** (baseline CRM, not plan-gated) | `POST /api/contacts` (`app/api/contacts/route.ts`); manager hub `/client/contacts`; customers `/client/customers`; PATCH `app/api/client/customers/[customerId]/route.ts:40–65` tenant+lifecycle check. Salespeople redirected to **missing** `/sales/customers` (`app/client/customers/page.tsx:27–28`). Tests: `tests/company-customers.test.ts` helpers only. | **Fix before selling** as “role-appropriate visibility”; otherwise **narrow the wording** to manager Customer Hub |
| **S02** | Starter | Leads: capture, assignment, update, history, conversion; working capture sources | **Implemented** (code paths) | **Code-supported only** for CRM; capture sources **Blocked or unverified** in live providers | Absent | `createLead` (`lib/leads/createLead.ts`); sources in `types/index.ts:4–13`; `/client/leads`; PATCH/bulk reassign; `lead_events` / timeline. Tests: `tests/company-leads.test.ts`, `lead-to-deal.test.ts`, `convert-lead-won-customer.test.ts` (mostly pure). | **Narrow the wording** to named sources; do not claim all capture channels live |
| **S03** | Starter | Pipeline: persisted stages, values, ownership, won/lost; UI/backend agree | **Implemented** | **Code-supported only** | Absent | `/client/leads/pipeline`, `/sales/pipeline`; `updateDealStage` / `closeDealWon` / `closeDealLost` (`lib/sales/deals/close-deal.ts`). Lost reason required (`:203–206`). Tests: `tests/company-pipeline.test.ts`, `deal-value.test.ts`. Pure managers are often read-only unless `also_sells`. | **Narrow the wording** (“ownership + manager oversight”) |
| **S04** | Starter | Shared WhatsApp Sales Hub | **Implemented** (architecture) | **Blocked or unverified** for live send/receive; unit tests **Runtime verified** (helpers only) | Absent | Dual transport: Meta Cloud + Quick/Baileys gateway (`docs/WHATSAPP_PROVIDER_ARCHITECTURE.md`; `lib/whatsapp/message-service.ts`; `services/whatsapp-gateway`). Shared queues `lib/inbox/fetch-conversations.ts:130–141`. Tests: `company-whatsapp-hub`, `whatsapp-provider-connections`, `gateway-message` — **pass**, no live delivery. | **Hold pending verification** of live delivery; **narrow** Quick vs Cloud capabilities |
| **S05** | Starter | Quotations: catalogue, qty, discount/tax, totals, persist, PDF, send/share, status; price-change behaviour | **Implemented** | **Code-supported only** for persist/PDF/send; live WhatsApp send **Blocked** | Absent | Totals `lib/quotations/totals.ts`; persist snapshots `unit_price` + `catalog_unit_price` (`lib/quotations/persist.ts:72–90`); PDF `app/api/quotations/[quotationId]/pdf/route.ts`; send `…/send/route.ts` (prepare ≠ send). Tests: `quotation-totals`, `quotation-enterprise`, `company-quotations` — **pass**. | **Narrow**: preparing vs sending; sending depends on WhatsApp/R2 |
| **S06** | Starter | Products: create/edit, persisted prices, use in quotations | **Implemented** (catalogue, not warehouse) | **Code-supported only** | Absent | `/client/products`; `lib/products/service.ts`; quote resolver `lib/quotations/commercial-resolver.ts`. Inventory module exists separately (`/client/inventory`) and is **not** this claim. | **Ready for the verified scope** as **product catalogue**, not stock/WMS. Qualify: code-supported, not runtime-quoted in this audit |
| **S07** | Starter | Packages: composition, pricing, use in a quotation | **Implemented** | **Code-supported only** | Absent | `/client/packages`; `lib/packages/service.ts`; `expandPackageToLineItems` (`lib/quotations/packages.ts:18–50`); enterprise tests expand packages. Distinct from public profile “packages”. | **Narrow**: commercial quote packages. Qualify environment |
| **S08** | Starter | Tasks: create, assign, complete, retrieve; permissions; persisted status | **Partial** | **Code-supported only** | Absent | `/sales/tasks` projects leads with `follow_up_date` (`lib/sales/tasks/sales-tasks-data.ts`). `AddTaskSheet` PATCHes lead follow-up date only (`components/sales/tasks/AddTaskSheet.tsx:71–74`). **No `tasks` table** in migrations. | **Fix before selling** or **narrow** to “follow-up tasks on leads” |
| **S09** | Starter | Follow-ups: schedule, due dates, reminders, assignee visibility; manual vs automated | **Implemented** (manual CRM dates) + **External or operational** (WhatsApp/cron reminders) | Manual: code-supported; automated delivery **Blocked** | Absent | Lead `follow_up_date` / deal `next_action_at`; cron `lib/follow-up-reminders.ts` → `sendWhatsApp`; schedules in `vercel.json` + `.github/README.md`. Quick connection **cannot** send automated templates (`lib/messaging/provider.ts`). | **Narrow**: separate manual follow-ups from automated WhatsApp reminders; latter needs Meta + cron |
| **S10** | Starter | Files attached to customer records; authorised download; tenant isolation | **Implemented** (documents linked to customer entity) | Isolation **Code-supported only**; live cross-org URL **Blocked** | Absent | `EntityDocumentsPanel` on customer detail (`CompanyCustomerDetailPanel.tsx:65`); `canViewDocument` tenant check (`lib/documents/permissions.ts:88–99`); key prefix `isDocumentStorageKeyForClient` (`lib/storage/r2.ts:149–151`). Tests: `documents-phase-b` **pass** (helpers). Needs R2. | **Narrow**: company documents on customer records; require R2; isolation not live-proven |
| **S11** | Starter | Manager dashboard: real data, team scope, date filters, empty/error, links | **Implemented** | **Code-supported only** | Absent | `/client/dashboard`; `getCompanySalesDashboard`. Tests: `company-dashboard.test.ts` trend helpers only. Date windows are mostly fixed (today / 30d / month), not a full custom picker. | **Narrow** date-filter wording |
| **S12** | Starter | Standard reports: enumerate actual reports, reconcile, TZ, filters, exports | **Implemented** | Helper tests **Runtime verified**; live totals vs records **Blocked** | Absent (CSV exists for company reports; marketing currently lists CSV as Scale) | Tabs: Overview, Sales, Pipeline, Leads, WhatsApp, Quotations, Team, Customers, Activities (`docs/SEGMIQ_COMPANY_REPORTS.md:24–38`). Export `GET /api/reports/company/export`. TZ note `get-company-reports-data.ts:674`. Tests: `company-reports.test.ts` **pass**. | **Ready for the verified scope** as listed tabs + CSV; **narrow** timezone; do not call this Scale-only |
| **G01** | Growth (+Starter) | Facebook Social Inbox (Messenger vs comments) | **Implemented** in code for Messenger DMs and Page comments | Unit tests **Runtime verified**; live Meta **Blocked** | **UI-only gating** / **Absent** for plan; **RBAC** `socialInbox.*` | Channels `lib/social-inbox/types.ts:11–18`; OAuth+subscribe `lib/social-inbox/oauth.ts:88–109`; webhook `lib/social-inbox/webhook.ts`; routes `/client/social-inbox`, `/sales/social-inbox`. Tests: `social-inbox.test.ts` **pass**. Distinct from Facebook **Lead Ads**. | **Narrow** to Messenger + Page comments; hold live delivery |
| **G02** | Growth | Instagram Social Inbox (DMs vs comments) | **Partial** (separate code; created only if Page has IG business account) | **Blocked or unverified** live; Facebook ≠ Instagram | Same as G01 (RBAC, not plan) | IG upsert `oauth.ts:110–128`; sync DMs/comments `lib/social-inbox/sync.ts`. | **Narrow** to Page-linked Instagram professional account; **hold pending verification** |
| **G03** | Growth | Daily focus from real leads/deals/activity/follow-ups | **Implemented** (deterministic, not generative AI) | Unit tests **Runtime verified** | Absent | Docs `SEGMIQ_DAILY_SALES_INTELLIGENCE.md`; engine `lib/sales/intelligence/priority-engine.ts:108–154`. Tests: `operating-hours-daily-focus.test.ts`, `sales-intelligence.test.ts` **pass**. Streak copy is status, not fake queue items. | **Narrow**: “daily sales plan from CRM data”, not “AI priorities” |
| **G04** | Growth | AI message drafts: context, edit, handoff; does not silently send | **Implemented** | **Code-supported only** (LLM not executed here) | Absent (RBAC on reply) | Prompt forbids send (`lib/social-inbox/ai.ts:46–48`); UI puts draft in composer. Provider failure → template fallback. Agentic auto-send is a **different** product (disabled by default). | **Narrow**: drafts for Social Inbox / enquiry assist; not Agentic sending |
| **G05** | Growth | Document questions: ingest, index, tenant/role Q&A, grounded, sources | **Implemented** | Permission tests **Runtime verified**; live ask **Code-supported only** | Absent | `lib/documents/retrieval/ask.ts:236–257` insufficient-evidence path; search `.eq("client_id")`. `canViewDocument` cross-org deny. TEAM/ROLE scopes return false for sales (`permissions.ts:114–116`). | **Narrow**: grounded Q&A over accessible docs; sales team-scope sharing limited |
| **G06** | Growth | Document summaries | **Partial** | Extraction tests **Runtime verified**; OCR **not implemented** | Absent | Upload types `lib/documents/validation.ts:4–32`; images skip OCR (`extract.ts:187–196`); PPTX skipped; intelligence if text ≥ 80 chars (`worker.ts:178–196`). | **Narrow** to text-extractable PDF/DOCX/XLSX/TXT/CSV; not scans/images |
| **G07** | Growth | Weekly AI team reports | **Implemented** (pipeline) | Strong unit tests **Runtime verified** (incl. PDF render in test); scheduled cron in **this** environment **Blocked** | **Enforcement found in code but untested** for plan; **manager RBAC** exists | Migration `supabase/migrations/20260921020000_weekly_team_performance_reports.sql`; cron `vercel.json` + `app/api/cron/weekly-team-report`; unique `(client_id, report_type, period_start_date)`; fallback narrative on AI fail. Tests: `weekly-team-report.test.ts` **pass** (empty data does not invent analysis). | **Narrow**: manager weekly performance report; distinguish manual generate vs cron; needs R2 in non-dev |
| **G08** | Growth | Sales automation | **Partial** (no freeform builder) | **Code-supported only**; live journey send **Blocked** | Absent | Triggers: `quotation_no_response`, `dormant_lead`, `customer_anniversary`, `lost_deal_funds` (`lib/marketing/journeys/types.ts:1–12`). Worker via `/api/cron/whatsapp-campaigns`. Follow-up reminder crons separate. | **Narrow** to predefined WhatsApp journeys + reminders |
| **G09** | Growth | Win/loss insights | **Partial** | **Code-supported only** | Catalogue copy only (`CRM_PLAN_FEATURES` Growth “Win analysis”) — **not enforced** | Lost reason required on lose; `hasWonReasons: false` (`won-lost-data.ts:446–448`). Aggregates, not ML insights. Empty lost-reason UX exists. | **Narrow**: lost-reason breakdown + KPIs; do not claim win-reason insights |
| **X01** | Scale (+lower) | Advanced forecasting | **Partial** | Forecast **math** unit tests **Runtime verified**; predictive accuracy **not proven**; live snapshots **Blocked** | **Absent** | `lib/revenue-forecast.ts`: stage probabilities, month/quarter, committed/best-case/pipeline. Max mapped stage 0.5 vs committed threshold 0.75 — committed effectively unused (`:25–38`, tests `:79–92`). Queries **leads**, not deals. | **Hold** as Scale “advanced”; optional **narrow** wording as stage-weighted pipeline forecast (not Scale-exclusive) |
| **X02** | Scale | Advanced reporting | **Partial** vs claim (capability exists, not advanced/Scale-only) | Report helpers **Runtime verified** | **Absent** | Same company reports as S12. No report builder, branch grouping, PDF/XLSX (`docs/SEGMIQ_COMPANY_REPORTS.md:201–206`). | **Hold** as Scale differentiator; keep under Starter “standard reports” |
| **X03** | Scale | Multi-team management | **Not found** | **Code-supported only** (absence evidenced) | N/A | Team page = users on one `client_id` (`docs/SEGMIQ_COMPANY_TEAM.md:39–42`). No sub-team entities. Tests: `company-team.test.ts`. | **Hold** / remove from Scale copy |
| **X04** | Scale | Branch management | **Not found** | Absence evidenced | N/A | Docs: no branch org model (`SEGMIQ_COMPANY_REPORTS.md:59`, `:206`; dashboard/pipeline docs). Inventory “locations” are stock, not CRM branches. | **Hold** / remove. Do not use “multi-team **or** branch” as if either exists |
| **X05** | Scale | Quotation approval workflows | **Implemented** as product | Engine tests **Runtime verified**; live routing **Code-supported only** | **Absent** (not Scale-gated) | Policies + request/approve APIs; send blocked if required/pending (`send/route.ts:69–84`); fingerprint invalidates (`quotation-enterprise.test.ts:172–192`); AI send blocked (`lib/agent/policy.ts:136–141`). **Authenticated PDF not gated** (`pdf/route.ts:9–26`). Public token is assigned **at send**, so customer PDF is after send. | **Narrow**: commercial approval exists **in product**, not as Scale exclusive; disclose PDF preview gap |
| **X06** | Scale | Configurable management views | **Not found** | Absence evidenced | N/A | Nav differs by `business_type` (`company-nav-config`); reports filters are ordinary date/salesperson, not persisted manager views. Settings omit custom dashboards (`SEGMIQ_COMPANY_SETTINGS.md`). | **Hold** / remove |
| **X07** | Scale | Priority support during published hours | **External or operational** | **Blocked or unverified** | Catalogue copy only (`lib/billing/plans.ts:52–57`) | No staffed queue, published hours, routing, or escalation process in product. Settings “Need Help” is mailto. Lead-response SLA is **customer lead** SLA, not SegmiQ support. | **Hold pending operational confirmation**. Do not invent hours or SLA |

---

## 3. Detailed findings

Severity order: data exposure / wrong quotations / lost or duplicated messages / approval bypass, then packaging honesty, then UX.

### F1 — Proposed Scale package is not a substantiated product tier

- **Observed:** Scale catalogue bullets in code are salesperson seats, “full intelligence engine”, audience segments, priority support (`lib/billing/plans.ts:52–57`). Proposed Scale adds forecasting, advanced reporting, multi-team/branch, quotation approval, configurable views, priority hours. Multi-team, branch, configurable views, and priority hours are not implemented as claimed. Remaining items are either already in lower-tier product surfaces or ungated.
- **Customer impact:** Publishing Scale at $49 would sell oversight that the organisation cannot fulfil as differentiated value.
- **Evidence:** matrix X01–X07; `docs/SEGMIQ_COMPANY_TEAM.md`; `docs/SEGMIQ_COMPANY_REPORTS.md:201–206`.
- **Severity:** packaging / commercial integrity — **high**.
- **Correction:** Hold Scale until real differentiators exist **and** are plan-enforced, or drop Scale from the table.

### F2 — Quotation approval can be bypassed via authenticated PDF (not via send)

- **Observed:** Send API and commercial check block unapproved quotes. AI auto-send is blocked when `approvalRequired`. `public_token` is written on send (`app/api/quotations/[quotationId]/send/route.ts:108,286`), and public PDF rejects `draft` (`app/api/quotes/[token]/pdf/route.ts:17–18`). Authenticated `GET /api/quotations/[quotationId]/pdf` only checks `canManageQuotation` — **no approval status check** (`app/api/quotations/[quotationId]/pdf/route.ts:9–26`).
- **Customer impact:** An unapproved quotation can still be exported/previewed as a PDF by an authorised internal user. That is an alternate export path relative to the proposed “approval workflow” promise. Customer send path is stronger.
- **Severity:** **high** if sold as enforced approval; **medium** if described as “send blocked until approved, internal preview allowed”.
- **Correction:** Gate internal PDF/export the same way as send, or change copy to “send/share is blocked until approved”.

### F3 — Salesperson customer records surface is broken

- **Observed:** Non-manager users hitting `/client/customers` or `/client/contacts/[id]` are redirected to `/sales/customers` (`app/client/customers/page.tsx:27–28`). There is **no** `app/sales/customers` route (confirmed: `app/sales/` has leads, pipeline, inbox, quotes, tasks — not customers).
- **Customer impact:** Starter “contacts” with “role-appropriate visibility” fails for salespeople on the named customer list. Managers can still use Customer Hub.
- **Severity:** **medium** (workflow hole, not proven data leak).
- **Correction:** Ship a salesperson customers route or stop redirecting there; verify assigned-only visibility with two users.

### F4 — “Tasks” is not a task product

- **Observed:** No `tasks` table. Sales Tasks builds items from lead follow-up dates (`lib/sales/tasks/sales-tasks-data.ts`). Create task = `PATCH /api/leads/:id` with `follow_up_date` (`AddTaskSheet.tsx:71–74`). Complete = clearing/completing that follow-up.
- **Customer impact:** Buyers expecting assignable standalone tasks (or tasks detached from a lead) will not get that.
- **Severity:** **medium** (mis-sell).
- **Correction:** Word as “follow-ups and callbacks on leads”, or implement a real task entity before advertising S08.

### F5 — Shared WhatsApp hub is real in code; live delivery was not observed

- **Observed:** Receive: Meta webhook and gateway HMAC events → `whatsapp_messages` + lead match. Send: hub → `sendCanonicalWhatsAppText` → Meta Graph or gateway. Shared manager vs salesperson queues, claim/transfer, history, receipts, reconnect states exist. Inbound dedup via `whatsapp_external_messages`. **No durable outbox**; optimistic UI marks `sent` on HTTP 200 (`persist-outbound.ts` persists `sent` on success). **No send idempotency key**. Quick connection: live history only, no template/broadcast. Automated `sendWhatsApp` refuses `TEMPORARY_WEB`.
- **Customer impact:** Marketing a “shared WhatsApp Sales Hub” is architecturally fair; claiming **live shared inbox delivery** in production is not justified here. Duplicate sends on double-submit remain possible. Failed sends may not leave a failed row.
- **Severity:** **high** for message-loss/duplication if sold as proven live; **ops-high** because gateway is a separate always-on deploy.
- **Correction:** Authorised staging round-trip (Meta and/or Quick) with two seats; then qualify connection method in copy.

### F6 — Social Inbox: Facebook and Instagram are not the same claim

- **Observed:** Distinct channel enums (`facebook_messenger`, `facebook_comment`, `instagram_dm`, `instagram_comment`, …). Instagram connection is created only when the Facebook Page has `instagram_business_account` (`oauth.ts:110–128`). Unit tests cover ranking/permissions/filters, not Graph delivery. Lead Ads docs are a different product (`docs/FACEBOOK_INTEGRATION.md`).
- **Customer impact:** “Social Inbox for Facebook and Instagram” over-claims if Meta review, Page–IG link, or comment vs DM variants fail in the customer’s Meta app.
- **Severity:** **medium** (channel honesty); live reply failures would be **high** operationally.
- **Correction:** Publish only verified variants. Recommended wording in §6.

### F7 — Growth “AI” bundle mixes rule engines, drafts, and a separate Agentic product

- **Observed:** Daily focus is explicitly non-generative (`docs/SEGMIQ_DAILY_SALES_INTELLIGENCE.md`). Drafts use an LLM and instruct “salesperson will review… Do not send” (`lib/social-inbox/ai.ts:46–48`). Customer-facing agent defaults `enabled: false`, `sendQuotations: false` (`lib/agent/settings.ts:16–39`). Cron still runs intelligence/coaching/segments for **all** clients with no plan filter (`app/api/cron/daily/route.ts:40–70`).
- **Customer impact:** A Growth buyer may think they purchased Agentic WhatsApp; a Starter org may still receive Growth-labelled jobs if cron is on.
- **Severity:** **high** for commercial boundary; product confusion **medium**.
- **Correction:** Keep Agentic as a separate add-on (not in this table). Word Growth AI as drafts + weekly narrative + document Q&A. Do not call daily focus “AI”.

### F8 — Document Q&A/summaries are real modules with format and OCR limits

- **Observed:** Upload allow-list includes PDF/Office/CSV/TXT/JPEG/PNG. Image OCR is disabled (`extract.ts:187–196`). PPTX skipped. Summaries require ≥80 characters of extracted text. Ask returns `insufficientEvidence` rather than inventing when no sources (`ask.ts:247–256`). Cross-org view denied if `actor.clientId !== document.client_id`.
- **Customer impact:** Scanned PDFs and photos will not summarise or answer. That is narrower than “document questions and summaries”.
- **Severity:** **medium**.
- **Correction:** List supported formats; state scanned/image documents are stored without OCR in this release.

### F9 — Weekly team reports are a serious implementation; operational cron/R2 unverified

- **Observed:** Unique period index, generation statuses, AI fallback that **does not invent** low-activity analysis (test: “does not invent analysis when activity is near zero”), PDF render in unit test, manager-only permissions, cross-org report id fail-closed in tests, timezone on the report row. Cron path exists (`/api/cron/weekly-team-report`, also referenced from weekly-digest). Non-dev PDF storage needs R2.
- **Customer impact:** Fair Growth feature **if** cron + R2 + model keys are actually running for the customer’s org. A dashboard card or manual generate is not the same as “weekly” operational delivery.
- **Severity:** **medium** until staging cron is proven.
- **Correction:** Run one authorised weekly job for a test org covering empty week, duplicate cron, and failed-AI fallback.

### F10 — “Sales automation” is journeys + reminders, not a builder

- **Observed:** Four trigger types and five step types (`lib/marketing/journeys/types.ts`). Execution via WhatsApp campaigns cron. Follow-up reminders are a separate Meta-template path and fail on Quick connections.
- **Customer impact:** “Sales automation” in Growth copy will be read as Zapier-like. Actual scope is much smaller and depends on Meta templates + cron.
- **Severity:** **medium**.
- **Correction:** Name the four journeys and follow-up reminders.

### F11 — Win/loss insights lack win reasons

- **Observed:** Losing a deal requires `lostReason` (`close-deal.ts:203–206`). Winning does not capture a win reason. API sets `hasWonReasons: false` (`won-lost-data.ts:446–448`). Close date uses `updated_at`.
- **Customer impact:** “Win/loss insights” overstates a lost-reason breakdown and KPI trends.
- **Severity:** **low–medium**.
- **Correction:** “Lost-reason reporting” until win reasons exist.

### F12 — Forecasting is not “advanced” and disagrees with “open deals” copy

- **Observed:** Weighted sum of **open leads** by stage probability (`lib/revenue-forecast.ts:1–45`). Committed tier threshold 0.75 never reached by current stage map (max 0.5). Tests assert committed = 0 for the sample (`tests/revenue-forecast.test.ts:79–92`). Methodology `"stage"` only; AI curve deferred.
- **Customer impact:** Scale “advanced forecasting” is not evidenced. UI “open deals” wording vs lead query is misleading.
- **Severity:** **medium** (wrong commercial claim); not a billing-data-corruption bug by itself.
- **Correction:** Do not sell as Scale advanced forecast. If shown at all, call it stage-weighted pipeline forecast and fix deals vs leads wording.

### F13 — Plan entitlements are catalogue/UI, not server ACL (except seats + suspend)

- **Observed:** `CRM_PLAN_FEATURES` is copy (`lib/billing/plans.ts:38–58`). Social Inbox, documents, weekly reports, journeys, approval, forecast, segments APIs do not check `subscriptions.plan`. Seat cap applies on **salesperson invite only** (`app/api/clients/[clientId]/users/route.ts:165–188`). Suspended subscriptions lock portals (`middleware.ts:329–344`). `past_due` does not lock. Missing/non-catalogue CRM plan → `limit == null` → **no seat cap**.
- **Customer impact:** A Starter subscriber (even at today’s $99) can use Growth/Scale-labelled capabilities if the screens exist. Proposed packaging cannot be fulfilled.
- **Severity:** **high** for packaging; not by itself a cross-tenant leak.
- **Correction:** If packages are to be sold as exclusive, add server entitlement checks on APIs, jobs, exports, and AI tools. Out of scope for this audit to implement.

### F14 — Files: isolation is designed; live IDOR not exercised

- **Observed:** Storage keys `clients/{clientId}/documents/…`; download signs only after `canDownloadDocument`. Unit tests block private docs for other users **in-process**. No HTTP test of a second organisation fetching another org’s document id or signed URL.
- **Customer impact:** If a signed URL leaked, time-limited R2 URLs still work until expiry; **authz is the control**. Untested live.
- **Severity:** treat as **unverified high** until a two-tenant test is run.
- **Correction:** Authorised staging IDOR test (another org’s document id and a raw storage key).

### F15 — Quotations: catalogue price change does not rewrite stored lines (correct snapshot)

- **Observed:** Line persist stores `unit_price` and `catalog_unit_price` (`persist.ts:72–90`). Changing a product later does not by itself mutate existing quotation lines (no live-price trigger found on persist).
- **Customer impact:** Historical quotes keep quoted prices — usually desired. Buyers should not expect live catalogue repricing of sent quotes.
- **Severity:** informational if copy is honest.
- **Correction:** State that quotations snapshot prices at save/send.

---

## 4. Tests performed and blocked checks

### 4.1 Commands run (this audit)

**Batch A — Starter CRM + billing + quotations** (local, no DB):

```text
npx tsx --test tests/company-billing.test.ts tests/company-customers.test.ts tests/company-leads.test.ts tests/company-pipeline.test.ts tests/company-quotations.test.ts tests/quotation-totals.test.ts tests/quotation-enterprise.test.ts tests/company-dashboard.test.ts tests/company-reports.test.ts tests/company-team.test.ts tests/lead-to-deal.test.ts tests/deal-value.test.ts tests/convert-lead-won-customer.test.ts tests/commercial-foundation.test.ts
```

**Result:** `# tests 144` · `# pass 144` · `# fail 0` · exit 0.

What this proves: catalogue prices $99/$199/$349; seat constants 5/15/unlimited; billing access helpers; DTO/tab/filter/KPI helpers; quotation totals, governance, approval commercial check, package expansion, fingerprint change on price edit. **Does not prove** HTTP persistence, PDF send, WhatsApp delivery, or multi-tenant isolation.

**Batch B — Growth / Scale / WhatsApp / documents / weekly reports:**

```text
npx tsx --test tests/social-inbox.test.ts tests/operating-hours-daily-focus.test.ts tests/sales-intelligence.test.ts tests/weekly-team-report.test.ts tests/documents-phase-b.test.ts tests/documents-phase-d.test.ts tests/company-whatsapp-hub.test.ts tests/salesperson-whatsapp-hub.test.ts tests/whatsapp-provider-connections.test.ts tests/gateway-message.test.ts tests/whatsapp-outbound-media.test.ts tests/whatsapp-lead-contacted.test.ts tests/revenue-forecast.test.ts tests/company-nav-config.test.ts tests/real-estate-gating.test.ts tests/quotation-authorised-signature.test.ts
```

**Result:** `# tests 131` · `# pass 131` · `# fail 0` · exit 0.

Notable assertions that **did** run: weekly report empty-data does not invent analysis; invalid AI JSON falls back to facts; manager vs salesperson weekly-report permissions; cross-org report id fail-closed; Unicode PDF render; document permission helpers including private-doc deny; forecast committed/best-case math; WhatsApp provider state machine and gateway restore helpers; Social Inbox RBAC/ranking filters.

### 4.2 Explicitly not run / blocked

| Check | Why blocked | Evidence still needed |
|-------|-------------|------------------------|
| Logged-in manager create contact → persist → salesperson visibility | `.env.local` may be a live tenant; audit forbids real-account use | Isolated seed DB + two roles |
| Salesperson `/sales/customers` | Route missing in source | After a route exists, browse it |
| Pipeline drag/won/lost against DB | No isolated fixture DB used | API + UI against test org |
| WhatsApp receive/send/assignment/receipts | No authorised test WABA/phone; sending forbidden | Staging round-trip, two seats, failure/retry cases |
| Quick connection QR + reconnect | Needs always-on gateway + real device | Render/gateway ops confirmation + test device |
| Facebook Messenger / comments live | No Meta connect | App review, webhook, send in 24h window |
| Instagram DMs / comments live | Same; FB ≠ IG | Page-linked IG professional account test |
| Document ask against two orgs | No second org runtime | IDOR: org B document id / storage key |
| Weekly report Monday cron for a real org-week | Cron not invoked | One authorised cron with `CRON_SECRET` on a **test** org |
| Journey engine send | Would message real/test phones via Meta | Dry-run or sandbox WABA |
| Quotation PDF send over WhatsApp | Send to recipients forbidden | Test number after approval gate |
| Production == `83ffa27` | No deploy inspection | Vercel deployment SHA + cron list |
| Priority support hours | No ops evidence in repo | Named roster, hours, escalation path |
| Seat invite over-limit HTTP | Would change subscriptions/users | Isolated API test only |
| Stripe / card charge | Not in product; charging forbidden | N/A |

`npm test` (full `tests/*.test.ts`) was **not** run as a single command; two targeted batches covering the claims above were. Remaining test files (security phases, agent, real-estate, etc.) were not required to score this package table and were not executed here.

---

## 5. Pricing implementation gaps

**Separate from feature functionality.** Do not treat these as “the CRM is missing contacts”.

| Proposed commercial rule | Code today | Gap |
|--------------------------|------------|-----|
| Starter $19 / Growth $29 / Scale $49 per seat | CRM catalogue **$99 / $199 / $349** per **company**, salesperson seat packs 5 / 15 / unlimited (`lib/billing/plans.ts:10–30`; locked by `tests/company-billing.test.ts:23–29`; public `/pricing`) | Prices and packaging unit (company vs seat) do not match |
| Every internal person is a paid seat (owners, managers, sales, support, customer admins); one person with several roles = one seat | Seats = active `SALESPERSON` only. Managers and `also_sells` managers are **not** counted (`lib/billing/company-billing-data.ts`; pricing FAQ). Roles in code: `SUPER_ADMIN`, `CLIENT_MANAGER`, `SALESPERSON` only. No OWNER / customer-admin role. Support is a **platform grant**, not a customer seat. | All-role seat counting **not implemented** |
| Organisation chooses one plan; roles determine permissions **within** that plan | One CRM `subscriptions` row per company is the model; **company managers cannot self-serve change plan** (agency-only update). Permissions are **role + `also_sells` + tenant**, almost never plan. | Plan does not drive feature ACL |
| Feature packages as in the proposal table | `CRM_PLAN_FEATURES` is display copy. Daily cron runs scoring, intelligence, coaching, segments, performance for all clients (`app/api/cron/daily/route.ts:32–70`). | **Direct packaging blocker:** lower-tier (or any) API/job can run “premium” functions |
| Agentic AI **not** included in CRM seat prices | No Agentic SKU on `subscriptions`. Agent is settings + env keys + RBAC. | Cannot invoice or entitle Agentic as an add-on from current billing schema |
| Billing provider | Manual invoices / payment proof (`docs/SEGMIQ_COMPANY_BILLING.md`). Not Stripe. | Fine if you keep manual billing; not a $19 self-serve checkout |
| Dual vocabularies | `subscriptions.plan` = starter/growth/scale; `clients.plan` = starter/professional/business mapped in `mapClientPlanToCrmPlan` | Confusion risk, not the proposed table |

**Downgrade behaviour:** not exercised (audit forbids changing subscriptions). Docs say the billing UI does not delete users or data on downgrade; seat enforcement is invite-time. Unexpected lockout of existing records on downgrade is **unverified**.

---

## 6. Corrected package table

Proposed **plan names and $19 / $29 / $49 rates retained** as commercial placeholders. Capabilities below are **only** those justified by this audit. Environment qualifier for all rows: **implemented in local source `83ffa27`; unit-tested where cited; not proven on a logged-in customer tenant or live providers in this audit.**

Rates are **not** commercially validated. Functional readiness ≠ price optimality. Current billed catalogue remains $99 / $199 / $349 until billing is changed (out of scope).

### Capabilities that can be described (with qualifications)

| Plan | Monthly (proposed) | Intended buyer (proposed) | Evidence-justified package copy |
|------|--------------------|---------------------------|----------------------------------|
| **Starter** | $19 | Teams organising enquiries, quotations and follow-ups | **Manager** contacts/customers and leads (create/edit/assign/history/convert); pipeline with persisted stages and won/lost (lost reason required); **product catalogue and commercial packages** used on quotations (not warehouse stock); quotations with qty, line discount/tax, snapshotted prices, PDF preview, and a distinct send path; **manual** follow-ups/due dates; company documents attachable to customer records (R2); manager dashboard and **standard company reports** (Overview, Sales, Pipeline, Leads, WhatsApp, Quotations, Team, Customers, Activities) with date range, salesperson filter, and CSV. **Shared WhatsApp Sales Hub is built** (Meta Cloud and optional Quick/linked-device gateway) but **live delivery was not verified in this audit.** |
| **Growth** | $29 | Teams that need assistance prioritising work and managing more channels | Everything in the **qualified Starter** list, plus: **Facebook Social Inbox** for Messenger and Page comments (code; live Meta unverified); **daily sales plan** generated from CRM data (explainable rules, not generative AI); **AI reply drafts** that insert into a composer and do not send by themselves; **document Q&A and summaries** for text-extractable files (PDF/DOCX/XLSX/TXT/CSV; no OCR); **weekly team performance reports** for managers (scheduled job implemented; operational cron/R2 unverified); **predefined WhatsApp journeys** (quotation no-response, dormant lead, anniversary, lost-deal-funds) and follow-up reminder jobs; **lost-reason** won/lost reporting. **Not included:** customer-facing Agentic AI. |
| **Scale** | $49 | Organisations that need deeper oversight and more complex workflows | **Hold — do not publish a differentiated Scale package from this evidence.** Quotation approval workflows exist **in the product** (send blocked until approved; editing changes the commercial fingerprint) but are **not Scale-gated**, and internal PDF preview is not approval-gated. Company reports and stage-weighted forecast are not Scale-exclusive advanced oversight. |

### Unverified or unsupported claims (do not present as available)

- Live shared WhatsApp receive/send/receipts in production or staging
- Instagram DMs and comments as a proven customer channel
- Facebook/Instagram live webhook delivery and Meta app-review permissions
- Automated customer WhatsApp (follow-ups, journeys, coaching) on **Quick** connections
- Standalone task assignment/completion (S08 as written)
- Salesperson customer list (`/sales/customers`)
- Scanned/image document Q&A or summaries (OCR off)
- Win-reason insights
- Freeform sales automation builder
- Advanced (deal-reconciled / predictive) forecasting
- Advanced reporting beyond the existing company report tabs
- Multi-team management
- Branch management
- Configurable management views
- Priority support during published hours (no hours/SLA/roster found)
- Plan-enforced exclusivity of any Growth/Scale feature
- $19 / $29 / $49 seat billing and all-role seat counting
- That commit `83ffa27` is deployed

### Honest substitute phrases

| Proposed phrase | Safer phrase |
|-----------------|--------------|
| Shared WhatsApp Sales Hub | Shared WhatsApp inbox in SegmiQ (Meta Cloud and optional linked-device connection); live delivery to be confirmed per account |
| Tasks and follow-ups | Follow-ups and callbacks on leads (due dates, assignee visibility, optional WhatsApp reminders when Meta Cloud + cron are enabled) |
| Daily focus and AI message drafts | Daily sales plan from your pipeline, plus AI **drafts** you edit and send |
| Social Inbox for Facebook and Instagram | Facebook Messenger and Page comments inbox; Instagram only if a professional account is linked to the Page (**unverified live** in this audit) |
| Sales automation and win/loss insights | Predefined WhatsApp journeys and lost-reason reporting |
| Advanced forecasting and reporting | *(omit from Scale)* Company reports already listed in Starter; optional stage-weighted pipeline forecast |
| Multi-team or branch management | *(omit — neither found)* |
| Configurable management views | *(omit)* Company dashboard and reports with date and salesperson filters |
| Quotation approval workflows | Optional commercial approval before **send** (not Scale-exclusive; internal PDF preview not blocked) |
| Priority support during published support hours | *(omit until operations confirms hours, roster, and routing)* |
| Every internal person is a paid seat | *(not true in code)* Today: billed per company; salesperson seat packs. Proposed all-role seating is a future billing change |

---

## 7. Actionable next steps (smallest ordered set)

Do **not** implement these in this task; they are the path to a table you can stand behind.

### Before any public package table

1. **Decide Scale:** hold it, or replace it with one real exclusive capability that will be **server-enforced**. Do not pad Scale with Starter reports or ungated approval.
2. **Rewrite Starter copy** using §6 (no standalone tasks; qualify WhatsApp; manager vs salesperson contacts).
3. **Rewrite Growth copy** using §6 (channel-specific Social Inbox; daily focus ≠ AI; journeys not “automation”; lost reasons not win insights; Agentic excluded).
4. **Treat pricing as a separate workstream:** $19/$29/$49, all-role seats, and entitlement middleware are not in this codebase. Shipping the proposed table without that work would contradict both product behaviour and current `/pricing`.

### Fixes required if Starter is sold as written today

5. Repair or remove `/sales/customers` redirect (S01).
6. Either implement tasks or change the word “tasks” (S08).
7. Authorised WhatsApp staging: inbound, outbound, assignment, failure state, two seats, tenant isolation (S04). Do not use production customers.

### Fixes / confirmations for Growth

8. Live Facebook Messenger **and** Page comment tests on a dedicated Page; **separate** Instagram DM and comment tests — drop any variant that fails.
9. Confirm document ask cannot read another org’s document over HTTP (G05/S10).
10. Run weekly-team-report cron once on a test org: empty week, duplicate invocation, AI failure fallback, manager download (G07).
11. Trace one journey enrollment to a **sandbox** WhatsApp send, or drop “automation” until then (G08).

### If Scale is to exist later

12. Define actual Scale exclusives (e.g. enforced approval including PDF/export, true team/branch org units, or staffed priority support with published hours).
13. Add server `subscriptions.plan` checks on those APIs/jobs — hidden nav is not enough.
14. Close approval PDF bypass if approval is the Scale promise (X05).
15. Operational confirmation of support hours, roster, and escalation **in writing** — a badge is not delivery (X07).

### Verification still required in an isolated environment

16. Two-organisation HTTP pass over contacts, files, WhatsApp ids, quote tokens, weekly report ids.
17. Role matrix: manager vs salesperson vs (if introduced) owner/support, **without** using production data.
18. Record whether production deployment SHA equals `83ffa27` before quoting live reliability.

---

## Direct answer

**Can SegmiQ truthfully publish and fulfil this exact package table today?**

**No.**

**Phrases that must change**

- Do not publish Scale as “everything in Growth” plus advanced forecasting, advanced reporting, multi-team or branch management, configurable management views, and priority support during published hours.
- Do not describe Starter “tasks” as a general task system.
- Do not imply a working salesperson customer file UI (`/sales/customers` is missing).
- Do not treat Facebook Social Inbox as proof Instagram works, or Lead Ads as Social Inbox.
- Do not call daily focus “AI”.
- Do not call predefined journeys “sales automation” without narrowing.
- Do not claim win-reason insights.
- Do not include customer-facing Agentic AI in these seat prices (and do not imply Growth drafts are Agentic).
- Do not claim live WhatsApp or live Meta inbox delivery from this audit.
- Do not claim $19/$29/$49 or “every internal person is a paid seat” as **current product billing**.

**Features that need fixes (if the current wording is kept)**

- Salesperson customers route / visibility (S01).
- Real tasks or copy change (S08).
- Approval PDF/export bypass if Scale (or anyone) is sold “enforced approval” (X05).
- Server-side plan entitlements if packages are exclusive (cross-cutting).
- Seat counting if the all-role rule is the commercial offer (billing workstream).

**Claims that remain unverified**

- Live WhatsApp shared inbox delivery, receipts, reconnect, and duplicate-send behaviour on a real number.
- Live Facebook/Instagram inbox send/receive and Meta app permissions.
- Operational weekly report cron + R2 in a deployed environment.
- Live document cross-org isolation over HTTP.
- Journey/reminder WhatsApp delivery.
- Production deployment of this git revision.
- Priority support hours, staffing, and escalation.
- Downgrade/entitlement behaviour against real subscriptions.

**Hold Scale** rather than pad its description. Starter and Growth can be discussed as **narrowed, environment-qualified** product bundles — not as this exact table, and not as verified live customer fulfilment.
