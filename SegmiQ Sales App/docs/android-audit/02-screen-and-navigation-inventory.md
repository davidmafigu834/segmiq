# 02 — Screen and navigation inventory

**Evidence key** used in the tables:
- **V** means verified on the API 30 emulator at 360×640 dp; the screenshot is in `screenshots/`.
- **C** means read from source only.

Line numbers refer to files under `app/src/main/kotlin/com/segmiq/sales/`.

## 1. Summary

- `SalesApp.kt` lines 97–188 declare **27 navigation destinations**. They render **24 distinct screen UIs**:
  - `calendar` reuses the Meetings screen;
  - `note`, `followup` and `schedule` share one form composable.
- Two overlays exist: the **quick-action bottom sheet** (`SalesApp.kt` lines 192–200) and the **end-call confirmation dialog** (`CallingScreens.kt` lines 132–135).
- An unused template screen (`ui/main/MainScreen.kt`) is not reachable from navigation.
- **All data is local demo data.** Every screen shows a lime "LOCAL DEMO · On-device data · no backend" strip under the top bar (`SalesApp.kt` lines 64–68). No screen calls a backend.

## 2. The original 10-screen concept

| # | Concept screen | Implemented as | Status | Notes |
|---|---|---|---|---|
| 1 | Welcome / Permissions | `WelcomeScreen` | **Partial** | Branding and an "Explore local demo" button only. There is no sign-in and no permission onboarding; the text says sign-in "will be connected once its API contract is available" (`WorkspaceScreens.kt` line 49) |
| 2 | My Day dashboard | `MyDayScreen` | **Functional demo** | Counts and tasks come from local data. The next-meeting card is hard-coded |
| 3 | Sales Inbox | `InboxScreen` + `ConversationScreen` | **Functional demo** | Search and the Follow-ups filter work. The "Mine" filter does nothing. "Sending" saves a local draft |
| 4 | Lead / customer profile | `CustomerScreen` | **Functional demo** | Four tabs work. Assignment and status are hard-coded |
| 5 | Smart Dialer | `DialerScreen` | **Functional demo** (simulated) | Keypad, contacts and recents work locally. No call is placed |
| 6 | Live Call | `LiveCallScreen` | **Functional demo** (simulated) | Timer works. Mute, speaker, hold and keypad only toggle UI state |
| 7 | Call review / call log | `CallReviewScreen` + Dialer "Recents" | **Functional demo** | Outcome and notes are saved once to DataStore and appear in Recents and the customer timeline |
| 8 | Meeting Recorder | `RecorderScreen` | **Visual only** | Setup form. No microphone access, no recording |
| 9 | Recording detail / transcript | `RecordingsScreen` "Transcripts" tab | **Not implemented** | No recording-detail screen exists. The Transcripts tab is an empty state |
| 10 | Deals & pipeline | `PipelineScreen` + `DealScreen` | **Functional demo** (read-only) | Stage filter works. There are no stage changes, won/lost or editing. Data comes from static fixtures, not persisted state |

**Count:** 7 of the 10 concept screens are functional demos, 1 is partial, 1 is visual only and 1 is not implemented. **None is production-ready**, because none is connected to the SegmiQ backend.

## 3. Full screen inventory

| Screen | File (lines) | Route | UI | Interaction (what actually works) | State | Data | Permissions | Backend | Status | Issues |
|---|---|---|---|---|---|---|---|---|---|---|
| Welcome | `features/WorkspaceScreens.kt` 29–57 | `welcome` (start destination, `SalesApp.kt` 97) | Complete | "Explore local demo" goes to My Day and pops Welcome (V) | Stateless | Static text | None | None | Functional demo | No login; no permission step. The app **always** cold-starts here, even after previous use (V `35`, `36`). Cold start shows a blank white window before Compose draws (V `35`) |
| My Day | `WorkspaceScreens.kt` 60–106 | `home` (bottom tab) | Complete | KPI tiles navigate (C). Task checkbox toggles completion and persists (C, unit-tested filter). "Open meeting", "Recorder setup", Copilot nudge and "View all" navigate (C). Search icon opens Leads; bell opens Notifications (C). FAB opens the quick-action sheet (V `03`, `43`) | ViewModel | Local DataStore + fixtures | None | None | Functional demo | Greeting name "Alex" is hard-coded (lines 65–67). **Next-meeting card is hard-coded** (lines 91–100), not taken from `meetings`. "New leads" counts **all** customers (line 76; V `37` shows 4 after adding one lead). "Calls to make" counts tasks whose title starts with "Call" (line 73). The FAB covers the meeting card (V `02b`) and at 130% font covers a KPI tile (V `39`) |
| Quick-action sheet | `app/SalesApp.kt` 192–200 | overlay on `home` | Complete | All 7 items navigate (V `43`): Add lead, Make call, Record meeting, Add note, Create follow-up, Schedule meeting, Create quotation | Local `rememberSaveable` | Static | None | None | Functional demo | Plain text buttons, no icons. The surface is Material's default lavender, not a SegmiQ colour (report 03). "Record meeting" opens a recorder that cannot record. "Create quotation" opens an unavailable page |
| Sales Inbox | `features/CustomerScreens.kt` 44–62 | `inbox` (bottom tab) | Complete | Search filters by name and company (C). "Follow-ups" chip filters to customers with open tasks (C). Tap opens the conversation (V `05`) | Local + ViewModel | 3 fixture messages | None | None | Functional demo | **"Mine" chip has no effect.** Only "Follow-ups" is handled (lines 52–55). The large hero headline leaves room for about one conversation above the fold at 360 dp (V `04`). Says "provider not connected" |
| Conversation | `CustomerScreens.kt` 64–84 | `conversation/{id}` | Complete | "Save draft on device" appends an outgoing message (C) | ViewModel | Local | None | None | Functional demo | There is no send. Drafts show as sent bubbles, labelled "Local draft". No attachments, voice notes or templates. The composer sits inline below the history rather than pinned to the bottom |
| Leads & customers | `CustomerScreens.kt` 20–29 | `customers` | Complete | Search by name, company and phone (C). Tap opens the profile (V `17`). "Add a local demo lead" (V `33`) | Local + ViewModel | Fixtures + added leads | None | None | Functional demo | Not paged. No status, owner or source filters. The subtitle is always "View customer and next action" |
| Customer profile | `CustomerScreens.kt` 86–139 | `customer/{id}` | Complete | Call goes to the simulated call. Message opens the conversation. Quote opens the unavailable Quotations page. **Meeting opens the Recorder** (line 96), not scheduling. Tabs Overview, Timeline, Notes and Deals all render (V `17`–`20`). "Add note" (C) | Local tab + ViewModel | Local | None | None | Functional demo | **"Assigned to Alex", "Active lead" and "Alex Demo" are hard-coded** (lines 93, 109). The Timeline always starts with a hard-coded "Sample enquiry received" (line 125). Deals come from static fixtures (line 133). An unknown id renders a blank page (`SalesApp.kt` lines 102–105). The "Deals" chip is cut off at the screen edge (V `17`) |
| Add note / Create follow-up / Schedule meeting | `CustomerScreens.kt` 141–160 (`LocalFormScreen`) | `note?customer=`, `followup?customer=`, `schedule` | Complete | Customer chips select (C). Save is disabled until the text (and the due text, when required) is filled; it then saves and shows "Saved on this device" (C) | Local + ViewModel | Local | None | None | Functional demo | The due date is **free text** ("Tomorrow · 10:00"), with no date/time picker and no reminder scheduled. Customer selection is **by name** (line 151), so duplicate names collide. The customer chip row grows without bound |
| Add lead | `CustomerScreens.kt` 161–179 | `lead` | Complete | Name required; phone validated by `validPhone`; an error is shown for invalid numbers and Save stays disabled (V `33b`). A valid lead is saved and **survives app restart** (V `33d`, `36b`) | Local + ViewModel | Local | None | None | Functional demo | No email, source or industry fields. No duplicate check. A lead with no company shows an empty line (V `36b`) |
| Dialer | `features/CallingScreens.kt` 33–83 | `dialer` (bottom tab) | Complete | Keypad digits, long-press 0 for "+", and backspace (C). Contacts tab search (V `07`). Recents lists saved reviews (C). "Start simulated call" is enabled only for a valid number (V `06b`) | Local + ViewModel | Local | None | None | Functional demo (simulated) | **No real call.** The text field opens the system keyboard on top of the app keypad (V `08b`). On a 360 dp phone the call button is below the fold (V `06`). **Number matching is unreliable** (line 60): a local number `0771234501` does not match the stored `+263771234501` (V `09` shows "Demo number"), and short inputs such as `501` would match the first customer whose number ends in 501 |
| Live Call (simulated) | `CallingScreens.kt` 86–136 | `call/{customer}?number=` (immersive: no top or bottom bar) | Complete | Timer counts from `SystemClock.elapsedRealtime()` and survives recomposition (V `09`, `09b`). Toggles change colour (V `09b`). "End simulated call" opens the review (V `10`). Back shows a confirm dialog (C) | Local `rememberSaveable` | Customer from state | None | None | Functional demo | Clearly labelled "SIMULATED CALL · NO PHONE CONNECTION". Mute, speaker, hold and keypad are **visual only**. The status bar and navigation bar stay light over the dark call screen (V `09`). The avatar shows "Dc" (from "Demo caller") while the title says "Demo number" (lines 103–104) |
| Call review | `CallingScreens.kt` 146–171 | `review/{customer}/{call}/{seconds}` | Complete | Outcome chips; notes; "Save review locally" is enabled after an outcome is chosen and **saves once** (V `11`; covered by instrumented test). Next-action rows navigate (C) | Local + ViewModel | Local | None | None | Functional demo | Saving does not complete the related task or update My Day (V `12`). Reviews for unmatched numbers are stored under customer id `"unknown"` and cannot be linked later. Nine outcomes are hard-coded (lines 157–158) instead of coming from organisation config. There is large vertical whitespace between the chip rows (V `10`) |
| Meeting recorder | `features/RecordingScreens.kt` 34–65 | `recorder?customer=` | Complete (setup form) | Title field; customer, type and participant inputs; consent checkbox; "View recording availability" shows "Recording is not enabled" (C) | Local only | None saved | **None requested** | None | **Visual only** | No start, pause, stop or waveform controls. Nothing is persisted. The consent checkbox gates nothing |
| Recordings | `RecordingScreens.kt` 67–85 | `recordings` | Complete (empty states) | Library/Transcripts toggle (V `23`, `24`). Search and type filters change only their own state | Local | None | None | None | **Visual only** | No recordings can exist. Search and filters operate on nothing |
| Pipeline | `WorkspaceScreens.kt` 169–192 | `pipeline` (bottom tab) | Complete | Stage chips filter (C). Card opens the deal (V `14`) | Local | **Static `DemoFixtures.opportunities`**; not in `DemoState`, not persisted | None | None | Functional demo (read-only) | "3 active opportunities" is a hard-coded string (line 175). Stages are hard-coded (`SalesRepository.kt` line 50). Total is formatted in USD with `Locale.US` (line 167). The "Negotiation" chip is clipped at 360 dp (V `13`) |
| Deal detail | `WorkspaceScreens.kt` 194–204 | `deal/{id}` | Complete | Customer row, Quotations and Add note navigate (C) | None | Static fixtures | None | None | Functional demo (read-only) | **Top-bar title shows "SegmiQ Sales"** because `deal/{id}` is missing from the title map (`SalesApp.kt` lines 46–50; V `14`). No stage change, value edit, won/lost or activity |
| Tasks | `WorkspaceScreens.kt` 127–137 | `tasks` | Complete | Filters Today, Upcoming, My tasks and Completed (unit-tested). Checkbox toggles completion (C). "Create follow-up" (C) | Local + ViewModel | Local | None | None | Functional demo | "My tasks" equals "all open tasks"; there is no ownership. "Today" is decided by the due **text** starting with "Today" (`SalesRepository.kt` lines 52–58), so tasks never roll over between days |
| Meetings / Calendar | `WorkspaceScreens.kt` 140–149 | `meetings`, `calendar` (same screen) | Complete | Rows open the detail (V `27`). "Schedule a local meeting" (C) | ViewModel | Local | None | None | Functional demo | "Calendar" is not a calendar; it is the same list. No date grouping and no device-calendar integration |
| Meeting detail | `WorkspaceScreens.kt` 151–165 | `meeting/{id}` | Complete | "Open recorder setup", "Add meeting notes", "Create a follow-up" (C) | None | Local | None | None | Functional demo | **Title shows "SegmiQ Sales"** (V `27`). The description text is hard-coded for every meeting (line 159). An unknown id renders blank |
| More | `app/SalesApp.kt` 134–150 | `more` (bottom tab) | Complete | 9 rows navigate (V `15`, `15b`) | — | Static | None | None | Functional demo | "Calendar" duplicates "Meetings" |
| Sales Copilot | `SalesApp.kt` 154–167 | `copilot` | Complete | "Review customer" navigates (C) | ViewModel | Open local tasks | None | None | **Functional demo** (rule-based) | Each "recommendation" is an open task restated as "Why: this action is scheduled for …". Labelled "No AI service is connected" (V `28`) |
| Quotations | `SalesApp.kt` 168 | `quotation` | Complete (empty state) | "Save requirements as a local note" (C) | — | None | None | None | **Visual only** | "Quotation service not connected" (V `29`) |
| Notifications | `SalesApp.kt` 169 | `notifications` | Complete (empty state) | — | — | None | None | None | **Visual only** | Always "You're all caught up" (V `30`) |
| Settings | `SalesApp.kt` 170–186 | `settings` | Complete | "Leave demo" returns to Welcome (V `41`) | — | Static text | None | None | Functional demo | Currency, time zone and theme are read-only text. "Leave demo" does not clear local data. There is no account, logout or permission management |
| Help | `SalesApp.kt` 187 | `help` | Complete | — | — | Static | None | None | Visual only | — |
| Template `MainScreen` | `ui/main/MainScreen.kt` | not routed | — | Its "OK" button has an empty handler (line 80) | — | — | — | — | Dead code | Delete or ignore |

## 4. Navigation system

| Aspect | Finding |
|---|---|
| Framework | Navigation Compose 2.9.0, string routes, a single `NavHost` (`SalesApp.kt` line 97) |
| Start destination | `welcome`, every time. There is no session check |
| Bottom navigation | 5 fixed tabs: My Day, Inbox, Dialer, Pipeline, More (`SalesApp.kt` lines 28–34). Tabs use `popUpTo("home") { saveState = true }`, `launchSingleTop` and `restoreState` (lines 74–79), so tab state is preserved (V) |
| Nested routes | None. A flat graph |
| Arguments | Path arguments `{id}`, `{customer}`, `{call}`, `{seconds}` (Int); optional query `?number=`, `?customer=` with defaults (lines 111, 117, 125, 151–152) |
| Deep links | **None.** No `navDeepLink` and no `VIEW` intent filters (`AndroidManifest.xml`) |
| Back-stack behaviour | Welcome is popped inclusively on entry, so **Back on My Day exits the app**. Live call → review pops the call route (line 114). The review "Back to My Day" pushes `home` with `launchSingleTop`. The Settings "Leave demo" pops the whole graph back to Welcome (line 184) |
| Transitions | Navigation Compose default crossfade; none customised. One capture (`02-myday`) showed Welcome content under the My Day top bar mid-transition. Four rapid follow-up captures did not reproduce it; treat it as a transient frame (Low) |
| Bottom sheets | 1 (quick actions) |
| Dialogs | 1 (end simulated call) |
| Quick actions | FAB on My Day only |
| Top-bar titles | Taken from a hand-written map (`SalesApp.kt` lines 46–50). `deal/{id}` and `meeting/{id}` are **missing**, so they fall back to "SegmiQ Sales" (V `14`, `27`) |
| Null routes | `customer/{id}`, `conversation/{id}`, `deal/{id}` and `meeting/{id}` render an **empty page** for unknown ids instead of a "not found" state |

## 5. Is navigation adaptive?

| Question | Answer | Evidence |
|---|---|---|
| Hard-coded? | **Yes.** The tabs, More rows and quick actions are literal lists | `SalesApp.kt` lines 28–34, 137–148, 195–196 |
| Role-aware? | **No.** There is no user or role concept at runtime | `BackendContracts.kt` declares `AuthorisedScope` but nothing uses it |
| Organisation-aware? | **No.** One fictional workspace | `Settings` text "Local demo workspace" |
| Industry-aware? | **No.** No `business_type` or `sales_workflow_preset` | Source search |
| Server-configurable? | **No.** `OrganisationConfig` (currency, time zone, stages, call outcomes) is declared but unused | `BackendContracts.kt` line 8 |

**Conclusion:** the app assumes every salesperson gets the same general-sales interface. Real estate and solar salespeople would see Pipeline, Quotations and a general dashboard that do not match their web experience.

## 6. Changes required for the three salesperson experiences (not implemented)

The web platform has three experiences: general, solar and real estate. Real estate is chosen by `clients.business_type = 'real_estate'`; solar by `clients.sales_workflow_preset = 'SOLAR_INSTALLATION'`; real estate wins if both are set. This is supplied context from the previous web audit (`../../audits/salesperson-android/`) and was not re-verified here.

1. **Session-driven start destination.** Replace the fixed `welcome` start with "restore session, then route to sign-in or home".
2. **One experience resolver** fed by the server: a bootstrap response with experience, enabled modules, stages, call outcomes, currency and time zone (report 10). No industry logic should be hard-coded on the device beyond mapping the server's value to a navigation set.
3. **Navigation as data.** Turn `mainTabs`, the More list and the quick actions into lists derived from the experience. Recommended sets are in report 09 of the web audit:
   - **General:** My Day · Inbox · Pipeline · Tasks · More.
   - **Solar:** My Day · Inbox · Solar Pipeline · Tasks · More.
   - **Real estate:** Home · Inbox · Properties · Activities · Menu.
4. **Rethink the Dialer as a bottom tab.** None of the three web experiences has a dialer destination. Calling should be an action on a lead, not a primary tab, unless the product deliberately keeps it.
5. **Type-safe routes,** so new experience-specific screens (listings, viewings, offers, site visits) cannot ship with missing titles or blank fallbacks.
6. **Experience-specific vocabulary.** For example, real estate says "Inquiries" and "My Activities" where general says "Leads" and "Tasks". Labels should come from the same configuration.
