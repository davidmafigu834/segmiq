import type { UserRole } from "@/types";

/** Platform operator — includes legacy JWT role during rollout. */
export function isSuperAdminRole(role: UserRole | string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "AGENCY_ADMIN";
}

/** Normalize legacy role strings stored in older session cookies. */
export function normalizeUserRole(role: string | null | undefined): UserRole | null {
  if (!role) return null;
  if (role === "AGENCY_ADMIN") return "SUPER_ADMIN";
  if (role === "SUPER_ADMIN" || role === "CLIENT_MANAGER" || role === "SALESPERSON") {
    return role;
  }
  return null;
}

/** Client-side / role-only check for Cloud admin surfaces. */
export function isCloudAdminRole(role: UserRole | string | null | undefined): boolean {
  return isSuperAdminRole(role) || role === "CLIENT_MANAGER" || role === "SALESPERSON";
}

/** Company profile & branding roles (no client scope). */
export function canManageClientProfileRole(role: string | null | undefined): boolean {
  return isSuperAdminRole(role) || role === "CLIENT_MANAGER" || role === "SALESPERSON";
}
