# SegmiQ Sales Android — unfinished features

Audit date: 2026-10-31. Commit `7e743eb`. This file lists every feature that is not COMPLETE and not deliberately out of scope. Completed rows live in `current-complete-feature-audit.md`.

Verification shorthand: **SRC** source read, **JVM** unit tests (129 passing), **EMU** emulator debug build, **NO-PROD** no authenticated call to www.segmiq.com.

The write gate is one record: `acceptedEstateReleases` in `EstateAccess.kt`. Reads for properties, buyers, viewings, introductions, offers, transactions, and calendar are listed. `writes` is empty. `privateImageHost` is null. Backend flags in `lib/mobile/sales-app/bootstrap.ts` set the real-estate write flags true whenever sales access is allowed. Android still blocks those writes.

---

## 1. Real-estate writes (schedule, reschedule, outcome, introduction decision, offer decision, buyer requirements, transaction note)

**Status:** INTEGRATED BUT GATED. **Priority:** P0. **Confidence:** High (SRC, JVM).

1. **Works.** `EstateRepository` builds the existing POST and PATCH bodies. `EstateServerScreen` and `EstateLiveForms` render the review sheets. Buttons appear only when `access.reason(resource, write = true)` is null.
2. **Does not work.** For the pinned production revision, `reason(..., write = true)` always returns “Mobile access is waiting for deployed security verification.” The buttons are replaced by explanatory text. Nothing is sent.
3. **Verified.** SRC `EstateAccess.kt`, `EstateRepository.kt`, `EstateServerScreens.kt`, `EstateLiveForms.kt`. JVM `EstateContractTest`. NO-PROD.
4. **Sources.** `EstateAccess.kt`, `EstateRepository.kt`, `EstateServerViewModel.kt`, `EstateServerScreens.kt`, `EstateLiveForms.kt`.
5. **API.** `POST /api/clients/{org}/buyer-sales/actions` (`viewing`, `reschedule_viewing`, `viewing_outcome`, `review_introduction`). `PATCH /api/clients/{org}/buyer-searches/{id}`. `PATCH /api/clients/{org}/offers/{id}`. `PATCH /api/clients/{org}/transactions/{id}` with `update_notes`.
6. **Missing.** A reviewed write entry on `EstateAcceptance` for this origin, revision, and role. After that, one behaviour is still unfinished: `confirmOverlap` is always `false`, so a server conflict cannot be confirmed in the app.
7. **Dependencies.** Product and security sign-off for the deployed revision. Do not reimplement the routes.
8. **Priority.** P0 for viewings, introduction decisions, and offer decisions. P1 for requirement edits and transaction notes.
9. **Acceptance.** On an accepted revision, a salesperson who already has the server permission sees the review button, the request includes only the documented fields, a 409 or 403 clears the private page, and a success reloads the server record. Overlap either stays blocked with the server message, or a second explicit confirm sends `confirmOverlap: true`. No customer WhatsApp is requested.

## 2. Private listing photographs

**Status:** INTEGRATED BUT GATED. **Priority:** P1. **Confidence:** High (SRC).

1. **Works.** Gallery pager, signed-metadata fetch, host allow-list, sample-size decode, neutral fallback, legacy-image copy.
2. **Does not work.** `imageHost()` is null. The server flag `privateListingImageDelivery` is false unless `SEGMIQ_RE_PRIVATE_IMAGE_ACCEPTANCE_JSON` matches the deployed revision, origin, role, and an R2 host (`lib/real-estate/private-image-acceptance.ts`). The UI shows “No listing photograph available”.
3. **Verified.** SRC. Phase comments in `EstateAccess` match the code. NO-PROD image request.
4. **Sources.** `PrivateListingImageClient.kt`, `EstateRepository.image`, `EstateServerScreens.EstatePrivatePhoto`, `private-image-acceptance.ts`.
5. **API.** `GET /api/clients/{org}/listings/{id}/images/{index}` then a signed URL on the approved host only.
6. **Missing.** Operator acceptance packet and the signed host on `EstateAcceptance.privateImageHost`. Android must not call the public marketing bucket.
7. **Dependencies.** Deployment / DevOps for the private bucket and the acceptance JSON. Product sign-off. Then a one-line Android host pin.
8. **Priority.** P1.
9. **Acceptance.** An authorised listing photo decodes, expires, and is not written to the public gallery. A foreign host or expired URL shows the neutral placeholder. Another organisation’s listing never requests an image.

## 3. Property create, edit, assign, share

**Status:** BACKEND READY — ANDROID MISSING for create. Edit actions are decoded and unused. **Priority:** P1. **Confidence:** High (SRC).

1. **Works.** Read directory and detail.
2. **Does not work.** No create form, no edit form, no assignment, no share sheet, no draft filter beyond the status chips already sent as query params.
3. **Verified.** SRC. `ListingActions.edit` has no call site. `POST` exists on `app/api/clients/[clientId]/listings/route.ts`.
4. **Sources.** `EstateDtos.ListingDto`, `EstateServerViewModel.listingFacts`.
5. **API.** `POST /api/clients/{org}/listings`. Detail already returns `permittedActions`.
6. **Missing.** Android create and edit using those contracts, gated by the same write acceptance. Share and map are not in the Android DTO (no coordinates).
7. **Dependencies.** Write acceptance. Do not invent a second listing API.
8. **Priority.** P1 create/edit. P3 share, until product defines it.
9. **Acceptance.** A permitted agent can create or edit only fields the existing POST/PATCH accepts. A forbidden agent sees no editor. The new id opens the live detail, not the fictional preview.

## 4. Buyer phone, call, and introduction request

**Status:** PARTIAL. **Priority:** P1. **Confidence:** High (SRC).

1. **Works.** Directory, requirements, matches, gated requirement editor.
2. **Does not work.** `BuyerSearchDto.phone` and `NamedParty.phone` are never shown. There is no Call action on a buyer. Android never sends `action: "introduction"`.
3. **Verified.** SRC. Grep of `.phone` in the estate UI hits inquiries and the dialer, not buyer detail.
4. **Sources.** `EstateDtos.kt`, `EstateServerViewModel.buyerFacts`, `buyer-introduction-service.ts` (`phone` is null unless `showContact`).
5. **API.** Buyer GET already returns `phone` when allowed. Introduction create is `POST …/buyer-sales/actions` with `action: "introduction"`.
6. **Missing.** Render phone and `ACTION_DIAL` only when the field is non-null. Add a request-introduction action for the signed-in agent’s own buyer, using the existing action.
7. **Dependencies.** Write acceptance for the request. Phone display does not need a new endpoint.
8. **Priority.** P1.
9. **Acceptance.** A buyer payload without a phone shows no number and no call button. A payload with a phone dials that number. A pending introduction never shows another agent’s buyer phone. Creating a request does not disclose contact details.

## 5. Inquiry relationships and the Inbox button

**Status:** PARTIAL, Inbox button BROKEN as a destination. **Priority:** P1. **Confidence:** High (SRC).

1. **Works.** Inquiry list, search, stage, notes, status, follow-up date, timeline, `ACTION_DIAL`, record, Copilot link.
2. **Does not work.** “Buyer requirements”, “Viewings”, and “Offers” open the directories. The screen says the inquiry has no buyer-search id. “Inbox” opens the unimplemented inbox module.
3. **Verified.** SRC `EstateLiveWorkspaces.kt` lines 137–149 and 112. EMU did not open a live inquiry.
4. **Sources.** `EstateInquiryDetail`, `LiveSalesApp` inbox route.
5. **API.** Lead GET. There is also `GET/POST /api/clients/{org}/leads/{leadId}/real-estate` which Android does not call. Inbox routes exist and are unused.
6. **Missing.** If `…/real-estate` returns a search id, viewing id, or offer id, open those records. Remove or relabel Inbox until a thread exists.
7. **Dependencies.** Confirm the real-estate lead payload before adding a second client. Do not guess ids.
8. **Priority.** P1.
9. **Acceptance.** From an inquiry, the agent opens the linked buyer search and its matches, or sees an explicit empty state. Inbox is absent or opens a real thread. No fictional match is shown.

## 6. Offer creation

**Status:** BACKEND READY — ANDROID MISSING. Decisions are INTEGRATED BUT GATED (see item 1). **Priority:** P1. **Confidence:** High (SRC).

1. **Works.** List, detail, event history, gated decision buttons, linked-transaction lookup with an honest bounded-list warning.
2. **Does not work.** No “create offer” call. The fictional preview can create a demo draft and says so.
3. **Verified.** SRC. `POST` is `app/api/clients/[clientId]/offers/route.ts`.
4. **Sources.** `EstateRepository.mutateOffer` (submit, counter, accept, reject, withdraw, note only).
5. **API.** `POST /api/clients/{org}/offers`.
6. **Missing.** A create form that posts the existing body, then opens the returned offer. Still behind write acceptance.
7. **Dependencies.** Item 1. Do not add a parallel offer service.
8. **Priority.** P1.
9. **Acceptance.** Create is refused without permission. A created offer reloads from GET. The demo preview cannot post to this route (`segment()` already rejects `demo-` ids).

## 7. Transactions beyond read, and compliance documents

**Status:** Transactions notes INTEGRATED BUT GATED. Milestone completion NOT STARTED. Compliance BACKEND READY — ANDROID MISSING. **Priority:** P1. **Confidence:** High (SRC).

1. **Works.** List, detail, milestone display, related offer link, gated note edit.
2. **Does not work.** Milestones cannot be completed. No participants editor. No document upload, download, or preview. Compliance load returns a local error and does not call the network.
3. **Verified.** SRC `EstateRepository` compliance branch and `transactionNote` comment: “Financial/completion transitions deliberately have no adapter.”
4. **Sources.** `EstateRepository.kt`, `EstateServerScreens.kt`.
5. **API.** `PATCH …/transactions/{id}`. `GET/POST /api/clients/{org}/compliance/cases` and document routes.
6. **Missing.** A document client only after the same private-storage acceptance used for photos. Milestone completion only if product wants it on mobile; the current code intentionally omits it.
7. **Dependencies.** Storage acceptance. Product decision on milestone edits.
8. **Priority.** P1 for an honest document status. P2 for milestone edits.
9. **Acceptance.** No file is saved to shared storage. A rejected document shows the server reason. Compliance is absent from navigation until the read flag and acceptance both allow it.

## 8. Calendar is not a full appointment book

**Status:** PARTIAL. **Priority:** P1. **Confidence:** High (SRC).

1. **Works.** When the calendar read gate is open: one-day fetch, week strip, previous and next week, today, date picker, paging, timezone label, tappable viewings and lead follow-ups.
2. **Does not work.** No month grid. No create, edit, or cancel on the calendar itself. `standaloneMeetingsSupported` is displayed as unsupported. Events whose related type is not `viewing` or `lead` are dropped in `eventLink`. The fallback `EstateCalendar` is only tasks.
3. **Verified.** SRC `EstateServerViewModel` calendar branch and `eventLink`.
4. **Sources.** `EstateServerViewModel.kt`, `EstateLiveWorkspaces.EstateCalendar`, `EstateRepository.calendar`.
5. **API.** `GET /api/sales/calendar?from&to&page&limit`.
6. **Missing.** Render every returned event. Unknown types stay read-only. Creation stays on the viewing sheet, not a fake meeting. Month view only if the same endpoint is queried per day or the contract gains a month query.
7. **Dependencies.** Read gate already lists CALENDAR. No new backend route is required to stop dropping events.
8. **Priority.** P1.
9. **Acceptance.** A viewing on the selected day opens the viewing. A task opens the inquiry. A meeting the feed marks unsupported is named in the coverage line and is not invented. The task fallback is not shown once the server calendar loads.

## 9. Live dialer is launch-only

**Status:** PARTIAL. **Priority:** P1. **Confidence:** High for source, Medium for the live call path (EMU covered the demo dialer only).

1. **Works.** Keypad, delete, long-press 0 inserts `+`, long-press delete clears. Display is not a text field. EMU demo keypad left `mInputShown=false`. Live screen uses the same `DialPad`. Zimbabwe and other regions go through libphonenumber; unknown countries are not assumed to be Zimbabwe. Contact picker. CRM lookup. Saving an outcome writes an internal note when a lead matches.
2. **Does not work.** `ACTION_DIAL` does not report duration or answer state. `review = true` runs immediately after `startActivity`, before the user returns. Save does not create a follow-up. There is no live recents list and no call log permission. The demo dialer’s “Start simulated call”, Contacts, and Recents are fictional and must not be described as the live dialer.
3. **Verified.** SRC `LiveHomeScreens.LiveDialerScreen`. EMU `06-dialer.png` is the demo. JVM `PhoneNumbersTest`.
4. **Sources.** `LiveHomeScreens.kt`, `DialPad.kt`, `PhoneNumbers.kt`, `CallingScreens.kt` (demo only).
5. **API.** `GET /api/contacts/lookup`. `POST /api/leads/{id}/internal-note`.
6. **Missing.** Show review only when the user comes back to SegmiQ. Add an optional follow-up date through the existing `PATCH follow_up_date`. Keep the “phone app does not report duration” sentence. Do not add call recording.
7. **Dependencies.** None on the backend for the review timing fix. Device testing for the picker and `ACTION_DIAL`.
8. **Priority.** P1.
9. **Acceptance.** Dialling opens the system dialer and does not show a saved outcome until the user submits one. An unmatched number cannot be written to the address book or to SegmiQ. The IME stays closed on the keypad. A Zimbabwe national number and a `+` international number both display in international form when the organisation country parses them.

## 10. Meeting recorder is local only

**Status:** PARTIAL for capture and library. NOT STARTED for upload, transcript, and Copilot extraction. Demo recorder is UI ONLY. **Priority:** P1. **Confidence:** High (SRC, JVM state machine). Physical microphone: not verified.

1. **Works in source.** Permission request, consent gate, `MediaRecorder` MIC to MPEG-4 AAC, foreground microphone service, ongoing notification without the customer name, pause, resume, stop, discard, low-storage error, empty-file rejection, SQLite index, playback and seek, rename, notes, delete, sign-out wipe. Waveform samples are `amplitude()` only while `RECORDING`; a paused or idle wave is not animated from a timer. Incoming audio-focus loss pauses. Service `onDestroy` tries to save. `START_NOT_STICKY` means process death does not resume recording.
2. **Does not work.** No upload, no transcript, no extracted commitments. `propertyId` is always null. Copilot opens the generic screen. The demo recorder tells the user the microphone is not opened. EMU library text: “Audio capture is not connected.”
3. **Verified.** SRC `MeetingRecorder.kt`, `MediaRecorderCapture.kt`, `MeetingRecordingService.kt`, `MeetingRecorderScreens.kt`. JVM `MeetingRecorderTest` uses `FakeCapture`. EMU demo only. No physical device.
4. **Sources.** Files above plus `RecordingLibrary.kt`, `RecordingDatabase.kt`.
5. **API.** None. No transcript or meeting-upload route was found under `app/api`.
6. **Missing.** A device test of start, background, lock, incoming call, and playback. A property picker that stores a real listing id. Upload and transcript wait on a backend contract. Do not simulate a transcript.
7. **Dependencies.** Device testing for capture. Cursor / Backend before any upload. The local library can ship without that.
8. **Priority.** P1 for a proven on-device recording. P2 for upload.
9. **Acceptance.** A file longer than 0 bytes plays back after stop. Discard removes it. Sign-out removes that account’s files and does not touch another account. The waveform is flat when the microphone is not recording. The demo path never calls `MediaRecorder`.

## 11. Sales Copilot actions that are web-only, and the ignored simulated flag

**Status:** PARTIAL. **Priority:** P1. **Confidence:** High (SRC, JVM `TaskRulesTest`).

1. **Works.** Cards from `GET /api/sales/tasks`. Explanation, missing fields, execution error, queues. Approve, dismiss, snooze, complete hit `POST /api/sales/copilot/work-items/{id}` and reload tasks. Quotations, listing shortlists, and appointments tell the user to use the website.
2. **Does not work.** `WorkItemResponse.simulated` and `notice` are never read. A success always toasts as confirmed. There is no transcript-based suggestion. Opening Copilot from a recording does not pass the recording id.
3. **Verified.** SRC `TaskRules.kt`, `LiveTaskScreens.kt`, `LiveViewModels.run`. NO-PROD.
4. **Sources.** Those files plus `LiveDtos.WorkItemResponse`.
5. **API.** `POST /api/sales/copilot/work-items/{id}` with `approve`, `dismiss`, `snooze`, `complete`.
6. **Missing.** If `simulated == true` or `notice` is set, show that notice and do not say the commitment was created. Keep web-only types on the web.
7. **Dependencies.** None. The endpoint already exists.
8. **Priority.** P1 because a simulated success is a false confirmation.
9. **Acceptance.** Approving a follow-up reloads the task as approved or completed. Approving a quotation draft shows the web message and does not post. A simulated response is visibly not a customer commitment.

## 12. Tasks are follow-up dates

**Status:** PARTIAL. **Priority:** P2. **Confidence:** High (SRC).

1. **Works.** Filters, overdue styling, complete via clearing `follow_up_date` or completing a Copilot work item, reschedule via a date, server reload after success.
2. **Does not work.** No task that is not a lead follow-up. No time of day (`follow_up_date` is a date column). No assignee, priority editor, or repeat. Offline edits are rejected.
3. **Verified.** SRC `LiveSalesApi.setFollowUp`, `TaskRules.completionPlan`.
4. **Sources.** `LiveTaskScreens.kt`, `LiveViewModels.kt`, `TaskRules.kt`.
5. **API.** `GET /api/sales/tasks?view=mine`. `PATCH /api/leads/{id}` with `follow_up_date`.
6. **Missing.** Nothing, if the product accepts “task = follow-up date”. A separate task service should not be invented.
7. **Dependencies.** Product decision before any richer task model.
8. **Priority.** P2.
9. **Acceptance.** Completing a row does not flip the checkbox until the reload says it is done. A failed PATCH leaves the old date.

## 13. WhatsApp inbox

**Status:** BACKEND READY — ANDROID MISSING. **Priority:** P1. **Confidence:** High (SRC).

1. **Works.** The tab or More row opens an honest unavailable screen, and a web path when bootstrap provides one. Demo inbox is labelled sample conversations.
2. **Does not work.** No conversation list, thread, send, attachment, quick reply, assignment, unread count, or transfer.
3. **Verified.** SRC `LiveModule.INBOX`. Backend route list. Android has zero `/api/inbox` calls.
4. **Sources.** `LiveWorkspace.kt`, `LiveSalesApp.kt`, `CustomerScreens.kt` (demo).
5. **API already present.** `GET /api/inbox/conversations`. `GET /api/inbox/conversations/{leadId}/messages`. `GET /api/inbox/quick-replies`. `POST /api/inbox/conversations/{leadId}/transfer-support`. `POST /api/leads/{leadId}/send-message` (text). Media GET exists; a general attachment upload for the mobile client was not confirmed as a salesperson send API.
6. **Missing.** An Android inbox that calls those routes with the sales session. Unread and status only if the list payload already includes them. Do not embed the WhatsApp Web client and call it native.
7. **Dependencies.** Codex / Android. Backend send of text exists. Attachments need a contract check before UI promises them. External provider remains WhatsApp session health on the server.
8. **Priority.** P1 for text inbox if salespeople live in WhatsApp. P2 for attachments.
9. **Acceptance.** The list is the server list for that salesperson. Send uses `send-message` and shows the server error. Demo mode never calls it. The inquiry Inbox button opens the same thread for that lead.

## 14. Push notifications

**Status:** NOT STARTED. Local reminders are PARTIAL. **Priority:** P2. **Confidence:** High (SRC).

1. **Works.** Two channels. One local alarm for the next loaded task. Tap deep-links to the lead if the account stamp matches. Recording notification while capturing.
2. **Does not work.** No FCM, no token register, refresh, or logout delete. No viewing, Copilot, or introduction push. No preference screen. Alarm is inexact and singular.
3. **Verified.** SRC `SalesNotifier.kt`, `LiveNotificationScreen.kt`. No `google-services.json`. No device-token route in `app/api`.
4. **Sources.** Those files, `AndroidManifest.xml`.
5. **API.** None for push. In-app notification rows exist at `GET /api/notifications` and are not called.
6. **Missing.** Either call `GET /api/notifications` for an in-app list, or a new device-token contract. Do not claim push because the bell icon exists.
7. **Dependencies.** `GET /api/notifications` can be wired by Android now. Push needs Cursor / Backend and an external push provider.
8. **Priority.** P2 for the in-app list. P3 for FCM until a contract exists.
9. **Acceptance.** The in-app list shows server rows for the signed-in user and opens the lead or introduction id the payload already contains. Logout does not leave another user’s reminder. No token is sent until an endpoint exists.

## 15. Pipeline and quotations

**Status:** Pipeline PARTIAL. Quotations NOT STARTED. **Priority:** P2 and P3. **Confidence:** High (SRC). EMU demo pipeline shows `$66,400.00` fictional USD (`07-pipeline.png`).

1. **Works.** Live pipeline shows server stage counts and known value, and says stage moves happen on the web.
2. **Does not work.** No deal open, no drag, no quote.
3. **Verified.** SRC `LivePipelineScreen`. EMU demo only.
4. **Sources.** `LiveHomeScreens.kt`, `SalesApp.kt` quotation empty state.
5. **API.** Dashboard already supplies the snapshot. `PATCH /api/deals/{dealId}` exists and is unused. Quote routes exist for platform sales and are not the salesperson mobile contract used here.
6. **Missing.** A read-only deal list only if an existing salesperson deal payload is identified. Do not build a quote engine in the app; Copilot already sends those to the web.
7. **Dependencies.** Product decision.
8. **Priority.** P2 pipeline detail. P3 quotations.
9. **Acceptance.** The live pipeline never shows demo currency. A deal the server did not return is not shown.

## 16. Solar-specific screens

**Status:** NOT STARTED. **Priority:** P2. **Confidence:** High (SRC).

1. **Works.** Bootstrap can select SOLAR. Shared leads, tasks, Copilot, and dialer reuse the general implementations. Unavailable modules can open a web path.
2. **Does not work.** Solar pipeline, site visits, assessments, and projects have no screens.
3. **Verified.** SRC `LiveWorkspace.tabsFor`.
4. **Sources.** `LiveWorkspace.kt`, `UnavailableModuleScreen`.
5. **API.** Not wired. Do not assume the general pipeline is the solar pipeline.
6. **Missing.** A solar contract, then screens. Until then the unavailable copy must stay.
7. **Dependencies.** Product and backend contract. Not a visual polish item.
8. **Priority.** P2 if solar customers are in this release. Otherwise later.
9. **Acceptance.** A solar user never sees real-estate listings or fictional solar jobs.

## 17. Real-estate home metrics that are not on the dashboard

**Status:** NOT STARTED as separate metrics. **Priority:** P2. **Confidence:** High (SRC).

1. **Works.** New inquiries and follow-ups due come from `GET /api/sales/dashboard`.
2. **Does not work.** The home does not show today’s viewing count, offer count, or a property highlight. It does not call the estate repository.
3. **Verified.** SRC comment on `RealEstateHomeContent`.
4. **Sources.** `RealEstateHome.kt`.
5. **API.** Viewings and offers GET already exist. They are not called from home.
6. **Missing.** Optional counts from those existing list payloads, or leave the links. Do not rename enquiry totals.
7. **Dependencies.** Read gates for those modules.
8. **Priority.** P2.
9. **Acceptance.** Each number is labelled with its endpoint. A failed viewing call does not zero-out inquiries.

## 18. More-menu copy versus the live estate screens

**Status:** BROKEN copy, screens themselves can be live. **Priority:** P2. **Confidence:** High (SRC).

1. **Works.** Tapping Properties, Buyers, Viewings, Introductions, Offers, or Transactions opens `EstateServerScreen` when the read gate is open.
2. **Does not work.** `LiveMoreScreen` subtitles say “Continue on SegmiQ web” whenever `LiveModule.implemented` is false. Those six modules are still `implemented = false` even though the server screen exists.
3. **Verified.** SRC `LiveWorkspace.kt` flags and `LiveHomeScreens.kt` lines 415–419.
4. **Sources.** Those files and `LiveSalesApp` module routes.
5. **API.** None.
6. **Missing.** Drive the subtitle from `EstateAccess.reason`, not from the stale flag.
7. **Dependencies.** None.
8. **Priority.** P2.
9. **Acceptance.** An accepted read says it opens the workspace. A gated module says verification is required and offers the web link. It does not say the feature is absent when the screen exists.

## 19. Fictional real-estate preview inside the signed-in app

**Status:** DEMO ONLY. **Priority:** P2. **Confidence:** High (SRC).

1. **Works.** `EstateDemoApp` is labelled fictional in its forms and refuses to call the network (`demo-` ids are rejected by `segment()`).
2. **Does not work as a product surface.** Settings and gated modules offer “Explore fictional workflow” beside live navigation. A hurried agent can think the preview is their stock.
3. **Verified.** SRC `RealEstateScreens.EstateModuleEntry`, `EstateSettings`, `EstateDemoDetails`.
4. **Sources.** `EstateDemoApp.kt`, `EstateWorkflow.kt`, `EstateDemoForms.kt`.
5. **API.** None. Must stay that way.
6. **Missing.** Either remove the entry from signed-in builds, or keep a persistent banner on every preview screen, not only on save.
7. **Dependencies.** Product decision.
8. **Priority.** P2.
9. **Acceptance.** No preview action can reach `EstateRepository`. Every preview screen shows that the records are fictional before the first card.

## 20. Login actions hidden on a short window

**Status:** PARTIAL. **Priority:** P2. **Confidence:** High (EMU).

1. **Works.** Email, password, visibility, local validation, forgot-password URL, demo entry, secure-host line. EMU empty submit shows “Enter your email and password.”
2. **Does not work on first paint.** On a 720×1184 window with 3-button navigation, the forgot-password control is clipped (`04-validation.png`, bounds bottom at y=1184). “Explore local demo” is off the first screen until the column scrolls (`02-login-scrolled.png`).
3. **Verified.** EMU screenshots in `docs/android-audit/screenshots/current-2026-10-31/`.
4. **Sources.** `AuthScreens.kt` `AuthBackdrop` column.
5. **API.** Forgot password is the website `/forgot-password`. That is acceptable. The defect is reachability.
6. **Missing.** First-viewport layout that keeps Sign in, Forgot password, and Explore demo above the system bar, including when the validation line is visible.
7. **Dependencies.** None.
8. **Priority.** P2.
9. **Acceptance.** On a 360×640 dp phone with 3-button navigation, all three controls are visible without scrolling, or the clipped control is fully visible and the rest is a single obvious scroll that cannot hide the primary button under the nav bar.

## 21. General My Day still says meetings are unavailable

**Status:** NOT STARTED for general meetings. Honest empty state. **Priority:** P3. **Confidence:** High (SRC).

The live general home hard-codes “Your SegmiQ calendar isn't available in the app yet.” Real-estate calendar is a different route. Do not point general users at the estate calendar. Leave this until a general meeting contract exists.

## 22. Account switching

**Status:** NOT STARTED. **Priority:** P3. **Confidence:** High (SRC).

Sign out, then sign in. The account stamp blocks a reminder deep link for a different user. There is no switcher and no organisation picker. Organisation switching is not applicable.

## Not unfinished

These were checked and are in scope as they stand: server-selected experience, encrypted session, MFA enrolment block, lead duplicate handling, Copilot web-only refusal, dialer keypad without an IME, recording consent copy, and the refusal to invent transcripts or listing photos. They still need a production click-through before a customer launch, which is a test gap, not a missing feature.
