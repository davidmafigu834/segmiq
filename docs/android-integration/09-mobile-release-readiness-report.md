# Mobile release readiness

This is the review record for the mobile-first Real Estate candidate. It does not accept production writes, move the Android read pin, or authorise a deployment.

## 1. Final code revision

- Parent on `origin/main`: `082ea3cf5198b3cda8639afd870238f6fd79507f`
- Runtime candidate: `420579d3d5cb76e98182d2f092d8eca92e0a7315`
- Production origin: `https://www.segmiq.com`
- Deployed verification: `NOT_ATTESTED`
- Verified deployed revision of this candidate: none
- Android read pin, unchanged: `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6`
- Contract version: 1

`420579d3d5cb76e98182d2f092d8eca92e0a7315` is the runtime commit. The following commit only records that hash in the activation documents. Bootstrap has not returned either SHA. After an authorised deploy, pin the SHA bootstrap returns. Do not copy the read pin onto the runtime commit or the documentation commit.

## 2. Files changed

The commit is limited to the mobile contracts, the four suite fixes, the Windows Open Graph build fix, and these three Android integration documents. Unrelated working-tree edits were left unstaged.

Runtime and contract files:

- `lib/real-estate/mobile-workflows.ts`
- `lib/real-estate/buyer-match.ts`
- `lib/real-estate/buyer-sales-service.ts`
- `lib/real-estate/buyer-introduction-service.ts`
- `lib/real-estate/buyer-introduction-review.ts`
- `lib/real-estate/viewing-access.ts`
- `lib/real-estate/private-listing-images.ts`
- `lib/sales/get-real-estate-inquiry-workspace.ts`
- `app/api/clients/[clientId]/buyer-searches/route.ts`
- `app/api/clients/[clientId]/buyer-searches/[searchId]/route.ts`
- `app/api/clients/[clientId]/listings/route.ts`
- `app/api/clients/[clientId]/listings/[listingId]/route.ts`
- `app/api/clients/[clientId]/listings/[listingId]/images/route.ts`
- `app/api/clients/[clientId]/listings/[listingId]/images/[index]/route.ts`
- `app/api/clients/[clientId]/leads/[leadId]/real-estate/route.ts`
- `app/api/sales/copilot/conversations/[leadId]/route.ts`
- `tests/real-estate-mobile-workflows.test.ts`

Release-blocker fixes outside the new contracts:

- `scripts/patch-vercel-og-windows.mjs` and the `build` script in `package.json`
- `lib/sales/pipeline-board-query.ts` so next-action buckets use the supplied clock
- `app/globals.css` restoring the 17px salesperson message size
- `lib/sales/company-skeleton-grids.ts` so the feedback skeleton matches the four live KPI cards
- `tests/real-estate-marketing.test.ts` so the source list includes the existing `email` code

Documents:

- `docs/android-integration/07-mobile-first-real-estate-workflows.md`
- `docs/android-integration/08-real-estate-mobile-activation.md`
- `docs/android-integration/09-mobile-release-readiness-report.md`

No Android `EstateAccess` file is in this commit. No Supabase migration is in this commit.

## 3. New features ready

Ready as source, not as a deployed Android activation:

- Bearer create and edit for a buyer search on the existing contact plus `real_estate_buyer_searches` model, including duplicate-phone handling.
- Bearer listing create and edit. Address is the heading. Agents remain draft or pending until a manager approves.
- Private listing photograph upload and a 300-second signed read, refused when the private bucket is missing or equal to the public bucket.
- Listing-to-buyer matches with rules points, completeness flags, and other-agent redaction.
- Introduction request and review on the existing actions, including no self-approval, a required decline reason, no repeated decision, and no customer WhatsApp.
- Owned-search viewing book, reschedule, and outcome. Bearer viewing requires an idempotency key. The legacy Bearer viewing create path stays 405.
- Inquiry workspace Bearer access and `buyerSearchId` linkage.
- Conversation-scoped Sales Copilot. Approval does not send WhatsApp. Suggested replies stay drafts.

## 4. Build results

Recorded 2026-11-01 on Windows with the editor helper Node binary.

- `next lint`: exit 0. Existing react-hooks warnings remain in unrelated components.
- `tsc --noEmit --pretty false`: exit 0.
- `next build` after `scripts/patch-vercel-og-windows.mjs`: exit 0. Static generation completed 243/243. `/opengraph-image` is a static route. Blog and package Open Graph routes remain dynamic.
- Root cause of the previous failure: Next.js 14.2.35 evaluates `fileURLToPath(path.join(import.meta.url, "../noto-sans-v27-latin-regular.ttf"))` while loading `@vercel/og`. On Windows, `path.join` turns that file URL into `.\file:\D:\...`, and `fileURLToPath` throws `TypeError: Invalid URL`. The same join is valid on Linux, which is why a Vercel build can succeed without the patch. The patch uses `new URL("./asset", import.meta.url)` for the font, Yoga, and resvg files that sit beside `index.node.js`. It runs only on win32 and only while the broken call is present. Open Graph generation was not disabled.
- `lib/zoho-books/import-plan.ts` still emits `module.createRequire failed parsing argument` during compilation. The build exits 0. The import planner already catches a failed phone parse. It does not block this release and was not rewritten.

## 5. Full test results

`tsx --test tests/*.test.ts`

- tests: 1485
- suites: 335
- pass: 1485
- fail: 0
- cancelled: 0
- skipped: 0
- duration: 171613 ms
- exit: 0

The four previously failing tests:

- `tests/company-skeletons.test.ts`: the live feedback page has four KPI cards (`md:grid-cols-4`). The shared skeleton token still said three columns. The token and count now match the live page.
- `tests/mobile-sales-inbox.test.ts`: `.salesperson-wa-workspace .wa-bubble-text` had been reduced to 15px. The mobile contract requires 17px. The composer radius of 22px was already present.
- `tests/pipeline-board-query.test.ts`: `nextActionBucket` received a clock but treated overdue with `Date.now()` via `getDealNextActionState`. A future action relative to the test clock was overdue on the wall clock. The bucket now compares `next_action_at` with the supplied clock. Live dashboard overdue counts still use `Date.now()`.
- `tests/real-estate-marketing.test.ts`: `email` is an existing source code, label, and hub mapping. `leadSourceFromReType("email")` stays `MANUAL` because there is no separate CRM source code. The test now expects that list and those mappings.

`tests/real-estate-mobile-workflows.test.ts`: 7 passed, inside the 1485.

## 6. Security verification results

**Not accepted.** Isolated database identities were not available.

The local environment points at hosted Supabase (`NEXT_PUBLIC_SUPABASE_URL` is a `*.supabase.co` project, not localhost) and a remote database URL. No Salesperson A, Salesperson B, manager, or organisation B credentials were supplied. This review did not create organisations, users, listings, searches, viewings, introductions, or storage objects, and it did not read customer rows.

Source coverage that did run:

- Agent listing create cannot approve or assign another agent.
- Buyer projection keeps phone for the owner and withholds it otherwise.
- Match cards can request an introduction without private requirement values.
- Introduction review rejects self-approval and blanks requirements for the requesting non-manager.
- Viewing replay matches only the same search, listing, agent, time, and instructions.
- Private image storage rejects the public bucket, a public URL, HTML, and a file over 20 MiB.
- Copilot success payload sets `sendsCustomerMessage` false, and `execute.ts` has no WhatsApp send call.

Database behaviour that was inspected in migrations and not executed:

- `idx_viewings_idempotency` is a partial unique index on `(client_id, idempotency_key)`.
- Introduction review updates only a row still in `status = requested` and returns 409 when that update matches nothing.
- A concurrent viewing insert that loses the unique index currently returns a failed create from `createScheduledViewing`. It does not silently insert a second row. It also does not automatically replay the winner. That path was not raced.

## 7. Deployment prerequisites

No new migration ships with this candidate. The database already needs the Real Estate tables used by the website, including:

- `contacts`, `real_estate_buyer_searches`, `listings`, `viewings`
- `idx_viewings_idempotency` from `supabase/migrations/20261016120000_real_estate_phase3_buyer_sales.sql`
- `real_estate_buyer_introductions.decided_by`, `decided_at`, and `decision_reason` from `supabase/migrations/20261018130000_buyer_introduction_decisions.sql`
- `leads.buyer_search_id`

Do not apply `re_mobile_transition_transaction` as part of this candidate. Offer, transaction, and compliance writes stay closed.

Environment required for the existing website, unchanged:

- Supabase URL and service role
- Auth secrets already used by the Sales JWT

Environment required before private photographs can be accepted:

- `CLOUDFLARE_R2_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME`, different from `CLOUDFLARE_R2_BUCKET_NAME`
- `SEGMIQ_RE_PRIVATE_IMAGE_ACCEPTANCE_JSON` bound to the deployed origin, the deployed 40-hex SHA, contract version 1, and the actor role
- `VERCEL_GIT_COMMIT_SHA` or `SEGMIQ_RELEASE_REVISION`
- `SEGMIQ_PUBLIC_API_ORIGIN` or `NEXTAUTH_URL` as an https origin with an empty path

Local `.env.local` does not have the private bucket name or the acceptance JSON. Public bucket credentials are present and must not be reused as the private bucket.

Windows release builds need the Open Graph patch step. `npm run build` runs it. Vercel on Linux does not need the rewritten file.

Deployment procedure, after explicit approval only:

1. Confirm the deployed git SHA. The runtime commit is `420579d3d5cb76e98182d2f092d8eca92e0a7315`. The documentation stamp, if included, is its child and does not change code. Bootstrap `release.revision` must equal the SHA that was actually deployed.
2. Deploy that SHA through the existing Vercel project. Do not push `main` merely to trigger the deploy unless that automatic production deploy is the intended approval.
3. Authenticate a synthetic salesperson and read `GET /api/sales/app/bootstrap`. Continue only if `release.revision` equals the deployed SHA.
4. Run the safe reads in document 08 blocker 2. Then run the isolated write walk in blocker 3 and the races in blocker 4.
5. Update document 08 with PASS only for operations that completed that walk. Update Android `EstateAccess` only for those operations, using the bootstrap SHA.

Rollback:

- Redeploy `082ea3cf5198b3cda8639afd870238f6fd79507f`, or revert this commit before merge.
- There is no migration to roll back.
- Leave `privateListingImageDelivery` false and `privateImageHost` null.
- The Android read pin stays `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6` until a new read walk passes.

Push effect: a push to `main` can create an automatic production deployment. `vercel.json` sets `git.deploymentEnabled` false only for `codex/real-estate-phase5a-acceptance`. This preparation does not push.

## 8. Approved operations

None. No write, no new projection, and no private image host is approved for Android.

The previous read pin remains the only accepted Android operation set, and only for revision `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6`.

## 9. Blocked operations

All of the following stay blocked until the deployed SHA is confirmed and the isolated walk passes:

- Add Buyer
- Add Property metadata
- Private property photographs
- Matched buyers for a listing
- Introductions
- Viewings
- Inquiry-to-buyer-search linkage
- Conversation-scoped Sales Copilot approval
- Offers, transactions, calendar writes, and compliance

## 10. Private image status

Not ready for Android.

- Private listing bucket: unset in the local release environment.
- Acceptance packet: unset. `privateImagesAcceptedForCurrentRelease` returns false.
- Legacy public images: untouched. They were not copied and not deleted.
- Upload permission: listing edit permission, enforced in the new route.
- MIME and signature: JPEG, PNG, WebP, AVIF. HEIC and HTML are rejected. Limit 20 MiB.
- Signed URL expiration: 300 seconds.
- Approved signed host: none.
- Storage isolation: source refuses the public bucket and foreign keys. That refusal was not demonstrated against a live bucket.
- Redirect safety: not tested. No signed URL was issued.
- `privateListingImageDelivery`: leave false.

## 11. Exact remaining release decisions

1. Approve or withhold deployment of `420579d3d5cb76e98182d2f092d8eca92e0a7315`. This record withholds it.
2. If deployment is approved, decide whether the delivery is a manual Vercel deploy or a `main` push. A `main` push can deploy production immediately. This record does not push.
3. Choose isolated test identities in organisation A (two salespeople and one manager) and organisation B (one salesperson). Do not use customer records.
4. After deploy, decide which individual operations pass the walk. Each operation is independent. A passing buyer create does not open photographs or offers.
5. Decide whether to provision a private R2 bucket that is not the public marketing bucket, then whether to sign an acceptance packet for the deployed SHA. Until both exist, photographs stay off.
6. Leave the Android read pin and the empty write set unchanged until bootstrap returns the deployed SHA and document 08 is updated from that evidence.
