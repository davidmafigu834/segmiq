# SegmiQ secret rotation

| Secret | Where | Rotate how | Notes |
|---|---|---|---|
| `NEXTAUTH_SECRET` | Env | Generate new; redeploy; all sessions invalid | Coordinate downtime |
| Supabase service role | Env | Dashboard → rotate → update env | Never ship to browser |
| `ACCOUNT_SECURITY_KEY` / MFA crypto | Env | **Do not casual-rotate** — seals MFA secrets | Planned migration only |
| `CRON_SECRET` | Env | New value + update callers | Timing-safe compare |
| Website integration API key | Per client | UI rotate (hash stored) | Old key dies immediately |
| Meta / Facebook tokens | Token vault | Reconnect OAuth | Encrypted at rest |
| User passwords | DB bcrypt | User change or admin reset | Revokes other sessions |

## After any production secret change

1. Confirm `instrumentation` startup passes  
2. Smoke: login, MFA challenge, one CRM write, cron ping  
3. Record event in ops log / ticket
