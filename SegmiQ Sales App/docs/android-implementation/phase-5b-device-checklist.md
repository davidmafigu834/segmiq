# Phase 5B — physical-phone release checklist

Status: preparation only. Record device model, Android version, build fingerprint/APK hash, account scope, test date and tester. Emulator checks do not complete this checklist. Use isolated authorised test accounts and fictional records. Do not remove rollout gates to run a test.

| Scenario | Procedure and expected result | Result / evidence |
|---|---|---|
| Install / restore | Install latest debug APK, launch, restore authorised session or sign in. Verify organisation and server-selected experience. | Not run |
| Outgoing call | From an authorised test inquiry, open ACTION_DIAL, check number and place an agreed test call in the system phone app. | Not run |
| Return from phone app | Return after answered, cancelled and unanswered calls. Do not fabricate duration, mute/speaker state or audio in SegmiQ. | Not run |
| Bluetooth headset | Pair headset, place agreed test call through system phone app; verify audio there and normal return to SegmiQ. | Not run |
| Rotation | Rotate during buyer requirements, date/time selection, booking review and offer review. Preserve draft/selection/key, not duplicate submission. | Not run |
| Lock / unlock | Lock with a draft or pending test request; unlock. Confirm truthful pending/result state and no unintended replay. No recorder is connected. | Not run |
| Background / foreground | Switch apps during validation, selection loading, review and an authorised synthetic save. Return without duplicate writes. | Not run |
| Airplane mode | Load permitted data, go offline, submit an authorised synthetic operation if enabled. Show failure/pending truthfully. Restore connectivity; no automatic financial replay. Same unchanged booking intent keeps its key. | Not run |
| Permission changes | Revoke any actually requested optional permission in Android Settings, return, and verify unrelated screens remain usable. Current system-dialer path does not require unrestricted phone or call-log permission. | Not run |
| Session revocation | Backend operator revokes an isolated test session; refresh or submit. End session/clear protected detail and choices. No another-account data remains. | Not run |
| Account / organisation switch | Sign out and sign in to a different isolated scope. No prior buyer, listing, image, form selection or transaction appears. | Not run |
| Small keyboard | Test 360dp phone with its real IME, including suggestions and password manager. Scroll to every field, error, Cancel and review/save action. Actions stay above IME or reachable by scrolling. | Not run |
| Large text | Repeat at 150% and 200%, light/dark, portrait/landscape. Check labels, pickers, sheets, statuses and all five primary destinations. | Not run |
| TalkBack | Navigate headings, fields/errors, selected property/buyer, overlap acknowledgement, dates and actions. Confirm logical order and named 48dp+ controls; statuses are spoken, not colour-only. | Not run |
| Reduced motion | Disable system animations; repeat navigation, picker, review and success/error states. No essential interaction depends on animation. Restore original setting. | Not run |
| Restart / process loss | Kill app while idle/drafting and reopen. Secure session restores appropriately; no ambiguous write automatically repeats. Fictional preview sessions may reset; missing fictional IDs show unavailable. | Not run |
| Offer / transaction | Only with accepted synthetic environment: stale decision returns conflict; double-tap cannot duplicate a draft; accepted offer opens an actual returned transaction ID. An empty bounded lookup never creates a transaction. | Not run |
| Photos / documents | Only after private-storage acceptance: logout/revocation clears access, no JWT reaches signed storage, no private public-gallery copy. Until then verify honest unavailable states. | Not run |
| Recorder | Verify unavailable state; no fake live waveform, audio file, transcript or two-sided SIM recording claim. | Not run |

Release owner must record unresolved failures and acceptance scope. Source support, emulator pixels and bootstrap feature flags are not production deployment approval.
