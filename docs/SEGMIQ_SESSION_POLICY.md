# SegmiQ Session Policy (Phase 2)

## Durations

| Role | Idle timeout | Absolute lifetime |
|---|---|---|
| SALESPERSON / CLIENT_MANAGER | 8 hours | 7 days |
| SUPER_ADMIN | 2 hours | 24 hours |

JWT `maxAge` upper bound = 7 days. SUPER_ADMIN absolute/idle enforced via `user_sessions`.

## Activity

- `last_seen_at` updates at most every **5 minutes**
- Header `x-segmiq-activity: 0` (or background API paths) does **not** extend idle
- Background paths: `/api/notifications*`, `/api/presence`, `/api/whatsapp/gateway*`, `/api/agent/jobs*`

## Logout

- Current device: revoke that `user_sessions` row (`USER_LOGOUT`) — does **not** bump `session_version`
- Sign out everywhere: revoke all + bump `session_version`
- Password change (voluntary): revoke **other** sessions only; current remains
- Password reset / disable / role change: bump `session_version` + revoke all

## Legacy sessions

JWTs without `sessionId` are rejected (one-time re-login after deploy).

## WhatsApp

Company WhatsApp QR sessions are **not** tied to `user_sessions`.
