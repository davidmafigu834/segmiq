# Temporary WhatsApp quick connection

This is a limited, reversible beta transport for manual one-to-one WhatsApp Business conversations. It is not the official Meta Cloud API and must not be used for automation, groups, status, newsletters, or bulk messaging.

The gateway uses the maintained `@whiskeysockets/baileys` WebSocket library. It must run as a dedicated long-lived Node 20+ service, never inside Vercel functions, and never on a host that sleeps or scales to zero. Run one gateway replica for the MVP; database lease fields reserve a later coordinated multi-replica design.

`WHATSAPP_GATEWAY_RENDER_DEPLOYMENT.md` is the current deployment path for a Vercel-hosted app. `WHATSAPP_GATEWAY_ORACLE_DEPLOYMENT.md` covers the equivalent setup on a self-managed VM and applies to any provider.

The gateway runs through `tsx`, so `tsx` and `@next/env` are declared as runtime `dependencies` rather than dev dependencies. A production install that omits dev dependencies must still be able to start the service.

## Rollout

1. Apply `20260814160000_whatsapp_provider_connections.sql`.
2. Generate independent `WHATSAPP_GATEWAY_SHARED_SECRET` (32+ random characters) and `WHATSAPP_SESSION_ENCRYPTION_KEY` (32 random bytes, base64 or hex).
3. Deploy the gateway with `npm run gateway:whatsapp`; set `SEGMIQ_INTERNAL_BASE_URL` to the restricted SegmiQ application origin. Locally, the command loads the project `.env.local` file.
4. Set the web app's `WHATSAPP_GATEWAY_URL` to the gateway origin.
5. Set `WHATSAPP_GATEWAY_MEDIA_HOSTS` on the gateway to only the R2 outbound-media hostname.
6. Set `WHATSAPP_TEMPORARY_WEB_ENABLED=true` globally.
7. Enrol selected tenants with `clients.whatsapp_temporary_web_enabled=true`.
8. A company manager opens Settings → WhatsApp and scans the QR. Salespeople never see it.

The global flag defaults off. Turning it off stops new QR enrolment while preserving Meta and CRM data. Existing Meta fields and webhook routes are untouched.

## Environment

| Variable | Service | Purpose |
| --- | --- | --- |
| `WHATSAPP_TEMPORARY_WEB_ENABLED` | web | Global kill switch |
| `WHATSAPP_GATEWAY_URL` | web | Private gateway origin |
| `WHATSAPP_GATEWAY_SHARED_SECRET` | both | HMAC authentication |
| `WHATSAPP_SESSION_ENCRYPTION_KEY` | web | AES-256-GCM envelope key |
| `SEGMIQ_INTERNAL_BASE_URL` | gateway | Application callback origin |
| `WHATSAPP_GATEWAY_PORT` | gateway | HTTP port, default 8787 (the hosting platform's `PORT` takes precedence) |
| `WHATSAPP_GATEWAY_MAX_SENDS_PER_MINUTE` | gateway | Manual outbound rate limit per connected business number |
| `WHATSAPP_GATEWAY_MEDIA_HOSTS` | gateway | Outbound media host allowlist |
| `WHATSAPP_GATEWAY_HEARTBEAT_SECONDS` | gateway | Liveness ping interval, default 60, minimum 30 |

## Restart recovery

On startup the gateway calls `GET /api/internal/whatsapp/connections/restorable`. SegmiQ returns every primary `TEMPORARY_WEB` connection that still holds an encrypted session bundle and was live before the restart, moving each one to `RECONNECTING` so a stale `CONNECTED` row never advertises a socket that no longer exists. The gateway then re-opens each session from stored credentials, staggered by 1.5 seconds, and a normal restart requires no new QR scan.

A QR code is only ever published for an admin-initiated connect or reconnect. If WhatsApp asks an unattended restore or automatic reconnect to pair again, the stored session is no longer authorized: the gateway closes the socket and reports `RECONNECT_REQUIRED` rather than issuing codes nobody is waiting to scan.

`RECONNECT_REQUIRED` raises an in-app notification for the company's managers, throttled to one alert per connection per six hours so a flapping connection cannot spam them. Salespeople are excluded — they cannot manage the connection and already see a reconnection notice in the Sales Hub.

## Operations and incident response

- `GET /health` returns only health and active connection count.
- Lifecycle is disconnected → initializing → awaiting QR → connecting → connected. Bounded exponential reconnects end in `RECONNECT_REQUIRED`.
- QR challenges expire after 60 seconds and are encrypted at rest.
- Auth state persists after credential/key updates through the encrypted internal session API; the development multi-file helper is not used.
- Only new `messages.upsert` notifications are ingested. Historical sync is disabled.
- R2 accepts supported inbound media up to 20 MB. Groups, status, newsletters, broadcasts, system chats, unsupported media, and oversized media are excluded.
- The gateway rate-limits manual sends per connected business number (30/minute by default) and does not queue failed sends for a later surprise retry.
- Every open session sends a heartbeat each minute, so `last_seen_at` reflects transport liveness rather than customer activity. A quiet business number stays fresh; a dead socket goes stale.
- Monitor `ERROR`, `RECONNECT_REQUIRED`, stale `last_seen_at`, failed HMAC requests, and restarts. Never log QR values, auth bundles, tokens, or media.
- For an incident: disable the global flag, restrict gateway access, rotate HMAC credentials, disconnect affected tenants, and rotate encrypted state through a controlled re-encryption migration. Meta Cloud remains independently available.
