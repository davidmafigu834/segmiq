# SegmiQ Sales Android — premium UI polish audit

Audit date: 2026-10-31. Brand colours in `Color.kt` match `#0C0C0C`, `#D4FF4F`, and `#F7F4EF`. Forest surfaces are `#14271E` and `#0B1D16`. The official wordmark and Q mark are the drawables used on login, the real-estate title, and Copilot rows. Typography is the system sans with tabular figures. No custom font file is bundled.

Runtime screenshots are in `docs/android-audit/screenshots/current-2026-10-31/`. They are the login flow and the local demo on emulator `emulator-5554` at 720×1184. Signed-in real-estate screens were not opened, so their visual notes are from Compose source and are marked that way.

## Login

- **Screenshot.** `01-launch.png`, `02-login-scrolled.png`, `04-validation.png`.
- **Quality.** Official wordmark, lime SALES label, and the architecture photograph with a dark scrim. Fields, eye icon, and lime button match the brand. Copy is readable.
- **Confirmed defect.** On the first viewport, “Forgot your password? Reset it on the SegmiQ website” is clipped by the system navigation bar. After a validation error the same clip remains (`04-validation.png`). “Explore local demo” exists only after scroll (`02-login-scrolled.png`).
- **Missing assets.** None for the logo. The login photograph is decorative architecture, which is appropriate here.
- **Animation.** Logo fades in over 220 ms. Not frame-timed on device.
- **Accessibility.** Email and password have content types. The eye icon has “Show password” / “Hide password”. The error line is an assertive live region. The clipped link fails as a target until scrolled.
- **Improvement.** In `AuthScreens.kt` `AuthBackdrop`, shorten the hero when the window is short: hide the architecture block once the column would exceed the safe drawing area, and pin Sign in, Forgot password, and Explore demo above the navigation bar.
- **File.** `features/auth/AuthScreens.kt`.
- **Priority.** P2.

## Splash

- **Screenshot.** Not captured. The emulator was already on login when the first shot was taken.
- **Quality.** API 31+ splash uses `segmiq_official_q_transparent` on `segmiq_window` (`values-v31/themes.xml`). That is the official Q, not a generic icon.
- **Defect.** Unverified at runtime. Pre-API 31 has no splash screen API attributes.
- **Improvement.** Capture one frame on API 31 and on API 26.
- **File.** `res/values-v31/themes.xml`, `res/drawable/ic_launcher_foreground.xml`.
- **Priority.** P3.

## Local demo My Day

- **Screenshot.** `05-demo-home.png`.
- **Quality.** Warm background, lime LOCAL DEMO chip, metric cards, and a forest next-meeting card. The demo banner is honest.
- **Confirmed defect.** On this height the next-meeting card’s title and actions sit on the next scroll. The first screen ends at the lime “NEXT MEETING · 14:00” chip. Scaffold padding is applied (`SalesApp` `Modifier.padding(padding)`), so this is density, not a view drawn under the bar. The card still promises “Let’s move the conversation forward” and then cuts the sentence at the fold.
- **Missing assets.** None.
- **Animation.** Tab transitions use `SegmiqMotion`. Not profiled.
- **Accessibility.** Search, notifications, and quick actions have content descriptions. Bottom labels are single-line at default font scale.
- **Improvement.** In `WorkspaceScreens.MyDayScreen`, move the meeting actions above the fold or shorten the metric grid on windows under 640 dp tall so Open meeting is visible without scrolling.
- **File.** `features/WorkspaceScreens.kt`.
- **Priority.** P3. This screen is the local demo, not the signed-in real-estate home.

## Local demo dialer

- **Screenshot.** `06-dialer.png`.
- **Quality.** Forest keypad, lime selected tab, disabled call button until digits exist. IME stayed closed (`mInputShown=false`).
- **Confirmed defect.** The button reads “Start simulated call”. That is correct for the demo and wrong if a user thinks they are in the live dialer. The live screen’s label is “Call with phone app” (`LiveDialerScreen`). Recents and Contacts on this demo screen are not the device call log.
- **Improvement.** Keep the DEMO CALLS ONLY chip, which is already on screen. Do not reuse this button label on the live route.
- **File.** `features/CallingScreens.kt` versus `features/live/LiveHomeScreens.kt`.
- **Priority.** P2 for anyone who can open both.

## Local demo pipeline, More, recordings

- **Screenshots.** `07-pipeline.png`, `08-more` (no extra shot after scroll), `09-recordings.png`.
- **Quality.** Pipeline states “USD demo configuration”. Recordings state “Audio capture is not connected.”
- **Defect.** Recordings still shows filter chips All / Meetings / Calls / Voice Notes on an empty library. Those chips imply categories the demo cannot record.
- **Improvement.** Hide the chips until a real recording exists, or label them as unavailable.
- **File.** `features/RecordingScreens.kt`.
- **Priority.** P3.

## Signed-in real-estate home (source only)

- **Screenshot.** None this pass.
- **Quality.** Ivory page, forest hero, lime review button, Q mark on the Copilot row, official wordmark in the top bar (`EstateBrandTitle`). The hero image is `estate_home_feature` and the caption says “Decorative architecture”.
- **Defect.** The hero spends a large block on a stock photograph before the two metrics. On a short phone the priorities start lower, same class of problem as the demo My Day.
- **Missing assets.** Real listing photos are gated, so the hero must stay decorative. Do not drop a sample house in as a listing.
- **Improvement.** In `RealEstateHome.kt` `EstateHero`, reduce the photo height when font scale is above 1.3 or the window is under 700 dp, and keep “Review inquiries” on screen.
- **File.** `features/realestate/RealEstateHome.kt`.
- **Priority.** P2 once a signed-in visual pass exists.

## Estate directories and gallery (source only)

- **Quality.** 20 dp radius cards, status chips, skeleton placeholders, empty copy that does not invent rows. Photo area is a neutral home icon and “No listing photograph available” while the image gate is closed. A loaded photo fades in over 260 ms and has a light bottom scrim (`alpha .18`), which is light enough to keep a future caption readable if text stays outside the image.
- **Defect.** `EstateServerScreen` error notices use `ErrorMapper.defaultMessage(error.kind)` and drop `error.message`. A specific forbidden or conflict sentence becomes “You don't have access to this.” or “This changed on the server.”
- **Defect.** More-menu subtitles say “Continue on SegmiQ web” for modules whose screens already exist (`LiveModule.implemented` is still false).
- **Defect.** Gated modules still show a large decorative photo (`estate_discovery_feature` and others) with a badge. The badge is honest. The photograph is taller than the explanation.
- **Improvement.** Show `error.message` when `ErrorMapper` marked it readable. Set subtitles from `EstateAccess`. Shrink the decorative feature card on gated screens.
- **Files.** `EstateServerScreens.kt`, `LiveHomeScreens.kt`, `RealEstateScreens.kt`.
- **Priority.** P2.

## Buyer and inquiry screens (source only)

- **Defect.** Buyer detail can receive `phone` and does not show it, so the profile looks unfinished next to an inquiry that shows a Call button.
- **Defect.** Inquiry “Inbox” is a real button that opens an empty unavailable module. It looks enabled.
- **Improvement.** Hide Inbox until the native inbox exists. Show a phone row only when the server sent one.
- **Files.** `EstateLiveWorkspaces.kt`, `EstateServerViewModel.kt`.
- **Priority.** P1 for the Inbox button, because it is a dead action. P1 for the missing phone, covered in the unfinished-features report.

## Calendar (source only)

- **Quality.** Week strip and today are compact. The partial-coverage label is visible.
- **Defect.** Events that are not viewings or leads disappear, so a day can look empty while the server returned rows.
- **Improvement.** Render those rows as non-clickable cards with the server title.
- **File.** `EstateServerViewModel.eventLink`.
- **Priority.** P1.

## Copilot (source only)

- **Quality.** Q mark, explanation disclosure, and “review on the website” for quotes and appointments. The identity is consistent.
- **Defect.** A successful response never surfaces `notice` or `simulated`, so the card can look fully confirmed.
- **Improvement.** Bind the success line to `WorkItemResponse.notice`.
- **File.** `LiveViewModels.kt`, `LiveTaskScreens.kt`.
- **Priority.** P1.

## Live recorder (source only)

- **Quality.** Forest workspace, lime control, consent checkbox, elapsed time from the recorder clock. The wave draws stored amplitudes and stays empty when idle. That is the correct visual.
- **Defect.** Not seen on a device. The demo recordings screen is a different, non-recording UI.
- **Improvement.** After a physical recording, check 48 bars at 120 ms ticks for dropped frames. No code change until that recording exists.
- **File.** `features/recorder/MeetingRecorderScreens.kt`.
- **Priority.** P2, blocked on device testing.

## Bottom navigation and type

- **Source.** `SegmiqBottomNavigation` grows to 112 dp at font scale 1.25 and 160 dp at 1.75. Labels allow 2 or 3 lines. Real-estate tabs are Home, Properties, Buyers, Inbox, More. “Properties” is the longest label.
- **Risk.** At the largest scale the bar consumes a large share of a short phone. Not rechecked at 1.3 or 2.0 in this pass. An older font-scale shot exists in the historical screenshot set and was not recaptured.
- **Improvement.** Re-run the real-estate shell at font scale 1.3 and 2.0 on the emulator and confirm every tab label and the last card action remain reachable.
- **File.** `core/design/Components.kt`.
- **Priority.** P2.

## Motion

`SegmiqMotion` supplies enter, exit, and press scale on dial keys. No jank was measured. Do not add more motion until the clipped login and the dead Inbox button are fixed.

## What not to polish first

Stock photography on the real-estate hero is already labelled decorative. Empty listing photos are already an honest placeholder. Changing radii or shadows will not make a gated write or a missing inbox work.
