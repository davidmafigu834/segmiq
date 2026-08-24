# Deploying the WhatsApp gateway on Render

SegmiQ runs on Vercel, which cannot host the gateway: Vercel functions are short-lived and stateless, while a linked-device WhatsApp session needs a socket that stays open for weeks. Render runs the same repository as a always-on Node service, deployed from a GitHub push.

The two halves call each other over HTTPS with HMAC-signed requests, so each side needs the other's URL and the same shared secret:

```
Vercel (SegmiQ app)  ──POST /v1/connections/…──▶  Render (gateway)  ──▶  WhatsApp
        ▲                                                │
        └──────POST /api/internal/whatsapp/… ◀───────────┘
```

The gateway needs no database and no persistent disk. Session bundles are stored encrypted in Supabase and fetched through the app's signed internal API, and the gateway never holds the encryption key. A rebuilt service restores existing connections on its first boot.

## Before you start

- A paid Render instance (Starter or larger). Free sleeps after ~15 minutes idle and drops the WhatsApp socket.
- Your SegmiQ production URL on Vercel.
- Push the current branch to GitHub, including the dependency change that moved `tsx` and `@next/env` into `dependencies`. Without it the service builds and then crashes on startup.

## 1. Create the service

In the Render dashboard choose **New → Web Service** and connect the SegmiQ repository.

Pick **Web Service**, not Background Worker. A Background Worker has no public URL, so Vercel would have no way to reach it.

Configure it as follows. Render will detect Next.js and suggest `npm run build` and `npm start` — both are wrong here, since you are deploying the gateway rather than the web app.

| Setting | Value |
| --- | --- |
| Language | Node |
| Branch | `main` |
| Build command | `npm ci --omit=dev` |
| Start command | `npm run gateway:whatsapp` |
| Instance type | Starter |
| Health check path | `/health` |
| Auto-deploy | Off (see below) |

`--omit=dev` is deliberate. It skips `canvas`, which needs native compilation that can fail on a slim build image, and it now works because `tsx` and `@next/env` are real dependencies. The build still installs the full application dependency tree, so expect two to four minutes.

**Turn auto-deploy off.** This is the setting that matters most. Render and Vercel deploy from the same repository, so with auto-deploy on, every frontend commit would restart the gateway and drop every client's WhatsApp socket. Deploy manually, and only when gateway code actually changes. Composer photo and video send uses `/v1/connections/:id/messages/media`; until that deploy lands the app falls back to the older `/messages/document` route so the file still arrives.

Set the health check path to `/health`. That route is intentionally public and returns only `{"ok":true,"activeConnections":N}` — every other route rejects unsigned requests with `401`.

## 2. Set the environment variables

Generate the two secrets **once**, on any machine, and use the identical values in both places:

```bash
openssl rand -base64 48   # WHATSAPP_GATEWAY_SHARED_SECRET
openssl rand -base64 32   # WHATSAPP_SESSION_ENCRYPTION_KEY
```

On the Render service, under **Environment**:

| Variable | Value |
| --- | --- |
| `NODE_VERSION` | `20` |
| `SEGMIQ_INTERNAL_BASE_URL` | `https://app.yourdomain.com` |
| `WHATSAPP_GATEWAY_SHARED_SECRET` | the 48-byte value |
| `WHATSAPP_GATEWAY_MEDIA_HOSTS` | your R2 bucket hostname |
| `WHATSAPP_GATEWAY_MAX_SENDS_PER_MINUTE` | `30` |

Do not set `PORT`. Render assigns it, and the gateway reads `process.env.PORT` before its own default.

`NODE_VERSION` matters because Baileys requires Node 20 or newer and Render's default may be older.

In the Vercel project settings:

| Variable | Value |
| --- | --- |
| `WHATSAPP_GATEWAY_URL` | `https://your-service.onrender.com` |
| `WHATSAPP_GATEWAY_SHARED_SECRET` | the same 48-byte value |
| `WHATSAPP_SESSION_ENCRYPTION_KEY` | the 32-byte value |
| `WHATSAPP_TEMPORARY_WEB_ENABLED` | `true` |

Redeploy Vercel so it picks them up.

`WHATSAPP_SESSION_ENCRYPTION_KEY` belongs **only** on Vercel. Keeping it off the gateway is what prevents a compromised gateway from decrypting any client's WhatsApp credentials. The gateway also needs no Supabase keys at all.

You get a free `*.onrender.com` hostname with TLS. A custom domain is optional and changes nothing else.

## 3. Deploy and check it

Deploy, then open the service logs. You should see `[whatsapp-gateway] listening on port …` and, on a fresh service, no restore activity. Confirm the public health route from your own machine:

```bash
curl https://your-service.onrender.com/health
```

## 4. Keep it to one instance

Never enable autoscaling or set the instance count above one. Two replicas would open competing WhatsApp sockets for the same connection and fight over the same linked device. The `worker_id` and `worker_lease_until` columns in the database are reserved for a future coordinated multi-replica design; until that exists, one instance is a correctness requirement rather than a cost decision.

## 5. Connect a test company

1. Apply the two migrations if you have not already: `20260814160000_whatsapp_provider_connections.sql` and `20260816210000_whatsapp_connection_alert_notification.sql`.
2. In Supabase, set `whatsapp_temporary_web_enabled = true` for one test client.
3. Sign in to SegmiQ as that company's manager and open **Settings → Integrations → WhatsApp**.
4. Choose **Connect with QR**, then scan from WhatsApp Business → *Linked devices* → *Link a device*.

Watch the Render logs while you scan, and send a message to the business number from another phone to confirm it reaches the WhatsApp Sales Hub.

## 6. Verify restart recovery

Worth doing before onboarding real clients, because it is what keeps a routine restart from forcing everyone to rescan. Use **Manual Deploy → Restart service**, then read the logs:

```
[whatsapp-gateway] restoring 1 connection(s)
```

Settings should return to **Connected** on its own, with no QR code.

## Operating notes

**Memory is your scaling limit.** Starter gives 512 MB. Node plus Baileys uses roughly 150 MB at rest and each live WhatsApp session adds 50–150 MB, so Starter comfortably holds about two or three connected companies. Watch the memory graph as you enrol beta clients and move to Standard (2 GB, $25/month) before you are consistently above 80%. An out-of-memory restart drops every socket at once.

**Deploys briefly overlap.** Render keeps the old instance alive until the new one is healthy, so for a few seconds two gateways exist. WhatsApp resolves the conflict by dropping the older socket, and the connection settles through `RECONNECTING` back to `CONNECTED` on its own. It is not harmful, but prefer deploying outside business hours.

**Updating:** push to GitHub, then trigger a manual deploy from the Render dashboard. Sessions restore automatically afterwards.

**Logs:** available in the dashboard and structured to omit QR payloads, session bundles, tokens, and message bodies. Render's log retention is short, so treat the `whatsapp_connection_events` table as the durable audit trail.

**Rolling the shared secret:** update it on Render and Vercel together. Any window where they disagree causes every request to fail with `401`.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Build succeeds, service crashes with `tsx: not found` | Deployed before the dependency change; `tsx` must be in `dependencies`, not `devDependencies` |
| Crash on boot with `ERR_PACKAGE_PATH_NOT_EXPORTED` for `whatsapp-rust-bridge` | The gateway was loaded as CommonJS; `services/whatsapp-gateway/package.json` declares `{"type":"module"}` and must not be deleted |
| Logs show `SEGMIQ_INTERNAL_BASE_URL is required` | Environment variable missing on Render, or set on Vercel by mistake |
| Render runs `next build` and the deploy is huge | Build and start commands were left at Render's Next.js defaults |
| Every request returns `401` | The two `WHATSAPP_GATEWAY_SHARED_SECRET` values differ, or Vercel was not redeployed after adding them |
| QR never appears / "operation was aborted due to timeout" | The gateway was restarting or unreachable. Confirm Starter (not free), Health check `/health`, and that `SEGMIQ_INTERNAL_BASE_URL` can reach Vercel. Keep the QR modal open while it starts. |
| SegmiQ says the gateway is unreachable | `WHATSAPP_GATEWAY_URL` wrong, or pointing at a Background Worker with no public URL |
| Connections drop every time you ship the frontend | Auto-deploy is still on |
| Service restarts on its own every few days | Memory ceiling; check the metrics graph and size up |
