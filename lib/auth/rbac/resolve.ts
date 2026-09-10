import type { UserRole } from "@/types";
import { isPermission, type Permission } from "./permissions";
import { permissionsForOrgRole, permissionsForSuperAdmin } from "./role-profiles";
import { isSuperAdminRole } from "@/lib/auth/roles";

export type PermissionActor = {
  userId: string;
  role: UserRole | string;
  clientId?: string | null;
  alsoSells?: boolean | null;
  /** When true, use effective (impersonated) role — never elevate to platform.*. */
  isImpersonating?: boolean;
};

/**
 * Resolve effective permissions for the authenticated (effective) identity.
 * Impersonation: session.role is already the customer role → no platform.*.
 */
export function resolvePermissions(actor: PermissionActor): Set<Permission> {
  const role = actor.role;
  if (isSuperAdminRole(role) && !actor.isImpersonating) {
    return new Set(permissionsForSuperAdmin());
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
