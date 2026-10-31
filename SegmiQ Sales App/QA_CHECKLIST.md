# Milestone 1 QA

Only mark items verified after executing them. Physical telephone and audio-capture testing belong to their implementation phases.

## Demo workflow acceptance
- Cold launch shows Welcome and clearly labelled local demo entry.
- All five bottom destinations open; Android Back returns from details.
- My Day quick-action sheet opens, closes and navigates.
- Inbox search filters fictional conversations; outgoing content saves as local drafts only.
- Customer Overview/Timeline/Notes/Deals show the selected customer.
- Creating a note from a customer keeps that customer selected.
- New lead rejects empty names and invalid phone input; valid leads survive app restart.
- Task completion changes filters and daily priorities.
- New follow-up and local meeting survive app restart; no invitation or reminder is claimed.
- Dialer handles digits, delete and long-press zero; call entry is explicitly simulated.
- Demo call controls alter UI only; ending navigates to review.
- A review saves once, appears in customer Timeline/Recents and contains no fabricated audio.
- Recorder setup explains unavailable capture and never requests microphone access.
- Recordings/Transcripts display honest empty/unavailable states.
- Pipeline stage filters and customer/deal routes work.
- Leaving demo returns to Welcome.

## Presentation
Check compact phone, larger window, dark/light themes, large font and keyboard visibility. Inspect page ends, quick-action sheet, bottom bar and call screen for system-bar overlap. Check descriptive labels and 48dp touch targets.

## Future physical-device gates
No claim of supported telephone or recording functionality until Phase 3/4 tests pass:
- Incoming/outgoing/missed calls, dual SIM, emergency system fallback, role removal.
- Mute, speaker, hold, DTMF, Bluetooth audio routing.
- Recording consent, microphone denial/revocation, notification, screen lock, interruptions, low storage, safe finalisation and playback after process restart.
- Authorised uploads, offline retries, idempotency, organisation isolation and logout/revocation cleanup.

## Integration prerequisites
Obtain approved artwork/concept image and the existing API/authentication contracts. Verify organisation membership, assignment scope, server-configured pipeline/outcomes/currency, messaging permissions and recording retention/access rules before production adapters.
