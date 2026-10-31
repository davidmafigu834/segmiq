# 08 — Local storage, offline behaviour and notifications

## 1. Local storage

| Mechanism | Present? | Details | Evidence |
|---|---|---|---|
| Room databases | **No** | — | No Room dependency or `@Database` |
| DataStore (Preferences) | **Yes** | One store, `segmiq_demo_v1`, with a single key `state` holding the whole `DemoState` as a JSON string (customers, tasks, messages, notes, reviews, meetings) | `core/data/SalesRepository.kt` lines 67–73 |
| Filesystem storage | **No** | No files are written | Source search |
| Local caches of server data | **No** | There is no server data | — |
| Pending sync queue / outbox | **No** | `CallsRepository.submit(..., idempotencyKey)` hints at a future outbox, but nothing exists | `BackendContracts.kt` line 21 |
| WorkManager tasks | **No** | No dependency | `app/build.gradle.kts` |
| Encryption at rest | **No** | DataStore plaintext; acceptable only because the data is fictional | — |

### 1.1 Persistence behaviour

- **Writes:** every mutation goes through `SalesViewModel.change`, which serialises edits with a `Mutex`, rewrites the whole JSON blob and shows "Could not save on this device…" on failure without losing the in-memory state (`SalesViewModel.kt` lines 28–41).
- **Reads:** `repository.state` is collected in `reload()`. A decode failure shows a "Device storage error" page with a retry button (`SalesApp.kt` lines 91–95). Calling `reload()` again starts an additional collector without cancelling the previous one (`SalesViewModel.kt` lines 22–27). That is harmless when the previous flow has already failed, but it is a pattern to fix.
- **Migration:** `decode` throws if a required key such as `customers` is missing, and only `meetings` has a fallback (`SalesRepository.kt` lines 94–108). Any schema change to the blob will surface the storage-error page rather than migrating.
- **Opportunities are not persisted**; they always come from `DemoFixtures`.
- **Verified:**
  - a locally added lead survived force-stop and relaunch on the emulator (V `33d` → `36b`);
  - the instrumented test `DemoPersistenceTest` (persists edits across repository instances) **passed** in this audit.

## 2. Offline behaviour

**The app is entirely offline by construction.** There is no network permission or code, so losing connectivity changes nothing.

| Question | Answer |
|---|---|
| What happens when the user loses internet? | Nothing changes; the app never used the network. Not tested with airplane mode because there is nothing to observe |
| Retry policies | None |
| Duplicate prevention | **Only for call reviews**, which carry a stable id (`SalesViewModel.kt` lines 47–49). Verified by `SimulatedCallTest`. Notes, tasks, leads and meetings get a fresh UUID per save. The forms guard against double submission using `submittedCount` (`CustomerScreens.kt` lines 146–147, 166) |
| Conflict resolution | None (single device, no server) |
| Locally recorded meetings available offline? | **Not applicable.** No recordings can be created (report 06) |

**Is this offline support?** Only in the trivial sense. There is **no offline-first architecture**:
- no cache of server data;
- no outbox;
- no sync;
- no conflict handling.

Production offline support still needs to be built. `DELIVERY.md` says the same.

## 3. Account switching and data-leak risks

| Risk | Current state | Production requirement |
|---|---|---|
| Data from one user visible to the next | All users share one unscoped blob. "Leave demo" does **not** clear it (`SalesApp.kt` line 184) | Scope all caches, files and outbox items by organisation and user. Wipe them on logout, on 401 or revocation, and on organisation switch |
| Backup or transfer leaks | **Mitigated.** `allowBackup="false"`, and backup plus device-transfer rules exclude every domain | Keep this |
| Tokens at rest | Not applicable (no tokens) | Keystore-backed storage |
| Recordings at rest | Not applicable | App-private storage, deleted on logout or after upload per retention policy |
| Screenshots of sensitive screens | Not handled (`FLAG_SECURE` unused) | Optional, decided by product |

## 4. Notifications

| Capability | Status | Evidence |
|---|---|---|
| `POST_NOTIFICATIONS` permission | **Not declared, not requested** | Manifest |
| Notification channels | **Not implemented** | No `NotificationManager` usage |
| Local notifications | **Not implemented** | — |
| Firebase Cloud Messaging | **Not implemented.** No dependency, no `google-services.json`, no messaging service | Build files; manifest |
| Device token registration | **Not implemented** | — |
| Deep links from notifications | **Not implemented.** There are no deep links at all (report 02) | — |
| Reminder scheduling | **Not implemented.** Follow-up forms state "Local planning text; no reminder is scheduled" | `CustomerScreens.kt` line 155 |
| Background notification handling | **Not implemented** | — |
| Notifications screen | **Visual only.** Always "You're all caught up" | `SalesApp.kt` line 169; V `30` |

**The app has no real push delivery.** Only a static notification screen and a bell icon exist.

**Backend context (supplied):** per the web audit, the SegmiQ web platform does not have a native push system either. It serves an in-app feed (`GET /api/notifications`, mark-all-read) and the web inbox polls every few seconds. Real Android push therefore needs **new backend work**:
- a device-token registry;
- FCM sending on the events that already create notifications;
- payloads that map to app deep links.

The interim option is periodic polling or WorkManager checks of the existing feed, with local reminders for follow-ups.

## 5. Background work

None exists: no WorkManager, `AlarmManager`, `JobScheduler` or foreground services. Future needs are listed below.

| Need | Suggested mechanism (not implemented) |
|---|---|
| Outbox sync (call logs, notes, task completion) | WorkManager, unique work, network constraint, exponential back-off, idempotency keys |
| Recording upload | WorkManager (long-running worker) |
| Follow-up reminders | `AlarmManager` exact alarms where justified, or WorkManager plus notifications |
| Push | FCM `FirebaseMessagingService` |
| Recording | Foreground service with `microphone` type (report 06) |
