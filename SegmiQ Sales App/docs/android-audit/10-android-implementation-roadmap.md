# 10 — Android implementation roadmap

These are recommendations only. Nothing here has been implemented. The phases build on the existing code rather than replacing it.

## 1. Principles

1. **One app, three experiences.** General, Solar and Real Estate are selected at runtime from server data. They are not three builds.
2. **Reuse the SegmiQ backend.** Use the existing mobile Bearer token (`POST /api/sales/app/auth`) and existing endpoints. No Supabase on the device, no service-role keys, no separate WhatsApp or AI backend.
3. **The server decides scope.** The device never chooses an organisation id or applies assignment rules itself.
4. **Keep the honesty.** The current app never pretends a simulated feature is real. Keep that standard: features that are not connected stay clearly labelled.
5. **Keep the demo as a build flavour.** The local demo is useful for sales demos and UI tests. Move it to a `demo` product flavour or a fake repository rather than deleting it.

## 2. Code to preserve

| Keep | Why |
|---|---|
| `core/design/Components.kt` and `ui/theme/Theme.kt` | Coherent component set and palette. Adjust lime usage and add `surfaceContainer*` roles rather than rewriting |
| Screen composables in `features/` | Layouts are sound. Change their inputs from `DemoState` to per-screen UI state |
| `core/data/BackendContracts.kt` | Correct repository boundaries, including the `idempotencyKey` on call submission. Extend them (MFA state, role, industry, Copilot work-item fields) |
| `RecorderState`, `TranscriptSegment`, `RecordingInsights`, `TranscriptStatus` | A sensible model for the recorder and future transcription |
| Call-review duplicate protection | Stable id plus a guard in the ViewModel. Reuse the pattern for the outbox |
| `validPhone`, `filterTasks` and their unit tests | Keep, but replace text-based dates with real timestamps |
| Backup and data-extraction exclusions, `allowBackup=false` | Correct for a CRM app |
| Instrumented tests | Keep them as demo-flavour UI tests |

**Remove:**
- `ui/main/MainScreen.kt`, `MainScreenViewModel.kt`, `data/DataRepository.kt`, `NavigationKeys.kt`;
- the template palette in `Color.kt`;
- the unused Navigation 3 catalog entries and the serialization plugin (or start using it).

## 3. Top 10 missing capabilities, by priority

| # | Capability | Why it matters | Depends on |
|---|---|---|---|
| 1 | **Real sign-in with MFA, secure token storage, session restore and logout wipe** | Nothing real can happen without it | `POST /api/sales/app/auth`, `/api/auth/mfa/login` (exist) |
| 2 | **Networking layer and production repositories** (HTTP client, Bearer interceptor, error mapping, DI) | Turns the contracts into working code | — |
| 3 | **Experience resolution and server-driven navigation** | Required for Solar and Real Estate; avoids three apps | **New** bootstrap endpoint (or the interim composite in §5) |
| 4 | **Real leads, lead detail, notes, timeline and add lead with duplicate lookup** | Core daily work | Existing Bearer endpoints |
| 5 | **Real calling:** `ACTION_DIAL`, post-call review, posting to `log-call` through an outbox | The app's main differentiator from the web | `POST /api/leads/{id}/log-call` (exists) |
| 6 | **WhatsApp inbox and send** (text, then media) | Primary channel | Existing Bearer inbox and send endpoints; paging recommended |
| 7 | **Tasks and Copilot work items** with real dates and approve/dismiss/snooze/complete | "My Day" value | Existing Bearer endpoints |
| 8 | **Offline cache and outbox** (Room plus WorkManager, idempotency, organisation-scoped wipe) | Field reliability | Idempotent server writes |
| 9 | **Genuine meeting recorder** (foreground service, private storage, playback, upload) | Stated priority feature | **New** upload and storage backend |
| 10 | **Push notifications and deep links** | Timely follow-up | **New** device-token registry and FCM sender |

Also high, after these:
- the pipeline with stage moves and won/lost (needs a Bearer deals-list endpoint);
- quotations;
- solar workflow and site visits;
- real-estate modules (after the server security fixes).

## 4. Suggested phases

### Phase 0: decisions and backend prerequisites (web team)

- **Fix the web audit's server-side security findings** before exposing more data to a mobile client:
  - salesperson can edit company settings including the industry;
  - billing is not enforced on APIs;
  - the MFA login path skips the role check;
  - real-estate visibility holes (competing offers, viewings bookable for any contact).
- **Decide the bootstrap contract**: experience, modules, stages, call outcomes, currency, time zone, user, organisation, solo flag.
- **Decide the calling scope.** Recommended: system dialer (`ACTION_DIAL`) plus post-call logging; **not** default-dialer and **not** SIM call recording.
- **Decide the meeting-recording policy**: consent, retention, storage and where transcription runs (server-side).
- **Brand assets:** official logo, launcher icon and font. The web uses Geist and Inter; the Android README mentions Manrope. Pick one.

### Phase 1: foundation (Android)

1. Add DI (Hilt or a manual container), an HTTP client, `INTERNET`, a base URL per build type and a Bearer interceptor.
2. Introduce `demo` and `prod` product flavours. Move `LocalDemoRepository` and the fixtures into `demo`.
3. Implement `AuthRepository` with MFA, Keystore-backed token storage, restore on launch, a 401/revoked handler and logout wipe.
4. Change the start destination to "session check, then sign-in or home".
5. Split the single ViewModel into per-feature ViewModels with their own loading, error and empty states.
6. Use type-safe routes; fix the missing deal and meeting titles and the blank pages for unknown ids.
7. Add the experience resolver and turn the tabs, More list and quick actions into data, starting with **General only**.
8. Add Room with organisation-scoped tables for leads, tasks and conversations as a read cache.

### Phase 2: general-sales core (Android, existing Bearer endpoints)

- My Day from `/api/sales/dashboard` and `/workspace`, including Copilot work-item actions with 409 handling.
- Leads list and detail (paging), notes, timeline, add lead with lookup, lead → deal.
- Calling:
  - `ACTION_DIAL` from the lead;
  - on return, the existing Call review screen;
  - post `log-call` via a WorkManager outbox;
  - fix number normalisation with libphonenumber.
- Inbox list and thread with send text (then media via presign).
- Tasks with real dates, plus local reminders (`POST_NOTIFICATIONS`).
- Notifications feed (polling) with deep links.

### Phase 3: pipeline, quotations and solar

- Pipeline stage list and deal detail with stage moves and won/lost. **Needs a Bearer deals-list endpoint.**
- Quotations list, PDF viewer and share; a simplified builder.
- Solar experience: solar pipeline from `/api/sales/solar-workflow`, site-visit assessment with camera and offline draft.

### Phase 4: meeting recorder (Android + new backend)

- Foreground recording service, Room metadata, private files, crash recovery, playback with seek and speed, deletion.
- Physical-device interruption matrix: lock, background, incoming call, permission revoke, low storage, kill.
- Upload via WorkManager to a new organisation-scoped storage endpoint.
- Server-side transcription and insights feeding existing Copilot work items.

### Phase 5: real estate (after Phase 0 security fixes and Bearer enablement)

- Home, Inquiries, Properties (with photo upload), Activities (viewings), Buyers, Offers, Introductions, then the remaining modules.

### Phase 6: push and polish

- Device-token registry and FCM on the backend; push handling and deep links on the device.
- Offline conflict handling; large-text, landscape, tablet and TalkBack passes; release signing, R8 and Play policy review.

## 5. Interim bootstrap if the new endpoint is delayed

The web audit lists where today's data lives: the login response, cookie-only `/api/users/me` and `/api/auth/home`, `/api/users/me/security-meta`, `/api/sales/execution-settings`, Bearer `GET /api/sales/solar-workflow` and the dashboard payload.

The app could compose the experience from the Bearer-accessible subset, but **cookie-only pieces cannot be used**. A single Bearer bootstrap endpoint is the cleaner and safer route.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Building parallel backends (WhatsApp, AI, auth) "to move faster" | Hold to principle 2; review every new network call against existing endpoints |
| Shipping real estate before the server visibility fixes | Gate it behind the Phase 0 fixes |
| Promising call recording | State plainly that ordinary apps cannot record both sides of SIM calls; decide VoIP or provider recording separately |
| Default-dialer scope creep | Use `ACTION_DIAL` first; only consider `ROLE_DIALER` with a clear business case |
| Data leaking between accounts | Organisation-scoped storage plus wipe on logout or revocation from day one of Phase 1 |
| Two Android apps (Capacitor `sales-app/` and native) diverging | Decide the Capacitor app's future; reuse its API contracts and offline call queue as reference |
| No physical-device testing so far | Add at least two physical devices (one small, one large; different OEMs) to the test plan from Phase 2 |
