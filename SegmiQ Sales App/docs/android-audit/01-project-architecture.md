# 01 — Project architecture

**Audit type:** read-only. No source, Gradle, manifest, permission or backend file was changed. The only files created are the reports in `docs/android-audit/` and the screenshots in `docs/android-audit/screenshots/`.
**Audit date:** 30 October 2026.
**Project root:** `SegmiQ Sales App/` (sibling of the SegmiQ web repository in the same workspace).

## Evidence levels used in every report

| Level | Meaning | Achieved in this audit |
|---|---|---|
| Compiles | Gradle compiled the current sources | **Yes.** A fresh forced `:app:compileDebugKotlin --rerun` succeeded with no Kotlin compiler warnings, and `:app:assembleDebug` produced `app-debug.apk` |
| Launches | The APK starts on an Android runtime | **Yes**, on the `SolarCare_API_30` emulator (Android 11, 720×1280 px at 320 dpi, which is 360×640 dp) |
| UI renders | Screens draw correctly | **Yes**, 70 screenshots in `screenshots/` |
| Interaction works | Buttons perform their advertised action | **Yes for the flows listed in report 02**, driven by `adb` input on the emulator |
| Backend request succeeds | A real SegmiQ API call returns data | **Not applicable.** The app contains no network code |
| Real device verified | Tested on a physical phone | **No.** No physical device was connected |

## 1. Identity and toolchain

| Item | Value | Source |
|---|---|---|
| Application ID | `com.segmiq.sales` | `app/build.gradle.kts` line 11 |
| Kotlin package / namespace | `com.segmiq.sales` | `app/build.gradle.kts` line 8 |
| Version | `versionCode 1`, `versionName "1.0"` | `app/build.gradle.kts` lines 15–16 |
| Kotlin | 2.3.20 (Compose compiler plugin uses the same version) | `gradle/libs.versions.toml` line 13 |
| Jetpack Compose | BOM `2026.03.01`; individual artifact versions are resolved by the BOM and were not separately inspected | `libs.versions.toml` line 6 |
| Material 3 | `androidx.compose.material3:material3`, version from the BOM | `libs.versions.toml` line 21 |
| Android Gradle Plugin | 9.0.1 | `libs.versions.toml` line 2 |
| Gradle | 9.1.0 | `gradle/wrapper/gradle-wrapper.properties` line 3 |
| minSdk / targetSdk / compileSdk | 26 / 36 / 36 | `app/build.gradle.kts` lines 9, 12, 13 |
| Java / JVM target | 17 / 17 | `app/build.gradle.kts` lines 26–27, 45 |
| Build JDK used in this audit | Android Studio bundled JBR | — |

## 2. Libraries actually used

| Concern | Implementation | Evidence |
|---|---|---|
| Architecture pattern | One `AndroidViewModel` with a `StateFlow<SalesUiState>` holding the whole demo dataset. Every screen receives the full `DemoState` and lambdas. There are no feature ViewModels, use cases or domain layer | `app/SalesViewModel.kt` lines 15–51 |
| Dependency injection | **None.** The ViewModel constructs `LocalDemoRepository(application)` directly | `SalesViewModel.kt` line 17 |
| Navigation | `androidx.navigation:navigation-compose:2.9.0` with string routes. Navigation 3 is declared in the version catalog but **not used** | `app/build.gradle.kts` line 84; `libs.versions.toml` lines 14, 36–38 |
| Networking | **None.** No HTTP client and no `INTERNET` permission | `AndroidManifest.xml` (no `<uses-permission>`); repository-wide search found no Retrofit, OkHttp, Ktor or `HttpURLConnection` |
| Local database | **None.** No Room. Demo data is serialised to a single JSON string in Preferences DataStore | `core/data/SalesRepository.kt` lines 67–73 |
| Preferences | `androidx.datastore:datastore-preferences:1.1.7`, store name `segmiq_demo_v1` | `build.gradle.kts` line 85; `SalesRepository.kt` line 67 |
| State management | `MutableStateFlow` in the ViewModel and `rememberSaveable` for per-screen UI state (search text, selected chip, form fields) | `SalesViewModel.kt` line 18; feature files |
| Background work | **None.** No WorkManager, services, broadcast receivers or alarms | Manifest; source search |
| Audio recording | **None.** No `MediaRecorder` or `AudioRecord` | Source search |
| Telephony | **None.** No `TelecomManager`, `RoleManager`, `InCallService` or dial intents | Source search |
| Icons | `material-icons-extended`, version from the BOM | `build.gradle.kts` line 86 |
| Serialization | The Kotlin serialization **plugin** is applied, but no `kotlinx-serialization` runtime dependency exists and the code uses `org.json` instead. The plugin is unused | `build.gradle.kts` line 4; `SalesRepository.kt` lines 9–10 |

## 3. Directory structure (source only; `build/`, `.gradle/`, `.idea/` and `.kotlin/` excluded)

```
SegmiQ Sales App/
├── build.gradle.kts, settings.gradle.kts, gradle.properties, gradlew(.bat)
├── gradle/libs.versions.toml, gradle/wrapper/
├── local.properties                  (SDK path only; git-ignored)
├── README.md, IMPLEMENTATION.md, DELIVERY.md, QA_CHECKLIST.md
├── artifacts/                        (3 earlier emulator captures + README)
└── app/
    ├── build.gradle.kts
    └── src/
        ├── main/
        │   ├── AndroidManifest.xml
        │   ├── kotlin/com/segmiq/sales/
        │   │   ├── MainActivity.kt              entry point, edge-to-edge, theme
        │   │   ├── Navigation.kt                MainNavigation() → SalesApp()
        │   │   ├── NavigationKeys.kt            unused template object `Main`
        │   │   ├── app/SalesApp.kt              Scaffold, NavHost (27 routes), quick-action sheet, inline screens
        │   │   ├── app/SalesViewModel.kt        single ViewModel, local mutations
        │   │   ├── core/data/SalesRepository.kt models, fixtures, DataStore repository
        │   │   ├── core/data/BackendContracts.kt  interfaces only, no implementations
        │   │   ├── core/design/Components.kt    shared composables
        │   │   ├── features/WorkspaceScreens.kt Welcome, My Day, Tasks, Meetings, Pipeline, Deal
        │   │   ├── features/CustomerScreens.kt  Customers, Inbox, Conversation, Customer, forms, Add lead
        │   │   ├── features/CallingScreens.kt   Dialer, simulated Live Call, Call Review
        │   │   ├── features/RecordingScreens.kt Recorder setup, Recordings, transcript models
        │   │   ├── data/DataRepository.kt       unused template
        │   │   ├── ui/main/MainScreen*.kt       unused template screen + ViewModel
        │   │   └── ui/theme/                    Color.kt (unused template palette), Theme.kt, Type.kt
        │   └── res/  launcher icons (default Android template), strings, theme, backup rules
        ├── test/        2 classes, 4 unit tests
        └── androidTest/ 4 classes, 4 instrumented tests
```

There are 1,776 lines of Kotlin in total: 1,645 in `main` (of which 275 are the mostly commented-out template `Color.kt`) and 131 in tests. The largest real files are `WorkspaceScreens.kt` (212 lines), `SalesApp.kt` (209), `CustomerScreens.kt` (179) and `CallingScreens.kt` (171).

## 4. Modules

| Module | Purpose |
|---|---|
| `:app` | The only module: UI, data, theme and tests |

There are no `core`, `feature` or `data` Gradle modules. The `core/` and `features/` folders are packages inside `:app`.

## 5. Native or WebView?

**Genuinely native Kotlin with Jetpack Compose.** A search of `app/src` found no `WebView`, no Capacitor and no embedded HTML. This app is unrelated to the existing Capacitor `sales-app/` in the web repository (see report 09).

## 6. Architecture assessment

**What is good and should be kept**
- Compose-only UI with Material 3, edge-to-edge, `safeDrawing` insets and `adjustResize` (`SalesApp.kt` line 53; `AndroidManifest.xml` line 16).
- `StateFlow` with `collectAsStateWithLifecycle`, and a mutex-serialised save path with explicit error states (`SalesViewModel.kt` lines 28–41).
- A clear, honest separation between demo code and future production contracts. `BackendContracts.kt` declares `AuthRepository`, `LeadsRepository`, `CallsRepository` (with an idempotency key), `RecordingsRepository`, `CopilotRepository` and others. None has an implementation.
- Backup and device transfer are explicitly excluded for all data domains (`res/xml/backup_rules.xml`, `data_extraction_rules.xml`; `allowBackup="false"`).

**What will not scale to production**
- **One ViewModel and one in-memory `DemoState` for the entire app.** Production data (hundreds of leads, paged conversations, per-screen loading and errors) needs per-feature ViewModels and repositories.
- **Whole-state JSON persistence.** Every mutation rewrites one JSON string (`SalesRepository.kt` lines 71–73, 74–93). That is acceptable for a demo but not for caches, outboxes or recordings.
- **No dependency injection.** Swapping `LocalDemoRepository` for network repositories means editing the ViewModel. Hilt or a manual container is needed before integration.
- **String routes built by concatenation** (for example `"call/${id}?number=..."`) with screen titles in a separate map. Two routes are already missing titles (report 02). Type-safe routes would prevent this.
- **Dead template code:** `ui/main/MainScreen.kt`, `MainScreenViewModel.kt`, `data/DataRepository.kt`, `NavigationKeys.kt` and the unused template palette in `ui/theme/Color.kt` lines 21–35. Two tests are named after the template but test other things (report 11, code quality section).
- `release` references `proguard-rules.pro`, which does not exist. This is harmless today because `isMinifyEnabled = false`, but it will fail once minification is turned on (`app/build.gradle.kts` lines 20–23).

## 7. Build and test results (run in this audit)

| Command | Result |
|---|---|
| `gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug --offline` | **BUILD SUCCESSFUL** |
| `gradlew :app:compileDebugKotlin --rerun --offline` | **BUILD SUCCESSFUL**, no Kotlin compiler warnings printed |
| Unit tests (`testDebugUnitTest`) | **4 passed, 0 failed** (`SalesRulesTest` ×2, `MainScreenViewModelTest` ×2) |
| Lint (`lintDebug`) | **0 errors, 20 warnings**: dependency or toolchain versions (16), `UseTomlInstead` (3), `ObsoleteSdkInt` (1) |
| Instrumented tests (`connectedDebugAndroidTest` on the API 30 emulator) | **4 passed, 0 failed** |

The first build attempt failed only because the tool sandbox pointed Gradle at an empty cache while running `--offline` (`foojay-resolver-convention` plugin not found). Re-running with the normal user Gradle home succeeded. This is an environment issue, not a project defect.

The existing `DELIVERY.md` reports the same 4 + 4 tests and the same lint totals from the previous session. This audit reproduced those results independently.
