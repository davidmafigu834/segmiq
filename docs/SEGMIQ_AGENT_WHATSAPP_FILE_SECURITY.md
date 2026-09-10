# SegmiQ Agent, WhatsApp, Integration & File Security (Phase 5)

## Actor model

```text
Human/System Actor
       ↓
Tenant Context (trusted server clientId)
       ↓
Permission / Company Policy
       ↓
Agent Tool Registry
       ↓
Resource Authorization
       ↓
Action
       ↓
Audit
```

Actor types: `HUMAN_USER`, `SYSTEM_AGENT`, `SYSTEM_AUTOMATION`, `SYSTEM_WEBHOOK`, `SYSTEM_WHATSAPP`, `SYSTEM_CRON`, `PLATFORM_ADMIN` (`lib/auth/system-actor.ts`).

## Invariants

1. LLM output is untrusted.
2. Agent authorization is enforced in code (`evaluateToolPolicy` / `evaluateWritePolicy` / RBAC), not prompt text.
3. Human-triggered Agent inherits effective human permissions (`P.AGENT_*`, assignment scope).
4. Autonomous Agent authority comes from server-side tenant policy + capabilities.
5. Every Agent tool is tenant-scoped via `ToolExecutionContext.clientId`.
6. High-risk Manager actions require confirmation; execute re-checks policy.
7. WhatsApp QR session ≠ SegmiQ human session.
8. WhatsApp session material never reaches normal browser clients (`getSafeWhatsAppConnection`).
9. Integration secrets are encrypted (token vault) and server-only.
10. OAuth callback tenant comes from trusted state cookie, not arbitrary body.
11. Webhooks require verification (Meta hub signature; WhatsApp gateway HMAC+nonce).
12. Private business files require authorization; Documents use signed downloads.
13. Signed URLs are temporary (`PRIVATE_DOWNLOAD_TTL_SEC` = 300).
14. AI document retrieval is tenant-scoped and APPROVED-only for Company Brain.
15. System mutations require trusted `clientId`.
16. System actors are explicit and auditable.

## WhatsApp session key

- Env: `WHATSAPP_SESSION_ENCRYPTION_KEY` (server-only, never `NEXT_PUBLIC_*`).
- Rotation requires deliberate re-seal of sessions + integration envelopes — do not rotate casually.
- Production should fail closed when key missing for encrypt paths.

## Meta Cloud platform fallback

- Default: no silent platform-token fallback when a client has its own `phone_number_id`.
- Opt-in: `META_WHATSAPP_ALLOW_PLATFORM_FALLBACK=true` for legacy tenants.

## File access classes

| Class | Examples |
|---|---|
| PUBLIC | Marketing logos/heroes |
| PRIVATE | Company documents, preferred for WhatsApp media (migration ongoing) |
| TOKEN_PUBLIC | Public quote/proposal links |
| INTERNAL | Gateway outbound media HMAC URLs |

## Remaining risk: WhatsApp chat media on public R2

Inbound/outbound conversation media may still use `getPublicUrl()` historically. Documents module is private+signed. Migrate media to key+signed GET in a follow-up without breaking existing message URLs.

## Customer impact

- WhatsApp QR: no reconnect required for this phase.
- Facebook tokens: no reconnect if already sealed; plaintext migrates on reveal.
- Public quote PDF: revoked links now return 410 (parity with JSON route).
- Agent ASSIST: `memory_update` no longer autonomous — needs COPILOT+.
- Meta send: tenants relying on shared platform token with per-client phone_number_id need client token or explicit fallback env.
