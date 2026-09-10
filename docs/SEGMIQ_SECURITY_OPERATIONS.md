# SegmiQ security operations

## Startup gate

`instrumentation.ts` runs `assertProductionSecurityEnv()`. Production fails closed if required secrets are missing (`NEXTAUTH_SECRET`, Supabase URL/service role, account security crypto key, etc.).

## Org policy

Managers: **Settings → Security → Organisation policy**

- MFA requirement: off | managers | all (grace via `mfaGraceUntil`)  
- Idle TTL hours (1–24) / absolute TTL hours (8–168)  
- Allow / deny data exports  

API: `GET/PATCH /api/org/security-policy` (PATCH requires origin + step-up).

## Audit

`GET /api/org/security-audit` — organisation admin events only; **IPs omitted**.  
CSV export: `?format=csv` requires step-up.

## Impersonation

1. SUPER_ADMIN with MFA enrolled  
2. Recent step-up  
3. Support reason (≥8 chars)  
4. Banner + 60-minute session cap  
5. Stop restores real admin session (`POST /api/agency/impersonate/stop`)

## Client security suspend

Set `clients.security_suspended_at` (ops/SQL). Non-platform users fail auth validation with `client_security_suspended`.

## Website API keys

Rotate via Website integration UI / `POST .../website-integration` (step-up). Plaintext returned **once**; stored as hash.
