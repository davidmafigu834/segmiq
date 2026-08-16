# Deploying the WhatsApp gateway on Oracle Cloud Free Tier

SegmiQ runs on Vercel, which cannot host the gateway: Vercel functions are short-lived and stateless, while a linked-device WhatsApp session needs a socket that stays open for weeks. This guide sets up that long-running process on an Oracle Cloud "Always Free" virtual machine.

The two halves talk to each other over HTTPS with HMAC-signed requests:

```
Vercel (SegmiQ app)  ──POST /v1/connections/…──▶  Oracle VM (gateway)  ──▶  WhatsApp
        ▲                                                  │
        └──────POST /api/internal/whatsapp/… ◀──────────────┘
```

Both directions are signed with the same shared secret, so each side must be able to reach the other.

## What you need before starting

- An Oracle Cloud account with the Always Free tier (a payment card is required for identity verification; Always Free resources are not charged).
- A domain you control, so the gateway can have an HTTPS hostname such as `wa-gateway.yourdomain.com`.
- Your SegmiQ production URL on Vercel.

## 1. Create the virtual machine

In the Oracle Cloud console, go to **Compute → Instances → Create instance**.

- **Image**: Canonical Ubuntu 22.04.
- **Shape**: click *Change shape*, choose **Ampere** (Arm), and set 1 OCPU with 6 GB memory. The Always Free allowance is 4 OCPUs and 24 GB total, so this leaves headroom to grow. Ampere capacity is sometimes unavailable in a region — if creation fails with an out-of-capacity error, either retry later or fall back to the `VM.Standard.E2.1.Micro` AMD shape, which is also Always Free but much smaller.
- **Networking**: keep the default VCN and assign a public IPv4 address.
- **SSH keys**: choose *Generate a key pair* and download the private key. You cannot download it again later.

Note the public IP address once the instance is running.

## 2. Open the firewall

Oracle blocks inbound traffic in two separate places, and missing either one is the most common reason a new instance appears unreachable.

**Cloud-level:** open your instance → click its subnet → click the default security list → **Add ingress rules**. Add source CIDR `0.0.0.0/0`, protocol TCP, destination port `443`. Add a second rule for port `80` (needed once, for the certificate check).

**Host-level:** Ubuntu images ship with restrictive `iptables` rules. After connecting over SSH:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo netfilter-persistent save
```

Do not open port 8787. The gateway itself stays bound to the machine and is only reached through the HTTPS reverse proxy set up below.

## 3. Connect and install the runtime

```bash
chmod 400 ~/Downloads/your-key.key
ssh -i ~/Downloads/your-key.key ubuntu@YOUR_PUBLIC_IP
```

On Windows use PowerShell with the same `ssh` command; if it rejects the key permissions, move the key somewhere under your user profile.

Install Node 20 and the supporting tools:

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
node --version   # expect v20.x
```

## 4. Point a hostname at the machine

In your DNS provider, create an `A` record for `wa-gateway.yourdomain.com` pointing to the VM's public IP. Wait until `ping wa-gateway.yourdomain.com` resolves to that address before continuing, otherwise certificate issuance fails.

## 5. Deploy the code

The gateway imports shared signing code from `lib/whatsapp/security/`, so clone the whole repository rather than copying the single file:

```bash
cd /opt
sudo git clone https://github.com/YOUR_ORG/segmiq.git
sudo chown -R ubuntu:ubuntu /opt/segmiq
cd /opt/segmiq
npm ci
```

If the repository is private, create a GitHub deploy key on the VM (`ssh-keygen -t ed25519`), add the public key to the repository's deploy keys with read-only access, and clone over SSH.

## 6. Configure secrets

Generate the two secrets **once**, on any machine, and use the identical values in both Vercel and the VM:

```bash
openssl rand -base64 48   # WHATSAPP_GATEWAY_SHARED_SECRET
openssl rand -base64 32   # WHATSAPP_SESSION_ENCRYPTION_KEY
```

Create `/opt/segmiq/.env.local` on the VM with the gateway's variables:

```bash
SEGMIQ_INTERNAL_BASE_URL=https://app.yourdomain.com
WHATSAPP_GATEWAY_SHARED_SECRET=<the 48-byte value>
WHATSAPP_GATEWAY_PORT=8787
WHATSAPP_GATEWAY_MEDIA_HOSTS=your-r2-bucket-host.r2.dev
WHATSAPP_GATEWAY_MAX_SENDS_PER_MINUTE=30
```

Restrict it so other accounts on the machine cannot read the secret:

```bash
chmod 600 /opt/segmiq/.env.local
```

The gateway does not need database or Supabase credentials. It reaches SegmiQ only through the signed internal API, which is what keeps tenant data and session decryption on the application side.

In the Vercel project settings, add:

| Variable | Value |
| --- | --- |
| `WHATSAPP_GATEWAY_URL` | `https://wa-gateway.yourdomain.com` |
| `WHATSAPP_GATEWAY_SHARED_SECRET` | the same 48-byte value |
| `WHATSAPP_SESSION_ENCRYPTION_KEY` | the 32-byte value |
| `WHATSAPP_TEMPORARY_WEB_ENABLED` | `true` |

Redeploy so Vercel picks them up. `WHATSAPP_SESSION_ENCRYPTION_KEY` belongs only on Vercel: session bundles are encrypted and decrypted by the app, never by the gateway.

## 7. Run the gateway as a service

A `systemd` unit restarts the process if it crashes and starts it again after a reboot. Create `/etc/systemd/system/segmiq-whatsapp.service`:

```ini
[Unit]
Description=SegmiQ WhatsApp gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/segmiq
ExecStart=/usr/bin/npm run gateway:whatsapp
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now segmiq-whatsapp
sudo systemctl status segmiq-whatsapp
curl http://127.0.0.1:8787/health
```

The health check should return `{"ok":true,"activeConnections":0}`.

## 8. Put HTTPS in front of it

Vercel will not send requests to a plain-HTTP origin, and the shared secret must never cross the internet unencrypted. Replace `/etc/nginx/sites-available/default` with:

```nginx
server {
    listen 80;
    server_name wa-gateway.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
        client_max_body_size 25m;
    }
}
```

The 25 MB body limit matters: inbound media is relayed as base64, which inflates a 20 MB file beyond the nginx default of 1 MB.

Then issue a certificate:

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d wa-gateway.yourdomain.com
```

Certbot rewrites the config for HTTPS and installs an automatic renewal timer. Verify from your own machine:

```bash
curl https://wa-gateway.yourdomain.com/health
```

Every other route rejects unsigned requests with `401`, which is expected — only `/health` is public.

## 9. Connect a test company

1. In Supabase, set `whatsapp_temporary_web_enabled = true` for one test client.
2. Sign in to SegmiQ as that company's manager and open **Settings → Integrations → WhatsApp**.
3. Choose **Connect with QR**, then scan from WhatsApp Business → *Linked devices* → *Link a device*.

Watch the gateway while you do it:

```bash
sudo journalctl -u segmiq-whatsapp -f
```

Send a message to the business number from another phone and confirm it appears in the WhatsApp Sales Hub.

## 10. Verify restart recovery

This is worth testing before onboarding real clients, because it is what keeps a reboot from forcing every client to rescan:

```bash
sudo systemctl restart segmiq-whatsapp
sudo journalctl -u segmiq-whatsapp -n 30
```

You should see `restoring 1 connection(s)`, and Settings should return to **Connected** without a QR code.

## Operating notes

- **Logs**: `sudo journalctl -u segmiq-whatsapp -f`. They are structured and deliberately omit QR payloads, session bundles, and message bodies.
- **Updating**: `cd /opt/segmiq && git pull && npm ci && sudo systemctl restart segmiq-whatsapp`. Sessions restore automatically afterwards.
- **Reboots**: `systemd` starts the service, and the restore sweep re-establishes sessions.
- **Backups**: nothing on the VM is irreplaceable. Session bundles live encrypted in Supabase, so a rebuilt machine restores existing connections on first boot.
- **Staying free**: Oracle reclaims idle Always Free instances that stay under roughly 10% CPU, 10% network, and 20% memory for seven days. A gateway holding live WhatsApp sockets normally has enough network activity to be safe, but if you have an Oracle paid account (even at zero spend) the reclamation policy does not apply at all — this is the simplest way to remove the risk.
- **One replica only**: run a single gateway instance. Two instances would open competing sockets for the same connection. The `worker_id` and `worker_lease_until` columns are reserved for a future coordinated multi-replica design.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `curl` to the public hostname times out | Ingress rule or host `iptables` rule missing (step 2 has both) |
| Gateway logs `SEGMIQ_INTERNAL_BASE_URL is required` | `.env.local` missing or in the wrong directory; it must be at `/opt/segmiq/.env.local` |
| SegmiQ reports the gateway is unreachable | `WHATSAPP_GATEWAY_URL` wrong, or Vercel not redeployed after adding variables |
| Every request returns `401` | The two `WHATSAPP_GATEWAY_SHARED_SECRET` values differ, or the VM clock has drifted more than five minutes — install `chrony` |
| QR never appears | Check `journalctl`; usually the gateway cannot reach `SEGMIQ_INTERNAL_BASE_URL` to publish the code |
| Inbound media missing while text works | nginx `client_max_body_size` too small, or the media type is outside the allowlist |
