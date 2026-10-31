# SegmiQ Sales — milestone 1 delivery

## Scope delivered
Phase 1 native foundation and the visual foundation of Phase 2. All ten requested destinations exist: Welcome, My Day, Sales Inbox, Customer Profile, Smart Dialer, simulated Live Call, Call Review, Meeting Recorder setup, Recordings/Transcripts and Pipeline.

Additional routes cover customer search, deal details, Tasks, Meetings, local meeting scheduling, Calendar agenda, Sales Copilot recommendations, local notes/follow-ups/leads, Quotations availability, Notifications, Settings and Help. Five primary tabs and the home quick-action bottom sheet are wired.

The interface uses the supplied warm-white/dark/lime tokens, reusable cards/buttons/chips/avatars/search/empty states, readable type, compact metric cards, system/keyboard insets and light/dark system themes. The welcome action stays visible on the compact emulator.

## Working local actions
- Search customers and conversations; filter pipeline stages and tasks.
- Create demo leads with name/phone validation.
- Save customer-linked typed notes and message drafts.
- Create and complete local follow-ups.
- Create local meeting plans; open the selected meeting/customer.
- Exercise a clearly simulated call, keypad/hold/mute/speaker UI and timer.
- Save a call review once using its stable call ID; view it in Recents and the customer timeline.
- Navigate recorder setup and honest recording/transcript empty states.

Demo mutations persist in app-private DataStore. The repository exposes Flow and the ViewModel exposes StateFlow. Explicit storage failures are presented without silently resetting data. Demo repositories are isolated from the unimplemented production contracts, and this APK requests no network or dangerous permissions.

## Important files
- app/build.gradle.kts; gradle/libs.versions.toml; settings.gradle.kts — build foundation.
- app/src/main/AndroidManifest.xml; app/src/main/res/xml/backup_rules.xml; app/src/main/res/xml/data_extraction_rules.xml — entry point, keyboard behavior and explicit backup/transfer exclusions.
- app/src/main/kotlin/com/segmiq/sales/app/SalesApp.kt — scaffold, primary/detail routes and quick actions.
- app/src/main/kotlin/com/segmiq/sales/app/SalesViewModel.kt — local state and mutations.
- app/src/main/kotlin/com/segmiq/sales/core/data/SalesRepository.kt — fictional fixtures and persistent demo implementation.
- app/src/main/kotlin/com/segmiq/sales/core/data/BackendContracts.kt — authentication, organisation and feature integration boundaries.
- app/src/main/kotlin/com/segmiq/sales/core/design/Components.kt — shared UI.
- app/src/main/kotlin/com/segmiq/sales/features/WorkspaceScreens.kt — Welcome, My Day, Tasks, Meetings and Pipeline.
- app/src/main/kotlin/com/segmiq/sales/features/CustomerScreens.kt — Inbox, customer context and local forms.
- app/src/main/kotlin/com/segmiq/sales/features/CallingScreens.kt — simulated dialer/call/review and recording-capability boundary.
- app/src/main/kotlin/com/segmiq/sales/features/RecordingScreens.kt — recorder setup, library and future transcript contracts.
- app/src/main/kotlin/com/segmiq/sales/ui/theme/ — colours and typography.
- app/src/test/ and app/src/androidTest/ — verification sources.
- README.md; IMPLEMENTATION.md; QA_CHECKLIST.md; artifacts/ — setup, scope and captures.

## Build and verification results
- Debug APK: PASS. Final assembleDebug and testDebugUnitTest run completed successfully.
- Unit tests: 4 passed, 0 failures. Task-filter boundaries/empty states and local/international phone-input validation.
- API 30 / Android 11 emulator tests: 4 passed, 0 failures, 0 skipped. Primary navigation; persistence across repository instances; explicit simulated-call review with post-save control removal; honest recording empty state. Repeated successfully after the pinned welcome action and backup changes.
- lintDebug: PASS, 0 errors. 20 nonblocking warnings remain for newer SDK/dependency/tool versions, generated launcher resource qualifiers and catalog style. The backup-rule warnings were resolved.
- Final metric-density and secondary-palette adjustments were rebuilt after the emulator/lint run. The density adjustment was also unit-tested; the final palette was manually checked in the inbox.
- App deployed and launched on the API 30 emulator; compact welcome/dashboard inspected. Captures are in artifacts/.
- Compose preview functions are provided. IDE preview rendering could not find the preview while this initially empty folder remained unlinked to Gradle; use the import step below.
- API 37 emulator verification was attempted but it remained offline; its log recommended more RAM than available. No API 37 or physical-phone passing result is claimed.
- The emulator briefly displayed a com.android.systemui nonresponding dialog during manual inspection. It was dismissed; instrumented tests completed successfully. This is not a physical-device performance certification.

Results: app/build/test-results/testDebugUnitTest/; app/build/outputs/androidTest-results/connected/debug/; app/build/reports/lint-results-debug.html.

## Android Studio import
This folder was open as an empty, non-Gradle IDE project before generation. If no app module/run configuration appears, use File > Open on the project root or settings.gradle.kts and import it as a Gradle project, then sync. Select Android Studio's bundled JDK as Gradle JDK and run the app module. XML inspection warnings from the unlinked IDE project are separate from the successful Gradle/AAPT/lint checks.

Validated toolchain: AGP 9.0.1, Gradle 9.1.0, Kotlin/Compose compiler 2.3.20, Compose BOM 2026.03.01, compile/target SDK 36, min SDK 26; Java/Kotlin bytecode target 17. The shell used Android Studio's bundled JBR 25, without downloading a separate Java toolchain.

APK: app/build/outputs/apk/debug/app-debug.apk.

## Not connected or operational
No backend API contracts, Supabase configuration, authentication code, official brand artwork or approved concept image existed in the supplied repository. No production URLs, schemas, secrets, users or writes were invented.

Authentication is an availability shell; no real sign-in or organisation membership validation is claimed. Messages remain local drafts. Pipeline fixtures and USD currency are demo configuration. Quotations, invitations, reminders, remote notifications, AI, transcripts, upload and synchronisation are unavailable. Copilot displays labelled local rule-based recommendations.

Calls are simulations and never invoke Telecom or place a phone connection. Device contacts/call logs, default-dialer role, incoming-call handling, Bluetooth and real call controls are Phase 3 work. There is no call recording.

Recorder setup does not access the microphone, start a service, create audio or fabricate recording metadata. Real capture, Room metadata, private audio storage, interruptions, bookmarks, playback, deletion, secure upload and transcription adapters remain Phase 4/later work.

Demo DataStore persistence is not the production offline-first implementation. Room organisation-scoped caches, an idempotent outbox, server version/conflict handling, revoked-access/account-switch cleanup, Keystore-backed sessions and organisation isolation tests must be implemented with verified backend contracts.

## Next steps
1. Import/sync the generated Gradle project in the currently open IDE.
2. Supply official logo/font assets and the approved concept image for visual comparison.
3. Inspect the actual SegmiQ authentication/API contracts and organisation/assignment rules, then add scoped production adapters and integration tests.
4. Implement Phase 3 telephony with system fallback and real-phone validation.
5. Implement Phase 4 genuine meeting recording and Room metadata; execute the physical-device interruption/permission/storage/playback matrix in QA_CHECKLIST.md.
6. Complete the large-text, dark-theme, larger-window, offline-conflict and physical-device acceptance matrix before production release.
