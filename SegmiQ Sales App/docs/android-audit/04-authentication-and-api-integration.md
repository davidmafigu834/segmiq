# 04 — Authentication and API integration

## 1. Headline

**The Android app has no authentication and makes no network requests.** It does not use `POST /api/sales/app/auth` or any other SegmiQ endpoint, and it does not talk to Supabase. The manifest does not even declare the `INTERNET` permission. Every piece of data comes from hard-coded fixtures plus local edits saved in DataStore.

## 2. Authentication audit

| Item | Finding | Evidence |
|---|---|---|
| Login screen | **None.** The Welcome screen has a heading "Organisation sign-in" and the text "Your existing SegmiQ authentication will be connected once its API contract is available", followed by "Explore local demo" | `features/WorkspaceScreens.kt` lines 48–52 |
| Credential handling | None. No email or password fields exist | Source search |
| Session management | None. No session object is created at runtime | — |
| Token storage | None. No Keystore, EncryptedSharedPreferences or token in DataStore | Source search |
| MFA | None | — |
| Logout | None. Settings "Leave demo" only navigates back to Welcome and **does not clear data** | `app/SalesApp.kt` line 184 |
| Token expiry / refresh | None | — |
| Session restoration | None. The app always starts at `welcome` | `SalesApp.kt` line 97 |
| User identity | Hard-coded "Alex" / "Alex Demo" | `WorkspaceScreens.kt` lines 65–67; `CustomerScreens.kt` lines 93, 109 |
| Organisation context | One fictional "Local demo workspace", currency text "USD" | `SalesApp.kt` lines 173–175 |
| Role validation | None | — |

### 2.1 Contracts prepared for later

`core/data/BackendContracts.kt` declares the shapes a real integration would fill. None has an implementation:

```7:17:app/src/main/kotlin/com/segmiq/sales/core/data/BackendContracts.kt
data class AuthorisedScope(val organisationId: String, val salespersonId: String)
data class OrganisationConfig(val currencyCode: String, val timezoneId: String, val stages: List<String>, val callOutcomes: List<String>)
sealed interface SessionState {
    data object SignedOut : SessionState
    data class Authenticated(val scope: AuthorisedScope) : SessionState
}
interface AuthRepository {
    suspend fun restore(): SessionState
    suspend fun signIn(email: String, password: String): SessionState
    suspend fun signOut()
}
```

**This is a sensible starting point, with gaps relative to the real backend:**
- `signIn` returns `Authenticated` or `SignedOut` only. The real flow can also require an **MFA challenge**: per the web audit, `POST /api/auth/mfa/login` with `channel:"mobile_sales"`. A `MfaRequired(challenge)` state is missing.
- `AuthorisedScope` has `organisationId` and `salespersonId` but no role, `also_sells`, `business_type`, `sales_workflow_preset` or solo flag. The app needs all of these to choose General, Solar or Real Estate.
- There is no "session revoked" or "company suspended" state. The backend re-validates every request and can reject an otherwise valid token.

### 2.2 Relationship to `POST /api/sales/app/auth`

**Not used.** No HTTP code exists.

From the previous web audit (`../../audits/salesperson-android/04` and `07`; supplied context, not re-verified here), the endpoint:
- issues a **14-day HS256 Bearer token** bound to a server-side `user_sessions` row of type MOBILE;
- has every Bearer request re-validated by `lib/auth/resolveApiAuth.ts`;
- has **no refresh endpoint**;
- has a known issue: the MFA login path does not run the salesperson role check (web audit report 10).

The existing Capacitor app in the web repository's `sales-app/` folder already uses this endpoint. Report 09 explains why that matters.

### 2.3 Secrets in source

**None found.** A search of `app/src` for API keys, secrets, passwords, tokens, Bearer strings, Supabase, Firebase and `http(s)://` URLs found only:
- XML namespace URLs and licence-header URLs;
- the parameter name `password` in the unimplemented `AuthRepository.signIn` signature.

`local.properties` contains only the Android SDK path and is git-ignored. `BuildConfig` generation is disabled (`app/build.gradle.kts` line 32).

## 3. Network request inventory

| Method | URL / base URL | Calling class | Repository | Request DTO | Response DTO | Auth | Error handling | Retry | Cache | Usage |
|---|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — | — | **No network requests exist** |

There is no HTTP client dependency, no base URL, no DTOs, no serializers in use and no `INTERNET` permission (`AndroidManifest.xml`).

## 4. Data sources actually used

| Source | Present? | Where |
|---|---|---|
| SegmiQ backend | **No** | — |
| Supabase directly | **No** (good; it must stay that way) | — |
| Local mock services | No separate service. The only data class is `LocalDemoRepository` | `core/data/SalesRepository.kt` lines 68–109 |
| In-memory repositories | `DemoFixtures` object, plus the `DemoState` defaults | `SalesRepository.kt` lines 18–51 |
| Static JSON fixtures | No files. Fixtures are Kotlin literals. Persisted state is one JSON string in DataStore | `SalesRepository.kt` lines 67–93 |

## 5. Fake, simulated, hard-coded and development-only data

Everything shown in the app falls into this category. The specific items are:

- **3 customers** with Zimbabwean demo numbers and `example.com` emails (`SalesRepository.kt` lines 30–34).
- **3 tasks, 3 inbound messages and 2 meetings** (lines 35–44, 24–27).
- **3 opportunities** and a **4-entry stage list**. These are **never persisted or editable**: `PipelineScreen`, `DealScreen` and the customer "Deals" tab read `DemoFixtures` directly (lines 45–50; `WorkspaceScreens.kt` lines 173–177, 195; `CustomerScreens.kt` line 133).
- **The next-meeting card** on My Day (`WorkspaceScreens.kt` lines 91–100).
- **Assignment labels** "Assigned to Alex" and "Active lead" (`CustomerScreens.kt` line 93).
- **The timeline entry** "Sample enquiry received" (`CustomerScreens.kt` line 125).
- **9 call outcomes** (`CallingScreens.kt` lines 157–158).
- **Copilot "recommendations"**, derived from open tasks (`SalesApp.kt` lines 154–167).
- **Currency USD via `Locale.US`** (`WorkspaceScreens.kt` line 167; `SalesApp.kt` line 174).
- **`DemoCallRecordingCapability`**, which always returns `Unsupported` (`CallingScreens.kt` line 29).

All screens label themselves as demo content ("LOCAL DEMO", "SIMULATED", "Sample …"). I found no screen that presents fake data as live.

## 6. Which existing SegmiQ interfaces are connected?

| Backend interface (from the web audit) | Connected in Android? |
|---|---|
| Mobile authentication (`POST /api/sales/app/auth`) | No |
| Sales dashboard (`GET /api/sales/dashboard`, `/workspace`) | No |
| Leads (`GET /api/sales/leads`, `/api/sales/app/leads`, `/api/leads/{id}`) | No |
| Lead activity and call logs (`POST /api/leads/{id}/log-call`, `/internal-note`, `/timeline`) | No |
| Sales Inbox (`GET /api/inbox/conversations`, messages, `POST /api/leads/{id}/send-message`) | No |
| Tasks (`GET /api/sales/tasks`) | No |
| Opportunities (`GET/PATCH /api/deals/{id}`; the list is cookie-only on the web) | No |
| Quotations (`GET /api/sales/quotes`, `/api/quotations/{id}` …) | No |
| Sales Copilot (`POST /api/sales/copilot/work-items/{id}`) | No |
| Notifications (`GET /api/notifications`) | No |

Endpoint names come from the web audit (`../../audits/salesperson-android/09-android-feature-mapping.md` §3.1). They are supplied context and were not re-verified against the web code in this audit.

## 7. Security observations for the current build

| Observation | Assessment |
|---|---|
| No permissions requested at all | Correct for a demo |
| `allowBackup="false"`, with full exclusion rules for cloud backup and device transfer | Good. Keep this for the production session and caches |
| Demo data stored unencrypted in DataStore | Acceptable for fictional data. **Not acceptable** for real customer data or tokens; see report 08 |
| "Leave demo" does not clear data | Harmless now. A real logout must wipe tokens, caches, outbox and recordings metadata per organisation |
| The release build has no signing configuration, minification is off, and the referenced `proguard-rules.pro` does not exist (`app/build.gradle.kts` lines 20–23) | Must be fixed before any release build |

## 8. Requirements for real integration (not implemented)

1. Add an HTTP stack (for example Retrofit or Ktor with OkHttp), a configurable base URL per build type, and the `INTERNET` permission.
2. Implement `AuthRepository` against `POST /api/sales/app/auth`, including:
   - an MFA challenge state using `/api/auth/mfa/login` with `channel:"mobile_sales"`;
   - Keystore-backed token storage;
   - handling for 401 and revoked sessions (the backend has no refresh endpoint, so expiry means re-login);
   - logout that clears all local data.
3. Add a Bearer interceptor and a single place that maps 401, 403 and 409 responses to app states.
4. Use only SegmiQ backend endpoints. **Never** embed Supabase keys or service-role credentials in the app.
5. Get organisation, role and industry from the server, ideally the proposed `GET /api/sales/app/bootstrap` from the web audit. Do not let the client choose an organisation id.
