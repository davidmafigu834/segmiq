## Cron jobs (Vercel)

Scheduled background jobs are defined in **`vercel.json`** at the repo root. Vercel invokes each path on its schedule and sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set in the Vercel project environment.

### Schedules

| Path | Frequency | Purpose |
| ---- | --------- | ------- |
| `/api/cron/daily` | Daily 06:00 UTC | Lead scoring, intelligence, coaching, uncontacted checks, due/prep follow-up reminders, billing |
| `/api/cron/check-followups` | Every minute | Timed callback follow-up WhatsApp reminders |
| `/api/cron/check-leads` | (manual / external) | Deprecated alias for timed callback follow-ups; prefer `check-followups`. Uncontacted SLA stays on daily. |
| `/api/cron/weekly-digest` | Mondays 06:00 UTC | Weekly manager performance digest |
| `/api/cron/health` | Every 5 minutes | Health probe |
| `/api/cron/whatsapp-campaigns` | Every 5 minutes | Scheduled WhatsApp campaign sends |

### Setup

1. Set **`CRON_SECRET`** in Vercel → Project → Settings → Environment Variables (generate with `openssl rand -hex 32`).
2. Deploy so `vercel.json` crons are registered on the production deployment.
3. In Vercel → Project → Settings → Cron Jobs, confirm the schedules appear after deploy.

### Manual testing

From a shell (replace origin and secret):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://your-app.vercel.app/api/cron/check-leads"
curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://your-app.vercel.app/api/cron/check-followups"
curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://your-app.vercel.app/api/cron/follow-up-reminders"
```

Agency admins can also preview and trigger follow-up reminders from **Agency → Follow-up reminders**.

### Notes

- Sub-daily schedules require a Vercel plan that supports them (Pro or above). Hobby allows at most one run per day per cron.
- Cron auth is implemented in `lib/cron-auth.ts`; routes return `401` when the bearer token does not match `CRON_SECRET`.
- `/api/cron/follow-up-reminders` remains available for manual or ad-hoc runs; production due/prep batches are covered by the daily job.
