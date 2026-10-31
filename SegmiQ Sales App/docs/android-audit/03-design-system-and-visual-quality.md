# 03 — Design system and visual quality

## 0. What this comparison is based on

**No approved SegmiQ Sales concept image was found.** I searched the Android project, its `artifacts/` folder and the whole SegmiQ workspace for concept or mockup files and found none. `IMPLEMENTATION.md` and `DELIVERY.md` also state that the concept image was never supplied to the previous build session.

**Visual parity with the concept therefore cannot be assessed and is not claimed.** This report compares the app against two other references:
1. the written SegmiQ tokens in the web repository's locked `design.md`;
2. general Material 3 and Android quality expectations.

All "V" observations come from screenshots I captured on the API 30 emulator at 360×640 dp, light and dark theme, 100% and 130% font scale, portrait and landscape. The files are in `screenshots/`.

## 1. Branding

| Item | Implementation | Assessment |
|---|---|---|
| Official logo | **None.** The Welcome screen shows the word "SegmiQ" plus a letter-spaced "SALES" in the system sans-serif (`WorkspaceScreens.kt` lines 36–37; V `01`) | Missing. The README says official artwork was not supplied |
| Launcher icon | **The default Android Studio robot on a green `#3DDC84` grid** (`res/drawable/ic_launcher_background.xml` line 8; `ic_launcher_foreground.xml`) | Must be replaced before any distribution |
| Lime accent | `Lime = #D4FF4F` (`ui/theme/Theme.kt` line 8) | **Matches** the web `--segmiq-lime` (`design.md` line 20) |
| Ink | `#0C0F0E` (`Theme.kt` line 9) | Close to the web's near-black `#0C0C0C` (`design.md` line 17) but not identical |
| Surfaces | Light: background `WarmWhite #F7F7F2`, surface white. Dark: background Ink, surface `Forest #151B18` (`Theme.kt` lines 14–40) | Coherent warm-neutral palette. Dark theme renders correctly (V `38`, `38b`) |
| **Use of lime** | Lime fills avatars, the selected chip, the navigation indicator, labels, the FAB, primary buttons, the four profile action circles and active call toggles (`Theme.kt` line 16 sets `primaryContainer = Lime`; `Components.kt` lines 30, 34, 42) | **Conflicts with `design.md`**: "Lime is for the primary create action and the current milestone mark. It is not a surface colour." On most screens lime appears 5–10 times (V `17`, `07`), which removes its meaning as the primary-action signal |
| Typography | `FontFamily.SansSerif` (Roboto on device) for every style (`ui/theme/Type.kt` lines 10–17) | **Does not match** the web's Geist (display, weight 600) and Inter (body). The README instead refers to a licensed "Manrope" font that is not present. The brand font decision is unresolved |
| Icons | Material Rounded and AutoMirrored icons (`material-icons-extended`) | Consistent family. Fine |
| Avatars | Initials on a lime 48 dp circle; no photos (`Components.kt` lines 33–39) | Clean. Two-letter initials are derived by splitting on spaces, so "Demo caller" shows "Dc" with a lowercase c (V `09`) |
| Spacing | 20 dp page padding, 16 dp vertical rhythm (`SalesApp.kt` line 206) | Consistent |
| Corner radii | Cards 22 dp, customer rows 20 dp, metric tiles 20 dp, action rows 18 dp, buttons 16 dp, labels 8 dp, some text fields 16 dp, others the M3 default (`Components.kt`; feature files) | Slightly inconsistent (six radii in use). A 3-step radius scale would be cleaner |
| Elevation | Flat. `surfaceTint` is transparent; cards are white on warm white with no shadow | Deliberate and clean. Card separation relies on the light background contrast |
| Buttons | Primary: lime fill, near-black SemiBold label, min height 52 dp, 16 dp radius (`Components.kt` lines 28–31). Secondary: `TextButton` and `OutlinedButton` | Matches the web CTA voice ("lime fill, near-black label"). Targets exceed 48 dp |

### 1.1 Theme defects

- **Off-brand lavender surfaces.** The colour schemes do not define the Material 3 `surfaceContainer*` roles (`Theme.kt` lines 14–40). Components that use them fall back to Material's baseline purple-tinted colours. Verified on the quick-action bottom sheet (V `03`, `43`). By the same mechanism this also applies to `AlertDialog`, which was not captured.
- **Cold-start white flash.** The window theme is `android:Theme.Material.Light.NoActionBar` (`res/values/themes.xml` line 4) and there is no SplashScreen API. On cold start the window is plain white until Compose draws (V `35`). That includes dark-mode users.
- **Live-call system bars.** The call screen forces a dark theme (`CallingScreens.kt` line 97), but the status bar and navigation bar stay light (V `09`). The edge-to-edge system-bar appearance is not switched with the screen.
- **Unused template palette.** `ui/theme/Color.kt` keeps a Material Theme Builder blue palette (lines 21–35 active, the rest commented out). It is not used, but it is confusing.

## 2. Component quality

| Component | Where | Quality | Issues |
|---|---|---|---|
| Dashboard metric cards | `WorkspaceScreens.kt` 75–90 | Good: a 2×2 grid, large numerals, arrow affordance, the whole card tappable (V `02b`) | "New leads" shows the total customer count. No trend, no target. At 130% font the FAB covers the bottom-right tile (V `39`) |
| Customer cards | `CustomerScreens.kt` 31–42 | Good: avatar, name, company, subtitle, 20 dp radius | Subtitle is generic. No status, owner or last-contact time. A blank company leaves an empty line (V `36b`) |
| Search fields | `Components.kt` 75–77 | Adequate: `OutlinedTextField` with a floating label | No leading search icon or clear button. They look like form fields, not search bars |
| Filter chips | `Components.kt` 79–83 | M3 `FilterChip` in a `LazyRow` | The last chip is clipped at the edge with no fade or affordance (V `13`, `17`, `25`). The "Mine" inbox chip does nothing |
| Bottom navigation | `SalesApp.kt` 71–83 | M3 `NavigationBar`, lime pill indicator, labels always visible (V) | Five tabs including Dialer; see report 02 §6 |
| Sheets and dialogs | `SalesApp.kt` 192–200; `CallingScreens.kt` 132–135 | Functional | Sheet: text-only list with no icons and a lavender surface. Dialog: default M3 styling (not captured) |
| Input forms | `CustomerScreens.kt` 141–179 | Inline validation on phone (V `33b`). Save disabled until valid | **Dates and times are free text**, with no pickers. Customer choice is a horizontal chip list that will not scale beyond a handful of customers |
| Call controls | `CallingScreens.kt` 110–115, 138–144 | 56 dp tonal toggle buttons with labels. Selected state is visible (V `09b`) | All visual only. Hold sits alone on its own row, which is visually unbalanced |
| Audio waveforms | — | **Not implemented** | — |
| Recording controls | — | **Not implemented.** The recorder screen has no record button (V `21`) | — |
| Timeline | `CustomerScreens.kt` 124–131 | Plain stacked cards | No timestamps, icons or chronological ordering; the first entry is hard-coded |
| Sales Copilot cards | `SalesApp.kt` 154–167 | Card with title, "Why: …" and a text button (V `28`) | Content is restated task text. No priority, confidence or approve/dismiss actions |
| Empty states | `Components.kt` 67–73 | Honest, well-written copy, consistently styled | No icons. Fine for now |
| Loading states | `SalesApp.kt` 89–90 | One full-screen spinner while DataStore loads | No skeletons, pull-to-refresh or per-section loading. Not needed offline, but required once networking exists |
| "LOCAL DEMO" strip | `SalesApp.kt` 64–68 | Clear honesty marker on every non-immersive screen | Costs about 28 dp of vertical space everywhere and wraps to two lines at 130% font (V `39`) |
| Hero headlines | Inbox "Good conversations. Better relationships.", Tasks "Make room for what matters.", Copilot, Welcome | Marketing tone | On a 360×640 dp screen they push working content below the fold. Inbox shows about one conversation without scrolling (V `04`). This conflicts with the web design rule "Workbench. One primary fact, then the next action, then the record" (`design.md` line 10) |

## 3. Responsiveness

| Condition | Result | Evidence |
|---|---|---|
| Small phone, 360×640 dp | Everything renders and scrolls, but:<br>• the FAB overlaps the next-meeting card;<br>• the Dialer call button is below the fold;<br>• Inbox shows one conversation;<br>• chip rows clip | V `02b`, `06`, `04`, `13` |
| Standard and large phones (393 / 412 dp) | **Not tested.** Only the 360 dp emulator profile was available in this session | — |
| Very wide screens and tablets | `Page` caps content width at 680 dp and centres it (`SalesApp.kt` line 206) | C only |
| Font scale 130% | Text wraps correctly with no clipping in the screens checked. The demo strip wraps to two lines; the FAB overlaps a KPI tile; bottom-nav labels still fit | V `39`, `39b`, `39c` |
| Font scale above 130% | Not tested | — |
| Display scaling | The emulator's density override (320 instead of the physical 420) is effectively a "display size larger" setting. Layouts held | V (all captures) |
| Portrait | Primary orientation; works | V |
| Landscape | Not locked, so it rotates. The top bar, demo strip and bottom nav leave only about 150 dp for content. Usable but cramped; there is no landscape layout | V `40`, `40b` |
| System navigation modes | Three-button navigation tested. Gesture navigation **not tested** | V |
| Keyboard | `adjustResize` plus `safeDrawing` insets. Fields scroll into view. The Dialer number field raises the **system keyboard on top of the custom keypad**, hiding the call button | V `08b`, `33b` |
| Dark theme | Renders correctly with the Forest/Ink palette | V `38`, `38b` |

## 4. Visual defects found

| # | Defect | Severity | Evidence |
|---|---|---|---|
| 1 | Default Android robot launcher icon | High (brand) | `res/drawable/ic_launcher_*.xml` |
| 2 | No logo; system font instead of the brand font | High (brand) | `Type.kt`; V `01` |
| 3 | Lime used as a surface colour throughout, against `design.md` | Medium | V `07`, `17` |
| 4 | Lavender (Material baseline) bottom-sheet surface | Medium | V `43` |
| 5 | FAB overlaps the next-meeting card, and a KPI tile at larger fonts | Medium | V `02b`, `39` |
| 6 | Dialer call button below the fold at 360 dp; system keyboard duplicates the keypad | Medium | V `06`, `08b` |
| 7 | Deal and meeting detail titles read "SegmiQ Sales" | Medium | V `14`, `27` |
| 8 | Light system bars on the dark live-call screen | Low | V `09` |
| 9 | White flash on cold start | Low | V `35` |
| 10 | Clipped last chip in horizontal chip rows with no affordance | Low | V `13`, `17`, `25` |
| 11 | Excessive vertical gaps between outcome chip rows on Call review | Low | V `10` |
| 12 | Hero headlines push content below the fold on small phones | Low | V `04`, `25` |
| 13 | Empty line for a lead without a company | Low | V `36b` |
| 14 | "Dc" avatar initials for an unknown caller | Low | V `09` |
| 15 | Transient frame of Welcome content under the My Day bar, seen once | Low (not reproduced) | V `02-myday` |

## 5. Accessibility (code review plus visual check; TalkBack not tested)

- Icon-only buttons have content descriptions: Back, Search customers, Notifications, Quick actions, Delete last digit, and the bottom-tab labels (`SalesApp.kt` lines 57, 60–61, 80, 86; `CallingScreens.kt` line 44).
- Touch targets meet 48 dp: primary buttons are 52 dp, call toggles 56 dp, keypad keys 80 dp, quick-action rows 48 dp.
- Contrast: Ink on lime and the light `onSurfaceVariant #58635A` on white both look comfortably readable. No contrast tool was run.
- Decorative icons are correctly `contentDescription = null` (`Components.kt` lines 58, 63).
- Not verified: TalkBack reading order, merged semantics on cards, switch access, and announcement of the call timer.
