# SegmiQ Sales — native Android

Milestone 1: Phase 1 foundation and the visual foundation of Phase 2. Native Kotlin / Jetpack Compose; no WebView.

## Run
Open this folder in Android Studio, allow Gradle sync, select the app configuration and run. Use Android Studio's bundled JDK. Minimum Android 8 (API 26), compile/target SDK 36.

For PowerShell if Java is not on PATH:

```powershell
$env:JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest --console=plain
.\gradlew.bat :app:connectedDebugAndroidTest --console=plain
```

The JDK location is machine-specific; adjust it to your Android Studio installation.

## Implemented
- Welcome, My Day, Inbox, Customer Profile, Dialer, simulated Live Call, Call Review, Recorder setup, Recordings/Transcripts and Pipeline.
- Five bottom destinations, detail back navigation, quick-action bottom sheet, Tasks, Meetings, local meeting scheduling, Copilot recommendations, Settings and Help.
- SegmiQ palette, light/dark themes, reusable components, system/IME insets, accessible touch targets and Compose previews.
- Search and filters; customer-linked notes, local message drafts, new demo leads, follow-ups, task completion, local meetings and duplicate-safe call review saves.
- App-private DataStore persistence for the isolated demo workspace; explicit load/save errors and no false delivery or upload claims.
- Integration interfaces for existing backend services. No endpoints, tables, credentials or live organisation identity are invented.

## Honest limitations
All customer and opportunity fixtures are fictional and marked LOCAL DEMO. No production authentication or networking adapter is installed. Sending messages, quotations, remote notifications, live pipeline configuration, upload and AI transcription are unavailable.

Calls are explicitly simulated. Mute, speaker, hold and keypad alter demo UI only. They neither place telephone calls nor control hardware. No phone, call-log, contacts or microphone permission is requested.

Recorder setup does not start capture or create an audio file. Real foreground recording, Room recording metadata, playback, interruption recovery and private upload are Phase 4 work. The library is empty until genuine recording support exists.

Structured production caches must move to Room with organisation scopes, revocation/logout cleanup, idempotent outbox sync and server conflict checks. Demo DataStore persistence is not a production offline-sync implementation. The app currently requests no network permission and cannot write to production.

No approved concept image, official logo artwork, licensed Manrope font, backend API/schema or authentication configuration was present. The supplied written design tokens guide this build; the text product title and generated launcher assets are temporary pending official artwork.

## Key files
- app/src/main/kotlin/com/segmiq/sales/app/SalesApp.kt — navigation, app scaffold and quick actions
- app/src/main/kotlin/com/segmiq/sales/app/SalesViewModel.kt — demo state and local mutations
- app/src/main/kotlin/com/segmiq/sales/core/data/SalesRepository.kt — fictional fixtures and persistence
- app/src/main/kotlin/com/segmiq/sales/core/data/BackendContracts.kt — integration boundaries
- app/src/main/kotlin/com/segmiq/sales/core/design/Components.kt — reusable UI
- app/src/main/kotlin/com/segmiq/sales/features/ — screen implementations
- app/src/main/kotlin/com/segmiq/sales/ui/theme/ — design tokens and typography

## Verification
Automated source tests cover task filtering and phone input. Instrumented tests cover primary navigation, truthful recording empty states and local persistence across repository instances. See DELIVERY.md for results from this session.

Real-phone calling/default-role and microphone tests have not been performed, because these platform integrations are not implemented at this milestone.

## Next
Supply official brand assets and the approved concept image for visual comparison. Verify existing authentication, organisation membership, assignment rules and API contracts before production adapters. Implement and physically test telephony in Phase 3, then actual meeting audio capture and playback in Phase 4.
