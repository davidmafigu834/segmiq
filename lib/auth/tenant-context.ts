import type { UserRole } from "@/types";

/**
 * SECURITY INVARIANT:
 * Tenant context for organisation-owned data must come from the authenticated
 * server-side session (or an explicit SUPER_ADMIN platform action).
 * Never treat a request body/query `clientId` as authorization by itself.
 */

export type TenantActor = {
  userId: string;
  role: UserRole;
  clientId: string | null;
  isImpersonating?: boolean;
  realUserId?: string | null;
};

export class TenantContextError extends Error {
  status: 400 | 401 | 403 | 404;
  constructor(message: string, status: 400 | 401 | 403 | 404 = 401) {
    super(message);
    this.name = "TenantContextError";
    this.status = status;
  }
}

/**
 * Fail closed for customer roles that must always operate inside one organisation.
 * SUPER_ADMIN (not impersonating) should use resolveAuthorizedClientId with an explicit id.
 */
export function requireTenantClientId(actor: TenantActor): string {
  if (!actor.clientId) {
    throw new TenantContextError("Unauthorized", 401);
  }
  return actor.clientId;
}

/**
 * Resolve which clientId a request may operate on.
 * - Tenant users: always session.clientId (body/query clientId ignored for auth)
 * - SUPER_ADMIN (not impersonating): may use explicitClientId when provided
 * - Impersonating SUPER_ADMIN: effective session.clientId only
 */
export function resolveAuthorizedClientId(
  actor: TenantActor,
  explicitClientId?: string | null
): string {
  if (actor.isImpersonating || actor.role !== "SUPER_ADMIN") {
    if (!actor.clientId) throw new TenantContextError("Unauthorized", 401);
    // SECURITY: never allow a tenant user to override their organisation via params.
    if (explicitClientId && explicitClientId !== actor.clientId) {
      throw new TenantContextError("Not found", 404);
    }
    return actor.clientId;
  }
  const clientId = explicitClientId?.trim() || null;
  if (!clientId) {
    throw new TenantContextError("clientId is required", 400);
  }
  return clientId;
}

/** Fail closed tenant equality check; returns 404-style denial (no existence leak). */
export function assertSameTenant(
  actorClientId: string | null | undefined,
  resourceClientId: string | null | undefined,
  role: UserRole,
  opts?: { allowSuperAdmin?: boolean; isImpersonating?: boolean }
): void {
  const allowSa = opts?.allowSuperAdmin !== false && role === "SUPER_ADMIN" && !opts?.isImpersonating;
  if (allowSa) return;
  if (!actorClientId || !resourceClientId || actorClientId !== resourceClientId) {
    throw new TenantContextError("Not found", 404);
  }
}

/**
 * Tenant-owned resources (SegmiQ today) are keyed by `client_id` → `clients.id`.
 * See docs/SEGMIQ_TENANT_SECURITY.md for the full inventory.
 */
export const TENANT_KEY = "client_id" as const;
