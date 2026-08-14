# WhatsApp provider architecture

SegmiQ has one WhatsApp Sales Hub, one lead/conversation model, and one canonical manual-message service. Providers are transports below that domain layer; they do not create a second inbox or CRM.

```text
Meta webhook ───────┐
                    ├─ normalized inbound service ─ lead matching/assignment ─ whatsapp_messages ─ Sales Hub
Linked-device gateway┘

Sales Hub send ─ authorization ─ canonical message service ─ provider resolver ─ Meta Cloud or Quick connection
```

The provider contracts live in `lib/whatsapp/providers`. `META_CLOUD` remains the default when a tenant has existing Meta credentials and no explicit connection row. `TEMPORARY_WEB` is selected only by an explicit primary connection. `META_COEXISTENCE` is reserved and currently inherits Meta capabilities.

| Capability | Meta Cloud | Quick connection |
| --- | --- | --- |
| Manual one-to-one text | Yes | Yes |
| Manual document | Yes | Yes |
| Approved templates | Yes | No |
| Broadcast/campaign | Yes | No |
| Automated qualification/follow-up sends | Yes | No |
| Delivery receipts | Yes | Yes |
| Meta 24-hour window | Yes | No |
| History | Provider history | New events after activation only |

## Persistence and identity

- `whatsapp_connections` stores provider, lifecycle state, safe display metadata, encrypted session envelope, and operational lease fields.
- `whatsapp_messages` remains the canonical Sales Hub message table. Provider type, connection, and sender source are additive fields.
- `whatsapp_external_messages` maps provider-scoped IDs to canonical messages. Deduplication is tenant + provider scoped.
- Messages sent on the physical business phone use `EXTERNAL_BUSINESS_DEVICE` and no salesperson actor.
- The inbound pipeline reserves a connection-scoped provider message identity before CRM processing, preventing reconnect replays from creating duplicate Leads or activities.
- Disconnecting clears authentication and QR material; it never deletes leads, contacts, messages, quotes, deals, or events.

`sendWhatsApp()` is the automated/template dispatch boundary. It refuses sends when a temporary connection is the active transport, so scheduled or campaign workflows cannot silently use legacy Meta credentials. Manual text and documents use the canonical message service, which derives the recipient from the authorized Lead record rather than accepting a client-supplied number.

## Trust boundaries

Browsers never receive session credentials or raw QR payloads. Company managers receive only a short-lived rendered QR data URL through a no-store API. Salespeople receive safe connection status only.

The application and gateway authenticate internal requests with HMAC-SHA256 over timestamp, nonce, method, path, and body hash. The application records nonces to reject replay. Authentication state and QR payloads use AES-256-GCM with tenant/connection-bound additional authenticated data.

Browser routes derive `clientId` from NextAuth. Only `CLIENT_MANAGER` can create, reconnect, or disconnect. `SALESPERSON` can send through the selected connected transport only after existing lead authorization succeeds.
