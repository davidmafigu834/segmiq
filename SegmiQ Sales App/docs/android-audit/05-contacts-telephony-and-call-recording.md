# 05 — Contacts, telephony and call recording

## 1. Headline

**There is no native phone functionality.** The Dialer, Live Call and Call Review screens are a clearly labelled **simulation**:
- no call is placed;
- no Android telephony, contacts, call-log or audio API is used;
- no related permission is declared.

The app **cannot** act as the default dialer and **cannot** record calls.

Evidence: the manifest has no `<uses-permission>` and no `<service>`. A source search for `Intent`, `ACTION_DIAL`, `ACTION_CALL`, `TelecomManager`, `RoleManager`, `InCallService`, `ContactsContract`, `CallLog`, `MediaRecorder`, `AudioRecord` and `checkSelfPermission`/`requestPermission` returned **no matches**.

## 2. Contacts

| Capability | Status | Evidence |
|---|---|---|
| `READ_CONTACTS` permission | **Not implemented** (not declared) | `AndroidManifest.xml` |
| Permission request flow | **Not implemented** | Source search |
| `ContactsContract` integration | **Not implemented** | Source search |
| Device contact search | **Not implemented**. The Dialer Contacts tab says "Authorised demo CRM contacts only. Device contacts are not accessed." | `CallingScreens.kt` line 66; V `07` |
| CRM contact search | **Functional demo**: a case-insensitive substring match on name and phone over local demo customers | `CallingScreens.kt` line 67 |
| Contact merging / matching | **Not implemented** | — |
| Phone number normalisation | **Not implemented.** `validPhone` only checks the allowed characters and a digit count of 3–15 (`SalesRepository.kt` line 60). There is no E.164 normalisation and no libphonenumber | — |
| Dual-source (device + CRM) handling | **Not implemented** | — |

## 3. Dialer

| Capability | Status | Evidence |
|---|---|---|
| Dialpad | **Functional demo.** A 4×3 grid of 80 dp keys appends digits; long-press 0 inserts "+"; backspace in the field | `CallingScreens.kt` lines 45–58; V `06` |
| Telephone number entry | **Functional demo.** The field filters to `0-9 + * # ( ) -` and space. It also opens the system phone keyboard, which duplicates the keypad and hides the call button | lines 41–44; V `08b` |
| Outgoing calling | **Not implemented.** "Start simulated call" navigates to an in-app screen; no telephony intent is fired | lines 59–62 |
| Incoming calling | **Not implemented** | — |
| Call lifecycle state | **Not implemented.** No dialling, ringing, active, held or disconnected states exist | — |
| Call duration timer | **Functional demo.** Counts from `SystemClock.elapsedRealtime()`; the start time is `rememberSaveable`, so it survives rotation | lines 87, 95; V `09` → `09c` |
| Speaker | **Visual only.** Toggles a boolean | line 113; V `09b` |
| Mute | **Visual only** | line 111; V `09b` |
| Hold | **Visual only.** The label changes to "Simulated hold" | lines 107, 115 |
| In-call keypad | **Visual only.** Shows the typed digits; "no tones sent" | lines 116–121 |
| Bluetooth routing | **Not implemented** | — |
| Dual-SIM support | **Not implemented** | — |
| Call history | **Functional demo.** The Recents tab lists saved call reviews from DataStore, labelled "SIMULATED · OUTGOING · NO AUDIO". Device call history is not read | lines 70–81 |

**Number-to-customer matching bug** (`CallingScreens.kt` line 60):

```60:61:app/src/main/kotlin/com/segmiq/sales/features/CallingScreens.kt
                val matched = data.customers.firstOrNull { it.phone.filter(Char::isDigit).endsWith(number.filter(Char::isDigit)) }
                go("call/${matched?.id ?: "unknown"}?number=${android.net.Uri.encode(number)}")
```

- A **local-format** number does not match the same customer stored internationally. `0771234501` against `+263771234501` fails, because the digits `263771234501` do not end with `0771234501`. Verified: the call showed "Demo number" (V `09`).
- **Short inputs over-match.** `validPhone` accepts 3 digits, so dialling `501` would attach the call to the first customer whose number ends in 501.
- Unmatched calls are saved with `customerId = "unknown"`, so the review can never be linked to a lead.

## 4. Android Telecom

| Item | Status |
|---|---|
| `RoleManager` / `ROLE_DIALER` request | **Not implemented** |
| `InCallService` subclass and manifest declaration (`BIND_INCOMING_CALL_SERVICE`, `android.telecom.IN_CALL_SERVICE_UI` meta-data) | **Not implemented** |
| `TelecomManager` (place call, default dialer package) | **Not implemented** |
| `DIAL` / `CALL` intent filters (required to qualify as a dialer) | **Not implemented** |
| `CALL_PHONE`, `READ_PHONE_STATE`, `MANAGE_OWN_CALLS` | **Not declared** |
| Default-dialer request flow | **Not implemented** |

**Can SegmiQ act as Android's default dialer? No.** A dialer-role app needs:
- an activity handling `ACTION_DIAL` (including the `tel:` scheme);
- an `InCallService` bound with `BIND_INCOMING_CALL_SERVICE`;
- a `RoleManager.createRequestRoleIntent(ROLE_DIALER)` flow.

None of these exists. The Dialer screen itself says "Real calling and system-dialer fallback are not enabled in this build" (`CallingScreens.kt` line 63).

**Architectural note (recommendation, not implemented).** Becoming the default dialer makes SegmiQ responsible for *every* call on the phone, including emergency calls, incoming calls, dual-SIM and Bluetooth. That is a large compliance and support burden.

The lower-risk path that matches the web platform is to:
1. launch the system dialer with `ACTION_DIAL` (no permission needed);
2. detect call completion when the app resumes, or optionally use `READ_PHONE_STATE`/`READ_CALL_LOG` with clear consent;
3. present the existing Call review screen;
4. post it to the backend's `POST /api/leads/{id}/log-call` (web audit context).

The Capacitor `sales-app/` already follows this pattern with an offline call queue (web audit report 07; supplied context).

## 5. Call logging

| Capability | Status | Evidence |
|---|---|---|
| Call outcome capture | **Functional demo.** 9 hard-coded outcomes; Save requires one | `CallingScreens.kt` lines 157–164; V `10`, `11` |
| Call duration | **Functional demo.** Seconds from the simulated timer are passed via the route | `SalesApp.kt` lines 114, 117–123 |
| Linked customer | **Partial.** Linked only when the number matched (see the bug above), or when the call was started from a customer profile | — |
| Notes | **Functional demo.** Free text | line 162 |
| Follow-up creation | **Functional demo.** A "Create follow-up" row opens the follow-up form prefilled with the customer. It is not created automatically from the outcome | line 167 |
| Duplicate prevention | **Implemented and verified.** Each review uses a route-scoped UUID; `SalesViewModel.review` ignores a second save with the same id; the Save button is replaced after saving | `SalesViewModel.kt` lines 47–49; instrumented test `SimulatedCallTest` passed; V `11` |
| Local persistence | **Implemented and verified (demo).** Saved to DataStore and shown in Recents and the customer Timeline | `DemoPersistenceTest` passed |
| Remote persistence | **Not implemented.** `CallsRepository.submit(scope, review, idempotencyKey)` is declared but unimplemented | `BackendContracts.kt` line 21 |

## 6. Call recording

**The app does not record calls, and it does not claim to.**
- `RecordingSupport` and `CallRecordingCapability` are declared, and the only implementation, `DemoCallRecordingCapability`, always returns `Unsupported` (`CallingScreens.kt` lines 27–29).
- The capability is not referenced by any screen.
- Every call screen says "NO AUDIO" or "No recording exists for this simulated call" (lines 100, 125, 150, 163).
- Settings states "Call recording unavailable … No audio is captured" (`SalesApp.kt` lines 181–183).

**No misleading recording buttons were found** on the call screens. The only "record" entry points are "Record meeting" (quick actions) and the customer profile's "Meeting" button. Both open the meeting-recorder setup page, which itself says recording is not enabled. The profile button's label "Meeting" suggests scheduling, not recording (report 02).

**Feasibility (context, not tested):** ordinary third-party Android apps cannot capture both sides of a cellular call. Becoming the default dialer does not grant access to the call audio stream (`VOICE_CALL` audio source requires system privileges). Workarounds are unreliable and often violate store policy:
- speakerphone plus microphone capture;
- accessibility-service hacks.

Genuine two-sided recording normally requires one of these:
1. **VoIP calling** that SegmiQ controls (the audio passes through the app);
2. **a telephony provider** that records server-side (for example a cloud PBX);
3. **OEM or system privileges**.

None of these exists in the web platform today (web audit context). **No call recording should be promised** until one of these routes is chosen and verified on real devices.

## 7. Unverified scenarios

None of these was tested, because the underlying features do not exist:
- real outgoing or incoming calls;
- missed calls;
- dual SIM;
- emergency-number fallback;
- default-dialer role grant or removal;
- Bluetooth routing;
- DTMF;
- speaker and mute hardware control.

`QA_CHECKLIST.md` lists them as future physical-device gates.
