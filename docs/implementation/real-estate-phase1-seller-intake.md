# Real Estate phase 1: seller intake

Date: 5 November 2026. Working tree only. Nothing was committed, pushed, deployed, or applied to the live database.

This slice is the seller form only. Buyers, viewing forms, offer PDFs, seller offer links, management accounting, automatic WhatsApp, and a template builder were not built. The accepted-offer transaction bootstrap was not changed. Its ignored failure remains open.

## What was tested, separately from release

**Implementation.** The request, client form, agent review, mandate preparation, and migration source are in the working tree. The workflow is behind `RE_SELLER_INTAKE`, which is off unless the value is `on`, `true`, or `1`. Server routes return 404 while it is off, and the agent screens hide the entry points when that 404 comes back.

**Test-environment verification.** Docker, the Supabase CLI, and `psql` are still absent. The only database in development configuration is the live Supabase project `gnnqzboaeezzevlwwryp`. No server was started against it. No SQL was applied. No message was sent. No customer row was copied.

The authenticated agent → client → review → owner opportunity / mandate / document journey, including a cross-organisation attempt, was **not observed** on a database. It is blocked. The same sequence was exercised with an in-memory PostgREST stand-in and an injected document store. That is a unit and service test, not a journey pass.

`RE_SELLER_INTAKE` is not set in development configuration, so the feature is off there too.

**Release readiness.** Not ready for production. Production stays disabled because the flag is off, the new migration has not been applied, the older compliance safety-baseline constraints are still absent, and a scanner is not configured. Enabling the flag on the live project before those are in place would either hide the feature or fail closed. It would not make the journey safe.

## What you can do in the tested environment

You can run the seller-intake tests. They create an approved template, a link, a draft, a submission, a correction, and an intake review using fake database rows and a memory store. They check that a second organisation is refused.

You cannot open the form in a browser against a safe database from this environment. Do not set `RE_SELLER_INTAKE=on` in the live project's environment to try it. A local trial needs an isolated database, this migration applied only there, the flag on only there, and a manager-approved template whose clause text is stored as data. No template is seeded, and this agency's fees are not platform defaults.

To enable it on an isolated deployment later:

1. Apply `supabase/migrations/20261105140000_real_estate_seller_intake.sql` to that database only.
2. Set `RE_SELLER_INTAKE=on` only in that deployment.
3. Keep `NEXTAUTH_SECRET` at least 16 characters, or set `SELLER_INTAKE_TOKEN_PEPPER`. Links are refused if neither is usable.
4. Have a manager save an approved open template and an approved sole template, including the clause wording for that version.
5. Leave `COMPLIANCE_CLAMAV_HOST` unset until a scanner is actually available. Uploads then stay unscanned and downloads stay blocked.

## Recovered files

These tracked files were empty or whitespace, their index matched `HEAD` `869fbde991a952de8593848b576e12e0295f89a9`, and the diff was a pure deletion. Each was backed up under `D:\Users\ddsta\Documents\segmiq-phase0-backup-20261105\phase1-recovery` and restored from `HEAD` individually:

- `lib/auth/roles.ts`
- `components/dashboard/company/settings/CompanySettingsPage.tsx`
- `lib/settings/company-settings-data.ts`
- `lib/mobile/sales-app/experience.ts`
- `app/api/clients/[clientId]/listing-shares/[shareId]/analytics/route.ts`
- `docs/implementation/REAL_ESTATE_SUPABASE_DEPLOYMENT_REPORT.md`
- `docs/real-estate/compliance/COMPLIANCE_FULL_FUNCTIONAL_AUDIT.md`

The Android sales app still has the same empty-file shape, and that tree also contains other local edits. Those files were left untouched because a deletion there cannot be separated from in-progress Android work:

- `SegmiQ Sales App/app/src/androidTest/kotlin/com/segmiq/sales/SimulatedCallTest.kt`
- `SegmiQ Sales App/app/src/main/kotlin/com/segmiq/sales/core/bootstrap/LiveWorkspace.kt`
- `SegmiQ Sales App/app/src/main/kotlin/com/segmiq/sales/core/live/LiveSalesApi.kt`
- `SegmiQ Sales App/app/src/main/kotlin/com/segmiq/sales/core/live/ScopedCache.kt`
- `SegmiQ Sales App/app/src/main/kotlin/com/segmiq/sales/features/CallingScreens.kt`
- `SegmiQ Sales App/app/src/main/kotlin/com/segmiq/sales/features/realestate/EstateServerViewModel.kt`
- `SegmiQ Sales App/app/src/main/kotlin/com/segmiq/sales/ui/theme/Type.kt`
- `SegmiQ Sales App/app/src/main/res/drawable/ic_launcher_background.xml`
- `SegmiQ Sales App/app/src/test/kotlin/com/segmiq/sales/native/PhoneNumbersTest.kt`
- `SegmiQ Sales App/docs/android-audit/06-meeting-recorder-and-audio.md`
- `SegmiQ Sales App/docs/android-audit/12-executive-summary.md`

## Routes and screens

Agent, all behind the flag and the existing client session:

- `GET` and `POST /api/clients/[clientId]/seller-intakes` — list requests, or create a link bound to the signed-in organisation and agent. An existing opportunity, contact, or conversation is checked and stored. The body cannot choose the organisation or the agent.
- `GET` and `POST /api/clients/[clientId]/seller-intake-templates` — a manager approves an open or sole template. A salesperson cannot.
- `GET` and `POST /api/clients/[clientId]/seller-intakes/[requestId]` — review, revoke, reissue, request corrections, or `accept_intake`. A signed file can be attached as multipart field `file`.

Client:

- `GET` and `POST /api/public/seller-intakes/[token]`
- Page `/seller-form/[token]`

Screens, using the existing acquisition shell, sales tokens, `ReSheet`, and `ContextCompliancePanel` for a manager after a case exists:

- Property opportunities list and opportunity detail: **Send seller form**, status, copy/share, revoke, corrections, and review.
- WhatsApp opportunity action: the same send action. It does not send a message.
- Owner portfolio: outstanding seller-form next actions.

The link is returned once for copy or share. SegmiQ does not send it. Reissue replaces the token hash and clears the browser session. The old link stops resolving. A resume link can show answers already saved on that request. A correction link shows accepted sections and asks again only for the rejected sections. A brand-new link stays blank.

## Model and template decisions

New tables, in the unapplied migration: templates, requests, submissions, events, reviews, acquisition parties, and prepared documents. Row level security is enabled and `anon` / `authenticated` have no grants. The application uses the service role only after its own session or token check. Database auth identity is not the actor.

The acquisition opportunity remains the property under the owner portfolio. Intake review does not create a listing. Mandate approval, listing approval, evidence verification, and signature state stay separate. `accept_intake` writes a mandate as `submitted` with evidence `not_provided`. It does not call mandate approval.

`contact_id` is the person: the individual owner, or the company representative. A company is an `re_acquisition_parties` row with kind `company` and no contact id. The representative is a separate party. The opportunity's owner name is the registered owner, which can be the company.

Open and sole field sets differ. Land is not stored as a residential stand. Cluster/Townhouse is not stored as townhouse. Share transfer, sectional title, and full title are not treated as the same right. Cession is the one right mapped to the existing legal route. Original labels stay on the submission. Ambiguous mappings are returned to the reviewer.

Mandate price and asking price before commission stay separate. The asking price is an `owner_asking` price discussion. No agreed marketing price is written. Open start and end dates are stored only when the seller entered valid dates. A sole mandate does not get an expiry date. A template may record a minimum exclusive period measured from a future signature, and whether it continues until varied in writing. The code does not invent two months, a signature date, or a witness attestation.

Identity, spouse, employer, PEP, source of funds, and company evidence go on the compliance case profile as `awaiting_documents` and `unverified`. Completing or reviewing the form does not verify them. A salesperson sees that restricted answers were submitted. The values are shown to a manager. The seller link never receives duplicate candidates or an existing contact profile. A phone or name match is not authentication.

Saved answers on the first link are visible only to the browser that holds the `sq_si` session cookie for that request. Resume and correction links are separate high-entropy secrets, stored as hashes. Scope ids in the client body are discarded. Drafts can omit bedrooms, photographs, and size. Those facts are not on these forms.

The prepared PDF is rendered from the frozen submission snapshot and that template version's clause text. Clause wording is not generated and is not hardcoded. The PDF says the signature, witness, and signature date are not recorded. A later edit does not rewrite a stored PDF hash. The file is private (`clients/{org}/seller-intake/...`), starts `unscanned`, and is not signature evidence. A returned signed copy is a new row in `signed_uploaded` / `unscanned`. Missing scanner configuration does not mark it clean. Download uses the existing quarantine decision and stays blocked until a scan is clean. The in-memory store used by tests does not bypass that decision.

If private storage or the compliance insert fails, the request stays `review_incomplete`, keeps any ids already saved, and can be retried. It is not marked accepted while the prepared PDF or mandate is missing. A second review returns the same contact, opportunity, mandate, and document.

## Migration prerequisites

Do not apply `20261105140000_real_estate_seller_intake.sql` to project `gnnqzboaeezzevlwwryp` as part of this work.

Still absent on that project, from the Phase 0 catalog read, and not applied now:

- `20261022113000_compliance_phase1_safety_baseline.sql`
- Its tenant foreign keys, `uq_compliance_cases_client_id_id`, context triggers, and `compliance_validate_context_tenant` / `compliance_prevent_event_mutation` / `compliance_apply_mutation_atomic`

Later columns such as `submitted_by` and `confidential` are not a substitute for that baseline. The seller-intake migration does not add those constraints.

Also still required before a real deployment: an isolated or reviewed database, the feature flag, approved template versions, private storage, and a scanner if downloads are to succeed. Outbound email and WhatsApp credentials remain present in development configuration and were not used.

## Tests

Command: the repo's `tsx --test` runner, in its own process, with test concurrency 1.

Passed, 77 tests, 0 failed:

- Previous acquisition, offers, compliance remediation, phase 3, and gating tests (65).
- `tests/real-estate-seller-intake.test.ts` (12), covering a new individual seller, a company and representative, an existing contact and a duplicate refusal, two properties for one owner, tenant and reviewer boundaries, no public identity lookup, draft and resume, corrections, expired and replaced tokens, a second submission, concurrent reviews, a failed store then retry, open versus sole prices and dates, no invented expiry or signature, private unscanned documents, immutable PDF bytes, and intake review that does not approve the mandate or create a listing.

The PDF test extracted the text with `pdf-parse`. A long owner name survived across more than one page, the font size stays 11pt, and the file contains no invented signature date and no hardcoded VAT rate. There is no browser screenshot. The page was not opened because that would need a server on the live database.

Project `tsc --noEmit` completed with exit code 0 after the last test-only type fix. No remaining type errors were reported, including the modules restored in this phase.

## Remaining blockers

- No isolated database, so the live journey was not run.
- Seller-intake migration is source only.
- Compliance safety baseline is still not on the live database.
- `COMPLIANCE_CLAMAV_HOST` is unset. Prepared and signed files stay unscanned, and downloads stay blocked.
- Android files listed above are still empty and were not judged safe to restore.
- Accepted-offer transaction bootstrap still ignores a failed `startOrGetTransactionFromOffer`, including an `{ ok: false }` result. Not changed in this slice.
- Viewing and management source documents are still absent and were not required for seller intake.
