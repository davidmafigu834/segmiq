# 12 — Executive summary

**Project:** `SegmiQ Sales App/`, a native Android app (`com.segmiq.sales`).
**Audit:** read-only, 30 October 2026. No source, Gradle, manifest, permission or backend file was changed.

## The short version

The SegmiQ Sales Android app is a **clean, native Kotlin/Jetpack Compose prototype of the general-sales experience that runs entirely on fictional local data**.

- **What works:**
  - it compiles, launches and passes its 4 unit and 4 instrumented tests;
  - it renders well in light and dark themes;
  - it is consistently honest about what is simulated.
- **What is missing:**
  - it has **no login, no networking and no permissions**;
  - calls are simulated;
  - the meeting recorder is a setup form only;
  - Copilot is a local rule;
  - quotations and notifications are empty pages;
  - it supports only one of the web platform's three salesperson experiences.

It is a solid **UI foundation to build on**, not a partially integrated app.

## Evidence achieved

| Level | Result |
|---|---|
| Compiles | **Yes.** Fresh forced Kotlin compile with no warnings; debug APK built |
| Launches | **Yes.** Android 11 emulator (360×640 dp) |
| UI renders | **Yes.** 70 screenshots in `screenshots/` |
| Interaction works | **Yes for the demo flows** driven on the emulator (report 02) |
| Backend request succeeds | **Not applicable.** No network code exists |
| Real device verified | **No.** No physical phone was available |

## Answers to the 18 questions

**1. Does the Android application compile successfully?**
Yes. `assembleDebug`, `testDebugUnitTest` (4/4 passed), `lintDebug` (0 errors, 20 version-related warnings) and `connectedDebugAndroidTest` (4/4 passed on API 30) all succeeded in this audit. A forced fresh Kotlin compile produced no compiler warnings.

**2. How many screens are implemented?**
27 navigation destinations rendering 24 distinct screens, plus a quick-action bottom sheet and an end-call dialog. Of the original 10-concept screens:
- 7 are functional demos;
- 1 is partial (Welcome: no sign-in or permissions);
- 1 is visual only (Meeting Recorder);
- 1 is not implemented (Recording detail / transcript).

**3. Which screens match the approved design?**
This cannot be determined. No approved concept image exists in the Android project or the SegmiQ workspace, so visual parity is not claimed.

Against the written SegmiQ tokens:
- the lime accent matches;
- the typography does not (system sans-serif instead of Geist and Inter);
- lime is over-used as a surface colour, contrary to `design.md`;
- the launcher icon is still the default Android robot.

**4. Which buttons and interactions actually work?**
These work on local data:
- bottom tabs and back navigation;
- the quick-action sheet;
- customer and conversation search;
- the Inbox "Follow-ups" filter;
- customer profile tabs;
- add lead (validated, persists across restart);
- add note, create follow-up and schedule meeting (free-text dates);
- task completion and task filters;
- pipeline stage filter;
- dialer keypad;
- simulated call timer;
- call-review save (once only);
- Recents;
- "Leave demo".

These are visual only:
- the Inbox **"Mine"** filter;
- call mute, speaker, hold and keypad;
- recorder setup (no record button);
- recordings search and filters;
- Quotations, Notifications and Help pages.

This is broken: **number-to-customer matching** in the dialer. A local `077…` number does not match a stored `+263…` number, and short numbers over-match.

Report 02 has the full button trace.

**5. Is authentication connected to the real SegmiQ backend?**
No. There is no sign-in. `POST /api/sales/app/auth` is not used. An `AuthRepository` interface exists without an implementation.

**6. Are real customer records being retrieved?**
No. Three fictional customers, tasks, messages, meetings and opportunities are hard-coded. User edits are saved only to on-device DataStore.

**7. Can a salesperson make a genuine SIM phone call?**
No. The call screen is a labelled simulation. No telephony API or intent is used and no phone permission is declared.

**8. Can SegmiQ act as the default dialer?**
No. There is no `ROLE_DIALER` request, no `InCallService` and no `DIAL` intent filter.

**9. Can it record both sides of an actual cellular call?**
No, and the app does not claim to. Ordinary Android apps cannot capture both sides of SIM calls, even as the default dialer. Two-sided recording would need VoIP or a telephony provider.

**10. Can it genuinely record an in-person meeting?**
No. No microphone permission, recorder, foreground service or audio file exists. The screen says "NO AUDIO CAPTURE".

**11. Can the user play, save and delete recordings?**
No. The Recordings library is a static empty state.

**12. Does Sales Copilot use real backend data?**
No. It lists open local demo tasks with a "Why: scheduled for …" reason, and says "No AI service is connected".

**13. Does the application support offline operations?**
Only trivially: it never goes online. There is no offline cache of server data, no outbox, no sync, no retry and no conflict handling.

**14. Does it support Real Estate and Solar modes?**
No. Navigation, stages and wording are hard-coded for general sales. Nothing reads `business_type` or `sales_workflow_preset`.

**15. Does it have real push notifications?**
No. There is no FCM, no notification channels, no `POST_NOTIFICATIONS` permission and no reminders. The Notifications screen is static. The web platform has no native push either, so push needs new backend work.

**16. What are the 10 highest-priority missing capabilities?**
1. Real sign-in with MFA, secure token storage, session restore and a logout wipe.
2. A networking layer, DI and production repositories against existing Bearer endpoints.
3. Experience resolution (General, Solar, Real Estate) with server-driven navigation. A new bootstrap endpoint is recommended.
4. Real leads: list, detail, notes, timeline, add with duplicate lookup.
5. Real calling: system dialer, post-call review and `log-call` through an outbox, with phone normalisation.
6. WhatsApp inbox and sending through SegmiQ endpoints.
7. Real tasks with dates and reminders, plus Copilot work items with approve, dismiss, snooze and complete.
8. An offline cache and outbox (Room plus WorkManager, idempotency, organisation-scoped wipe).
9. A genuine meeting recorder (foreground service, private storage, playback, upload) with a new backend upload path.
10. Push notifications and deep links. Needs a new backend token registry and FCM.

**17. Which existing code should be preserved?**
- the design components and theme (after adjusting lime use and adding the missing surface roles);
- all screen composables;
- `BackendContracts.kt` (extend it);
- the recorder, transcript and insight models;
- call-review duplicate protection;
- `validPhone` and `filterTasks` and their tests;
- backup exclusions;
- the instrumented tests (as demo-flavour UI tests).

Move the local demo into a `demo` build flavour. Remove the unused template files (`ui/main/*`, `data/DataRepository.kt`, `NavigationKeys.kt`, the `Color.kt` template palette).

**18. What should be implemented next without rewriting completed work?**
Phase 1 foundation, keeping every existing screen:
1. DI.
2. The HTTP client and Bearer interceptor.
3. `demo` and `prod` flavours.
4. A real `AuthRepository` with MFA and session restore.
5. A session-based start destination.
6. Per-feature ViewModels that feed the existing composables.
7. Type-safe routes, which also fix the two missing titles and the blank pages.
8. A General-only experience resolver.

Then Phase 2 wires My Day, leads, calling plus `log-call`, inbox, tasks and Copilot to the endpoints that already accept the mobile token. Report 10 has the full plan.

## Most important defects found in the current build

| Defect | Severity | Report |
|---|---|---|
| Dialer number matching fails for local formats and over-matches short numbers; unmatched calls are stored under `"unknown"` | High | 05 |
| Inbox "Mine" filter has no effect | Medium | 02, 07 |
| Deal and meeting detail screens are titled "SegmiQ Sales" | Medium | 02 |
| FAB covers the next-meeting card, and a KPI tile at 130% font | Medium | 03 |
| Dialer call button below the fold at 360 dp; system keyboard duplicates the keypad | Medium | 03, 05 |
| Customer "Meeting" button opens the recorder | Medium | 02 |
| Next-meeting card, user name and lead assignment are hard-coded | Medium | 02, 04 |
| "New leads" KPI counts all customers | Low | 02 |
| Off-brand lavender bottom sheet; light system bars on the dark call screen; white cold-start flash | Low | 03 |
| Unknown route ids render blank pages | Low | 02 |

## Context the product team should weigh

- **The web repository also contains an existing Capacitor Android app (`sales-app/`).** Per the web audit, it already uses the Bearer API, polls notifications and queues call logs offline. Decide whether the native app replaces it. Either way, reuse its API usage as the reference.
- **Fix the web audit's server-side security findings before exposing more data to any mobile client.** These include salesperson access to company settings, unenforced billing on APIs, the MFA role-check gap and the real-estate visibility holes.

## Report index

| File | Content |
|---|---|
| `01-project-architecture.md` | Toolchain, modules, libraries, structure, build and test results |
| `02-screen-and-navigation-inventory.md` | Every screen and route, button trace, navigation, adaptivity |
| `03-design-system-and-visual-quality.md` | Branding, components, responsiveness, visual defects |
| `04-authentication-and-api-integration.md` | Auth, networking, data sources, secrets |
| `05-contacts-telephony-and-call-recording.md` | Contacts, dialer, Telecom, call logging, call recording |
| `06-meeting-recorder-and-audio.md` | Recorder, recordings library, transcription models |
| `07-sales-features-and-copilot.md` | Leads, inbox, pipeline, quotations, tasks, Copilot |
| `08-storage-offline-and-notifications.md` | DataStore, offline, account isolation, notifications, background work |
| `09-web-vs-android-gap-analysis.md` | Feature-by-feature matrix against the web platform |
| `10-android-implementation-roadmap.md` | Code to keep, top 10 gaps, phases, risks |
| `11-android-feature-matrix.md` | Every function with its verified status |
| `screenshots/` | 70 emulator captures referenced by "V" in the reports |
