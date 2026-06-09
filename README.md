# Leadstaq

Lead management for marketing agencies and their service-business clients. Built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, **Supabase (PostgreSQL)**, **NextAuth.js**, and **Zustand**.

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (PostgreSQL)

## Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Database**

   - In the Supabase SQL editor, run the SQL in `supabase/migrations/001_initial_schema.sql`.
   - Optionally use the connection string as `DATABASE_URL` for external tools (Drizzle/pgAdmin). The app uses the Supabase JS client with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

3. **Environment**

   Copy `.env.example` to `.env.local` and fill in values.

4. **Seed**

   ```bash
   npm run seed
   ```

   Default admin (after seed): `admin@leadstaq.com` / `admin123`.

5. **Storage buckets (Supabase Dashboard)**

   Create buckets: `client-logos`, `landing-page-images`, `lead-attachments`. Use signed URLs for private files (see `lib/storage.ts`).

6. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Development

### Testing cron endpoints locally

```bash
# Set CRON_SECRET in your .env.local
curl -X GET \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  http://localhost:3000/api/cron/check-leads
```

Expected response: `200 OK` with JSON body containing counts of leads processed. In `NODE_ENV=development`, `lib/cron-auth.ts` also allows unauthenticated cron calls for quick local testing.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for API routes and seed |
| `DATABASE_URL` | Postgres URL (optional; for migrations/tools) |
| `NEXTAUTH_SECRET` | Session encryption |
| `NEXTAUTH_URL` | Public app URL (e.g. `https://your-app.vercel.app`) |
| `NEXT_PUBLIC_APP_DOMAIN` | Apex domain for subdomain routing (e.g. `leadstaq.com`) |
| `META_WHATSAPP_*` | Meta Cloud API: WhatsApp phone number ID, access token — [docs/meta-whatsapp-setup.md](docs/meta-whatsapp-setup.md) |
| `TWILIO_*` | **Deprecated** (rollback only); was Twilio Content API SIDs |
| `DEFAULT_COUNTRY_CODE` | ISO country for parsing local phones (e.g. `ZW`) |
| `RESEND_API_KEY` | Resend API key (server-only) |
| `RESEND_FROM_EMAIL` | Verified sender address (e.g. `notifications@yourdomain.com`) |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Meta app (Login + Marketing API) |
| `FACEBOOK_REDIRECT_URI` | Must match app settings exactly, e.g. `https://your-app.vercel.app/api/facebook/oauth/callback` |
| `FACEBOOK_WEBHOOK_VERIFY_TOKEN` | Same value configured on the Meta webhook |
| `FACEBOOK_API_VERSION` | Graph API version (default `v19.0`) |
| `CRON_SECRET` | `Authorization: Bearer` for `/api/cron/*` in production. Set the same value on Vercel, in the repo’s Actions secrets (GitHub cron), and in `.env.local` for manual curl tests. |

For outbound email, verify the sending domain for `RESEND_FROM_EMAIL` in Resend (SPF and DKIM records) so messages authenticate correctly.

## Add a new client

1. Sign in as agency admin.
2. Insert or create a **Client** row (via seed or Supabase) with a unique `slug`.
3. Configure **Form** (`/dashboard/clients/[clientId]/form`) and **Landing** (`/dashboard/clients/[clientId]/landing-page`).
4. Assign **Client manager** and **Salespeople** users with `client_id` set.

## Facebook Lead Ads

1. Create a Meta app with **Facebook Login** and the permissions used by Leadstaq (`leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_manage_ads`, `business_management`, `ads_read`).
2. In the app’s **Facebook Login** settings, add **Valid OAuth Redirect URIs**: the same value as `FACEBOOK_REDIRECT_URI` (for production, e.g. `https://app.leadstaq.com/api/facebook/oauth/callback`).
3. Set `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_REDIRECT_URI`, `FACEBOOK_WEBHOOK_VERIFY_TOKEN`, and optionally `FACEBOOK_API_VERSION` in your environment.
4. Configure the **Webhooks** product: callback `https://your-domain/api/facebook/webhook`, verify token = `FACEBOOK_WEBHOOK_VERIFY_TOKEN`, subscribe to `leadgen` at the **Page** level (the in-app flow subscribes the app when you select a Page).
5. As agency admin, open **Dashboard → Client → Facebook** and run **Connect with Facebook**, then pick the Page and Lead Form. No manual database edits are required.

## Meta WhatsApp (Cloud API) templates

Business-initiated WhatsApp uses **Meta-approved** templates only. Template names (`segmiq_*`) are hardcoded in `lib/messaging/meta-whatsapp.ts`. Placeholders in code are **1–indexed** (`1`, `2`, …).

Setup, webhook, and WABA: **[docs/meta-whatsapp-setup.md](docs/meta-whatsapp-setup.md)**.

Implementation: `lib/messaging/provider.ts` → `sendWhatsApp` → `lib/messaging/meta-whatsapp.ts`. Delivery and status updates (read receipts) are recorded in **`message_logs`**. **Email** is unchanged (Resend).

**Rollback:** set `lib/messaging/provider.ts` to use the deprecated `lib/messaging/twilio.ts` and keep `TWILIO_*` in env.

## Deployment

**Cron & GitHub Actions:** On Vercel Hobby, arbitrary schedules are not available for Vercel Cron. Production schedules for uncontacted-lead checks (every 30 min), follow-up reminders, and the weekly-digest hook are run via **GitHub Actions** (see [`.github/README.md`](.github/README.md) for `APP_URL` / `CRON_SECRET` setup, schedule table, and manual “Run workflow” tests).

## Deploy (Vercel)

- **NextAuth (login):** In production, **`NEXTAUTH_SECRET` is required**. If it is missing, sign-in shows `/api/auth/error` — *“There is a problem with the server configuration.”* Generate one locally: `openssl rand -base64 32`, add it under Vercel → Project → Settings → Environment Variables, then redeploy.
- Set **`NEXTAUTH_URL`** to your live site origin with **no path**, e.g. `https://leadstaq.tech` (must match how users open the app; avoid `http://` or a wrong host).
- **Hobby (free):** Vercel only allows cron expressions that run **at most once per day**. This repo can still use a single daily job: `vercel.json` → `/api/cron/daily` at **06:00 UTC** (uncontacted-lead + follow-up in one request). If you also use **GitHub Actions** for the same work on sub-daily or different times, consider trimming `vercel.json` crons to avoid duplicate runs.
- Set **`CRON_SECRET`** in the Vercel project environment. It must match the **`CRON_SECRET`** GitHub Actions secret; any caller (Vercel Cron, GitHub Actions) sends `Authorization: Bearer <CRON_SECRET>`.
- For ad-hoc external pings (e.g. [cron-job.org](https://cron-job.org)), `GET` **`/api/cron/check-leads`** with the same `Authorization` header and value as in production.
- Set all other env vars in the Vercel project (including **`NEXT_PUBLIC_SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`**).

## Build

```bash
npm run build
```


Field	Value
Email
admin@leadstaq.com
Password
admin123
Role
AGENCY_ADMIN
