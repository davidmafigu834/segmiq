# SegmiQ Account Security (Phase 4)

## Architecture

```text
Password
   ↓
MFA Challenge (if enabled) — short-lived user_auth_challenges
   ↓
Authenticated Session (user_sessions)
   ↓
Security Activity (security_events)
```

WhatsApp QR connection sessions remain **completely separate**.

## Encryption

- TOTP secrets sealed with AES-256-GCM.
- Prefer `ACCOUNT_SECURITY_ENCRYPTION_KEY` (32-byte hex or base64).
- Fallback: `WHATSAPP_SESSION_ENCRYPTION_KEY` with AAD `mfa:totp:{userId}`.
- **Never** use `NEXTAUTH_SECRET` as the encryption key.
- Operational backup: losing the encryption key makes existing MFA secrets unreadable — store the key in the same secret manager as other SegmiQ envelope keys.

## SUPER_ADMIN MFA rollout

| Env | Effect |
|---|---|
| `MFA_ENFORCE_SUPER_ADMIN` unset / not `true` | MFA **recommended** for SUPER_ADMIN (prompt on Security page). No lockout. |
| `MFA_ENFORCE_SUPER_ADMIN=true` | After grace period, MFA **required** (enrolment banner; policy level `required`). |
| `MFA_SUPER_ADMIN_GRACE_DAYS` | Default `14`. |
| `ACCOUNT_SECURITY_ROLLOUT_AT` | ISO date start of grace (default `2026-09-09`). |

Existing SUPER_ADMIN users are **not** locked out on deploy. Enable enforcement only after admins have enrolled.

## Role policy

| Role | MFA |
|---|---|
| SALESPERSON | Optional |
| CLIENT_MANAGER | Recommended |
| SUPER_ADMIN | Recommended → Required after safe rollout |

Organisation-wide “require MFA for all users” is intentionally **not** built yet (Phase 5+).

## Password reset + MFA

Password reset:

1. Updates password + `password_changed_at`
2. Bumps `session_version` and revokes all sessions
3. **Does not** disable MFA

Next login requires new password **and** MFA if enabled.

## Lost authenticator + recovery codes

There is **no** self-service MFA bypass.

### Support procedure (restricted)

1. Verify identity out-of-band (company admin / known contacts / contract).
2. Only `SUPER_ADMIN` may call `POST /api/auth/admin/mfa-reset` with:
   - own TOTP step-up
   - `confirm: true`
   - written reason
3. Event `MFA_ADMIN_RESET` is recorded (actor + target).
4. CLIENT_MANAGER cannot reset another employee’s MFA.

If no strong identity verification is possible, **do not** reset MFA.

## Security notifications (Resend)

Sent (deduped for new sign-in ~6h per user+device key):

- New sign-in
- Password changed / reset
- MFA enabled / disabled
- Recovery code used
- Sign out everywhere

Never include tokens, passwords, OTPs, or recovery codes.

## Login alert deduplication

`shouldSendNewSignInEmail(userId, deviceKey)` suppresses repeats within 6 hours for the same user+device key (device_id or label).

## Invariants

1. Raw session credentials are never exposed by device APIs.
2. Users can only inspect/revoke their own sessions (except platform admin MFA reset).
3. MFA secrets are encrypted at rest.
4. Recovery codes are stored only as hashes.
5. MFA is not active until setup code is verified.
6. Password reset does not bypass MFA.
7. Existing authenticated session alone is insufficient for disabling MFA (password + TOTP).
8. SUPER_ADMIN requires stronger authentication than normal users.
9. MFA challenge state is not a full SegmiQ session.
10. No MFA secret, OTP, password or recovery code is logged.
11. WhatsApp QR sessions remain separate from human account MFA/session management.

## New-device detection

A newly created `user_sessions` row is treated as a new sign-in. Mobile `device_id` improves stability. No invasive fingerprinting. IP is not authoritative.
