# SegmiQ Demo Engine — Phase 2A.3 Security Readiness

Date: 13 October 2026

Scope: shared production database and the existing application deployment. The separate-database design is closed. This phase did not apply a migration, did not re-seed Rossi Tyres, did not change any customer `workspace_mode`, did not send a live message, and did not set guest flags in the deployment environment.

Status words mean:

- **PASS** — the check ran and succeeded, or the source path was inspected and the control is present.
- **FAIL** — the check ran and the control was absent or wrong.
- **BLOCKED** — the check needs a database, deployment, or approval that was not available.
- **NOT TESTED** — the check was not run.

Evidence kinds are named in each section: source inspection, mocked unit test, database-backed test, or browser verification.

---

## 1. Executive summary

The guest service-role client can no longer query `clients`. A guest reads one organisation through `readPinnedDemoWorkspace`, and only when the requested id is the workspace already stored on the server-side guest session. Production queries of `clients` are unchanged when no guest context is active.

Guest access on the shared application now requires three settings, not two: `SEGMQ_DEMO_DATABASE=shared`, `SEGMQ_DEMO_GUEST_ACCESS=enabled`, and `SEGMQ_DEMO_SCHEMA=20261012194500`. None of those were set in this phase. Unsetting `SEGMQ_DEMO_GUEST_ACCESS` stops guest redemption and guest sessions without ending customer NextAuth sessions.

The mocked security suite finished at **30 pass, 0 fail**. The guest tables are still absent, so invitation redemption, session persistence, and the controlled live demonstration are **BLOCKED**. Public guest access stays off.

---

## 2. Critical organisation-query security fix

**Result: PASS** (source inspection and mocked unit tests). Database-backed enumeration against a disposable database: **BLOCKED**.

`lib/demo/repository-guard.ts` no longer allowlists `clients`. While a guest context is active, `createAdminClient().from("clients")` throws `DemoAccessDenied` before any select, insert, or update. The same wrapper still throws for `leads`, `deals`, `users`, and for `.rpc`, `.storage`, and `.auth`.

The replacement is `lib/demo/workspace-lookup.ts`:

- The id must equal `getGuestContext().clientId`. A missing or different id throws. There is no list method.
- The query is `.eq("id", pinnedId).maybeSingle()` with a fixed column list: `id`, `name`, `workspace_mode`, `demo_industry`, `demo_scenario`, `business_type`, `sales_workflow_preset`, `logo_url`.
- Integration secrets and `select("*")` are not in that list.
- The returned row's id is checked again against the pinned id.

`getWorkspaceConfig` uses that lookup when a guest context is active and rethrows `DemoAccessDenied` instead of treating it as a missing workspace. With no guest context it keeps the existing production query, including the fail-closed production mode when the demo columns are missing.

Guest pages that previously called `.from("clients")` after the session was bound now use the pinned lookup:

- `app/sales/layout.tsx`
- `app/sales/pipeline/page.tsx`
- `app/client/layout.tsx`
- `app/client/dashboard/page.tsx`

The deal page already skipped the company query when the deal was in demo mode.

Invitation redemption is a separate pre-session path. `loadGuestBySecret` and `redeemInvitation` run before `bindGuest`, so they are not guest-context queries. They still load one invitation or one session by hash, then one workspace by primary key. They do not list organisations.

`createUnguardedAdminClient` exists only so the pinned lookup can read that one row after the id check. It is not the client returned to guest request code.

Unit evidence in `tests/demo-guest-foundation.test.ts`:

- A guest context denies `clients`, `leads`, `deals`, and `users`.
- The same assertions allow those tables when no guest context is active.
- `requirePinnedWorkspaceId("rossi", "other-company")` and a null id throw.
- The pinned column list contains `id` and does not contain `access_token`, an `fb_` prefix, or `*`.

---

## 3. Guest request-context verification

**Result: PASS** for source inspection and the concurrent AsyncLocalStorage test. Browser and cross-process verification: **NOT TESTED**.

Context is `AsyncLocalStorage` in `lib/demo/context.ts`. There is no mutable global current-guest variable. `enterGuestContext` uses `enterWith` so later awaits in the same request still see the guest after `getOperationalSession` or `resolveApiAuth` returns. `runAsGuest` uses `storage.run`, which is what the concurrency test uses. `enterGuestContext` throws unless the role is `CLIENT_MANAGER` or `SALESPERSON`.

Middleware and the Node route runtime do not share that storage. `lib/demo/guest-gate.ts` does its own lookups: session by `secret_hash`, invitation by id, workspace by id. Allowlisted server components call `getOperationalSession`, which loads the secret again and calls `bindGuest` before any dashboard query. API handlers call `getAuthFromRequest`, which binds the same way. A cookie accepted by middleware is not trusted as an already-initialised context.

A request with both a NextAuth user and a demo cookie returns no operational session (`credentialsConflict`). An invalid or revoked secret returns null from `loadGuestBySecret`, and the gate sends the browser to `/demo/unavailable`.

Guest actor ids are `demoId("rossi:actor:<key>")` at session load and at persona switch. They do not read `users`. After the session is bound, dataset loading also falls back to those ids because `users` is denied. Salesperson deal ownership therefore matches the session even when the staff rehearsal users exist in the database. Staff rehearsal has no guest context, so it still resolves the seeded login users and the organisation mutation log. The two paths do not share mutation rows.

Concurrent test result: two `runAsGuest` calls and one call with no context resolved to `session-1`, `other-demo`, and `production` respectively. **PASS** (mocked).

---

## 4. Guest route security matrix

Middleware denies every page and API that `lib/demo/allowlist.ts` does not name. Allowlisted handlers bind the guest again and take the workspace id from that session. Browser exercise of these routes: **NOT TESTED**. Persistence of a stage change: **BLOCKED** until the guest tables exist.

| Route | Auth | Workspace id | Data | Mutations | External | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /sales/dashboard` | Gate, then `getOperationalSession`. Salesperson only. | Session `clientId` | `loadDemoDatasetForClient`. Guest mismatch or a non-Rossi workspace throws. | None | Copilot fetch is not rendered for a guest | PASS, source |
| `GET /sales/pipeline` | Same | Pinned chrome lookup. Deals filtered to `owner_id === session.userId` | Fictional deals. Real-estate and solar boards are skipped for guests so they cannot query CRM tables | Stage changes go to `PATCH /api/deals/:id` | None on this page | PASS, source |
| `GET /sales/deals/:id` | Same | `lookupDemoDeal(session.clientId)` | Demo payload. Unknown id is 404, not a CRM read | None on GET | Call, WhatsApp, and quotation revision stay hidden | PASS, source |
| `GET /client/dashboard` | Gate. Manager only | Pinned logo and workflow fields | Company dashboard adapter | None | Weekly report fetch is skipped for a guest | PASS, source |
| `GET /api/auth/session`, `GET /api/auth/csrf` | Allowlist is GET only | None | NextAuth probe. Credential POST is not allowlisted | None | None | PASS, source |
| `GET /api/demo/status` | `getAuthFromRequest` | Guest context | Rossi personas only. `canReset` is false for a guest | None | None | PASS, source |
| `POST /api/demo/persona` | Guest context. Body may contain `personaKey` only | `guest.clientId`, not the body | Template persona | Updates `persona_key` on that session row | None | PASS, source. Database write BLOCKED |
| `POST /api/demo/session/reset` | Guest context | That session's mutation row | Clears that session's log by compare-and-swap | Cannot see another session | None | PASS, mocked store. Database BLOCKED |
| `GET` and `PATCH /api/deals/:id` | `canReadDeal` / `canModifyDeal` bind the guest first | `session.clientId` | Guest lookup never returns production mode | `appendDemoMutation` writes `demo_session_mutations` | No provider call on stage change | PASS, source. Database BLOCKED |
| `GET /demo/:token` | Public redemption, before a guest context exists | Invitation's `client_id`, then one workspace row | Creates one session and an empty mutation log | Invitation token is not the session secret | None | PASS, mocked redemption. Database BLOCKED |
| `POST /api/demo/reset` | Not allowlisted. Handler returns 404 for a guest | — | Organisation reset | Denied | — | PASS, source |
| Any other `/api/*`, `/sales/*`, or `/client/*` | Gate returns 403 or redirects | — | Not reached | Denied | Denied | PASS, source |

---

## 5. External integration regression results

**Mocked provider tests: PASS.** Live sends: **NOT TESTED**, and none were attempted.

`decideEgress` refuses the action when the process is the isolated demo deployment, when a guest context is active, or when the workspace mode is `demo`. On the shared application, a normal request with no guest context and a production workspace is still allowed. Platform email with no `clientId` and no guest context remains allowed. A missing `clientId` does not authorise a guest send, because the guest context alone refuses.

The unit test that stubs `fetch` recorded zero network calls for Resend, Zoho Books, and the WhatsApp gateway from a demo deployment. Guest and demo-workspace decisions are covered by `decideEgress` directly.

Production behaviour that must stay available, by source inspection:

| Integration | Production request | Guest or demo workspace |
| --- | --- | --- |
| WhatsApp gateway | Allowed when egress allows the caller | Refused before the gateway call. Campaign cron also excludes `workspace_mode = demo` |
| Resend | Allowed for a normal caller, including mail with no organisation id | Refused |
| Zoho Books | Existing region and credential behaviour | Refused before region resolution |
| Meta / QR pairing | Unchanged for staff | Not allowlisted. Gateway client refuses guest context |
| AI agent tools | Allowed for a production workspace | Refused for guest context and for `workspace_mode = demo`, including staff rehearsal inside a demo workspace |
| Cron | `demoCronSkip()` returns null unless `SEGMQ_DEPLOYMENT=demo` | Shared mode does not skip customer jobs |

`SEGMQ_DEPLOYMENT=demo` was not set and must not be set on this deployment. That flag would skip every cron that calls `demoCronSkip`.

Residual, source inspection: weekly digest, uncontacted-lead alerts, and WhatsApp campaigns exclude demo workspaces. Other jobs still scan CRM tables. Guests cannot insert those rows, and the Rossi seed script does not insert them. A demo organisation that already contained real CRM rows could still be seen by a job that does not filter `workspace_mode`. This phase did not query the database to count such rows. **NOT TESTED** against data.

---

## 6. Rossi dataset verification

**Fictional dataset, mocked tests: PASS.** Live organisation row: not re-queried. The operator's earlier read-only check remains the database evidence. This phase did not run `seed:rossi`.

Code and unit tests confirm:

- Template industry `tyres`, scenario `rossi`.
- Actors Tendai (manager), Tinashe (default salesperson), Rudo, and Tanaka. Roles come from the seed definition.
- Deal, quotation, customer, and owner ids stay aligned. Every generated deal uses the requested `clientId`.
- A salesperson projection contains that person's deals and not every deal. The manager projection includes the team.
- Clearing the mutation log restores the canonical stage.
- Two session logs do not share mutations. A compare-and-swap conflict retries and keeps both writes on one session.
- Persona switch changes `persona_key` only. The session id, and therefore the mutation log, stays the same.
- Session reset compare-and-swaps that session's row to an empty log. Another session's repo is a different key.

Staff rehearsal still uses `demo_workspace_mutations` when no guest context is set. Guests use `demo_session_mutations` only. Guest passwords were not issued.

Dashboard totals and a live stage change in the browser: **NOT TESTED**.

---

## 7. Migration readiness

**SQL review: PASS.** Applied to the project database: **not done**. Disposable-database rehearsal: **BLOCKED**.

File: `supabase/migrations/20261012194500_demo_guest_sessions.sql`

The script is additive. It does not `UPDATE` or `DELETE` customer CRM rows. It creates:

| Object | Behaviour |
| --- | --- |
| `public.demo_invitations` | `token_hash` is `UNIQUE`. `client_id` references `clients(id)` on delete cascade. `created_by` references `users(id)` on delete set null. `expires_at` required. `revoked_at` nullable |
| `public.demo_sessions` | `secret_hash` is `UNIQUE`. References the invitation and the client. `expires_at` required. `revoked_at` nullable. Index on `invitation_id` |
| `public.demo_session_mutations` | Primary key is `session_id`, so one log per session. `version integer not null default 0` with `check (version >= 0)`. `mutations` defaults to `[]` |
| RLS | Enabled on all three tables. No policies are added |
| Grants | `REVOKE ALL` from `anon` and `authenticated`. `GRANT` select, insert, update, delete to `service_role` only |

Compare-and-swap is one `UPDATE` filtered by `session_id` and `version`. The application treats zero returned rows as a conflict and retries. Postgres row locking makes that statement atomic. This was not executed against a database in this phase. The mocked store covers the same retry. **PASS** mocked, **BLOCKED** on Postgres.

Operator procedure, only after explicit approval. Do not run the whole migrations directory.

1. Confirm the target is the existing project and that `demo_invitations`, `demo_sessions`, and `demo_session_mutations` are still absent.
2. Apply only `20261012194500_demo_guest_sessions.sql`.
3. Confirm the three tables exist, unique constraints exist on `token_hash` and `secret_hash`, RLS is enabled, and `anon` / `authenticated` have no privileges.
4. Confirm a sample of customer `clients` rows still has the same `workspace_mode` as before the statement.
5. Set `SEGMQ_DEMO_SCHEMA=20261012194500` only together with the two guest switches, in the application environment, when a controlled test is authorised.

Until that approval, do not set the schema variable. Setting it without the tables would make the gate think the schema is acknowledged while redemption fails closed on the missing relation. Leaving it unset keeps the gate off.

---

## 8. TypeScript and build results

**Full typecheck: see the command result below. Production build: NOT TESTED.**

`package.json` `typecheck` is:

```text
node ./node_modules/typescript/lib/tsc.js --noEmit --pretty false --incremental false
```

Phase 2A.1 completed that command and Node aborted it:

```text
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

The default heap is about 2 GB, and `--incremental false` forces a full program. A later 8 GB retry in that phase was stopped before an exit code.

This phase started one incremental check, which is what `tsconfig.json` already requests (`incremental: true`), with a larger heap:

```text
node --max-old-space-size=8192 ./node_modules/typescript/lib/tsc.js --noEmit --pretty false
```

After about 18 minutes that process had printed no diagnostics. It was stopped. The shell recorded exit code 4294967295 because the process was killed, not because `tsc` reported type errors. There is still no successful typecheck exit code. The cause is the size of the program: the default-heap command aborts with the fatal allocation error above, and raising the heap to 8 GB did not produce a result within 18 minutes. The command was not repeated.

`next build` was not started. A filtered file check is not a full typecheck. **Full typecheck: no successful result. Production build: NOT TESTED.**

---

## 9. Security test evidence

Command (exit 0):

```text
node ./node_modules/tsx/dist/cli.mjs --test --test-name-pattern "guest access gate|guest permissions|session mutation|refuses demo deployment|does not call Resend|skips schedulers|invitation redemption|Rossi actor|guest repository|workspace mode|Rossi dataset|relative dates|rendered demo|external side|enables guests|organisation id|concurrent guest" tests/demo-guest-foundation.test.ts tests/demo-workspace.test.ts
```

Result: **30 pass, 0 fail**, `duration_ms` 13383. An earlier run in this phase was 29 pass and 1 fail because the schema check correctly ran before the isolated-project pin check. The assertion was updated. The agent-tool module was not imported; its earlier Phase 2A result is not recounted here.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Guest cannot list organisations | PASS | No list API. Pinned lookup throws on a foreign id. Mocked |
| Guest cannot request another organisation | PASS | `requirePinnedWorkspaceId` and `datasetFor` both throw. Mocked |
| Guest cannot use CRM tables | PASS | `clients`, `leads`, `deals`, `users` throw under guest context. Mocked |
| Guest cannot call RPC, storage, or auth-admin | PASS | Source: the admin proxy throws on `rpc`, `storage`, and `auth`. Not executed against Supabase |
| Guest cookie and NextAuth do not merge | PASS | `credentialsConflict` unit test. Source: operational session returns null |
| Invalid guest session fails closed | PASS | Source: null secret, missing row, and bad invitation state return null and the gate redirects. Database row: BLOCKED |
| Guest cannot assume `SUPER_ADMIN` | PASS | `enterGuestContext` throws. Mocked |
| Revocation blocks access | PASS | `invitationAccess` unit cases for revoked and expired invitations. Live revoke: BLOCKED |
| Concurrent guests keep their own session ids | PASS | AsyncLocalStorage test |
| Concurrent production request is unaffected | PASS | Same test; the unbound call saw no guest |
| Missing context does not by itself open CRM tables to a guest | PASS | With no context the guard allows production queries. Allowlisted handlers bind before they query. A handler that forgot to bind would be a bug; the allowlisted ones call `getOperationalSession` or `getAuthFromRequest` |
| Two sessions do not share mutations | PASS | Mocked session repo |
| Deal change survives refresh | BLOCKED | Requires `demo_session_mutations` |
| Persona switch keeps the same session state | PASS | Source: update changes `persona_key` only. Mocked id formula matches the dataset |
| Session reset cannot affect another visitor | PASS | Mocked repo keyed by session id |
| Normal users still authenticate | PASS | Source: NextAuth path is unchanged when the demo cookie is absent. Browser login: NOT TESTED |
| Normal CRM access stays authorised | PASS | Guard returns immediately when no guest context is active. Mocked |
| Production egress stays allowed | PASS | `decideEgress` unit case without guest context, without demo deployment, and without demo workspace |
| Background jobs still select production clients | PASS | `excludeDemoWorkspaces` adds `neq("workspace_mode","demo")` and `demoCronSkip()` is null when the deployment flag is unset. Mocked |

Database-backed security tests were not run. They are **BLOCKED**, not a pass. Browser verification is **NOT TESTED**.

---

## 10. Outstanding blockers

1. `20261012194500_demo_guest_sessions.sql` is not applied. Guest invitations and session state cannot be stored.
2. Full TypeScript validation still has no successful exit. The default-heap command runs out of memory. The 8 GB incremental command produced no diagnostics in 18 minutes and was stopped. See section 8.
3. `next build` was not run.
4. No disposable database was available, so constraints, RLS, and compare-and-swap were not executed on Postgres.
5. No browser pass of the Rossi guest flow, on desktop or mobile.
6. Jobs that scan CRM tables other than weekly digest, uncontacted leads, and WhatsApp campaigns do not all exclude `workspace_mode = demo`. They cannot see guest session state. They could see CRM rows if a demo organisation contained any. That was not counted.

Public guest access stays disabled until the migration is approved and the three environment variables are set on purpose.

---

## 11. Release readiness checklist

| Item | Status |
| --- | --- |
| Guest `clients` queries pinned to one workspace | PASS |
| Production `clients` queries unchanged without a guest context | PASS |
| Guest writes to `clients` denied | PASS |
| Schema acknowledgement required before the guest gate opens | PASS |
| `SEGMQ_DEPLOYMENT=demo` left unset | PASS |
| Guest flags left unset in the environment | PASS |
| Emergency stop documented (unset `SEGMQ_DEMO_GUEST_ACCESS`) | PASS |
| Mocked isolation, egress, and Rossi dataset tests | PASS, 30 / 0 |
| Guest migration applied | FAIL until approval. Not applied |
| Database-backed isolation test | BLOCKED |
| Full typecheck and production build | No successful exit. See section 8 |
| Controlled browser demonstration | BLOCKED |

The shared application is safe to keep serving customers with guest access off. It is not ready for a public or unattended guest invitation.

---

## 12. Exact steps for controlled live testing

Do not start these steps until the migration in section 7 has been approved and applied, and until an operator sets the three variables below on the existing deployment. Do not set `SEGMQ_DEPLOYMENT=demo`. Do not create a second Rossi organisation. Do not send a live WhatsApp, email, Zoho, or Meta call during the test.

Emergency stop at any point: remove `SEGMQ_DEMO_GUEST_ACCESS` and redeploy or restart so the process drops it. Existing customer NextAuth cookies keep working. Guest cookies then fail closed.

When the test is authorised:

1. Set `SEGMQ_DEMO_DATABASE=shared`, `SEGMQ_DEMO_GUEST_ACCESS=enabled`, and `SEGMQ_DEMO_SCHEMA=20261012194500`.
2. As a super admin, with no demo cookie on that browser, issue one invitation for the existing Rossi Tyres workspace. Copy the URL once. It is not shown again.
3. Open that URL in a browser that is not logged into the CRM. Expect the salesperson dashboard without a CRM password.
4. Open the pipeline. Confirm the deals belong to Tinashe and are the fictional Rossi records.
5. Move one fictional opportunity to another stage.
6. Refresh. The stage should still be the new one.
7. Switch to the manager persona. Expect `/client/dashboard`.
8. Confirm the manager figures reflect that stage change.
9. Open the same invitation URL in a second browser profile. Confirm that visitor starts from the canonical dataset and does not show the first visitor's stage change.
10. Revoke the invitation from the super-admin screen.
11. Refresh both browsers. Both should lose access and land on the unavailable page.
12. Repeat the navigation, stage change, and refresh on a phone-width viewport.
13. Unset `SEGMQ_DEMO_GUEST_ACCESS` when the test is finished.

If the migration, the schema acknowledgement, or the operator approval is missing, stop before step 1.
