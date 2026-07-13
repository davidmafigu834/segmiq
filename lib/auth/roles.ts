import type { UserRole } from "@/types";

/** Client-side / role-only check for Cloud admin surfaces. */
export function isCloudAdminRole(role: UserRole | string | null | undefined): boolean {
  return role === "AGENCY_ADMIN" || role === "CLIENT_MANAGER";
}

/** Company profile & branding roles (no client scope). */
export function canManageClientProfileRole(role: string | null | undefined): boolean {
  return role === "AGENCY_ADMIN" || role === "CLIENT_MANAGER";
}
