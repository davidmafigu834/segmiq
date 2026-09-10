# SegmiQ Roles & Permissions (Phase 3)

## Authorization layers

```text
Session (auth)
   ↓
Authenticated user (effective identity)
   ↓
Tenant (client_id)
   ↓
Permissions (role + also_sells + platform)
   ↓
Resource scope (assignment / ownership / document policy)
   ↓
Action
```

## Catalogue

Typed constants live in `lib/auth/rbac/permissions.ts` (`P.*`).

Unknown permissions **default to DENY**.

## Role profiles

| Area | Salesperson | Client Manager | Manager + also_sells | Super Admin |
|---|---|---|---|---|
| Read assigned leads | Yes | via read_all | Yes + read_all | Platform |
| Read all company leads | No | Yes | Yes | Platform |
| Assign leads | No | Yes | Yes | Platform |
| Update assigned leads/deals | Yes | No* | Yes | Platform |
| Quotes create/send | Yes | Yes | Yes | Platform |
| Quotes approve / catalog | No | Yes | Yes | Platform |
| WhatsApp messaging (assigned) | Yes | No* | Yes | Platform |
| WhatsApp org read / assign | No | Yes | Yes | Platform |
| WhatsApp QR connection | No | Yes | Yes | Platform |
| Team manage | No | Yes | Yes | Platform |
| Cloud settings / team | No | Yes | Yes | Platform |
| Data export | No | Yes | Yes | Platform |
| platform.* | No | No | No | Yes |

\* Non-selling managers retain oversight reads and quote/commercial management; personal sales writes require `also_sells` (matches `canModifyLead` / `canModifyDeal`).

## Resource checks (unchanged helpers)

- `canReadLead` / `canModifyLead`
- `canReadDeal` / `canModifyDeal`
- `canManageQuotation*`
- Document / commercial catalogues

Permission grants the *category*; resource helpers enforce *which* record.

## Impersonation

Effective `session.role` drives permissions. `platform.*` is never granted while impersonating.

## Access removed in Phase 3

- **Salespeople** can no longer manage Cloud team / Cloud settings (`canManageCloudSettings`, `isCloudAdminRole`).

## Future

Catalogue is ready for OWNER / SUPPORT / custom roles and OrganisationMembership without rewriting every check — map new roles into `permissionsForOrgRole` or a later DB grant table.
