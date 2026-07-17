## Cron Jobs via GitHub Actions

Leadstaq's scheduled background jobs run via GitHub Actions workflows in `.github/workflows/`. These hit the app's `/api/cron/*` endpoints on a schedule.

### Required GitHub Secrets

Configure these in **Settings → Secrets and variables → Actions** for the repo:

| Secret        | Value                                                      | Example                   |
| ------------- | ---------------------------------------------------------- | ------------------------- |
| `APP_URL`     | Production URL of the deployed app (no trailing slash)   | `https://app.leadstaq.com` |
| `CRON_SECRET` | Long random string. Must match the same env var set in Vercel | `openssl rand -hex 32` output |

### Schedules

| Workflow                     | Frequency                  | Purpose                                               |
| ---------------------------- | -------------------------- | ----------------------------------------------------- |
| `cron-check-leads.yml`       | Every 30 minutes           | Flags uncontacted leads past SLA, notifies managers |
| `cron-follow-up-reminders.yml` | Daily at 06:00 UTC       | Sends WhatsApp prep (tomorrow) and due/overdue follow-up reminders |
| `cron-weekly-digest.yml`     | Mondays at 09:00 UTC     | Weekly performance summary email to managers         |

### Testing a workflow manually

1. Go to the **Actions** tab in GitHub.
2. Pick the workflow from the left sidebar.
3. Click **Run workflow** → select branch → **Run workflow**.
4. Watch the run output for response status and body.

### Notes

- Use the **production** URL in `APP_URL`, not a preview deployment (preview URLs change per PR).
- GitHub Actions scheduled workflows pause after 60 days of repo inactivity. Any commit resets the timer.
- GitHub's cron has ~5-10 minute drift sometimes — not a problem for these use cases.
- Failed workflow runs send email alerts to repo admins automatically.

### Switching to Vercel Cron later

If you upgrade to Vercel Pro and want to move crons back to Vercel:

1. Add `vercel.json` with the `crons` array (schedules match the workflows above).
2. Disable the three `.yml` workflows by renaming to `.yml.disabled` or deleting.
3. No code changes needed in the endpoints — Vercel also uses `Authorization: Bearer` for cron auth.

### Verification checklist

- Three workflow files exist in `.github/workflows/`
- Each workflow has both `schedule` and `workflow_dispatch` triggers
- Each workflow fails loudly on missing secrets
- Each workflow fails loudly on non-200 response
- Cron endpoints validate `Authorization: Bearer` + `CRON_SECRET` (see `lib/cron-auth.ts` and each route)
- `CRON_SECRET` documented in `.env.example`
- GitHub secrets `APP_URL` and `CRON_SECRET` added in repo settings
- `.env` on Vercel (production environment) has the same `CRON_SECRET` value
- Manually triggered `cron-check-leads` via GitHub Actions UI → returns 200 with expected body
- Manually triggered `cron-follow-up-reminders` → returns 200
- Manually triggered `cron-weekly-digest` → returns 200 with `implemented: false` if placeholder

`npm run build` passes with zero errors (no new TypeScript issues).
