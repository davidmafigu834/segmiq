# SegmiQ Sales Android — final functional completion

Date: 1 November 2026. Work is in `SegmiQ Sales App`. The parent repository is still at `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6`. The Android tree is untracked there, so this sprint was not committed onto `main`. No production backend was deployed. No customer message, offer, viewing, or listing was created against `https://www.segmiq.com`.

## What was verified on the deployed server

No authorised test account was available in this session. Production bootstrap was not fetched again. Read acceptance was left as already pinned:

- Origin `https://www.segmiq.com:443`
- Contract version 1
- Revision `7e743eb43fd2995636c8b2f7133d606a1d2c3cb6`
- Role `SALESPERSON` only
- Reads: properties, buyers, viewings, introductions, offers, transactions, calendar
- Writes: empty
- `privateImageHost`: null
- `deployedVerification` remains `NOT_ATTESTED` until the server says otherwise

Deployment of that revision is not treated as write approval.

## Features completed

- More menu subtitles come from `EstateAccess` and real navigation: native, rollout-gated, web-only, or unavailable for this account. General and Solar web-only copy is unchanged (`Not in the app yet`). Real-estate web-only modules still say they continue on the web.
- Inquiry and lead screens open `live/inbox/{leadId}` for that record. The Inbox tab uses the same screens.
- Buyer, viewing, and introduction phones are shown only when the payload includes a non-blank number. Call uses `ACTION_DIAL`. A missing number stays redacted.
- Every calendar event returned by the server is shown. Known types open the record. Other types are read-only cards with title, time, and type.
- Sales Copilot shows `notice` and labels `simulated` results as simulated. A simulated approval is not presented as a customer commitment.
- Estate screens show the mapper sentence for validation, conflict, permission, and not-found. HTTP 5xx and unclassified bodies stay on the generic sentence, so an internal `error` string is not rendered.
- Short login windows keep the official logo, Sign in, Forgot password, and Explore local demo above the system bars. The architectural image is omitted when the window is short or the keyboard is open.
- Native WhatsApp directory and thread, backed by the existing bearer routes. Search, refresh, unread only when `unread > 0`, composer, quick-reply insertion, pending send, and draft retention on failure. An accepted send is not described as delivered. `providerId` `demo-simulated` is described as not delivered.
- Listing create/edit, introduction request, and offer create forms use the documented fields and stay closed unless write acceptance includes that resource. Offer amounts use `BigDecimal`. Listing bodies do not send `agent_id` or `approval_status`.
- A viewing overlap (`90 minutes` / confirm-only copy) keeps the page and sends `confirmOverlap: true` with the same idempotency key only after an explicit second confirmation.
- Call review is offered after the app is stopped and started again. It does not assume the call connected. Outcome, notes, and an optional follow-up date use the existing note and follow-up routes. No call-log permission.
- Meeting recorder can store an authorised listing id from the first page of properties. A typed name is stored as a label and is not described as a linked listing. Audio is not uploaded.
- In-app notification list from `GET /api/notifications`, scoped to the signed-in user. Deep links only for a real lead id, or an introduction id when introductions are open. Not push. Not FCM.
- Real-estate home shrinks the decorative hero under 700dp. Counts are shown only from the field that actually means that count, and partial pages are not labelled as totals.
- Fictional preview screens carry a persistent banner: fictional training data, not organisation stock, no server writes.

## Features partially completed

- WhatsApp send, quick replies, and the directory are implemented and covered with synthetic HTTP. They were not exercised against a live customer conversation.
- Listing, offer, and introduction forms are built and tested against a synthetic acceptance. On the pinned production release the write set is empty, so the buttons stay hidden and the repository makes no request.
- Viewing schedule, reschedule, and outcome adapters already existed. Overlap confirmation is now explicit. Production writes stay closed.
- Inquiry relationships are not loaded. `GET /api/clients/{org}/leads/{leadId}/real-estate` requires a browser cookie session. The phone does not call it, and it does not guess a buyer-search id from a name or phone.
- Transfer to support is the same: `POST .../transfer-support` uses a cookie session. The thread says that action stays on SegmiQ web.
- Attachment send is text-only on `send-message`. Received files are labelled with the MIME type and are not downloaded.
- Compliance documents stay unavailable until storage acceptance exists.
- Private listing images stay unloaded (`privateImageHost` is null).
- Notifications are a pull list. There is no device-token registration.
- Recorder behaviour that needs a physical handset (lock, interruption, a real microphone check beyond the emulator) was not repeated on hardware.

## Backend endpoints used by the new phone code

Bearer session, already used by the app:

- `GET /api/inbox/conversations`
- `GET /api/inbox/conversations/{leadId}/messages`
- `GET /api/inbox/quick-replies`
- `POST /api/leads/{leadId}/send-message`
- `GET /api/notifications`
- Existing estate reads, plus the write adapters for `POST/PATCH` listings, `POST` offers, and buyer-sales `action: "introduction"` and viewing schedule. Those writes run only when `EstateAcceptance.writes` contains the resource.

Not called from the phone:

- `POST /api/inbox/conversations/{leadId}/transfer-support`
- `GET /api/clients/{org}/leads/{leadId}/real-estate`

## Production reads and writes

Production reads were not re-run in this sprint. The acceptance pin above is unchanged. Production writes: none. Synthetic tests show a closed production-like repository makes zero HTTP calls for listing, offer, and introduction creation, and a synthetic acceptance sends exact decimals without `agent_id` or `approval_status`.

## Remaining security gates

`acceptedEstateReleases` still has an empty write set and a null image host. Do not add a write until there is an exact origin, the revision, contract version 1, the module capability, the actor permission, and an independent security acceptance for that operation. Financial create/update stays behind that gate. Overlap is never confirmed automatically.

## Native inbox

Compose directory and thread. No WebView and no second WhatsApp provider. Unread badges use the server `unread` count. Delivery text is shown only for `pending`, `sent`, `delivered`, `read`, and `failed`. Session closed disables the composer. Duplicate taps are blocked while a send is in flight. The draft is cleared only after `ok` and only if the field still matches the text that was sent.

Opening a thread calls the messages route. On the server that route also marks WhatsApp and new-lead notifications read. Tests use a local mock server, so they do not mark anyone's notifications.

## Recording

The existing `MediaRecorder` service, SQLite row, and playback were not rebuilt. `property_id` is written when the user picks a listing id that is not blank and does not start with `demo-`. On the emulator, the instrumented capture started, paused, saved, listed, and played a recording. No physical device was attached. Upload and transcription stay off because there is no authenticated upload contract.

## Call flow

`ACTION_DIAL` sets a pending flag. Review opens only after `ON_STOP` and a later `ON_START`. The review does not show duration or answered state. The keypad is not a text field.

## Notifications

`GET /api/notifications` fills the list for the current salesperson id. Items are hidden if the owner id does not match. Local reminders are unchanged and remain separate from this list. Copy on the screen says this is not push delivery and the phone is not registered with Firebase.

## UI defects fixed

Clipped login actions on a short window, More-menu copy that said every estate module continued on the web, oversized gated-module art on short screens, missing call actions when a phone was present, the inquiry Inbox control that opened an unavailable module, calendar rows dropped for unknown types, generic estate errors that hid a safe conflict sentence, Copilot simulated results that looked confirmed, demo recording chips that implied transcripts, and a fictional preview that could be mistaken for stock. Brand colours, logo, and existing card motion were left in place.

## Tests

- `testDebugUnitTest`: 142 tests, 0 failures. The previous audit count was 129. This sprint added coverage for copilot simulation, dial-return, compact login, phone redaction, unknown calendar types, inbox decode and failed send, notifications, More-menu presence, closed production writes, synthetic decimal writes, explicit overlap confirmation, and 5xx error copy.
- `lintDebug`: 0 errors, 55 warnings. No test or lint check was disabled to obtain the result.
- `connectedDebugAndroidTest`: 21 tests, 0 failures, emulator `SolarCare_API_30` (`emulator-5554`). Includes login, real-estate shell, estate server UI, demo workflow, forms, dialer, recorder capture, and navigation.
- `InboxCaptureTest`: 1 test, 0 failures. Synthetic directory, thread, and a 502 send that keeps the draft. It is not part of the 21.

No test was disabled. CI does not send a customer message or create an offer or viewing.

## Emulator screenshots

Pulled from the emulator Download folder into `docs/android-implementation/screenshots/final-sprint/`. These are captures of the running app or instrumented Compose, using fictional or synthetic data.

Useful frames:

- Login and short-window layout: `01-login-light-360dp.png`, `26-login-font200.png`, `32-login-keyboard.png`
- Real-estate home: `02-home-light-360dp.png`, `40-agent-home-synthetic-api.png`, `p7-13-real-estate-home-synthetic.png`
- Properties, buyer, viewing, calendar, copilot: `03-properties-light-360dp.png`, `04-property-light-360dp.png`, `06-buyer-light-360dp.png`, `09-viewing-light-360dp.png`, `08-calendar-light-360dp.png`, `14-copilot-light-360dp.png`
- Empty and error: `56-api-empty.png`, `57-api-error.png`, `31-image-failure.png`
- Dialer, review, notifications, recorder: `p7-01-dialer.png` through `p7-12-recording-playback.png`, including `p7-08-recorder-recording.png` taken while `MediaRecorder` was running
- Native inbox (synthetic mock server): `inbox-directory-synthetic.png`, `inbox-thread-synthetic.png`, `inbox-send-failure-synthetic.png`

`15-inbox-light-360dp.png` and `16-thread-light-360dp.png` are the local demo conversation UI, not the WhatsApp API screens. The fictional banner applies to demo preview screens.

## Physical device

`adb devices` showed only `emulator-5554`. No handset was attached. Lock-screen recording, a real cellular call return, and a hardware microphone check were not done.

## Journeys

- **A. Inquiry → customer → WhatsApp → follow-up.** The inquiry opens that lead's thread. Follow-up still uses the existing lead follow-up route. Stop: a live send was not made, and transfer-to-support is web-only.
- **B. Requirements → matches → property → viewing.** Read navigation works when the release pin allows it. Stop: requirement edits and viewing booking stay write-gated on the pinned revision.
- **C. Property → introduction → approval → phone.** The request form exists. Stop: introduction create and decision writes are not in `EstateAcceptance.writes`. A phone is shown only if the server included it.
- **D. Viewing → outcome → offer → transaction.** Read screens and the offer form exist. Stop: outcome, offer create, and any financial completion stay gated. No completion action was invented.
- **E. Dialer → return → outcome → note → follow-up.** The return gate and the review form are implemented and covered on the emulator. Stop: not verified against a live lead on a handset.
- **F. Recorder → save → playback → customer or property.** Emulator capture completed through playback. A listing id is stored only when an authorised listing was chosen. Stop: no upload, and no physical-device pass.

## Remaining blockers

See `external-dependencies.md`. The Android project was not published.
