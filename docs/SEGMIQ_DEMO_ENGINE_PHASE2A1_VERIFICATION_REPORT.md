# SegmiQ Demo Engine — Phase 2A.1 Verification Report

Phase 2A.1 checked and hardened the guest-demo foundation. It did not start Phase 2B, Demo Studio, or another industry template.

**The Rossi guest demo is not release-ready.** A real browser was not able to open a live invitation, because this workspace has no verified isolated demo database and guest access is still off.

---

## 1. Executive summary

The Phase 2A code is present and the local test suites that finished passed. This pass fixed three concrete gaps:

- Guest access no longer turns on from two environment flags alone. The process must also name the demo Supabase project and the production Supabase project, and the configured URL must be the demo host.
- A process marked `SEGMQ_DEPLOYMENT=demo` refuses to open the named production Supabase host.
- The Rossi salesperson and manager screens no longer fire live search, notification, copilot, weekly-report, call, WhatsApp, or quotation-revision requests during a guest session.

What is still blocked:

- No dedicated demo Supabase project is configured in this workspace.
- `supabase/migrations/20261012194500_demo_guest_sessions.sql` has not been applied anywhere that this session could verify.
- No browser completed the invitation-to-dashboard journey.
- The full TypeScript check still has no successful exit code. The last completed attempt ran out of memory.
- The production build was not run.

---

## 2. Environment and database readiness

Local `.env.local` is present. Checked names only; secret values were not printed.

| Control | Local workspace |
|---|---|
| `SEGMQ_DEPLOYMENT` | Unset. This process is not a demo deployment. |
| `SEGMQ_DEMO_GUEST_ACCESS` | Unset. Guest redemption stays off. |
| `SEGMQ_DEMO_SUPABASE_REF` | Unset. |
| `SEGMQ_PRODUCTION_SUPABASE_REF` | Unset. |
| Supabase URL | One host is configured. |
| `SUPABASE_SERVICE_ROLE_KEY` | Set. |
| `NEXTAUTH_SECRET` | Set. `NEXTAUTH_URL` host is `localhost:3000`. |
| `RESEND_API_KEY` | Set. |
| WhatsApp gateway URL, R2 access key, Zoho client id, Meta app id | Unset in this file. |

There is one database endpoint in the local environment, and it was not identified as a disposable demo project. Resend is configured beside it. That combination is not a safe place to enable guest access or to apply the guest migration. No second NextAuth secret exists here, because there is no second deployment.

Supabase MCP was not available in this session. `supabase/config.toml` is not in the repo. No project link was verified.

### How a demo deployment must be operated

Use the same source. Do not copy this `.env.local` into the demo host.

On the demo host only:

1. Create one Supabase project for all prospects. Do not create one project per prospect.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from that project.
3. Set `SEGMQ_DEMO_SUPABASE_REF` to that project's ref (the subdomain of `*.supabase.co`).
4. Set `SEGMQ_PRODUCTION_SUPABASE_REF` to the production project's ref. It must be different.
5. Set a new `NEXTAUTH_SECRET` and a demo `NEXTAUTH_URL`.
6. Leave `SEGMQ_DEPLOYMENT=demo`.
7. Leave `SEGMQ_DEMO_GUEST_ACCESS` unset until the checklist in section 12 is pass.
8. Do not copy `RESEND_API_KEY`, Meta, Zoho, WhatsApp gateway, or R2 secrets.
9. Create a `SUPER_ADMIN` user in the demo database for operators. Rossi seed users are manager and salesperson accounts. They cannot issue invitations. Do not copy production user rows.
10. Disable cron schedules on the demo host. The routes also no-op when `SEGMQ_DEPLOYMENT=demo`.

Guest redemption stays disabled unless all of these are true: deployment is `demo`, guest access is `enabled`, both project refs are set and different, and `NEXT_PUBLIC_SUPABASE_URL` is `https://<demo-ref>.supabase.co` and not the production host.

`createAdminClient()` throws if a demo-marked process is given the production host. A normal process, with `SEGMQ_DEPLOYMENT` unset, is unchanged.

Production cannot accept a guest token while those variables are unset. A production process that someone marks as `demo` and points at the production host is refused once `SEGMQ_PRODUCTION_SUPABASE_REF` is set.

---

## 3. Migration verification

File: `supabase/migrations/20261012194500_demo_guest_sessions.sql`

| Check | Result |
|---|---|
| `demo_invitations` | Hashed token, unique `token_hash`, expiry, `revoked_at`, creator, client foreign key |
| `demo_sessions` | Separate unique `secret_hash`, persona, expiry, `revoked_at`, invitation and client foreign keys |
| `demo_session_mutations` | One row per session, JSON log, `version` with `check (version >= 0)` |
| Indexes | Unique hashes, plus `demo_sessions_invitation_id_idx` |
| RLS | Enabled. `anon` and `authenticated` revoked. `service_role` granted. No anon policies. |
| Applied | **Not applied.** Migration history was not queried, because the only configured database was not an authorised demo target. |

Optimistic concurrency is one `UPDATE` filtered by `session_id` and `version` in `lib/demo/session-store.ts`. Postgres locks that primary-key row for the statement. A second writer updates zero rows and the application retries. That is atomic at the statement level. It was **not** executed against Postgres in this session. The passing concurrency test uses an in-memory repository.

Operator command, only after linking the CLI to the dedicated demo project:

```text
supabase db push
```

Then confirm the version `20261012194500` is in `supabase_migrations.schema_migrations` on that project. Do not run this against production.

---

## 4. Guest-access verification

Not completed in a browser. Guest access is off, and there is no demo database to redeem against.

What the code does, and what tests covered:

| Step | Code | Evidence this session |
|---|---|---|
| Administrator issues an invitation | `POST /api/agency/demos/invitations` calls `requireSuperAdmin()` and refuses a demo cookie | Not called over HTTP |
| Valid URL | `/demo/[token]` | Route exists. Not opened in a browser. |
| Invalid, expired, revoked invitation | `invitationAccess` plus `redeemInvitationWithStore` | Passed. Mocked store, not Postgres. |
| Session secret is not the invitation token | Redeem returns a new secret | Passed |
| Cookie flags | HttpOnly, Secure in production, SameSite=Lax | Passed |
| Conflict with a NextAuth session | `credentialsConflict` | Passed as a unit check. Not in a browser. |
| Salesperson dashboard, pipeline, deal stage, refresh, manager persona | Wired in Phase 2A | **Not browser-tested** |
| Tampered or expired cookie | Lookup misses or `invitationAccess` fails; middleware clears the cookie | Decision function tested. No live cookie. |
| Fail closed | Guest dataset load throws `DemoAccessDenied` instead of querying CRM tables | Code inspected. Not executed against a database. |

`GET /api/auth/session` and `GET /api/auth/csrf` are allowlisted so the existing NextAuth client probe does not receive a guest 403. `POST` to NextAuth callbacks stays denied. No other `/api/sales/**` or `/api/client/**` routes were added.

Background calls removed from the guest screens:

- Sales Copilot daily workspace (`/api/sales/dashboard/workspace`)
- Company weekly report (`/api/reports/weekly`)
- Global search (`/api/search`)
- Notification bell (`/api/notifications`)
- Header quick actions that open lead intake
- Deal Call, WhatsApp, Command SegmiQ, and Create revision

Stage changes still use `PATCH /api/deals/:id`, which was already allowlisted and writes the session mutation log.

---

## 5. Rossi dataset verification

`resolveDemoPersona` and `materializeDemoDataset` both take actor ids from `resolveActors`. The role is the Rossi seed role, not a role stored on a user row, so a database role cannot promote a guest to `SUPER_ADMIN`.

If the Rossi users exist, both the session and the deals use those user ids. If they do not, both use `demoId("rossi:actor:<key>")`. They do not diverge from each other.

Test that passed: `uses the same actor id for the persona and that person's deals`. Tinashe owns a non-empty subset. Other deals exist for the rest of the team. Every deal `client_id` is the workspace id passed into the dataset. The dataset function returns null for any industry other than tyres/rossi, and a guest load throws rather than falling through.

`npm run seed:rossi` was not run. Legacy `seed:demo` and the Haven SQL seed were not run.

Staff rehearsal still uses `demo_workspace_mutations`. Guest writes do not.

---

## 6. Cross-session isolation tests

| Case | Result |
|---|---|
| Two sessions, separate logs, conflicting write retried | Pass. In-memory repository. |
| Two overlapping writes on one session both kept | Pass. In-memory repository. |
| Refresh, server restart, revocation, expiry against Postgres | **Not tested.** Tables are not applied. |
| Two browsers | **Not tested.** |

Session reset remains `POST /api/demo/session/reset` for the current guest only. Organisation reset stays denied for guests.

---

## 7. Security and external egress

Denied by the allowlist, covered by the permission test: platform impersonation, client administration, platform billing, user-create paths, lead patch, organisation demo reset, and NextAuth credential POST.

Forged persona keys outside the Rossi actors are rejected by `findDemoPersona`. A production `workspace_mode` is rejected by redemption. Guest `clientId` must match the session row inside `loadDemoDatasetForClient` and `lib/demo/acl.ts`.

| Egress | This session |
|---|---|
| Resend, Zoho, WhatsApp gateway from a demo deployment | Pass. Zero provider calls. |
| Pure `decideEgress` for deployment, guest, and demo workspace, including a missing client id on a demo deployment | Pass |
| Cron skip when `SEGMQ_DEPLOYMENT=demo` | Pass |
| Agent tool block | Passed in the Phase 2A run. This session stopped a rerun after the import had not finished. Not re-counted as a new pass. |
| Campaign send and R2 `putObject` | Guards are in those modules. They were not imported by this session's tests. |

`putObject` and `sendEmail` still refuse a demo deployment or a guest context even when no `clientId` is passed. On a normal production process, a staff call with no client id can still send. That path is not reachable as a guest, because guest context is set before the handler runs.

Residual limits:

- The pin works only after operators set both project refs. Until `SEGMQ_PRODUCTION_SUPABASE_REF` is set, a mis-labelled demo process can still open whatever URL is configured. Guest redemption stays off in that case (`supabase-project-unpinned`).
- Host access logs can still contain `/demo/<token>`.
- Navigation to an unlisted sales page redirects to `/demo/unavailable`. That is denial, not a second product UI.
- Manager role profiles still include billing permission. Guests never reach those routes; the allowlist is the control.

---

## 8. Typecheck and build results

`package.json` script `typecheck` is:

```text
node ./node_modules/typescript/lib/tsc.js --noEmit --pretty false --incremental false
```

`--incremental false` forces a full program, and Node's default heap is about 2 GB. The completed attempt in Phase 2A failed with:

```text
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

A later retry with `--max-old-space-size=8192` was stopped before it printed an exit code. This session did not run `tsc` again and did not run `next build`.

**Full typecheck: no successful result. Production build: not tested.** Neither is a pass.

A justified rerun, when memory is available:

```text
node --max-old-space-size=8192 ./node_modules/typescript/lib/tsc.js --noEmit --pretty false
```

Leave off `--incremental false` so `tsconfig.json` can reuse incremental state. Do not describe a filtered file check as a full typecheck.

---

## 9. Browser and mobile results

**Not tested.** No dev server was opened. Desktop, standard mobile, and narrow mobile views of the guest dashboard, pipeline, deal page, persona switcher, and expired-link page were not exercised.

`/demo/unavailable` is a single centered column using the existing type scale. It was not screenshotted. No separate demo visual design was added.

Supported guest pages still use `SalesAppShell` and `CompanyDashboard`. Unsupported controls were removed from the guest path rather than restyled.

---

## 10. Bugs fixed

| File | Change |
|---|---|
| `lib/demo/deployment.ts` | Guest access requires a pinned demo project ref and refuses the production ref. |
| `lib/supabase/admin.ts` | Demo-marked processes throw before using the production Supabase host. |
| `lib/demo/invitation-access.ts` | Shared valid / missing / expired / revoked decision. |
| `lib/demo/guest-session.ts` | Redemption goes through that decision and a store seam used by tests. |
| `lib/demo/guest-gate.ts` | Middleware uses the same expiry and revocation decision. |
| `lib/demo/allowlist.ts` | Allows only `GET /api/auth/session` and `GET /api/auth/csrf`. |
| `components/sales/shell/SalesAppShell.tsx` | Guests do not mount search, notifications, or quick actions. |
| `components/dashboard/sales/DashboardHeader.tsx` | Same for the salesperson header. |
| `components/dashboard/sales/SalesDashboard.tsx` | Guests do not mount Sales Copilot. |
| `components/sales/pipeline/PipelinePageShell.tsx` | Forwards the guest flag. |
| `app/sales/pipeline/page.tsx` | Passes the guest flag on the Rossi pipeline. |
| `lib/sales/sales-shell-props.ts` | Deal shell receives the guest flag. |
| `components/sales/deals/DealWorkspaceClient.tsx` | Guests keep stage changes. Call, WhatsApp, command, and quote revision are not offered. |
| `app/sales/deals/[dealId]/page.tsx` | Passes `demonstration` for guests. |
| `components/dashboard/company/CompanyDashboard.tsx` | Guests do not load the weekly report endpoint. |
| `components/dashboard/company/CompanyDashboardHeader.tsx` | Guests do not mount search, notifications, or quick actions. |
| `app/client/dashboard/page.tsx` | Marks the manager dashboard as fictional for guests. |
| `supabase/migrations/20261012194500_demo_guest_sessions.sql` | Non-negative version check and a comment on the atomic update. Not applied. |
| `tests/demo-guest-foundation.test.ts` | Pin, redemption, raced writes, and Rossi actor ids. |

Unrelated dirty files (reports, quotations, passwords, qualification) were not edited.

---

## 11. Unresolved blockers

1. No verified isolated demo Supabase project, and no second deployment.
2. Guest migration not applied and not confirmed in migration history.
3. Rossi not seeded in a demo project as part of this pass.
4. No HTTP or browser proof of invitation redemption, persona switch, or refresh persistence.
5. No Postgres proof of concurrent mutation writes.
6. Full `tsc` has no successful exit. `next build` was not run.
7. The agent-tool egress test was not re-completed in this session.

Until those are done, do not set `SEGMQ_DEMO_GUEST_ACCESS=enabled` on any host.

---

## 12. Release readiness checklist

| Item | Status |
|---|---|
| Verified separate Supabase project | BLOCKED |
| Verified separate demo deployment | BLOCKED |
| Verified safe secrets configuration | BLOCKED. Local env is a single project and includes Resend. |
| Applied and verified migrations | BLOCKED |
| Seeded and validated Rossi template | NOT TESTED against a database. Actor-id unit test passed. |
| Working administrator invitation creation | NOT TESTED over HTTP. Code requires `SUPER_ADMIN` and the guest flag. |
| Valid guest redemption | NOT TESTED in a browser. Mocked redemption passed. |
| Cross-tenant access denial | NOT TESTED against a database. Unit checks passed. |
| Independent visitor mutation histories | NOT TESTED in Postgres. In-memory tests passed. |
| Server-side route restrictions | Pass as allowlist unit tests. Not browser-tested. |
| No external production side effects | Pass for Resend, Zoho, and the WhatsApp gateway under `SEGMQ_DEPLOYMENT=demo`. |
| TypeScript validation | FAIL. No successful full typecheck. |
| Production build verification | NOT TESTED |
| Browser end-to-end verification | NOT TESTED |
| Mobile layout | NOT TESTED |
| Production login regression | NOT TESTED in a browser. Provider-selection tests passed. |
| Rollback and kill switch | Pass in code: omit `SEGMQ_DEMO_GUEST_ACCESS`, or fail the project-ref pin. Not exercised on a host. |

**Ready for public guest invitations: no.**

---

## 13. Next implementation recommendations

Stay on the foundation until the blocked rows are actually pass. Do not start quotations, tasks, or Demo Studio first.

1. Provision one demo Supabase project and one demo app deployment. Set the two project refs. Confirm `createAdminClient` throws if the URL is the production host.
2. Apply `20261012194500` there only. Read it back from migration history.
3. Seed Rossi with `npm run seed:rossi` using that project's environment. Add one demo-only `SUPER_ADMIN` for invitations.
4. Re-run the demo tests, then the higher-heap typecheck above, then `next build` on the demo environment.
5. Issue one invitation, open it in a desktop browser and a phone-sized browser, move one deal, refresh, switch to Tendai, and confirm a second session does not see the move.
6. Only then set `SEGMQ_DEMO_GUEST_ACCESS=enabled` on the demo host.

### Tests recorded this session

Command A, stopped after the cases below had already passed and before the agent-tool case finished:

```text
node ./node_modules/tsx/dist/cli.mjs --test tests/demo-guest-foundation.test.ts tests/demo-workspace.test.ts
```

Passed before the stop: guest gate (6), permissions (2), mutation isolation including a raced write (2), Resend/Zoho/gateway refusal (2).

Command B, completed:

```text
node ./node_modules/tsx/dist/cli.mjs --test --test-name-pattern "skips schedulers|invitation redemption|Rossi actor|workspace mode|Rossi dataset|relative dates|rendered demo|external side" tests/demo-guest-foundation.test.ts tests/demo-workspace.test.ts
```

Result: **14 pass, 0 fail.** That includes cron skip, mocked redemption, Rossi actor ids, and the existing Rossi workspace tests.

These are unit tests and mocked integration tests. None are database-backed integration tests or browser end-to-end tests.
