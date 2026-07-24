# Facebook Lead Ads integration

**New:** For a **beginner-friendly, ordered checklist** (Meta’s screens + Leadstaq’s four steps), see **[FACEBOOK_SETUP_STEP_BY_STEP.md](./FACEBOOK_SETUP_STEP_BY_STEP.md)**.

This guide describes how Leadstaq connects to Meta (Facebook) Lead Ads, what to configure outside the app, and how operators use the Facebook tab per client.

## Overview

- **Source:** When someone submits a Lead Ad form on a connected Page, Meta sends a webhook to Leadstaq. The app fetches the full lead from the Graph API and creates a **Lead** with `source: FACEBOOK`, same pipeline as landing-page leads (round-robin, notifications).
- **Who connects:** Only **agency admins** (`AGENCY_ADMIN`). Client managers and salespeople cannot use the Facebook setup UI or APIs.
- **Architecture:** The client’s Business Manager adds the agency’s Meta app as a partner; the agency completes OAuth in Leadstaq and selects Page + Lead Form (and an Ad account for the Campaigns feature).

## Prerequisites

1. **Supabase migrations** (run in order on your project), including:
   - Facebook-related columns on `clients` (from earlier migrations).
   - `010_leads_facebook_lead_id.sql` — `leads.facebook_lead_id` + unique index per `(client_id, facebook_lead_id)` for deduplication.
   - `011_fb_token_expired_at.sql` — `clients.fb_token_expired_at` for Graph token expiry detection and UI.

2. **Resend** (optional but recommended): `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — used for “no salesperson” alerts and “Facebook token expired” emails to agency admins.

3. **Twilio WhatsApp** (optional): configured for new-lead notifications as elsewhere in the app.

## Meta Developer App (outside Leadstaq)

1. Create a **Business** type app in [Meta for Developers](https://developers.facebook.com/).
2. Request/use permissions aligned with the OAuth scopes in code (including **`ads_read`** for the Campaigns dashboard and **`pages_manage_ads`** where Graph returns `(#200) Requires pages_manage_ads permission` for Page-linked ad objects).
3. **Valid OAuth Redirect URIs:** add exactly the value of `FACEBOOK_REDIRECT_URI` (e.g. `https://yourdomain.com/api/facebook/oauth/callback`).
4. **Webhooks**
   - **Callback URL:** `https://yourdomain.com/api/facebook/webhook`
   - **Verify token:** must match `FACEBOOK_WEBHOOK_VERIFY_TOKEN` in your environment.
   - **Subscription fields:** `leadgen` (and configure the app to receive Page leadgen events as Meta documents).

## Environment variables

Copy from `.env.example` and set in `.env.local` (development) and your host (production).

| Variable | Purpose |
|----------|---------|
| `FACEBOOK_APP_ID` | Meta app ID |
| `FACEBOOK_APP_SECRET` | Meta app secret; used for OAuth and **webhook signature verification** (`X-Hub-Signature-256`) |
| `FACEBOOK_REDIRECT_URI` | OAuth redirect; must match Meta app settings |
| `FACEBOOK_WEBHOOK_VERIFY_TOKEN` | Random string; Meta sends it during webhook verification |
| `FACEBOOK_API_VERSION` | Graph API version (e.g. `v19.0`); used for all Graph calls routed through `graphCall` |
| `NEXTAUTH_URL` | Public base URL of the app (e.g. `https://yourdomain.com`) — used in emails and absolute links |

**Note:** `INTERNAL_API_SECRET` is **not** used anymore. Webhooks call `createLead` in-process; do not rely on an internal submit secret.

## Operator flow (per client)

Path: **Dashboard → Clients → [client] → Facebook** (`/dashboard/clients/[clientId]/facebook`).

### Step 1 — Connect account

1. Click **Connect with Facebook** (opens `/api/facebook/oauth/start?clientId=...`).
2. Approve permissions on Meta.
3. Meta redirects to `/api/facebook/oauth/callback`; Leadstaq stores a long-lived **user** token and expiry, then sends you back to the Facebook tab (next step: Ad account).

**Reconnect:** use **Reconnect with Facebook** or `?reconnect=1` on the start URL to clear existing Facebook fields and start over.

### Step 2 — Ad account

Select the Ads account used for **Campaigns** insights (Marketing API). If only one account is returned, it may be auto-selected.

### Step 3 — Page

1. Leadstaq lists Pages via Graph `me/accounts`.
2. Select a Page and confirm. The backend:
   - Fetches a **Page** access token.
   - Subscribes the app to the Page for **`leadgen`**.
   - Saves `fb_page_id`, `fb_page_name`, replaces `fb_access_token` with the **Page** token (user token is preserved in `fb_user_access_token` for Marketing API).

### Step 4 — Lead form

1. Lists `leadgen_forms` for the selected Page.
2. Save one form per client (`fb_form_id`, `fb_form_name`).

### Connected summary

- Page name, form name, webhook status, last Facebook lead time, token expiry warning (&lt; 7 days).
- **Disconnect** — clears Facebook fields on the client.
- **Backfill missed leads** — opens a modal; choose “since” datetime and **Run backfill** to pull recent leads from Graph for that form and insert any missing rows (deduped by `facebook_lead_id`). Rate limit: **one backfill per client per minute**. Up to **10** Graph pages of results per run.

### Form intent rules (qualification)

After a Lead Form is connected, the Facebook tab shows **Form intent rules**:

1. **Refresh questions from Facebook** — Graph `/{form_id}?fields=questions` caches options on `clients.fb_form_questions` (also runs automatically when a form is selected).
2. For each non-contact question, map answers to **High / Medium / Low** intent (or Ignore).
3. **Enable scoring** + **Save** — stores `fb_qualification_enabled` and `fb_qualification_rules`.
4. New Facebook leads (webhook + backfill) are scored in `createLead`: `form_data._fbQualScore` / `_fbQualTier` / `_fbQualReasons`, plus `leads.score` and `manual_priority`.
5. **Cold** forced answers skip Call now (Nurture / later). Hot answers sort to the top of priority lists and show a **Form · hot** chip on Facebook lead cards.

Rules are client-specific (e.g. solar: budget band + ZESA = hot; “just exploring” = cold) and take precedence over generic AI intent when present.

## Webhook behavior

- **GET** `/api/facebook/webhook` — Meta subscription verification (`hub.verify_token` must match `FACEBOOK_WEBHOOK_VERIFY_TOKEN`).
- **POST** — Raw body is read for **`X-Hub-Signature-256`** (HMAC-SHA256 with app secret). Invalid signature → **403**.
- Only **`object: "page"`** payloads are processed; others return **200** without work.
- For each `leadgen` change, Leadstaq finds **exactly one** client with matching **`fb_page_id`** and **`fb_form_id`** and a non-null token. No match → logged, **200** (no retry storm).
- Lead payload is loaded from Graph; **`createLead`** handles dedupe, assignment, and notifications. **200** is returned to Meta even if Graph or DB logic logs an error (to avoid endless retries on your side).

## Token expiry (Graph errors)

When Graph returns an OAuth-style error (e.g. code **190** or certain subcodes), Leadstaq:

- Sets `fb_webhook_verified` to `false` and **`fb_token_expired_at`** to the current time.
- Sends **at most one email per 24 hours** per client to active agency admins (`sendTokenExpiryAlert`), with a link to reconnect.

The Facebook tab shows a **Connection expired** state when `fb_token_expired_at` is set; reconnecting via OAuth clears that field.

## API routes (reference)

| Method | Path | Role | Notes |
|--------|------|------|--------|
| GET | `/api/facebook/oauth/start` | Agency admin | Starts OAuth |
| GET | `/api/facebook/oauth/callback` | Logged-in agency admin | Meta redirect target |
| GET | `/api/facebook/pages` | Agency admin | Lists Pages |
| POST | `/api/facebook/pages/select` | Agency admin | Saves Page + subscribes `leadgen` |
| GET | `/api/facebook/forms` | Agency admin | Lists leadgen forms |
| POST | `/api/facebook/forms/select` | Agency admin | Saves form + syncs questions |
| GET/POST | `/api/facebook/forms/questions` | Agency admin | Read / refresh cached form questions |
| GET/POST | `/api/facebook/qualification-rules` | Agency admin | Read / save intent rules |
| GET | `/api/facebook/ad-accounts` | Agency admin | Lists ad accounts |
| POST | `/api/facebook/ad-accounts/select` | Agency admin | Saves ad account |
| POST | `/api/facebook/disconnect` | Agency admin | Clears Facebook state |
| POST | `/api/facebook/backfill` | Agency admin | Imports missing leads since `sinceIso` |
| GET/POST | `/api/facebook/webhook` | **Public** (Meta) | Signature required on POST |

Public landing lead submission remains **`POST /api/leads/submit`** (browser); no Facebook secret required.

## Testing

1. Use Meta’s **Lead Ads Testing Tool** (in the developer tools) to send a test lead to the connected Page/form.
2. Confirm a new row in **Dashboard → Leads** with source **FACEBOOK**.
3. Send the same test twice if Meta redelivers — only **one** row per `facebook_lead_id` per client.
4. Optional: use **Backfill** with a “since” time just before a test submission to verify imports.

## Troubleshooting

| Symptom | Things to check |
|---------|------------------|
| Webhook never verifies | `FACEBOOK_WEBHOOK_VERIFY_TOKEN` matches Meta; callback URL exact (HTTPS in prod). |
| POST webhook 403 | `FACEBOOK_APP_SECRET` correct; body must not be altered by proxies (raw body signing). |
| Leads go to wrong client | Each client must have a **unique** Page + form pair; duplicate pairings are unsupported. |
| No leads created | Client must have completed **form** selection; `fb_page_id` + `fb_form_id` + token must match webhook `page_id` / `form_id`. |
| “Connection expired” in UI | Reconnect OAuth; check Meta app permissions and that the Page user still grants access. |
| Backfill 502 + `tokenExpired` | Reconnect; Page token may be invalid. |
| Backfill 429 | Wait one minute between backfills for the same client. |
| **fb_user_access_token / schema cache** error on connect | The **clients** table is missing Facebook columns from migration **004** (duplicate-safe repair in **015**). In Supabase **SQL Editor**, run `supabase/migrations/015_ensure_fb_user_access_token.sql`, then reconnect. If it still fails briefly, run `NOTIFY pgrst, 'reload schema';` or restart the project to refresh PostgREST. |
| OAuth finishes but UI still shows **Connect Facebook** | Deploy includes a **no-store** redirect from the OAuth callback and a **forced dynamic** Facebook page so the client row reloads. If it still happens: hard-refresh the tab; confirm the callback URL in the browser network tab returned **302** to `/facebook?step=adaccount` (not `/login` or `/dashboard?fbError=…`). |

## Code map (for developers)

- **Lead creation:** `lib/leads/createLead.ts`
- **Graph + token expiry:** `lib/facebook/graph.ts` (also re-exported from `lib/facebook-graph.ts`)
- **Webhook signature:** `lib/facebook/signature.ts`
- **Structured logs:** `lib/facebook/log.ts` (`fbLog`)
- **Notifications:** `lib/notifications.ts` (`notifyNewLead`, `notifyAdminsNoSalesperson`, `sendTokenExpiryAlert`)
- **UI:** `app/(agency)/dashboard/clients/[clientId]/facebook/FacebookConnectPanel.tsx`

## Security checklist

- [ ] `FACEBOOK_APP_SECRET` only in server env, never in client bundles.
- [ ] Webhook **POST** always rejected without valid **HMAC** signature.
- [ ] `FACEBOOK_WEBHOOK_VERIFY_TOKEN` is a long random value, not guessable.
- [ ] Production `NEXTAUTH_URL` matches your public site URL (emails and redirects).

---

*Last updated to reflect Leadstaq’s Facebook Lead Ads + Marketing API integration as implemented in the repository (OAuth, webhook, `createLead`, Graph client, backfill, token expiry handling).*
