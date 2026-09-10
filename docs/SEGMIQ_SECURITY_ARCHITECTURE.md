# SegmiQ security architecture (Phase 6)

## Trust boundaries

| Boundary | Mechanism |
|---|---|
| Browser → App | NextAuth JWT cookie + `user_sessions` registry; Origin check on sensitive mutations |
| App → DB | Supabase **service role** only on server; never expose to client |
| Tenant | `users.client_id` → `clients.id`; fail-closed search/agent/API guards |
| Public ingest | Website API key (hashed at rest) or magic tokens with allowlists |
| Cron / jobs | Timing-safe `CRON_SECRET` bearer |

## Roles

- `SUPER_ADMIN` — platform only; MFA recommended/required by env; impersonation requires MFA + step-up + reason + 60m TTL
- `CLIENT_MANAGER` — org security policy + audit read
- `SALESPERSON` — assigned-scope CRM; no org policy manage

## Session model

1. JWT signature alone is insufficient  
2. `session_version` = global revoke-all  
3. `user_sessions` row must be active, non-expired, non-idle  
4. Org `security_policy` can tighten idle/absolute TTL (baked into session at create)  
5. WhatsApp QR sessions are independent  

## Secrets at rest

- User passwords: bcrypt  
- MFA TOTP secrets: AES-GCM envelope (`ACCOUNT_SECURITY_KEY`)  
- Meta/FB tokens: token vault  
- Website integration keys: SHA-256 hash only (plaintext column retired; active plaintext rows must be 0)  

## Headers

See `next.config.mjs`: nosniff, frame deny, referrer, Permissions-Policy, CSP Report-Only (enforce with `CSP_ENFORCE=true`), HSTS in production.
