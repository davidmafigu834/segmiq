# 11 — Android feature matrix

**Status vocabulary:**
- **Implemented and verified:** tested successfully.
- **Implemented but unverified:** code exists, end-to-end behaviour not tested.
- **Functional demo:** works locally with demo data.
- **Visual only:** renders, but the action is not implemented.
- **Partial:** some functionality exists; important behaviour is missing.
- **Broken:** evidence shows it fails.
- **Not implemented:** no code found.

**Evidence columns:**
- **Compiles**, **Launches** and **Renders**: verified on the API 30 emulator at 360 dp.
- **Interaction**: driven on the emulator (V) or read from code (C).
- **Backend**: no feature has a backend.
- **Device**: no physical device was used.

## 1. Platform and foundation

| Function | Status | Compiles | Launches | Renders | Interaction | Backend | Device | Notes |
|---|---|---|---|---|---|---|---|---|
| Native Kotlin/Compose app, single module | Implemented and verified | Yes | Yes | Yes | — | — | No | No WebView |
| Debug build | Implemented and verified | Yes | — | — | — | — | — | `assembleDebug` succeeded |
| Release build readiness | Partial | — | — | — | — | — | — | No signing config; minify off; `proguard-rules.pro` missing |
| Unit tests (4) | Implemented and verified | Yes | — | — | — | — | — | All passed |
| Instrumented tests (4) | Implemented and verified | Yes | Yes | Yes | V | — | No | All passed on API 30 |
| Lint | Implemented and verified | — | — | — | — | — | — | 0 errors, 20 warnings |
| Dependency injection | Not implemented | — | — | — | — | — | — | — |
| Networking | Not implemented | — | — | — | — | — | — | No `INTERNET` permission |
| Light / dark theme | Implemented and verified | Yes | Yes | Yes | V | — | No | — |
| Font scaling (130%) | Implemented and verified | Yes | Yes | Yes | V | — | No | FAB overlap at 130% |
| Landscape | Partial | Yes | Yes | Yes | V | — | No | Cramped |
| Brand assets (logo, icon, font) | Not implemented | — | — | — | — | — | — | Default robot icon |

## 2. Authentication and session

| Function | Status | Notes |
|---|---|---|
| Sign-in | Not implemented | Welcome shows "Explore local demo" only |
| MFA | Not implemented | — |
| Token storage | Not implemented | — |
| Session restore | Not implemented | Always starts at Welcome |
| Logout | Not implemented | "Leave demo" navigates only; data kept |
| Role / organisation / industry | Not implemented | Contracts declared only |
| Permission onboarding | Not implemented | No permissions declared |

## 3. Screens and features

| Function | Status | Interaction evidence | Notes |
|---|---|---|---|
| Welcome | Partial | V | No sign-in, no permissions |
| My Day KPIs + tasks | Functional demo | V | Hard-coded name and meeting card; "New leads" = all customers |
| Quick-action sheet | Functional demo | V | Off-brand surface |
| Inbox list + search | Functional demo | V / C | — |
| Inbox "Mine" filter | **Visual only** | C | No effect |
| Inbox "Follow-ups" filter | Functional demo | C | — |
| Conversation view | Functional demo | V | — |
| Send WhatsApp message | Not implemented | — | Local drafts only |
| Leads list + search | Functional demo | V | — |
| Add lead with validation | Functional demo | V | Persists across restart |
| Edit lead | Not implemented | — | — |
| Lead ownership | Visual only | V | Hard-coded "Assigned to Alex" |
| Customer profile tabs | Functional demo | V | — |
| Customer "Meeting" button | Partial | C | Opens recorder, not scheduling |
| Notes | Functional demo | C | — |
| Timeline | Partial | V | Hard-coded first entry; no timestamps |
| Tasks + filters + complete | Functional demo | C, unit-tested | Text-based dates |
| Create follow-up | Functional demo | C | Free-text due; no reminder |
| Meetings list / detail | Functional demo | V | Detail title bug |
| Schedule meeting | Functional demo | C | Free text |
| Calendar | Visual only | V | Alias of Meetings |
| Pipeline list + stage filter | Functional demo | V | Static fixtures; not persisted |
| Deal detail | Functional demo | V | Read-only; title bug |
| Stage change / won-lost | Not implemented | — | — |
| Lead → deal | Not implemented | — | — |
| Quotations | Visual only | V | Empty state |
| Sales Copilot | Functional demo | V | Local rules; no approve/dismiss |
| Notifications screen | Visual only | V | Static |
| Settings | Functional demo | V | Read-only text; "Leave demo" |
| Help | Visual only | V | Static |

## 4. Telephony and contacts

| Function | Status | Interaction evidence | Notes |
|---|---|---|---|
| Dialpad entry | Functional demo | V | System keyboard also opens |
| Start call | Functional demo (simulated) | V | No telephony |
| Real outgoing SIM call | Not implemented | — | — |
| Incoming calls | Not implemented | — | — |
| Default dialer (`ROLE_DIALER`, `InCallService`) | Not implemented | — | — |
| Call timer | Functional demo | V | — |
| Mute / speaker / hold / keypad | Visual only | V | Labelled as demo |
| Bluetooth / dual SIM | Not implemented | — | — |
| Number → customer matching | **Broken** | V | Local vs international format fails; short numbers over-match |
| Call review save (once) | Implemented and verified (demo data) | V + instrumented test | — |
| Call history (Recents) | Functional demo | C | Saved reviews only |
| Remote call logging | Not implemented | — | — |
| Device contacts | Not implemented | — | — |
| Phone normalisation | Not implemented | — | — |
| Call recording | Not implemented | — | Honestly labelled as unavailable |

## 5. Recording and AI

| Function | Status | Notes |
|---|---|---|
| Recorder setup form | Visual only | No record button |
| Microphone capture | Not implemented | No `RECORD_AUDIO` |
| Foreground recording service | Not implemented | — |
| Pause / resume / bookmark / waveform | Not implemented | — |
| Recordings library | Visual only | Empty state; search and filters inert |
| Playback / seek / speed / delete | Not implemented | — |
| Upload | Not implemented | — |
| Transcription | Not implemented (interfaces only) | No sample transcript shown |
| Insights (decisions, objections, actions) | Not implemented (models only) | — |

## 6. Data, offline and notifications

| Function | Status | Notes |
|---|---|---|
| Local persistence (DataStore JSON) | Implemented and verified (demo) | Instrumented test plus restart check |
| Room database | Not implemented | — |
| Offline cache of server data | Not implemented | — |
| Outbox / sync / retry | Not implemented | — |
| Conflict handling | Not implemented | — |
| Organisation-scoped wipe | Not implemented | — |
| Backup exclusion | Implemented but unverified | Manifest and XML rules present; backup not exercised |
| Notification permission / channels | Not implemented | — |
| Local reminders | Not implemented | — |
| FCM push | Not implemented | — |
| Deep links | Not implemented | — |

## 7. Industry experiences

| Function | Status | Notes |
|---|---|---|
| General sales experience | Functional demo | The only experience |
| Solar experience | Not implemented | — |
| Real estate experience | Not implemented | — |
| Solo mode | Not implemented | — |
| Server-driven navigation | Not implemented | — |

## 8. Code quality summary

| Area | Finding |
|---|---|
| Compiler warnings | None from a fresh forced Kotlin compile |
| Lint | 0 errors. 20 warnings, all version, catalog or `-v26` folder notices; no correctness warnings |
| Deprecated APIs | None reported by the compiler or lint |
| Architecture boundaries | Demo and contracts are cleanly separated. A single ViewModel holds the whole app state; no DI |
| Duplicate / unused code | Template `MainScreen`, `MainScreenViewModel`, `DataRepository`, `NavigationKeys` and the `Color.kt` palette are unused. Navigation 3 catalog entries and the serialization plugin are unused |
| Hard-coding | Name "Alex", the next-meeting card, assignment labels, the "3 active opportunities" text, stages, outcomes, USD |
| State handling | `StateFlow` plus `collectAsStateWithLifecycle`; `rememberSaveable` for UI state; mutex-guarded saves |
| Cancellation / lifecycle | `viewModelScope` throughout. `reload()` can start a second collector |
| Memory-leak risks | None obvious. `AndroidViewModel` holds the Application context only |
| Error handling | Explicit load and save error states. Blank pages for unknown route ids |
| Accessibility | Content descriptions on icon buttons; touch targets at or above 48 dp; TalkBack not tested |
| Logging | No `Log.*` or `println`, so nothing sensitive is logged |
| Security | No secrets; no permissions; backup disabled. Release hardening outstanding |
| Test naming | `MainScreenTest` tests `SegmiqEmptyState`; `MainScreenViewModelTest` tests `filterTasks`. Both are named after the unused template |
