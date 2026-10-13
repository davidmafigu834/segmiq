# SegmiQ Demo Engine — Guest Session Migration Applied

Date: 14 October 2026

The three guest tables are on the existing SegmiQ database. Guest access is still off. No customer `workspace_mode` was changed, Rossi was not reseeded, and no guest environment variables were set.

## A. Database target

| Item | Result |
| --- | --- |
| Project name | `leadstaq` |
| Project reference | `gnnqzboaeezzevlwwryp` |
| Region | `eu-west-1` |
| Status | `ACTIVE_HEALTHY` |
| Postgres | 17.6 |
| Connected account | Authorised Supabase session for this project |

The reference matches the authorised target. No second project was created.

`supabase db push` was not used. The Supabase CLI is not installed on this machine, and the remote migration history does not match the local `supabase/migrations` filenames. A full push would have tried to apply other files.

## B. Migration changes

File: `supabase/migrations/20261012194500_demo_guest_sessions.sql`

The file remains additive. It does not `UPDATE` or `DELETE` customer CRM rows. Two constraints were added to the table definitions before the migration ran:

- `demo_invitations_id_client_unique`: unique `(id, client_id)` on `demo_invitations`
- `demo_sessions_invitation_client_match`: foreign key `(invitation_id, client_id)` to `demo_invitations(id, client_id)` on delete cascade
- `demo_mutations_must_be_array`: `jsonb_typeof(mutations) = 'array'`

Existing keys were kept: invitation `token_hash` unique, session `secret_hash` unique, invitation and session foreign keys to `clients`, invitation `created_by` foreign key to `users` on delete set null, session foreign key to the invitation, mutation primary key on `session_id` with cascade delete, and `version >= 0`.

## C. Preflight results

| Check | Result |
| --- | --- |
| `public.clients` exists, `id` is a uuid primary key | PASS |
| `public.users` exists, `id` is a uuid primary key | PASS |
| `gen_random_uuid()` available | PASS |
| `demo_invitations`, `demo_sessions`, `demo_session_mutations` absent | PASS |
| Version `20261012194500` absent from history | PASS |
| Rossi Tyres present as `rossi-tyres`, `workspace_mode = demo`, industry `tyres`, scenario `rossi` | PASS |
| Other organisations | 27 production, 1 demo |

Baseline counts before the migration: clients 28, users 61, leads 1519, deals 114. `demo_workspace_mutations` already existed and was not altered.

## D. Migration execution

**Applied.**

Method: the Supabase migration tool for this project, one migration named `demo_guest_sessions`. The SQL is the updated `20261012194500_demo_guest_sessions.sql`. No other migration was applied.

The tool first stored the history row as version `20261013230444`. That is the timestamp the platform assigns at execution, and it is not the filename. The same history row was then set to version `20261012194500` so the recorded version is the migration file. There is one row, name `demo_guest_sessions`. The earlier timestamp is not a second entry.

## E. Database verification

All three tables exist and are empty.

Columns match the application: uuid ids, `token_hash` and `secret_hash` as text, `mutations` jsonb default `[]`, `version` integer default 0.

| Constraint | Present |
| --- | --- |
| `demo_invitations.token_hash` unique | Yes |
| `demo_sessions.secret_hash` unique | Yes |
| `demo_invitations_id_client_unique` | Yes |
| `demo_sessions_invitation_client_match` | Yes, on delete cascade |
| `demo_mutations_must_be_array` | Yes |
| `demo_session_mutations_version_nonnegative` | Yes |
| Invitation and session foreign keys to `clients` | Yes, on delete cascade |
| `created_by` foreign key to `users` | Yes, on delete set null |
| Session foreign key to the invitation | Yes, on delete cascade |
| Mutation row foreign key to `demo_sessions` | Yes, on delete cascade |
| Index `demo_sessions_invitation_id_idx` | Yes |

RLS is enabled on all three tables. No policies were added. `anon` and `authenticated` have no privileges on these tables. `service_role` has select, insert, update, and delete. The platform also left `service_role` with references, trigger, and truncate, which is the usual owner grant on new Supabase tables.

History contains version `20261012194500`, name `demo_guest_sessions`.

## F. Production safety

| Object | Before | After |
| --- | --- | --- |
| clients | 28 | 28 |
| users | 61 | 61 |
| deals | 114 | 114 |
| leads | 1519 | 1520 |
| production workspaces | 27 | 27 |
| demo workspaces | 1 | 1 |
| Rossi `workspace_mode` | `demo` | `demo` |

The migration SQL does not read or write `leads`. One lead has `created_at` at or after 23:00 UTC on 13 October 2026, between the two counts. That row was not created by this migration.

Guest tables have zero rows. No organisation `workspace_mode` was updated. WhatsApp, Meta, Zoho, notifications, crons, and CRM authentication were not called and were not changed.

## G. Application compatibility

No application code was changed. These queries already use the columns that now exist:

- `lib/demo/guest-session.ts` reads and writes `demo_invitations`, `demo_sessions`, and `demo_session_mutations` with `token_hash`, `secret_hash`, `client_id`, `invitation_id`, `persona_key`, `expires_at`, `revoked_at`, `mutations`, and `version`.
- `lib/demo/session-store.ts` compare-and-swaps `demo_session_mutations` by `session_id` and `version`, and writes a JSON array.
- `lib/demo/guest-gate.ts` looks up one session by `secret_hash`, then the invitation and the workspace by id.
- `lib/demo/deployment.ts` still requires `SEGMQ_DEMO_SCHEMA=20261012194500` before guest access can open. That variable was not set.
- `lib/demo/workspace-lookup.ts` still reads one organisation by the pinned id. `clients` is not a guest-allowlisted table.

TypeScript and the production build were not rerun. Application code did not change. The deployed build remains `ba4c936`.

## H. Test results

Mocked application tests, exit 0:

```text
node ./node_modules/tsx/dist/cli.mjs --test tests/demo-guest-edge-crypto.test.ts tests/demo-guest-foundation.test.ts tests/demo-guest-journey.test.ts
```

Result: **33 pass, 0 fail**.

Constraint behaviour against a disposable Postgres (valid invitation, mismatched client rejected, duplicate hashes rejected, non-array JSON rejected, negative version rejected, separate session logs, concurrent compare-and-swap) is **BLOCKED**. Docker and the Supabase CLI are not available here, and those inserts were not run on the live database.

Catalog checks in section E confirm the constraints exist. They do not prove a rejected insert.

## I. Outstanding risks

1. Guest access stays closed until `SEGMQ_DEMO_DATABASE=shared`, `SEGMQ_DEMO_GUEST_ACCESS=enabled`, and `SEGMQ_DEMO_SCHEMA=20261012194500` are set on purpose. Setting the schema variable without the guest switch does not open the gate.
2. `service_role` can truncate the new tables. The application uses select, insert, update, and delete. Anon and authenticated still cannot.
3. RLS is on and there are no policies. That is intentional. The service role bypasses RLS. A future policy that grants `authenticated` access would widen the tables.
4. Live insert rejection tests have not been executed.
5. Jobs that scan CRM tables and do not filter `workspace_mode = demo` could still see CRM rows if a demo organisation contained any. These new tables do not add CRM rows.
6. The migration file is updated in the working tree and has not been committed.

## J. Next steps for the first controlled Rossi demonstration

Do not start until an operator sets the three variables on the existing deployment. Do not set `SEGMQ_DEPLOYMENT=demo`. Do not create a second Rossi organisation. Do not send WhatsApp, email, Zoho, or Meta during the test.

Emergency stop: remove `SEGMQ_DEMO_GUEST_ACCESS` and restart or redeploy so the process drops it. Customer NextAuth sessions keep working. Guest cookies then fail closed.

1. Set `SEGMQ_DEMO_DATABASE=shared`, `SEGMQ_DEMO_GUEST_ACCESS=enabled`, and `SEGMQ_DEMO_SCHEMA=20261012194500`.
2. As a super admin, with no demo cookie, issue one invitation for the existing Rossi Tyres workspace. Copy the URL once.
3. Open that URL in a browser that is not logged into the CRM. Expect the salesperson dashboard without a CRM password.
4. Open the pipeline. Confirm the deals belong to Tinashe and are the fictional Rossi records.
5. Move one fictional opportunity to another stage. Refresh. The stage should remain.
6. Switch to the manager persona. Expect `/client/dashboard`, with figures that include that stage change.
7. Open the same invitation URL in a second browser profile. That visitor should start from the canonical dataset.
8. Revoke the invitation. Refresh both browsers. Both should land on the unavailable page.
9. Repeat the navigation and stage change on a phone-width viewport.
10. Unset `SEGMQ_DEMO_GUEST_ACCESS` when the test is finished.
