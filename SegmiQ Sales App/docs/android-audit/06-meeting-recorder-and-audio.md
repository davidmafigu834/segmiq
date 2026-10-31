# 06 — Meeting recorder, recordings library and audio

## 1. Headline

**Meeting recording is not implemented.** The "Meeting recorder" screen is a setup form with no record button. The app:
- does not declare `RECORD_AUDIO`;
- never touches the microphone;
- has no foreground service;
- creates no audio file and no recording metadata.

The Recordings library and Transcripts tab are honest empty states. Transcription exists only as Kotlin interfaces and data classes with no implementation.

Evidence: `AndroidManifest.xml` declares no permissions or services. A source search for `MediaRecorder`, `AudioRecord`, `MediaPlayer`, `ExoPlayer` and `Service` usage returned **no matches**. The screen text says "RECORDER PREVIEW · NO AUDIO CAPTURE" and "Audio capture is not enabled in this build" (`features/RecordingScreens.kt` lines 44, 47; V `21`).

## 2. Meeting recorder

| Capability | Status | Evidence |
|---|---|---|
| Microphone permission (`RECORD_AUDIO`) | **Not implemented** (not declared, never requested) | Manifest |
| Audio recorder implementation | **Not implemented** | Source search |
| Foreground service (`foregroundServiceType="microphone"`) | **Not implemented** | Manifest |
| Recording notification | **Not implemented** | — |
| Start / Pause / Resume / Stop | **Not implemented.** No such buttons exist | `RecordingScreens.kt` lines 34–65; V `21`, `21b` |
| Bookmark | **Not implemented** | — |
| Recording duration | **Not implemented** | — |
| Audio waveform | **Not implemented** | — |
| Storage location | **Not implemented** | — |
| Recording metadata | **Declared only.** `RecordingMetadata(id, customerId, meetingId, title, durationMs, privateFileName, bytes)` and `RecordingsRepository` exist with no implementation | `core/data/BackendContracts.kt` lines 24–25 |
| Audio file format | **Not decided** | — |
| Playback, seeking, playback speed | **Not implemented** | — |
| Deletion | **Not implemented** | — |
| File recovery (after a crash or process death) | **Not implemented** | — |
| Error handling | **Declared only.** `RecorderState` has `Unavailable`, `Ready`, `Recording(elapsedMs)`, `Paused(elapsedMs)`, `Finalising`, `Saved(recordingId)` and `Error(message)`. It is a good state model, but no code uses it | `RecordingScreens.kt` lines 23–31 |

**What the setup screen does** (functional only as a form):
- title field, auto-filled "Meeting with {customer}" when a customer chip is chosen (lines 49–54);
- customer chips: "Standalone" plus every customer;
- type chips: Meeting, Site visit, Voice note;
- participants and purpose fields;
- a consent checkbox, "I will notify participants and obtain consent…" (lines 58–61). It gates nothing, because nothing can start;
- "View recording availability", which shows "Recording is not enabled" (lines 62–64).

None of these values is saved. Leaving the screen discards them.

**Is the recording real or simulated?** Neither. **No recording, real or simulated, takes place.** The UI says so explicitly.

## 3. Interruption and lifecycle behaviour

| Scenario | Status |
|---|---|
| Screen lock | **Unverified.** No recorder exists |
| App backgrounding | **Unverified** |
| Incoming phone call | **Unverified** |
| Permission removed while recording | **Unverified** |
| Low device storage | **Unverified** |
| App terminated or process death | **Unverified** |

`QA_CHECKLIST.md` lists all of these as physical-device gates for a future phase.

## 4. Recordings library

| Capability | Status | Evidence |
|---|---|---|
| Meeting recordings | **Not implemented.** The library is a static empty state | `RecordingScreens.kt` lines 74–78; V `23` |
| Call recordings | **Not implemented**, and not feasible as discussed in report 05 | — |
| Voice notes | **Not implemented.** "Voice note" exists only as a type chip on the setup form | line 55 |
| Customer linkage | **Declared only** (`RecordingMetadata.customerId`) | `BackendContracts.kt` line 24 |
| Meeting linkage | **Declared only** (`RecordingMetadata.meetingId`) | same |
| Opportunity linkage | **Not modelled.** There is no `opportunityId` | same |
| Local storage | **Not implemented.** `privateFileName` suggests app-private storage was intended | same |
| Upload status | **Not modelled** (no state field) | — |
| Playback | **Not implemented** | — |
| Search | **Visual only.** The search field updates its own state; there is nothing to search | line 75 |
| Filters | **Visual only.** All, Meetings, Calls and Voice Notes chips change selection only | line 76 |
| Deletion | **Not implemented** | — |

**Can the user play, save and delete recordings? No.**

## 5. AI transcription

| Question | Answer | Evidence |
|---|---|---|
| Implemented? | **No** | — |
| Connected to a provider? | **No.** No network code exists | Report 04 |
| Represented by interfaces only? | **Yes.** `TranscriptionService.request(recordingId)` and `.segments(recordingId)` | `RecordingScreens.kt` lines 19–22 |
| Simulated? | **No.** No sample transcript text is shown. The Transcripts tab says "AI transcription is coming to SegmiQ… Nothing has been sent for processing" | lines 79–83; V `24` |

### 5.1 Can the data models support the future features?

| Future need | Supported by the current models? | Model |
|---|---|---|
| Transcript segments | **Yes** | `TranscriptSegment(startMs, endMs, speaker, text)` (line 17) |
| Speaker identification | **Partly.** `speaker: String?`, but there is no mapping of speakers to participants or customers | same |
| Time markers / bookmarks | **Partly.** Segments have times; there is no bookmark model | — |
| Key decisions | **Yes** | `RecordingInsights.decisions` (line 18) |
| Action items | **Yes, as text.** `suggestedActions: List<String>`, with no due date, owner or link to tasks | same |
| Customer objections | **Yes** | `RecordingInsights.objections` |
| Sales Copilot recommendations | **Not linked.** `Recommendation` (in `BackendContracts.kt` line 30) has no recording or segment reference | — |
| Processing status | **Yes** | `TranscriptStatus { NotAvailable, NotRequested, Processing, Completed, Failed }` (line 16) |
| Consent / retention record | **No.** The consent checkbox is not persisted, and there is no retention policy field | — |

The models are a reasonable skeleton. They need these additions before use:
- an upload state;
- an opportunity or lead link;
- a persisted consent record;
- server ids;
- structured action items that map to SegmiQ tasks or Copilot work items.

## 6. Relationship to the web platform

From the previous web audit (supplied context): **the SegmiQ web platform has no meeting-recording or transcription feature to reuse**, and no storage path for audio. A native recorder therefore needs a new backend capability for these parts:
- upload, preferably presigned and following the existing media-presign pattern used for WhatsApp media;
- storage with organisation scoping;
- retention;
- transcription processing.

Transcription should run server-side, so provider keys never live on the device. Its results should feed the existing Sales Copilot services rather than a separate AI engine.

## 7. What a genuine implementation would need (recommendation, not implemented)

- **Permissions and service:** `RECORD_AUDIO`, plus `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MICROPHONE` (Android 14+), and `POST_NOTIFICATIONS` (Android 13+) for the ongoing notification.
- **Recorder:** a foreground `Service` with `foregroundServiceType="microphone"` that owns the recorder:
  - `MediaRecorder` producing AAC in an `.m4a` container; or
  - `AudioRecord` plus `MediaCodec` if a live waveform is needed.
  The ViewModel should be a client of that service, so recording survives screen lock and backgrounding.
- **Interruptions:** audio focus and telephony-state handling that auto-pauses on an incoming call.
- **Storage:** app-private files (`filesDir/recordings/{orgId}/`); never shared storage. Write metadata (Room) **before** recording starts, so an interrupted file can be recovered or flagged on the next launch.
- **Upload:** WorkManager, with network constraints, resumable or chunked transfer, an idempotency key and organisation scoping.
- **Playback:** Media3 ExoPlayer with seek and speed controls.
- **Deletion:** removes both the local file and the server copy.
- **Testing:** every scenario in §3 on at least two physical devices.
