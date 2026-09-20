import type { UserRole } from "@/types";
import { isPermission, type Permission } from "./permissions";
import {
  permissionsForOrgRole,
  permissionsForSuperAdmin,
  permissionsForSupportAccess,
} from "./role-profiles";
import { isSuperAdminRole } from "@/lib/auth/roles";

export type PermissionActor = {
  userId: string;
  role: UserRole;
  clientId: string | null;
  alsoSells?: boolean | null;
  /** When true, use effective (impersonated) role — never elevate to platform.*. */
  isImpersonating?: boolean;
  /**
   * Scopes of an ACTIVE Support Access grant, verified server-side against the
   * grant store. Never populate this from request input or client state.
   */
  supportAccessScopes?: readonly string[] | null;
};

/**
 * Resolve effective permissions for the authenticated (effective) identity.
 * Impersonation: session.role is already the customer role → no platform.*.
 *
 * SECURITY: a platform operator's client-data permissions come only from a
 * verified Support Access grant, never from the SUPER_ADMIN role itself.
 */
export function resolvePermissions(actor: PermissionActor): Set<Permission> {
  const role = actor.role;
  if (isSuperAdminRole(role) && !actor.isImpersonating) {
    const perms = new Set(permissionsForSuperAdmin());
    for (const p of permissionsForSupportAccess(actor.supportAccessScopes ?? [])) {
      perms.add(p);
    }
    return perms;
  }
  return new Set(
    permissionsForOrgRole(role, { alsoSells: Boolean(actor.alsoSells) })
  );
}

/** Default-deny for unknown permission strings. */
export function hasPermission(
  actor: PermissionActor,
  permission: Permission | string
): boolean {
  if (!isPermission(permission)) return false;
  return resolvePermissions(actor).has(permission);
}

export function hasAnyPermission(
  actor: PermissionActor,
  permissions: readonly (Permission | string)[]
): boolean {
  return permissions.some((p) => hasPermission(actor, p));
}

export function hasAllPermissions(
  actor: PermissionActor,
  permissions: readonly (Permission | string)[]
): boolean {
  return permissions.every((p) => hasPermission(actor, p));
}

/** Safe list for session/UX payloads (no secrets). */
export function listPermissions(actor: PermissionActor): Permission[] {
  return Array.from(resolvePermissions(actor)).sort();
}
