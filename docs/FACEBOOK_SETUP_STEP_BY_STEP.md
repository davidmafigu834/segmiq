# Facebook Lead Ads — step-by-step setup

This guide is for **super admins** who need to finish Facebook integration end-to-end: Meta (Facebook) developer settings first, then **Segmiq** per client. Meta’s UI changes occasionally; if a label differs slightly, use the **intent** described in each step.

**Quick path in Leadstaq (after Meta is ready):**  
**Dashboard → Clients → [choose client] → Facebook**  
URL shape: `/dashboard/clients/{clientId}/facebook`

---

## Part 0 — What you must have

| Requirement | Why |
|-------------|-----|
| **Super admin** account in Segmiq | Only `SUPER_ADMIN` can open the Facebook tab and call Facebook APIs. |
| A **Meta (Facebook) account** that can manage the **Facebook Page** receiving leads | You will log in with this account during “Connect with Facebook”. |
| That same person (or Business) can access **Meta Business Suite** / **Ads Manager** if you run Lead Ads | The Page and Lead Form must exist in Meta before Leadstaq can attach to them. |
| **HTTPS** production URL (or localhost for dev) | OAuth redirect and webhooks must use URLs Meta accepts. |

---

## Part 1 — Create and configure the Meta app (developers.facebook.com)

Do this **once** for your agency (not per Leadstaq client).

### 1.1 Open Meta for Developers

1. Go to **[https://developers.facebook.com/](https://developers.facebook.com/)**.
2. Log in with a Meta account that is allowed to create apps (often the same person who manages the Page or the agency’s Meta Business).
3. Open **My Apps** (top right) → **Create App** (or use an existing app).

### 1.2 Choose an app type that supports login + pages

- Prefer an app type that supports **Facebook Login** and **business / marketing** features (Meta’s wizard wording varies).
- Complete the wizard (app name, contact email, etc.) until you reach the **App Dashboard**.

### 1.3 Add products you need (if not already added)

In the app dashboard sidebar, add or confirm:

- **Facebook Login** (or the login product Meta shows for OAuth).
- **Webhooks** (so Meta can notify Leadstaq when a lead is submitted).

If you do not see **Webhooks**, use **Add product** and add it.

### 1.4 OAuth — redirect URL (critical)

Leadstaq redirects users back to your site after Facebook login. This URL **must match exactly** (including `http` vs `https`, no trailing slash unless you use one everywhere).

1. In the Meta app, open **Facebook Login** → **Settings** (or **Use cases** → your login use case → **Settings**).
2. Find **Valid OAuth Redirect URIs**.
3. Add **exactly** the value of your env var **`FACEBOOK_REDIRECT_URI`**, for example:
   - **Production:** `https://yourdomain.com/api/facebook/oauth/callback`
   - **Local dev:** `http://localhost:3000/api/facebook/oauth/callback`

Copy the same value into `.env.local` / hosting env as `FACEBOOK_REDIRECT_URI`.

### 1.5 App ID and secret → Leadstaq env

1. In the app dashboard, open **App settings** → **Basic**.
2. Copy **App ID** → `FACEBOOK_APP_ID`.
3. Copy **App secret** (show/reveal) → `FACEBOOK_APP_SECRET` (server only; never commit to git).

### 1.6 Webhooks — verify token and callback URL

1. In **Webhooks**, choose or add a **Page** subscription (Lead Ads use **Page** `leadgen` events).
2. **Callback URL** (Meta may call this “Callback URL” or “URL”):  
   `https://yourdomain.com/api/facebook/webhook`  
   (Use your real domain; for local testing, Meta often requires a public tunnel such as ngrok unless you only test in Meta’s tools.)
3. **Verify token:** invent a long random string. Put the **same** value in Leadstaq as **`FACEBOOK_WEBHOOK_VERIFY_TOKEN`**.
4. When Meta runs **verification**, Leadstaq answers **GET** on that URL. If verification fails, double-check the token and URL (no typos, HTTPS in production).

### 1.7 Subscribe to `leadgen`

After the webhook endpoint verifies:

1. In the **Page** webhook section, subscribe to the **`leadgen`** field (Meta’s name for “new lead from a Lead Ad / Instant Form”).
2. Save. If Meta asks which **Page** to attach, you may attach the Page here or rely on Leadstaq’s later step that subscribes the app to the Page when you select the Page in the UI—**both** must end with the Page sending `leadgen` to your app. If leads never arrive, revisit webhook **Page** subscriptions in Meta.

### 1.8 Permissions and app mode (Live vs Development)

- OAuth scopes Leadstaq requests include things like **pages**, **leads retrieval**, **pages_manage_ads**, **business_management**, **ads_read** (see `app/api/facebook/oauth/start/route.ts` in the repo). Add **`pages_manage_ads`** in the Meta app’s **App Review → Permissions** (or use a developer/test user in Development mode) if Graph reports missing that permission.
- In **Development** mode, only **testers / roles** added under **Roles** in the app can complete OAuth for a real Page in some setups.
- For production Pages and real customers, you typically need **Live** mode and any **App Review** Meta requires for those permissions.

If OAuth or Page list fails with a permissions error, open Meta’s **App Review** / **Permissions and features** and request what Meta asks for.

### 1.9 Graph API version

Set **`FACEBOOK_API_VERSION`** (e.g. `v19.0`) to match what your app is built for. It must stay in sync with URLs Meta documents for that version.

---

## Part 2 — Lead Ads in Meta (outside Leadstaq)

Leadstaq does **not** create your Lead Ad or Instant Form. You create them in Meta:

1. **Facebook Page** — the Page that will receive Lead Ads.
2. **Lead form** — Instant Form / Lead form attached to that Page (the form users submit on Facebook / Instagram).

Remember the **Page name** and **form name**; you will pick the same Page and form inside Leadstaq.

---

## Part 3 — Leadstaq environment (one-time per deployment)

Set these on the server (or `.env.local` for dev). See also `.env.example`.

| Variable | Purpose |
|----------|---------|
| `FACEBOOK_APP_ID` | From Meta app **Basic** settings. |
| `FACEBOOK_APP_SECRET` | From Meta; used for OAuth and webhook signature checks. |
| `FACEBOOK_REDIRECT_URI` | Must match Meta **Valid OAuth Redirect URIs** exactly. |
| `FACEBOOK_WEBHOOK_VERIFY_TOKEN` | Same random string you entered in Meta webhook setup. |
| `FACEBOOK_API_VERSION` | e.g. `v19.0` |
| `NEXTAUTH_URL` | Public site root, e.g. `https://yourdomain.com` |

Restart the app after changing env vars.

---

## Part 4 — Per-client flow in Leadstaq (the four steps)

Open: **Dashboard → Clients → [client] → tab “Facebook”.**

The screen shows a **wizard**: Connect account → Ad account → Page → Form. Complete them **in order**.

### Step 1 — Connect account

1. Click **Connect with Facebook** (or **Reconnect** if you are fixing an expired connection).
2. A Meta window opens — **log in** as someone who can grant access to the **Page** and **Business** assets you need.
3. **Accept** all requested permissions. If you skip any, later steps may fail (empty Page list, errors from Graph API).
4. Meta redirects to Leadstaq’s **`/api/facebook/oauth/callback`**, then back to the Facebook tab.  
   **If you see an error:** read the message on the tab; common causes are redirect URI mismatch, app in Development without your user as a role, or missing permissions.

### Step 2 — Ad account

1. Leadstaq loads **Ad accounts** your token can use (for **Campaigns** / marketing insights).
2. **Select** the correct account and confirm/save.  
   If only one account exists, Leadstaq may auto-select it.

### Step 3 — Page

1. Leadstaq lists **Facebook Pages** your token can manage (`me/accounts`).
2. Choose the **same Page** where your Lead Ad / form lives.
3. Confirm. Leadstaq stores the Page and subscribes the app for **leadgen** on that Page where applicable.

**If the list is empty:** the Facebook user you used is probably not an **admin/editor** on that Page, or the app lacks permissions. Fix roles in Meta or reconnect with a user who manages the Page.

### Step 4 — Lead form

1. Leadstaq lists **lead generation forms** for the selected Page.
2. Pick the **exact form** that should create leads in Leadstaq for **this** client.
3. Save.

**Important:** One Leadstaq client should map to **one** Page + **one** form pair. Duplicating the same pair on two clients is not supported and will confuse webhooks.

---

## Part 5 — Confirm it works

1. **Webhook:** In Meta’s webhook UI, confirm the **Page** subscription is active and **`leadgen`** is subscribed.
2. **Test lead:** Submit a test lead in Meta (Lead Ads testing tool or a real ad), then in Leadstaq open **Dashboard → All Leads** and look for **source FACEBOOK**.
3. **Backfill (optional):** On the Facebook tab, use **Backfill missed leads** if you need historical imports (respect rate limits shown in the UI).

---

## Part 6 — Where people get stuck (short fixes)

| Problem | What to do |
|---------|------------|
| “Redirect URI mismatch” | Meta **Valid OAuth Redirect URIs** must **exactly** equal `FACEBOOK_REDIRECT_URI` (scheme, host, path). |
| OAuth works but **no Pages** | Use a Facebook login that is **Page admin** (or has task access). Check app **Live** mode and **roles** for dev. |
| **Webhook verification failed** | Same verify token in Meta and `FACEBOOK_WEBHOOK_VERIFY_TOKEN`; callback URL must hit your live server (HTTPS). |
| **403** on webhook POST | Wrong `FACEBOOK_APP_SECRET` or a proxy modifying the raw body (signature must match raw body). |
| Leads never appear | Finish **Step 4 (form)**; Page + form IDs must match the Lead Ad; webhook must deliver `leadgen` for that Page. |
| “Connection expired” in Leadstaq | Click **Reconnect**; refresh permissions in Meta; check Page access was not revoked. |

---

## Part 7 — Technical reference (deeper detail)

For architecture, API route table, token expiry behavior, and security checklist, see **[FACEBOOK_INTEGRATION.md](./FACEBOOK_INTEGRATION.md)** in the same `docs/` folder.

---

*If Meta renames a menu, search the app dashboard for **“Redirect”**, **“Webhook”**, **“leadgen”**, or **“Facebook Login”**.*
