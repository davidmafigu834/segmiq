# SegmiQ Sales Android — 01 Authentication, Session and Bootstrap Contract

Status: Backend Readiness Phase 1. Applies to the native Android app (`SegmiQ Sales App/`).
The legacy Capacitor app (`sales-app/`) uses the same endpoints and remains supported.

All examples are redacted. Tokens, passwords, codes and identifiers below are placeholders,
never real values.

---

## 1. Endpoints

| Purpose | Method and path | Auth |
|---|---|---|
| Password sign-in | `POST /api/sales/app/auth` | none |
| Complete two-step verification | `POST /api/auth/mfa/login` (`action: "complete"`, `channel: "mobile_sales"`) | challenge token |
| Bootstrap (who am I, which experience) | `GET /api/sales/app/bootstrap` | `Authorization: Bearer <token>` |
| Sign out this device | `POST /api/auth/session/logout` | `Authorization: Bearer <token>` |
| All other Sales APIs | e.g. `GET /api/sales/app/leads` | `Authorization: Bearer <token>` |

Only HTTPS. Every authenticated request sends `Authorization: Bearer <token>`. The app never
sends an organisation or user id to choose whose data it sees; the server derives both from
the token's server-side session.

---

## 2. Password sign-in — `POST /api/sales/app/auth`

### Request

```json
{
  "email": "salesperson@example.com",
  "password": "<password>",
  "deviceId": "<stable random UUID generated once per install>",
  "deviceName": "Samsung Galaxy A54"
}
```

| Field | Required | Notes |
|---|---|---|
| `email` | yes | Trimmed; case-insensitive. |
| `password` | yes | Never logged by the server. |
| `deviceId` | recommended | ≤128 chars. Random per install, not a hardware id. Used for session labels and new-sign-in alert de-duplication. |
| `deviceName` | recommended | ≤120 chars. Shown in the user's session list. |

Send a meaningful `User-Agent` (e.g. `SegmiQSales-Android/1.0.0 (Android 14)`); it is recorded
on the session.

### Response A — signed in (HTTP 200)

```json
{
  "token": "<JWT>",
  "expiresAt": "2026-11-13T08:00:00.000Z",
  "user": {
    "userId": "<uuid>",
    "name": "Thandi M.",
    "clientId": "<uuid>",
    "role": "SALESPERSON",
    "clientMode": "team",
    "alsoSells": false,
    "sessionId": "<uuid>"
  }
}
```

`expiresAt` is the earlier of the token expiry and the server session's absolute expiry.
After a successful sign-in, call **bootstrap** before showing any screen.

### Response B — two-step verification required (HTTP 200)

```json
{
  "mfaRequired": true,
  "challengeId": "<uuid>",
  "challengeToken": "<opaque>",
  "expiresAt": "2026-10-30T08:08:00.000Z"
}
```

No token and no session are issued. Continue with section 3. The challenge expires after 8
minutes and allows a limited number of attempts.

### Response C — two-step enrolment required (HTTP 200)

The organisation's security policy requires MFA and the user has not enrolled.

```json
{
  "mfaEnrolmentRequired": true,
  "token": "<restricted JWT>",
  "expiresAt": "2026-11-13T08:00:00.000Z",
  "user": { "...": "as in Response A" }
}
```

The token is **restricted**: every Sales API (including bootstrap) answers
`403 MFA_ENROLMENT_REQUIRED`. Enrolment is a web flow — show a message directing the user to
set up two-step verification on the SegmiQ website, then sign in again. Logout works with this
token.

### Errors

See section 7 for the full table. Codes this endpoint returns:
`INVALID_REQUEST`, `INVALID_CREDENTIALS`, `RATE_LIMITED`, `INSUFFICIENT_ROLE`,
`NO_ORGANISATION`, `ORGANISATION_SUSPENDED`, `SERVICE_UNAVAILABLE`, `SERVER_MISCONFIGURED`.

Wrong password, unknown email and disabled account all return `INVALID_CREDENTIALS` on purpose
(no account enumeration). Role and organisation checks run **only after** the password is
verified, and before any MFA challenge or session is created.

Rate limit: 10 attempts per email and IP per 15 minutes.

---

## 3. Two-step verification — `POST /api/auth/mfa/login`

### Request

```json
{
  "action": "complete",
  "channel": "mobile_sales",
  "challengeId": "<from sign-in>",
  "challengeToken": "<from sign-in>",
  "totpCode": "123456",
  "deviceId": "<same as sign-in>",
  "deviceName": "Samsung Galaxy A54"
}
```

Send exactly one of `totpCode` (6 digits from the authenticator app) or `recoveryCode`
(spaces, hyphens and case are ignored). `channel` **must** be `"mobile_sales"`; any other value
does not apply the Sales eligibility checks and does not produce a Sales token.

### Success (HTTP 200)

```json
{
  "ok": true,
  "token": "<JWT>",
  "expiresAt": "2026-11-13T08:00:00.000Z",
  "user": {
    "userId": "<uuid>",
    "name": "Thandi M.",
    "clientId": "<uuid>",
    "role": "SALESPERSON",
    "clientMode": "team",
    "alsoSells": false,
    "sessionId": "<uuid>"
  }
}
```

The session is recorded as MFA-verified (`auth_strength = password_mfa`).

### Errors

| HTTP | `code` | `error` (legacy) | Meaning |
|---|---|---|---|
| 400 | `INVALID_REQUEST` | `Challenge required` / `Invalid JSON` | Missing challenge fields or bad body. |
| 401 | `MFA_VERIFICATION_FAILED` | `Verification failed` | Wrong / reused code, expired or consumed challenge, too many attempts. `reason` gives detail (`invalid_code`, `challenge_expired`, `challenge_consumed`, `too_many_attempts`, …). |
| 401 | `ACCOUNT_DISABLED` | `Unauthorized` | Account disabled after the challenge was issued. |
| 403 | `INSUFFICIENT_ROLE` | role message | Not a salesperson / selling manager. |
| 403 | `NO_ORGANISATION` | | Not linked to an organisation. |
| 403 | `ORGANISATION_SUSPENDED` | | Organisation inactive, archived or security-suspended. |
| 429 | `RATE_LIMITED` | `Too many attempts` | 40 requests per IP per 15 minutes. |
| 503 | `SERVICE_UNAVAILABLE` | | Database unavailable; retry. |

On `challenge_expired`, `challenge_consumed` or `too_many_attempts` the app must return to the
password screen; the challenge cannot be reused.

---

## 4. Token and session lifecycle

* The token is an HS256 JWT. Treat it as **opaque**: do not parse it for authorisation
  decisions; use bootstrap.
* Every request is validated server-side against the `user_sessions` registry: the session
  must exist, belong to the user, be unrevoked, inside its absolute and idle lifetime, and the
  user's `session_version` must match. The user must be active, their role / organisation /
  selling flag must still match the token, and the organisation must be active and not
  security-suspended.
* **Lifetime:** 14 days absolute (platform default). Idle timeout defaults to the same 14 days
  and is measured from the last foreground request. An organisation security policy may
  shorten both. Use `expiresAt` from sign-in / bootstrap as the upper bound, but the server
  may end a session earlier (revocation, idle timeout, policy, password change, offboarding).
* **No refresh token.** `refreshSupported` is `false`. When the session ends, the user signs in
  again. No long-lived refresh credential is issued by design.
* Background polling (notifications, presence) should send `X-Segmiq-Activity: background` so
  it does not extend the idle timeout.
* An administrator can revoke a single session, all of a user's sessions, or bump
  `session_version` (sign out everywhere). All take effect on the next request.

### Storage requirements (Android)

* Store the token only in Android Keystore-backed storage (e.g. EncryptedSharedPreferences /
  DataStore with a Keystore key). Never in plain SharedPreferences, files, logs, analytics,
  crash reports or backups (exclude from Auto Backup).
* Never embed or request Supabase keys. The app talks only to SegmiQ APIs.
* Clear the token and all cached tenant data on logout and on any `TOKEN_*`, `SESSION_*`,
  `ACCOUNT_DISABLED`, `INSUFFICIENT_ROLE`, `NO_ORGANISATION` or `ORGANISATION_SUSPENDED`
  response.

---

## 5. Logout — `POST /api/auth/session/logout`

```
POST /api/auth/session/logout
Authorization: Bearer <token>
```

* Revokes **only the current session** (`revoked_reason = USER_LOGOUT`). Other devices stay
  signed in. `session_version` is not changed.
* Always answers `200 {"ok": true}` — including when the token is already expired or invalid —
  so the app can clear local state unconditionally. Delete the token locally whether or not
  the request succeeds. (An expired or invalid token cannot be used again, so there is
  nothing further to revoke; its session row simply lapses.)
* No `Origin` header is required when a Bearer token is sent.
* "Sign out everywhere" is not available to Bearer tokens in this phase; it is an explicit web
  action (`DELETE /api/auth/session/logout` with a browser session) or an administrator action.

---

## 6. Bootstrap — `GET /api/sales/app/bootstrap`

Call after sign-in, on cold start, and when returning to the foreground after a long pause.
Any query parameters are ignored. The response is never cached (`Cache-Control: no-store`); do
not persist it beyond the current session.

Bootstrap is **not** blocked by a suspended subscription — it answers 200 with
`subscription.salesAccess = "BLOCKED"` so the app can explain the situation (section 6.4).

### 6.1 Schema (version 1)

```ts
{
  schemaVersion: 1;
  generatedAt: string;                   // ISO-8601
  session: {
    sessionId: string | null;
    sessionType: "MOBILE" | "WEB" | null;
    expiresAt: string | null;            // earliest of token and session expiry
    refreshSupported: false;
  };
  user: {
    id: string;
    displayName: string;
    role: "SALESPERSON" | "CLIENT_MANAGER";
    alsoSells: boolean;
    avatarUrl: string | null;
  };
  organisation: {
    id: string;
    name: string;
    logoUrl: string | null;
    businessType: "trades" | "real_estate";
    salesWorkflowPreset: "GENERAL_TRADES" | "SOLAR_INSTALLATION";
    clientMode: "team" | "solo";
    workspaceMode: "production" | "demo";
    assignmentMode: "direct" | "pool" | "round_robin";
    country: string | null;
    dialCode: string | null;             // e.g. "263"
    responseTimeLimitHours: number | null;
  };
  subscription: {
    product: "crm";
    status: "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED" | "UNKNOWN";
    salesAccess: "ALLOWED" | "BLOCKED";
  };
  experience: {
    id: "GENERAL" | "REAL_ESTATE" | "SOLAR";
    resolvedBy: "BUSINESS_TYPE" | "SALES_WORKFLOW_PRESET" | "DEFAULT";
    homeVariant: "TEAM" | "SOLO";
  };
  capabilities: {
    modules: string[];                   // destination ids the user may open
    permissions: string[];               // RBAC permission keys (informational)
    featureFlags: { realEstateWorkflow: boolean; solarWorkflow: boolean; demoWorkspace: boolean };
    restrictions: {
      salesOperations: "ALLOWED" | "BLOCKED";
      leadVisibility: "ORGANISATION" | "ASSIGNED_AND_UNASSIGNED" | "ASSIGNED_ONLY";
      leadModification: "ASSIGNED_ONLY";
      canManageCompanyProfile: boolean;
      quotationMarginVisibleToSalespeople: boolean | null;
      quotationCostVisibleToSalespeople: boolean | null;
    };
  };
  navigation: {
    home: string | null;                 // destination id, e.g. "DASHBOARD"
    primary: string[];                   // bottom-bar destination ids, in order
    sections: { id: string; label: string }[];
    destinations: {
      id: string;                        // e.g. "PIPELINE", "WHATSAPP", "LISTINGS"
      label: string;
      shortLabel: string | null;         // bottom-bar label when present
      section: string;
      placement: "PRIMARY" | "MORE";
      webPath: string;                   // web equivalent; for deep links only, never an authority
    }[];
  };
  salesConfiguration: {
    terminology: { lead, salesperson, project, siteVisit, team: {singular, plural}; actions: {...} };
    pipeline: {
      model: "DEAL_STAGE" | "SOLAR_SALES_STAGE" | "REAL_ESTATE_STAGE";
      configurable: false;
      stages: { id: string; label: string; closed: boolean }[];
      boardColumns: { id: string; label: string; stages: string[] }[] | null;  // real estate only
    };
    callOutcomes: {
      configurable: false;
      reachOutcomes, leadResults, dealResults, callbackOptions: { id: string; label: string }[];
      followUpReasons, lostReasons, notQualifiedReasons: string[];
    };
    timeZone: {
      configured: string | null;         // organisation setting; null when never set
      effective: string;                 // IANA zone the server uses for this organisation
      source: "ORGANISATION" | "PLATFORM_DEFAULT";
    };
    currency: {
      quotationDefault: string | null;   // ISO 4217; null when not configured
      supported: string[];
      source: "QUOTATION_SETTINGS" | "NOT_CONFIGURED";
    };
  };
}
```

Compatibility rules: fields may be **added** within version 1; existing fields are never
removed, renamed or repurposed. Unknown enum values must be handled gracefully (treat unknown
destinations as hidden, unknown experiences as `GENERAL`). A breaking change ships as
`schemaVersion: 2`; the app must refuse to continue (and ask for an update) when
`schemaVersion` is greater than it supports.

### 6.2 Experience resolution

Evaluated server-side, in this order, after the session and role are validated:

1. **Home variant**: `SOLO` only for a `SALESPERSON` in a `solo` organisation; otherwise `TEAM`.
   This changes the dashboard only; the experience is still chosen by steps 3–5.
2. **Demo workspace**: `workspaceMode = "demo"` organisations resolve exactly like production
   ones (`featureFlags.demoWorkspace = true`). Demo-guest browser sessions are not accepted by
   bootstrap (`UNSUPPORTED_SESSION`).
3. `businessType = "real_estate"` → `REAL_ESTATE` (wins over Solar).
4. `salesWorkflowPreset = "SOLAR_INSTALLATION"` → `SOLAR`.
5. Otherwise → `GENERAL`.

### 6.3 Configuration honesty

* Pipelines and call outcomes are fixed by SegmiQ per experience today (`configurable: false`).
* `currency` is only reported when the organisation has quotation settings; otherwise
  `quotationDefault: null`, `source: "NOT_CONFIGURED"`. Do not assume a currency.
* `timeZone.configured` is `null` when the organisation never set one; `effective` is the
  zone the server actually uses for "today" boundaries (platform default otherwise).
* `quotation*VisibleToSalespeople` is `null` when the organisation has no quotation settings.
* No subscription plan or feature entitlements are exposed; none exist for the Sales app yet.

### 6.4 Subscription state

`salesAccess = "BLOCKED"` exactly when the web portal would block the organisation
(`status = "SUSPENDED"`, including an overdue invoice past its grace period). In that state
`navigation.destinations`, `navigation.primary` and `capabilities.modules` are empty and every
non-exempt Sales API returns `402 SUBSCRIPTION_SUSPENDED`. Show a blocking screen with logout
available. `PAST_DUE` and `CANCELLED` do not block (same as web).

### 6.5 Redacted example (Solar organisation, team salesperson)

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-30T08:00:00.000Z",
  "session": { "sessionId": "<uuid>", "sessionType": "MOBILE", "expiresAt": "2026-11-13T07:59:58.000Z", "refreshSupported": false },
  "user": { "id": "<uuid>", "displayName": "Thandi M.", "role": "SALESPERSON", "alsoSells": false, "avatarUrl": null },
  "organisation": {
    "id": "<uuid>", "name": "Example Solar Co", "logoUrl": "https://cdn.example.com/logo.png",
    "businessType": "trades", "salesWorkflowPreset": "SOLAR_INSTALLATION",
    "clientMode": "team", "workspaceMode": "production", "assignmentMode": "round_robin",
    "country": "ZW", "dialCode": "263", "responseTimeLimitHours": 4
  },
  "subscription": { "product": "crm", "status": "ACTIVE", "salesAccess": "ALLOWED" },
  "experience": { "id": "SOLAR", "resolvedBy": "SALES_WORKFLOW_PRESET", "homeVariant": "TEAM" },
  "capabilities": {
    "modules": ["DASHBOARD", "WHATSAPP", "PIPELINE", "SOCIAL_INBOX", "LEADS", "QUOTES", "TASKS", "WON_LOST", "MY_WORK", "PROJECTS", "CALENDAR", "COMMAND", "REPORTS", "GOALS", "TOOLBOX"],
    "permissions": ["leads.read_assigned", "leads.update_assigned", "quotes.create", "…"],
    "featureFlags": { "realEstateWorkflow": false, "solarWorkflow": true, "demoWorkspace": false },
    "restrictions": {
      "salesOperations": "ALLOWED", "leadVisibility": "ASSIGNED_ONLY", "leadModification": "ASSIGNED_ONLY",
      "canManageCompanyProfile": false,
      "quotationMarginVisibleToSalespeople": null, "quotationCostVisibleToSalespeople": null
    }
  },
  "navigation": {
    "home": "DASHBOARD",
    "primary": ["DASHBOARD", "PIPELINE", "WHATSAPP", "TASKS"],
    "sections": [
      { "id": "overview", "label": "Overview" }, { "id": "sales", "label": "Sales" },
      { "id": "field", "label": "Field & delivery" }, { "id": "intelligence", "label": "Intelligence" },
      { "id": "tools", "label": "Tools" }
    ],
    "destinations": [
      { "id": "DASHBOARD", "label": "Dashboard", "shortLabel": "Dashboard", "section": "overview", "placement": "PRIMARY", "webPath": "/sales/dashboard" },
      { "id": "PIPELINE", "label": "Solar Pipeline", "shortLabel": "Pipeline", "section": "sales", "placement": "PRIMARY", "webPath": "/sales/pipeline" },
      { "id": "LEADS", "label": "Leads", "shortLabel": null, "section": "sales", "placement": "MORE", "webPath": "/sales/leads" },
      { "id": "PROJECTS", "label": "Projects", "shortLabel": "Projects", "section": "field", "placement": "MORE", "webPath": "/sales/projects" }
    ]
  },
  "salesConfiguration": {
    "terminology": { "lead": { "singular": "Lead", "plural": "Leads" }, "…": "…" },
    "pipeline": {
      "model": "SOLAR_SALES_STAGE", "configurable": false,
      "stages": [
        { "id": "NEW_LEAD", "label": "New Lead", "closed": false },
        { "id": "QUOTE_SENT", "label": "Quote Sent", "closed": false },
        { "id": "WON", "label": "Won", "closed": true },
        { "id": "LOST", "label": "Lost", "closed": true }
      ],
      "boardColumns": null
    },
    "callOutcomes": {
      "configurable": false,
      "reachOutcomes": [{ "id": "reached", "label": "Reached them" }, { "id": "no_answer", "label": "No answer" }, { "id": "call_back", "label": "Call me back" }],
      "leadResults": [{ "id": "qualified", "label": "Qualified opportunity" }],
      "dealResults": [{ "id": "won", "label": "Won" }, { "id": "lost", "label": "Lost" }],
      "followUpReasons": ["Comparing quotes"], "lostReasons": ["Chose a competitor"], "notQualifiedReasons": ["Out of area"],
      "callbackOptions": [{ "id": "in_1_hour", "label": "In 1 hour" }]
    },
    "timeZone": { "configured": null, "effective": "Africa/Harare", "source": "PLATFORM_DEFAULT" },
    "currency": { "quotationDefault": null, "supported": [], "source": "NOT_CONFIGURED" }
  }
}
```

(Arrays shortened with `…`; the server returns the complete lists.)

---

## 7. Errors

### 7.1 Envelope

Mobile endpoints (sign-in, MFA completion, bootstrap, and the subscription gate) return:

```json
{ "error": "<legacy string>", "code": "<STABLE_CODE>", "message": "<user-facing English text>" }
```

* **Branch on `code`.** `error` is kept for older clients and may be a human sentence.
* `message` is safe to show but may change; localise from `code` where possible.
* Responses carry `Cache-Control: no-store`.

### 7.2 Codes

| `code` | HTTP | What the app should do |
|---|---|---|
| `INVALID_REQUEST` | 400 | Bug or corrupted input; show generic error. |
| `INVALID_CREDENTIALS` | 401 | "Incorrect email or password." |
| `RATE_LIMITED` | 429 | Ask the user to wait a few minutes. |
| `MFA_VERIFICATION_FAILED` | 401 | Code not accepted; allow retry or restart sign-in per `reason`. |
| `MFA_REQUIRED` | 403 | Session lacks MFA proof; sign in again (goes through MFA). |
| `MFA_ENROLMENT_REQUIRED` | 403 | Direct the user to enrol on the website; offer logout. |
| `TOKEN_INVALID` | 401 | Missing / malformed / forged token. Clear and sign in. |
| `TOKEN_EXPIRED` | 401 | Token past `exp`. Clear and sign in. |
| `SESSION_EXPIRED` | 401 | Absolute or idle timeout. Clear and sign in. |
| `SESSION_REVOKED` | 401 | Signed out elsewhere, by an admin, password change, or role/organisation change. Clear and sign in. |
| `ACCOUNT_DISABLED` | 401 | Account deactivated. Clear; show "contact your administrator". |
| `INSUFFICIENT_ROLE` | 403 | Not a salesperson or selling manager. Clear; explain. |
| `NO_ORGANISATION` | 403 | Account has no organisation. Clear; explain. |
| `ORGANISATION_SUSPENDED` | 403 | Organisation inactive, archived or security-suspended. Clear; explain. |
| `SUBSCRIPTION_SUSPENDED` | 402 | Billing suspended. Keep the session; show the blocked screen; allow logout. |
| `UNSUPPORTED_SESSION` | 403 | Impersonation or demo-guest browser session; not usable in the app. |
| `SERVICE_UNAVAILABLE` | 503 | Backend outage. Keep the session; retry with backoff. **Never sign out on 503.** |
| `SERVER_MISCONFIGURED` | 500 | Server configuration fault. Keep the session; retry later. |

Any other 5xx or a network failure is an outage: keep the session and retry.

### 7.3 Existing Sales APIs

Endpoints other than bootstrap (for example `GET /api/sales/app/leads`) still answer a failed
authentication with `401 {"error": "Unauthorized"}` and no `code`. When the app receives a
`401` without `code`, it should call bootstrap once: bootstrap returns the precise reason.
Two gates in front of every Sales API already return codes:

* `403 {"error": "MFA_ENROLMENT_REQUIRED", "code": "MFA_ENROLMENT_REQUIRED"}` for restricted tokens.
* `402 {"error": "SUBSCRIPTION_SUSPENDED", "code": "SUBSCRIPTION_SUSPENDED"}` for suspended billing.

The subscription gate runs before the route validates the session, so a revoked token whose
organisation is also suspended may first see `402`; bootstrap then reports `SESSION_REVOKED`.

Paths never blocked by the subscription gate: `/api/auth/*` (MFA, sessions, logout),
`/api/sales/app/auth`, `/api/sales/app/bootstrap`, `/api/sales/app/download`, `/api/billing/*`,
`/api/health`, `/api/status`, `/api/users/me/security-meta`.

---

## 8. Role and tenant constraints

* A Sales token is issued only to an **active** user who is a `SALESPERSON`, or a
  `CLIENT_MANAGER` with `also_sells = true`, linked to an organisation that is active, not
  archived and not security-suspended. This is enforced on **both** issuance paths (password
  sign-in and MFA completion) before a session row is created. Platform admins are refused.
* The organisation and user are always taken from the validated server session. Request
  parameters cannot select another organisation or user. A token whose claims no longer match
  the user's current role, organisation or selling flag is rejected (`SESSION_REVOKED`).
* Salespeople see and modify leads according to the organisation's assignment mode
  (`restrictions.leadVisibility`) and may modify only leads assigned to them.
* Salespeople cannot change company profile, identity, owner e-mail, business type, workflow
  configuration or assignment mode (`canManageCompanyProfile: false`); the server rejects such
  writes with 403 regardless of client behaviour.
* Impersonation (Support Access) and demo-guest sessions are web-only.

---

## 9. Android implementation checklist

1. Generate `deviceId` once per install (random UUID) and keep it with the app's private data.
2. Sign in → handle Response A / B / C. For B, call MFA completion with `channel: "mobile_sales"`.
3. Store the token in Keystore-backed encrypted storage. Never log it.
4. Call bootstrap. Check `schemaVersion`. Build navigation only from
   `navigation.destinations`; choose screens by `experience.id` and `homeVariant`.
5. If `subscription.salesAccess = "BLOCKED"`, show the blocked screen.
6. Send `Authorization: Bearer <token>` on every request; send
   `X-Segmiq-Activity: background` on background polls.
7. Handle error codes per section 7. Sign out locally on any `TOKEN_*` / `SESSION_*` /
   account / role / organisation code; never on `SERVICE_UNAVAILABLE`.
8. Logout: `POST /api/auth/session/logout` with the Bearer token, then delete local data
   regardless of the response.
9. Never ship or request a Supabase key; never call Supabase directly.

---

## 10. Known limitations (Phase 1)

* No refresh token; sessions end at `expiresAt` or earlier.
* "Sign out everywhere" from the app is not available (web / administrator only).
* Existing per-feature Sales APIs return a generic `401 Unauthorized` (section 7.3).
* MFA enrolment must be completed on the web.
* Pipelines, call outcomes and terminology are product defaults, not organisation-configurable.
* The SegmiQ Cloud field app (`channel: "mobile_cloud"`, `/api/cloud/app/auth`) is a separate
  product and is not covered by this contract.
