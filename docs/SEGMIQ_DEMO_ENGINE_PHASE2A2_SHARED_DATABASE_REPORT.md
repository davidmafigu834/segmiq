# SegmiQ Demo Engine — Phase 2A.2 Shared Database Report

## A. Executive summary

The Demo Engine can now sit on the existing SegmiQ application and the existing Supabase project. A guest session is a separate request context. Turning that context on does not require `SEGMQ_DEPLOYMENT=demo`, so customer WhatsApp, email, accounting, agent tools, and cron jobs are not switched off for the whole process.

Public guest links stay **disabled**. This workspace does not set `SEGMQ_DEMO_DATABASE` or `SEGMQ_DEMO_GUEST_ACCESS`. The guest migration has not been applied. No browser opened a live invitation, and no test ran against the customer database.

The shared-database boundary that is enforced in code:

- Guest identity never merges with NextAuth.
- Guest service-role queries may touch only `clients` and the three demo control tables.
- Leads, deals, users, storage, auth admin, and RPCs throw `DemoAccessDenied` while a guest context is active.
- External sends are refused for a guest or a demo workspace, and still allowed for a normal production call.
- Schedulers keep running on the production app. An isolated demo deployment is still the only mode that skips them entirely.

That is not a completed production release. It is a safer shape for one database, with public activation still blocked.

## B. Architecture changes

Production and demo traffic share one Next.js process and one Supabase project.

| Context | How it is recognised | Data | External effects |
|---|---|---|---|
| Production user | NextAuth session, no demo cookie | Existing CRM repositories | Existing integrations |
| Guest | `segmiq_demo_session` only, after the invitation and session rows validate | Rossi dataset in code, plus that session's mutation row | Refused or explicitly simulated |
| Both credentials | Cookie and NextAuth together | Neither identity is used | Request is rejected |
| Isolated demo deployment | `SEGMQ_DEPLOYMENT=demo` | Optional later move | Whole process refuses sends and skips crons |

`SEGMQ_DEPLOYMENT=demo` is unchanged as a kill switch. Do not set it on the production application.

Fictional leads, deals, messages, and quotations stay in `lib/demo`. They are not inserted into CRM tables. Later, the demo control tables and the provider can move to another Supabase project by running the same app with `SEGMQ_DEPLOYMENT=demo` and the project-ref pin. The CRM pages do not need to be rewritten for that move.

## C. Deployment configuration

Guest redemption is enabled only when `guestAccessBlockReason()` returns null.

| Variables | Result |
|---|---|
| Neither guest flag set | Disabled. This is the production default. |
| `SEGMQ_DEMO_GUEST_ACCESS=enabled` alone | Disabled. Reason: `shared-database-not-selected`. |
| `SEGMQ_DEMO_DATABASE=shared` and `SEGMQ_DEMO_GUEST_ACCESS=enabled` | Enabled on the current application. Production integrations stay on. |
| `SEGMQ_DEPLOYMENT=demo` and `SEGMQ_DEMO_GUEST_ACCESS=enabled`, without project refs | Disabled. Reason: `supabase-project-unpinned`. |
| `SEGMQ_DEPLOYMENT=demo`, guest access enabled, demo ref, production ref, and a URL whose host is `<demo-ref>.supabase.co` | Enabled on an isolated deployment. Sends and crons for that process stay refused. |
| Isolated mode whose URL is the production ref | Disabled, and `createAdminClient()` throws. |

Do not set the guest flags in the deployed environment in this phase. Do not set `SEGMQ_DEPLOYMENT=demo` on production.

## D. Database architecture

Control tables, unchanged in purpose, in `supabase/migrations/20261012194500_demo_guest_sessions.sql`:

- `demo_invitations` — hashed invitation token, expiry, revocation
- `demo_sessions` — separate hashed session secret, persona, expiry, revocation
- `demo_session_mutations` — one JSON log and a `version` per session

RLS is enabled. `anon` and `authenticated` have no grants. The server still uses the service role, so the repository guard in section F is the control that matters for guests.

The migration is additive. It does not alter CRM tables, users, billing, or workspace modes. It was **not applied**. No migration history was read, because the only configured database is the live project.

Rollback, if it is later applied and must be removed, is dropping those three tables. That deletes guest sessions only. It does not touch customer CRM rows.

Compare-and-swap remains one `UPDATE` filtered by `session_id` and `version`. That statement is atomic in Postgres. It was not executed against a database in this phase.

## E. Guest authentication

Unchanged prospect path: `GET /demo/[token]` checks the hashed invitation, rate-limits, inserts a session with a new secret, and sets the HttpOnly cookie `segmiq_demo_session`. The invitation token is not the cookie.

A guest role can only be `CLIENT_MANAGER` or `SALESPERSON`. `enterGuestContext` throws if the role is anything else, including `SUPER_ADMIN`. Personas are the Rossi actors. The workspace id comes from the session row, not from the request.

A request with both a NextAuth user and a demo cookie is still a conflict. The API returns 409. Pages clear the demo cookie. The identities are not merged.

## F. Tenant and data isolation

`createAdminClient()` returns the normal service-role client for production requests. When a guest context is active it returns a wrapper:

- `.from(table)` is allowed only for `clients`, `demo_invitations`, `demo_sessions`, and `demo_session_mutations`
- `.rpc`, `.storage`, and `.auth` throw `DemoAccessDenied`
- Any other table, including `leads`, `deals`, and `users`, throws `DemoAccessDenied`

Guest dashboard and pipeline reads still go through `loadDemoDatasetForClient`. A guest mismatch, a non-demo workspace, or a non-Rossi template throws instead of querying CRM tables. Deal authorisation uses that same lookup. Stage changes append to `demo_session_mutations`.

`clients` is allowed because workspace mode, industry, and the logo are control-plane fields for the pinned demo organisation. The wrapper does not itself add `.eq("id", guest.clientId)` to every query. Routes must keep using the session's workspace id. A future query that selects every client while a guest context is active would still be a bug. It cannot select leads or deals.

Actor ids for a guest no longer read `users`. `resolveActors` catches the denial and uses the same deterministic id the dataset uses, so the salesperson and their deals still match. Staff rehearsal, which has no guest context, can still read the seeded Rossi users.

## G. External integration protection

`decideEgress` refuses when any of these is true:

- the process is an isolated demo deployment
- a guest context is set
- the client id belongs to a demo workspace

On the shared production app, a normal call with no guest and no demo workspace is allowed. That includes platform email that has no client id. A missing client id is not permission to send from a guest: the guest context is enough to refuse.

`simulatedExternalSend` still returns an explicit simulated result for a guest or a demo workspace. Refused Resend, campaign, gateway, Zoho, storage, and agent calls do not report a real delivery.

`demoCronSkip()` returns a skip only when `SEGMQ_DEPLOYMENT=demo`. Shared mode leaves schedulers running. The weekly digest and the uncontacted-lead scan now drop `workspace_mode = demo` and still select production organisations. WhatsApp campaign template sync already had that filter. Other jobs read CRM tables. Guests cannot write those tables. A demo organisation that was given real CRM rows by an old seed could still be seen by a job that does not filter `workspace_mode`. The Rossi provider does not insert those rows.

## H. Session isolation

Unchanged from Phase 2A. Each visitor has a `demo_sessions` row and one `demo_session_mutations` row. Persona changes update `persona_key` only. Reset clears that session's log. A conflicting version retries and then throws. Database errors throw. There is no guest memory fallback.

The raced-write test passed against an in-memory repository. Postgres was not used.

## I. Files modified

- `lib/demo/deployment.ts` — shared-database switch, isolated mode kept
- `lib/demo/egress.ts` — comments for per-request refusal
- `lib/demo/cron.ts` — cron skip stays isolated-only; `excludeDemoWorkspaces`
- `lib/demo/repository-guard.ts` — new guest table allowlist
- `lib/supabase/admin.ts` — guest wrapper around the service-role client
- `app/api/cron/weekly-digest/route.ts` — skip demo organisations
- `lib/notifications.ts` — uncontacted-lead scan skips demo organisations
- `tests/demo-guest-foundation.test.ts` — shared-database, cron, and repository tests

No unrelated CRM files were edited. Guest access flags were not written into `.env.local`.

## J. Database migrations

`supabase/migrations/20261012194500_demo_guest_sessions.sql` was not changed in this phase and was **not applied**.

Do not run it against the live project until there is an explicit approval. After approval, apply only that file and confirm version `20261012194500` in `supabase_migrations.schema_migrations`.

## K. Test results

Command:

```text
node ./node_modules/tsx/dist/cli.mjs --test --test-name-pattern "guest access gate|guest permissions|session mutation|refuses demo deployment|does not call Resend|skips schedulers|invitation redemption|Rossi actor|guest repository|workspace mode|Rossi dataset|relative dates|rendered demo|external side|enables guests" tests/demo-guest-foundation.test.ts tests/demo-workspace.test.ts
```

Result: **28 pass, 0 fail**, about 218 seconds.

Covered: shared-database guest switch, isolated pin still required, production crons not skipped when guests are enabled on the shared flag, demo workspace exclusion helper, guest denial of `leads` / `deals` / `users`, rejection of a platform role, redemption, Rossi actor ids, Resend/Zoho/WhatsApp gateway refusal, and the existing Rossi workspace tests.

Not run:

- The agent-tool egress case. It passed in the Phase 2A run and was left out here because its import stalls.
- Database-backed session tests.
- Browser end-to-end.
- Full `tsc`. The last completed attempt ran out of memory. This phase did not repeat it and does not call it a pass.
- `next build`.

## L. Remaining security risks

1. The service-role wrapper allows any `clients` query during a guest request. Call sites must keep the pinned workspace id. A bug that lists every organisation would leak client metadata, not CRM rows.
2. Public guest access cannot be proven against the live schema until the migration is applied and a real invitation is redeemed.
3. Jobs that scan CRM tables without a `workspace_mode` filter will still see a demo organisation that has real rows. The fictional Rossi dataset does not create those rows. An old seed script could.
4. Host logs can still contain `/demo/<token>`.
5. Isolated mode (`SEGMQ_DEPLOYMENT=demo`) still disables every send and every cron on that process. Setting it on production would harm customers. The shared flags do not do that.

## M. Release readiness

| Requirement | Status |
|---|---|
| Production and demo contexts on one app | PASS in code and unit tests |
| Guest access disabled by default | PASS. Flags are unset. |
| Enabling guests does not disable production integrations | PASS in `decideEgress` and `demoCronSkip` tests |
| Guest cannot query CRM tables through the service role | PASS in the repository test |
| Guest cannot take a platform role | PASS |
| Separate session mutations | PASS in memory. NOT TESTED in Postgres. |
| Migration applied and verified | BLOCKED. Not applied. |
| Browser redemption and two visitors | NOT TESTED |
| Production login regression in a browser | NOT TESTED |
| Full typecheck and production build | FAIL / NOT TESTED. No successful full typecheck. |
| Public guest invitations | FAIL. Do not enable. |

## N. Next phase

Do not start Phase 2B until:

1. There is explicit approval to apply `20261012194500_demo_guest_sessions.sql` to the existing project.
2. Rossi is confirmed as `workspace_mode = demo`, industry `tyres`, scenario `rossi`, without CRM rows for fictional deals.
3. A super admin issues one invitation only after `SEGMQ_DEMO_DATABASE=shared` and `SEGMQ_DEMO_GUEST_ACCESS=enabled` are set on purpose.
4. A desktop browser and a phone-sized browser complete the salesperson path, a stage change, a refresh, the manager persona, and a second session that does not see the change.
5. The higher-heap typecheck from the Phase 2A.1 report finishes with an exit code.

Phase 2B is still quotations, tasks, follow-ups, and the other CRM actions that are denied today. Demo Studio and new industries stay later.

Moving to a separate database later means a new Supabase project, `SEGMQ_DEPLOYMENT=demo`, the two project refs, and this same migration. Leave `SEGMQ_DEMO_DATABASE` unset on that process so the isolated rules apply. The provider, cookies, and allowlists stay.
