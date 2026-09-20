/**
 * Support Access — scoped, temporary, audited platform-staff access to one
 * organisation's client data.
 *
 * Platform administration (organisations, billing, integration health) does not
 * require a grant. Reading client business data always does.
 */

export * from "./scopes";
export * from "./policy";
export * from "./masking";
export {
  recordSupportAccessEvent,
  listGrantEvents,
  supportAccessEventLabel,
  scopeAuditEvent,
  SUPPORT_ACCESS_LIFECYCLE_EVENTS,
  CLIENT_DATA_ACCESS_EVENTS,
  type SupportAccessEventType,
  type SupportAccessEventRow,
  type SupportAccessEventOutcome,
} from "./audit";
export {
  findLatestGrant,
  findGrantById,
  listGrants,
  listActiveGrantsForAdmin,
  createGrant,
  approveGrant,
  denyGrant,
  revokeGrant,
  type SupportAccessGrantListRow,
} from "./grants";
export {
  requirePrivilegedTenantAccess,
  requireClientDataAccess,
  assertResourceTenant,
  resolveSupportAccess,
  type PrivilegedAccessContext,
  type PrivilegedAccessResult,
} from "./guard";
