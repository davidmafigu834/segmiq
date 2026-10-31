# SegmiQ Sales Android — final polish roadmap

Audit date: 2026-10-31. Commit `7e743eb`. This roadmap follows the code and the emulator pass in the sibling audit files. It does not repeat the older phase plans.

Authenticated production clicks were not part of this audit. The first task in Sprint 1 is a non-destructive read-only pass on a real salesperson account so the revision pin is confirmed on the deployed host.

## Sprint 1 — False states, dead controls, and the real-estate read path

**Goal.** A signed-in real-estate agent can trust what the app claims, and can open the records the server already returns.

**Files.** `EstateAccess.kt`, `LiveHomeScreens.kt`, `LiveWorkspace.kt`, `EstateLiveWorkspaces.kt`, `EstateServerViewModel.kt`, `EstateServerScreens.kt`, `LiveViewModels.kt`, `AuthScreens.kt`.

**Order.**

1. On a salesperson account, open bootstrap and record `release.revision`, `deployedVerification`, and the real-estate flags. If the revision is not `7e743eb`, do not widen the pin until that deploy is the one security reviewed. If it matches, walk Properties, Buyers, a buyer’s matches, Viewings, Introductions, Offers, Transactions, and Calendar with reads only.
2. Change More-menu subtitles to follow `EstateAccess.reason`, not `LiveModule.implemented`.
3. Remove or disable the inquiry Inbox button until Sprint 3. It currently opens an unavailable module.
4. Render buyer and introduction `phone` only when the JSON includes it, with `ACTION_DIAL`.
5. Stop dropping calendar events whose type is not `viewing` or `lead`. Show the others as read-only.
6. Show `ApiError.message` on estate failures when the mapper allows that sentence. Show Copilot `notice` and do not treat `simulated == true` as a normal confirmation.
7. Fix the login column so Forgot password and Explore demo sit above the 3-button navigation on a 720×1184 window (`04-validation.png`).

**Dependencies.** A test account. No backend change for items 2–7.

**Acceptance.** Read screens show server rows or an explicit gate. No control navigates to a dead inbox. A redacted phone stays hidden. A simulated Copilot response is labelled. Login controls are fully on screen in the screenshot size from this audit.

**Tests.** Extend `EstateContractTest` for subtitle and phone rendering. Extend `TaskRules` or the Copilot UI test for `simulated`. Add a Compose check that the login actions clear the navigation bar inset. Re-run `testDebugUnitTest`.

**Screens to look at.** Login, real-estate More, buyer detail, introduction detail, calendar day, Copilot after a simulated item if one can be loaded safely.

**Done.** An agent can move from home to a real listing, buyer, match, viewing, introduction, offer, and calendar event without hitting a fictional card or a button that goes nowhere. Writes still stay gated.

## Sprint 2 — Phone, recorder, and local reminders

**Goal.** Native pieces behave the way the copy already describes, on a physical Android phone.

**Files.** `LiveHomeScreens.kt` (`LiveDialerScreen`), `DialPad.kt`, `MeetingRecordingService.kt`, `MeetingRecorderScreens.kt`, `RecordingScreens.kt`, `SalesNotifier.kt`, `LiveNotificationScreen.kt`.

**Order.**

1. Live dialer: set the review form only after the user returns to the app. Keep the sentence that duration and answer state are unknown. Add an optional follow-up date through the existing lead `PATCH`. Do not read the call log.
2. On a physical device, place an `ACTION_DIAL`, return, save a note on a test lead only if that write is authorised, and confirm the IME never opens on the keypad.
3. On a physical device, record, pause, lock the screen, take an incoming-call audio focus change, resume, stop, play, seek, rename, and delete. Confirm the file is gone after delete and after sign-out. Confirm the waveform is silent when not recording.
4. Replace the free-text property field with an optional listing id chosen from the authorised property list, or leave the field as a label and stop implying a property link. `propertyId` is currently always null.
5. Hide demo recording category chips that suggest calls and voice notes exist.
6. Exercise the local reminder: allow notifications, confirm one alarm, tap it, land on the lead, sign out, confirm it does not fire for the next account.

**Dependencies.** Device testing. No upload endpoint. Do not add Firebase in this sprint.

**Acceptance.** The criteria in unfinished-features items 9, 10, and 14 for the local half. No audio leaves the phone.

**Tests.** JVM recorder tests stay on the fake capture. Add an instrumented test that the live dialer composable does not toggle review before a return flag is set. Physical cases stay a written checklist, not a CI emulator microphone test.

**Screens.** Live dialer, call review, recorder, recording detail, notifications.

**Done.** A salesperson can call through the system dialer, write an honest outcome, and keep a meeting recording on the device with consent. The app does not claim a transcript.

## Sprint 3 — Turn on the writes and the inbox that already exist

**Goal.** Use the deployed routes. Do not add parallel services.

**Files.** `EstateAccess.kt` (acceptance sets), `EstateRepository.kt` (`confirmOverlap` and introduction request), `EstateLiveForms.kt`, `EstateServerScreens.kt`, new inbox screens beside `LiveSalesApp.kt`, `LiveSalesApi.kt` or a small inbox client.

**Order.**

1. Product signs the write set for the deployed revision: viewings, introduction review, offer decisions, buyer requirements, transaction notes. Put those resources in `EstateAcceptance.writes` for `SALESPERSON` only. Leave compliance and images out until their storage packet exists.
2. Overlap: on a 409 conflict, show the server message and require a second confirm before sending `confirmOverlap: true`.
3. Introduction request from the signed-in agent’s buyer, using `action: "introduction"`. No contact disclosure in the request UI.
4. Offer create via `POST /api/clients/{org}/offers`, then open the GET detail.
5. Listing create and edit only for `permittedActions` the detail already returns, via the existing listings POST. Skip share and map.
6. If `GET /api/clients/{org}/leads/{leadId}/real-estate` returns search, viewing, or offer ids, point the inquiry buttons at those records.
7. Inbox: `GET /api/inbox/conversations`, `GET …/messages`, `POST /api/leads/{id}/send-message`. Wire the inquiry Inbox button to that thread. Quick replies and support transfer after text send works. Attachments only if a salesperson upload route is confirmed; otherwise say they are unavailable.
8. In-app notifications from `GET /api/notifications`, deep-linking ids the payload already has. No device token.

**Dependencies.** Sprint 1 read-only pass. Security sign-off for the write pin. Do not disable rollout checks to test.

**Acceptance.** Each mutation reloads from GET. A 403 or 409 clears stale private content, which the view model already does. Demo and `demo-` ids cannot call these routes. A WhatsApp send shows the server error and does not pretend the message left when the provider fails.

**Tests.** Contract tests for overlap confirm, introduction request body, and offer create body. MockWebServer instrumented tests for one viewing book and one inbox send. No production writes in CI.

**Screens.** Viewing sheet, introduction detail, offer detail, new offer, listing editor, inquiry related rows, inbox list, inbox thread, notification list.

**Done.** The gated buttons from Sprint 1 either work against the accepted revision or stay hidden with the real reason. The inbox is the server inbox.

## Sprint 4 — Photos, compliance, and release polish

**Goal.** Finish the items that are blocked on storage or on a visual pass, then freeze.

**Files.** `private-image-acceptance.ts` operators’ env, `EstateAccess.privateImageHost`, `PrivateListingImageClient.kt`, compliance screens only after the same packet, `RealEstateHome.kt`, `Components.kt`.

**Order.**

1. Deploy the private listing bucket and `SEGMIQ_RE_PRIVATE_IMAGE_ACCEPTANCE_JSON` for the revision under test. Pin that host in `EstateAcceptance`. Confirm a cover photo loads and a foreign host does not.
2. Compliance documents only after the same style of acceptance. No shared-storage copies. Until then, leave the local forbidden response.
3. Real-estate home: shorten the decorative hero on short windows. Optional viewing and offer counts must be labelled from their own endpoints.
4. Font scale 1.3 and 2.0 on the real-estate tabs. Bottom bar already grows; confirm the last action on a detail is reachable.
5. Physical-device lifecycle: background recording, process death, low storage, rotation, offline banner.
6. Run `lintDebug` and `connectedDebugAndroidTest`. Fix new failures. Do not disable tests.

**Dependencies.** Deployment / DevOps for images. Sprint 3 writes should already be accepted or explicitly deferred.

**Acceptance.** Photos and documents use the approved host only. Large text does not cover the primary button. Lint and instrumented tests are green on the same commit that ships.

**Screens.** Property detail gallery, compliance only if accepted, home, every tab at large font, recorder in background.

**Done.** A real-estate salesperson can complete a day: inquiries, a listing with a real photo or an honest placeholder, a buyer match, a viewing change that the server confirmed, an offer decision the server confirmed, a call outcome, and a local recording. Solar-only modules stay on the unavailable screen. Push and transcripts stay absent until a backend contract exists.

## Out of this roadmap

Account switching, organisation switching, quotation building, solar pipeline, acquisitions, inspections, owners, mandates, commissions, call recording, and call-log import. They are absent on purpose until a contract exists.

## Tests this audit actually ran

- `testDebugUnitTest`: 18 suites, 129 tests, 0 failures. Includes auth, session, HTTP, tasks, Copilot policy, estate contracts, private-image rules, phone numbers, and the recorder state machine with a fake capture.
- `assembleDebug`: success. Installed on `emulator-5554`.
- `lintDebug`: success, 0 errors, 51 warnings. The warnings are style and API-level notes (synchronous `commit()` on the encrypted session store, `POST_NOTIFICATIONS` referenced from minSdk 26, target SDK). They are not the functional gaps in this roadmap. Report: `app/build/reports/lint-results-debug.html`.
- Instrumented tests were not executed in this pass. The emulator was used for the manual login and demo walk. Existing instrumented coverage includes navigation, demo calls, estate UI against MockWebServer, premium contrast, and a Phase 7 capture test. Those tests do not replace a production read-only walk.
- Not tested on a physical phone: microphone, `ACTION_DIAL`, contact picker, notification tap, camera-less photo decode, font scale.

## Executive answers

1. **Fully working in code, still needing a production click-through.** Login validation, password visibility, MFA and session handling, sign-out, server-chosen experience, general and real-estate inquiry list and detail, follow-up date and notes, task complete via the server, Copilot follow-up review, property and buyer reads behind the revision pin, match list, viewing and introduction and offer and transaction reads behind that pin, calendar day fetch, dialer keypad without an IME, and the official logo.
2. **Partial.** Live dialer, call review timing, tasks as dates, Copilot simulated flag, calendar event types, inquiry links, buyer phone, local reminders, on-device recorder, real-estate home metrics, pipeline.
3. **Nonfunctional or misleading controls.** Inquiry Inbox. More-menu “Continue on SegmiQ web” while the live screen exists. Estate write buttons, which correctly do not submit. Demo call, demo recorder, and fictional real-estate preview. Login forgot-password clip on a short window.
4. **Demo only.** The local demo from the login screen, and “Explore fictional workflow” inside a signed-in real-estate session.
5. **APIs present and not called.** Inbox conversations and messages, `send-message`, quick replies, support transfer, `GET /api/notifications`, listings POST, offers POST, introduction create action, real-estate lead link route, deal PATCH, compliance routes.
6. **Native gaps.** Call duration and answer state cannot come from `ACTION_DIAL`. No call log. No FCM. Recorder does not upload. Contact access is the system picker only. Incoming-call behaviour is pause-on-audio-focus and is not device-proven.
7. **Fix first.** Confirm the production revision, correct dead or misleading controls, then show phones and calendar rows the server already sends.
8. **Closest to done.** Real-estate writes and requirement edits. The UI and repository are built. They wait on `EstateAcceptance.writes`.
9. **Needs Cursor / Backend, not more Android guessing.** Device-token push. Meeting upload and transcript. Private-image acceptance JSON and bucket (Deployment / DevOps). Compliance file policy. Solar contracts. Anything else in the gap matrix marked Codex / Android should be built in the app against the existing route.
10. **UI with the most impact.** Unclip login. Stop the Inbox button and the More subtitle from lying. Show server error sentences. Shrink the decorative hero on short phones. Do not restyle cards before that.
11. **Before a customer relies on it.** Production read-only pass on the pinned revision. Write acceptance or a clear “web only” label on every decision button. No simulated Copilot success. No fictional preview one tap from live stock. A physical recording and a physical dialler check. Photos either load from the private host or stay on the neutral placeholder.
12. **Next build to finish real estate.** Sprint 1, then the write pin and viewing / introduction / offer actions, then offer create and the inquiry links, then photos. Inbox can follow in the same sprint if WhatsApp is how those agents work.

## Top 20 remaining tasks

| # | Task | Priority | Depends on | Backend work |
|---|---|---|---|---|
| 1 | Read-only production walk. Record bootstrap revision, flags, and one page each of listings, buyers, viewings, introductions, offers, transactions, calendar. | P0 | Test account | No |
| 2 | If revision matches `7e743eb`, add the signed write set to `EstateAcceptance.writes`. If it does not match, stop and review that deploy. | P0 | 1, security sign-off | No new route |
| 3 | Fix inquiry Inbox so it does not open the empty module. | P1 | None | No |
| 4 | More-menu subtitle from `EstateAccess`, not `implemented`. | P1 | None | No |
| 5 | Show buyer and introduction phone plus Call only when JSON has a phone. | P1 | 1 | No |
| 6 | Render non-viewing calendar events as read-only. | P1 | 1 | No |
| 7 | Surface Copilot `simulated` and `notice`. | P1 | None | No |
| 8 | Estate errors show `error.message`. | P1 | None | No |
| 9 | Login: Forgot password and Explore demo above the system bar at 720×1184. | P2 | None | No |
| 10 | Dialer review only after return. Optional follow-up date via existing lead PATCH. | P1 | Authorised test lead if saving | No |
| 11 | Physical recorder pass: focus loss, lock, playback, delete, sign-out wipe. | P1 | Device | No |
| 12 | Overlap conflict: second confirm sends `confirmOverlap: true`. | P0 | 2 | No |
| 13 | Introduction request via existing `action: introduction`. | P1 | 2 | No |
| 14 | Offer create via existing `POST …/offers`. | P1 | 2 | No |
| 15 | Wire inquiry buttons to `…/leads/{id}/real-estate` when that payload has ids. | P1 | Read the payload | No, route exists |
| 16 | Inbox list, thread, and text send via existing inbox and `send-message` routes. | P1 | None | No for text |
| 17 | In-app list from `GET /api/notifications`. | P2 | None | No |
| 18 | Pin `privateImageHost` after the acceptance JSON is deployed. | P1 | DevOps packet | Env and JSON, not a new API |
| 19 | Listing create/edit using existing POST and `permittedActions`. | P1 | 2 | No |
| 20 | Font-scale and short-window pass on real-estate home, tabs, and viewing sheet. | P2 | 1 | No |

Compliance downloads, push, transcripts, solar, and quotations stay off this list until a contract or a storage packet exists.
