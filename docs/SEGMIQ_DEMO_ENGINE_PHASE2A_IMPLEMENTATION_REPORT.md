# SegmiQ Operational Demo Engine — Phase 2A Implementation Report

Phase 2A builds the secure guest-demo foundation only. It does not build Demo Studio, extra industry templates, guided tours, engagement analytics, quotation or task adapters, or account conversion.

Guest access is **disabled by default**. The migration in this phase has **not been applied**. This is **not** a deployment-ready release.

---

## A. Architecture decision

**Selected: Architecture B — one SegmiQ codebase, a separately configured demo deployment, and one dedicated demo Supabase project.**

The Phase 1 audit recommended Architecture C: one deployment and one database, with fictional operations kept out of CRM tables. That recommendation is still the right *data model*. It is not a sufficient *deployment* boundary for public guests, because `createAdminClient()` in `lib/supabase/admin.ts` uses `SUPABASE_SERVICE_ROLE_KEY` and bypasses RLS. A guest request that reaches an unadapted query would run with production privileges if the process held production credentials.

Architecture B is feasible without a second application:

| Criterion | Architecture A — shared deployment and database | Architecture B — shared code, isolated demo deployment |
|---|---|---|
| Tenant isolation | Application checks only. A missed filter can read production rows with the service role. | The demo process has no production database credentials, so it cannot read production rows even if a filter is missed. |
| Service-role risk | The same key serves customers and guests. RLS does not apply. | The demo key can only see the demo project. RLS is still not the control; the credential boundary is. |
| NextAuth | Unchanged for production users. Guest cookies must be kept out of the production process. | Production NextAuth stays on the production deployment. The demo deployment has its own `NEXTAUTH_SECRET` and `NEXTAUTH_URL`. |
| Migrations | One stream. | The same migration files are applied to the demo project as well as production. Schema drift becomes a demo outage if the demo project is left behind. |
| Routing | One host. Guest routes must be impossible to enable by accident. | Same routes, different host and environment. Guest redemption refuses to run unless the process is explicitly marked as the demo deployment. |
| Cost | No extra project. | One extra Supabase project and one extra app deployment. Not one project per prospect. |
| Maintenance | Lowest infrastructure cost, highest blast radius. | One codebase and one UI. Two environment configurations. No forked CRM. |
| Deployment complexity | Lower. | Operators must provision the demo project, apply migrations there, and withhold production secrets. `vercel.json` still declares cron schedules, so a Vercel project created from this repo would schedule those routes unless they no-op. |

The audit’s objection that Architecture B “fights” `createAdminClient()` applies to using two Supabase projects inside **one process**. The client is a process-wide singleton bound to `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. A second deployment is a second process with different environment variables. That does not require a forked UI or a second admin-client implementation.

**Data model inside the demo project remains Architecture C.** Rossi records stay in code (`lib/demo/industries/tyres/rossi/dataset.ts`). Visitor changes go to `demo_session_mutations`. They are not inserted into `leads`, `deals`, or `quotations`.

**Residual risk.** This code cannot prove that the configured Supabase URL is not production. Guest redemption stays off unless both of these are set on that process:

- `SEGMQ_DEPLOYMENT=demo`
- `SEGMQ_DEMO_GUEST_ACCESS=enabled`

Do not set the second variable on the production deployment. Do not copy production Resend, Meta, Zoho, WhatsApp gateway, R2, or Supabase credentials into the demo deployment. Do not create one Supabase project per prospect.

---

## B. Implemented functionality

What is in the codebase and what was actually exercised:

| Capability | Status |
|---|---|
| Server-side production vs guest context | Implemented. Production NextAuth is returned unchanged when no demo cookie is present. |
| Guest invitation create, redeem, revoke | Implemented. Disabled unless the demo deployment flag is on. Not exercised against a database. |
| HttpOnly session cookie, separate from the invitation token | Implemented and unit-tested for cookie flags and hashing. |
| Rossi salesperson and manager personas, including the other Rossi salespeople already in the dataset | Implemented. Persona switch updates `demo_sessions.persona_key` only. |
| Session-scoped mutation log with compare-and-swap | Implemented. Isolation and a conflicting write were tested with an in-memory repository, not against Postgres. |
| Existing staff Rossi rehearsal on `demo_workspace_mutations` | Preserved. Guests do not use that log. |
| Salesperson dashboard, pipeline, and deal page can resolve a guest session | Wired to `getOperationalSession`. Not browser-verified. |
| Deal stage change for a guest | `PATCH /api/deals/:id` is allowlisted and appends a session mutation when guest context is bound. Not exercised live. |
| Manager dashboard for the manager persona | `/client/dashboard` is allowlisted. Same session mutation log is used. |
| Fictional-data indicator and minimal persona selector | `DemoWorkspaceChip` shows “Fictional demonstration” for a guest and posts persona changes to `/api/demo/persona`. |
| External egress refusal | Resend, campaign templates, WhatsApp gateway, Zoho, R2 `putObject`, and agent tools refuse before the provider call when the deployment is demo, a guest context is set, or the workspace is a demo workspace. |
| Cron no-op on the demo deployment | Implemented on the existing cron routes. |
| Fail closed when a guest template or session cannot be resolved | Guest dataset loads throw `DemoAccessDenied` instead of returning null. Null still means “use production” for staff. |
| Public guest access | Off. `SEGMQ_DEMO_GUEST_ACCESS` is not enabled in this repository. |

The first prospect path is implemented in code as:

1. An authorised super admin creates an invitation with `POST /api/agency/demos/invitations` (flag required).
2. The prospect opens `GET /demo/[token]`.
3. The server stores only a hash, creates a separate session secret, sets `segmiq_demo_session`, and redirects to `/sales/dashboard`.
4. Pipeline and deal reads use the Rossi dataset plus that session’s mutations.
5. A stage change persists in `demo_session_mutations`.
6. Switching persona does not reset that log.
7. A second session has its own row.

That path cannot be completed until the migration is applied to the dedicated demo project, Rossi is seeded there, and the two environment switches are turned on **only on that deployment**.

---

## C. Changed files

### New

- `lib/demo/deployment.ts` — demo-deployment flag, guest-access switch, TTLs, cookie options
- `lib/demo/tokens.ts` — 32-byte tokens and SHA-256 hashes
- `lib/demo/context.ts` — guest async context
- `lib/demo/errors.ts` — `DemoAccessDenied`
- `lib/demo/egress.ts` — fail-closed external-action decision
- `lib/demo/allowlist.ts` — guest page and API allowlists
- `lib/demo/personas.ts` — Rossi personas only
- `lib/demo/cookie.ts` — session cookie read
- `lib/demo/session-store.ts` — session mutation log and compare-and-swap
- `lib/demo/guest-session.ts` — redeem, revoke, persona switch, invitation create
- `lib/demo/guest-gate.ts` — middleware gate
- `lib/demo/cron.ts` — scheduler skip
- `lib/auth/operational-session.ts` — production session or guest session
- `app/demo/[token]/route.ts` — invitation redemption
- `app/demo/unavailable/page.tsx` — denial page
- `app/api/demo/persona/route.ts`
- `app/api/demo/session/reset/route.ts`
- `app/api/agency/demos/invitations/route.ts`
- `app/api/agency/demos/invitations/[id]/revoke/route.ts`
- `supabase/migrations/20261012194500_demo_guest_sessions.sql`
- `tests/demo-guest-foundation.test.ts`

### Modified for this foundation

- `middleware.ts` — guest API and page gates; `/demo` is public so redemption is not sent to `/login`
- `lib/supabase/middleware-admin.ts` — exported the existing edge lookup helper
- `lib/auth/resolveApiAuth.ts`
- `lib/auth/getAuthFromRequest.ts`
- `types/next-auth.d.ts` — optional `demoGuest` (NextAuth login does not set it)
- `lib/demo/provider.ts`
- `lib/demo/actions.ts`
- `lib/demo/acl.ts`
- `lib/demo/external.ts`
- `app/sales/layout.tsx`
- `app/sales/dashboard/page.tsx`
- `app/sales/pipeline/page.tsx`
- `app/sales/deals/[dealId]/page.tsx`
- `app/client/layout.tsx`
- `app/client/dashboard/page.tsx`
- `lib/sales/sales-shell-props.ts`
- `app/api/demo/status/route.ts`
- `app/api/demo/reset/route.ts` — guests cannot reset the organisation log
- `components/demo/DemoWorkspaceChip.tsx`
- `lib/email/resend.ts`
- `lib/marketing/send-campaign-template.ts`
- `lib/whatsapp/gateway-client.ts`
- `lib/zoho-books/http.ts`
- `lib/storage/r2.ts`
- `lib/agent/tools/execute.ts`
- Cron routes under `app/api/cron/**/route.ts` that now call `demoCronSkip()`
- `app/api/cron/whatsapp-campaigns/route.ts` also excludes `workspace_mode = demo` from the active-client query

Other uncommitted files in the working tree (reports UI, quotation builder, password helper, qualification flow, and similar) are not part of this phase.

The migration file was named to match the existing `YYYYMMDDHHMMSS_name.sql` convention. It was not created with `supabase migration new`.

---

## D. Database changes

**Not applied.** No migration was executed against production or against a demo project. Nothing in this report claims the tables exist in a live database.

New migration: `supabase/migrations/20261012194500_demo_guest_sessions.sql`

| Table | Purpose |
|---|---|
| `demo_invitations` | Hashed invitation token, expiry, revocation, creating user, demo `client_id` |
| `demo_sessions` | Separate hashed session secret, persona key, expiry, revocation, invitation link |
| `demo_session_mutations` | One JSON mutation log and an integer `version` per session |

RLS is enabled on all three. `anon` and `authenticated` are revoked. `service_role` is granted. There are no policies that would allow a browser client to read these tables. The application still uses the service role on the server.

`demo_workspace_mutations` is unchanged. No production CRM rows are deleted or rewritten. No customer is marked as a demo.

### Environment that must be provisioned later

On the demo deployment only, before any invitation is issued:

- A dedicated Supabase project, not the production project
- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for that project only
- Distinct `NEXTAUTH_SECRET` and `NEXTAUTH_URL`
- `SEGMQ_DEPLOYMENT=demo`
- `SEGMQ_DEMO_GUEST_ACCESS=enabled` only after the checks below
- Rossi seeded in that project with `workspace_mode = demo`, industry `tyres`, scenario `rossi`
- This migration applied to that project
- Production Resend, Meta, Zoho, WhatsApp gateway, and R2 secrets omitted
- Cron schedules disabled in the demo host, in addition to the code skip

No connection strings are invented here. Those values do not exist in this change.

---

## E. Authentication and guest sessions

Production behaviour is unchanged when `segmiq_demo_session` is absent. `getServerSession` and the existing NextAuth cookie path still run. `requireSuperAdmin` was not switched to the operational session, so a guest cookie cannot open agency administration.

Resolution order in `getOperationalSession` and `resolveApiAuth`:

1. If a NextAuth user and a demo cookie are both present, the request is refused. API routes return 409. Pages clear the demo cookie and redirect to `/demo/unavailable`.
2. If only NextAuth is present, that session is returned as before.
3. If only a demo cookie is present, the secret is hashed and looked up in `demo_sessions`. The invitation must still be unexpired and unrevoked. The client must be `workspace_mode = demo` with the Rossi template. The persona must be one of the configured Rossi actors and must not resolve as `SUPER_ADMIN`.
4. The guest is bound in server context for the rest of the request. `clientId` comes from the session row, not from a query or body.

A guest session is shaped as a salesperson or client manager of that one workspace, with `demoGuest: true`, `alsoSells: false`, and `clientMode: "team"`. MFA is not applied to the guest. Platform permissions are not granted.

### Tokens and cookies

- Invitation tokens are 32 random bytes, base64url.
- Only the SHA-256 hex hash is stored.
- Redemption creates a new session secret. The invitation token is not the cookie value.
- Cookie name: `segmiq_demo_session`.
- `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when `NODE_ENV=production`.
- Session lifetime: 12 hours.
- Invitation lifetime: 7 days by default, rejected above 30 days.
- The cookie is not written to local storage.
- Redemption and status responses set `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
- Allowed guest pages also receive those headers.
- The raw token is not written to an application log. The URL path `/demo/[token]` can still appear in host access logs. That is a residual of the required URL shape.

### Revocation

`POST /api/agency/demos/invitations/:id/revoke` sets `revoked_at` on the invitation and on its sessions. Later requests fail because both the session and the invitation are checked. Revocation does not depend on waiting for the 12-hour cookie expiry.

### Rate limit

Redemption uses the existing database rate limiter, key `demo-redeem:` plus a hash of the client IP, 30 attempts per 15 minutes.

### Roles for the first release

| Persona | Role | Pages |
|---|---|---|
| Tinashe Moyo (default) | Salesperson | `/sales/dashboard`, `/sales/pipeline`, `/sales/deals/:id` |
| Rudo, Tanaka | Salesperson | Same salesperson pages |
| Tendai Muchengeti | Manager | `/client/dashboard` only |

A salesperson persona does not receive manager pages. A manager persona stays inside the demo workspace. Persona switch does not change the session id or the mutation row.

`CLIENT_MANAGER` still has billing permission in the existing role profile. Guest billing safety is the middleware allowlist, not a change to manager permissions. Guests cannot call billing, user-invite, impersonation, or platform routes. Those APIs are not on the allowlist, so the middleware returns 403 before the handler.

### Pages traced for this release

These pages now call `getOperationalSession` rather than `getServerSession` alone:

- `app/sales/layout.tsx`
- `app/sales/dashboard/page.tsx`
- `app/sales/pipeline/page.tsx`
- `app/sales/deals/[dealId]/page.tsx`
- `app/client/layout.tsx`
- `app/client/dashboard/page.tsx`

Deal authorisation still goes through `canReadDeal` / `canModifyDeal`, which call `getAuthFromRequest`. That helper binds the guest before the demo lookup. Unsupported sales and client routes are redirected by middleware before their own login redirect. Direct API calls that are not allowlisted are refused.

---

## F. Demo state isolation

Each visitor session has one `demo_session_mutations` row. The base Rossi dataset is shared and immutable. `applyDemoMutations` still applies the log in memory.

- Cache keys include the session id, so two empty logs do not share a snapshot.
- Writes use compare-and-swap on `version`. A conflicting version is retried up to five times, then the write throws.
- A database error throws. There is no process-memory fallback on the guest path.
- Reset of a guest session (`POST /api/demo/session/reset`) clears only that session’s log.
- `POST /api/demo/reset` remains the staff organisation reset and returns 404 for a guest.
- Staff Rossi mutations still use `demo_workspace_mutations`, including its existing in-memory fallback. That path is intentionally unchanged so current staff rehearsal keeps working. Guests do not call it.

Acceptance scenario, as implemented:

- Visitor A and Visitor B redeem separate sessions, so they receive separate secrets and separate mutation rows.
- Visitor A’s stage change appends to Visitor A’s row. Visitor A’s manager persona reads that same row.
- Visitor B’s read uses Visitor B’s row, which does not contain Visitor A’s mutation.

The compare-and-swap behaviour was verified with an in-memory repository. It has not been verified against Postgres, because the migration is not applied.

---

## G. Security controls

### Production data

- Guest `loadDemoDatasetForClient` throws `DemoAccessDenied` on a client mismatch, a non-demo workspace, or any template other than tyres/rossi. It does not fall through to CRM queries.
- Guest lookups in `lib/demo/acl.ts` throw instead of returning `"production"`.
- The pipeline page throws if a guest session has no demo dataset, before the production `deals` query.
- The deal page returns not found if a guest lookup is not in demo mode.
- Workspace identity is the session’s `client_id`. Request-supplied client ids that do not match are denied.
- Unlisted APIs are denied in middleware. A hidden button is not the control.

A guest cannot, through the allowlist:

- Open another demo workspace or a production company
- Pass an arbitrary `clientId` as their tenant
- Create CRM users or send invitations
- Open agency administration, billing management, or impersonation
- Reach password-management routes
- Call the organisation-wide demo reset

`SUPER_ADMIN` is refused if a resolved guest persona ever carries that role.

### External effects

`decideEgress` refuses when any of these is true: the process is the demo deployment, a guest context is active, or the workspace mode is demo. Missing `clientId` does not become permission to send. On a demo deployment the refusal happens before a workspace lookup.

| Boundary | Behaviour |
|---|---|
| `sendEmail` | `{ success: false, error: "DEMO_EGRESS_BLOCKED" }` before Resend |
| `sendCampaignTemplate` | `{ ok: false, errorCode: "DEMO_EGRESS_BLOCKED" }` before Graph |
| WhatsApp gateway wake and call | Throws `DEMO_EGRESS_BLOCKED` before `fetch` |
| Zoho get and write | Throws before region and URL resolution |
| `putObject` | Throws before the storage call |
| `runAgentTool` | Returns `BLOCKED` / `DEMO_EGRESS_BLOCKED` before executors |
| Cron routes | Return `{ ok: true, skipped: "demo-deployment" }` when `SEGMQ_DEPLOYMENT=demo` |

`simulatedExternalSend` is the existing deliberate simulation for channels that already return `simulated: true`. It is not used to report success for the refused operations above. A refused email or campaign is a failure, not a pretend send.

The chip tells the guest the records are fictional. The unavailable page states that no message was sent.

### What is still residual

- Operators must point the demo deployment at the dedicated database before enabling the flag. The code cannot check the URL.
- On a **production** deployment, a staff Rossi organisation with `workspace_mode = demo` can still be seen by production cron jobs other than the campaign query, which now excludes that mode. Guest access cannot be enabled there unless someone also sets `SEGMQ_DEPLOYMENT=demo`.
- `putObject` refuses a guest context and a demo deployment. A staff demo workspace on production, with no guest context, is not covered by that particular call unless the caller passes a client id into a future check. Current `putObject` calls `egressDecision()` without a client id.
- A bare `sendEmail` on production has no client id. Guest context and a demo deployment are refused. A staff password reset on production can still send.
- Agent tools are blocked for every demo workspace, including staff rehearsal, because egress treats `workspace_mode = demo` as refuse.
- Middleware database timeouts fail closed to `/demo/unavailable`. That is correct, and it can lock a demo during a PostgREST blip.
- Host access logs may contain `/demo/<token>`.

---

## H. Test results

Command that completed:

```text
node ./node_modules/tsx/dist/cli.mjs --test tests/demo-guest-foundation.test.ts tests/demo-workspace.test.ts
```

Result observed from that run:

| | |
|---|---|
| Tests | 22 |
| Suites | 9 |
| Pass | 22 |
| Fail | 0 |
| Skipped | 0 |
| Duration | about 217 seconds |

Covered by that run:

- Guest access stays off unless the process is the demo deployment and the switch is `enabled`
- A CRM session plus a demo cookie is a conflict
- Invitation material is stored as a hash
- The session cookie is HttpOnly and Secure in production
- Invitation lifetime above 30 days is rejected
- Neither Rossi persona receives platform impersonation, client-admin, or platform-billing permissions
- Page and API allowlists deny tasks, billing, invites, impersonation, lead patch, and organisation reset
- Two sessions keep separate mutation logs, and a conflicting write is retried
- Egress refuses a demo deployment, a guest, and a demo workspace
- Resend, Zoho, and the WhatsApp gateway make zero network calls from a demo deployment
- Agent tool execution is blocked before the tool runs
- Cron skip returns a skip response only when the deployment is demo
- Existing Rossi workspace tests still pass, including production-vs-demo provider selection

Not covered by an automated test, because they need the new tables or a full request:

- HTTP redemption of a valid, invalid, expired, or revoked invitation
- A tampered or expired cookie against `demo_sessions`
- Refresh persistence in Postgres
- Two live visitors moving deals
- A full NextAuth login regression in the browser
- Campaign-template and R2 network counters (the guards are in those modules; the test imports Resend, Zoho, the gateway, and agent tools)

### Typecheck

Not successful.

`node ./node_modules/typescript/lib/tsc.js --noEmit --pretty false --incremental false` ran for about 11 minutes and then crashed:

```text
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

A second run with `NODE_OPTIONS=--max-old-space-size=8192` was still running when it was stopped. **Do not treat the project as typechecked for this phase.** No TypeScript errors were reported before the crash, and none were confirmed absent.

### Browser

The guest journey was not verified in a browser. Guest access is disabled, and the migration is not applied, so a prospect link cannot be redeemed against a real session row. Production login and the salesperson dashboard were not re-walked in this pass.

---

## I. Remaining gaps

Working in code, behind the flag:

- Invitation issue, redeem, revoke, and session cookie
- Rossi guest entry to the salesperson dashboard, pipeline, and an existing deal
- Stage moves through the existing deal mutation, stored per session
- Persona switch without resetting that session
- Fictional-data chip
- Server-side denial of unlisted pages and APIs
- Egress refusal for the integrations listed above

Incomplete or disabled on purpose:

- Demo Studio
- Solar, real estate, and other industry templates
- Guided tours and engagement analytics
- Account conversion
- Quotation create and edit
- Tasks, follow-ups, and lead patch mutations
- Social Inbox
- Live Sales Copilot
- Any action that would need a new demo adapter

Those unlisted actions are denied by middleware or left on their existing staff-only paths. They are not described as working guest features.

Staff demo workspaces still use the organisation mutation log. Guest sessions do not.

---

## J. Next implementation phase

Phase 2B should make the essential CRM workflows operational for a guest without widening the security boundary.

1. Apply `20261012194500_demo_guest_sessions.sql` to the dedicated demo project only, after that project exists. Confirm the apply. Do not apply it to production as part of enabling guests.
2. Seed Rossi in that project and confirm actor ids used by the guest session match deal `owner_id` values. If the users are missing, the dataset falls back to deterministic ids; the session must use those same ids or salesperson deal checks return 403.
3. Re-run the project typecheck with a heap large enough to finish, and fix any errors in the files listed above.
4. Add request-level tests for redeem, revoke, expired and tampered cookies, and two sessions against a test database.
5. Quotation create and edit through `applyDemoMutations`, with server-side denial until the adapter exists.
6. Tasks and follow-ups, including the mutation types the dataset already understands (`followup.complete`, assignment) wired to the real buttons.
7. Lead updates that the lead cards already send, which are denied today.
8. Mark every simulated send in the UI so it cannot be read as a message that left SegmiQ.
9. Keep `SEGMQ_DEMO_GUEST_ACCESS` off on every production process.

Do not start Demo Studio, new industries, or live external integrations in that phase. Finish the Rossi guest workflows on the isolated deployment first.
