# SegmiQ Tenant Security Foundation

Phase 1 documents the current tenancy model and how organisation isolation must be enforced.

## Current model (preserved)

```text
User.client_id  →  clients.id   (tenant boundary)
```

- One user belongs to at most one organisation (`client_id`, nullable for `SUPER_ADMIN`).
- There is no `OrganisationMembership` table yet (deferred).
- Database access commonly uses the Supabase **service role** (`createAdminClient`), which bypasses RLS. Application code **must** enforce tenant filters.

## Tenant key

Almost all organisation-owned tables use:

`client_id` → `public.clients.id`

Confirm on each table before assuming another column name.

## Tenant-owned resources (inventory)

| Resource area | Typical tables / stores | Tenant key |
|---|---|---|
| People | `users` (org members) | `client_id` |
| CRM | `leads`, `contacts`, `deals`, `call_logs`, lead events | `client_id` |
| Quotes | `quotations`, `quotation_line_items`, quotation settings/policies | `client_id` / via quotation |
| Documents | company documents, document policies/activity | `client_id` |
| WhatsApp | `whatsapp_connections`, inbox conversations/messages (via lead) | `client_id` |
| Products / packages / inventory | catalog, packages, products, movements | `client_id` |
| Calendar / viewings / appointments | viewings, calendar activities | `client_id` |
| Marketing | campaigns, journeys, segments, instant forms | `client_id` |
| Settings / integrations | client settings, website API key, FB/Meta fields on `clients` | `clients.id` |
| Agent | executions, confirmations, escalations, learning, proactive jobs | `client_id` |
| Files | R2 keys under `clients/{clientId}/…` | path prefix + DB `client_id` |
| Compliance / after-sales | compliance cases, after-sales | `client_id` |
| Billing | invoices / subscriptions scoped to client | `client_id` |

Platform-only (not customer tenant data): `agency_settings`, `agency_proposals` (SegmiQ commercial proposals), SUPER_ADMIN users (`client_id` null).

## Access hierarchy

```text
Authentication (NextAuth cookie / mobile Bearer)
      ↓
Current user validation (exists, is_active, session_version)
      ↓
Tenant / client context (session.clientId or explicit SUPER_ADMIN clientId)
      ↓
Role / capability (SUPER_ADMIN | CLIENT_MANAGER | SALESPERSON + also_sells)
      ↓
Resource ownership / assignment
      ↓
Database operation (service role + mandatory tenant filter)
```

## Fail closed

Dangerous:

```ts
if (clientId) query = query.eq("client_id", clientId);
```

Required for tenant users:

```ts
const clientId = requireTenantClientId(actor); // throws if missing
query = query.eq("client_id", clientId);
```

`SUPER_ADMIN` cross-tenant access must be **explicit** (platform admin path + concrete `clientId` when operating inside a company). Never treat “missing clientId” as “all tenants” for customer roles.

## Impersonation

Effective identity drives authorisation (`userId`, `clientId`, `role`).
`realUserId` is retained for audit / exit-impersonation only and must not unlock unrestricted platform queries while impersonating.

## Offboarding

Preferred lifecycle for organisation employees:

`ACTIVE` → `INACTIVE` (`is_active = false`) + `session_version++`

Do not hard-delete by default (preserves FK history). Hard delete remains unavailable from the normal team-management DELETE path.

## Integration secrets

Meta/Facebook/WhatsApp Cloud tokens must be sealed at rest (AES-GCM envelope) and never sent to browsers. UI receives status flags only (`fb_connected`, `meta_whatsapp_token_configured`).

## Future RLS (defence in depth)

Service-role queries bypass RLS. Application-level tenant filters remain the primary control.

| Class | Guidance |
|---|---|
| A — Safe candidate soon | Read-mostly tenant tables with clear `client_id` and authenticated Supabase user JWT path |
| B — Needs architecture first | Mixed SUPER_ADMIN + tenant + webhook writers |
| C — Service-role internal | Agent jobs, Facebook webhooks, background workers |
| D — Public / integration | Magic links, public quote/proposal, Meta webhooks |

Do not add RLS policies that only “look secure” while `createAdminClient()` remains the default access path.

## Future work (not this phase)

- OrganisationMembership / multi-org users
- Full RLS conversion for all tables
- MFA / device session inventory UI (session registry + `/api/auth/session` ready in Phase 2)
- Dynamic RBAC
