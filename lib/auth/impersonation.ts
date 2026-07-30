import type { ClientMode, UserRole } from "@/types";
import { isSuperAdminRole, normalizeUserRole } from "@/lib/auth/roles";

export function homeForRole(role: UserRole | string, clientMode: ClientMode = "team"): string {
  const normalized = normalizeUserRole(role) ?? role;
  if (isSuperAdminRole(normalized)) return "/dashboard";
  if (normalized === "CLIENT_MANAGER") return "/client/dashboard";
  if (normalized === "SALESPERSON" && clientMode === "solo") return "/solo/dashboard";
  if (normalized === "SALESPERSON") return "/sales/dashboard";
  // Unknown / legacy roles: never default to /sales (causes redirect loops).
  return "/login";
}

export function roleLabel(role: UserRole | string): string {
  if (isSuperAdminRole(role)) return "Super Admin";
  if (role === "CLIENT_MANAGER") return "Manager";
  if (role === "SALESPERSON") return "Salesperson";
  return String(role);
}

export function canBeImpersonated(user: {
  role: string;
  client_id: string | null;
  is_active: boolean;
}): boolean {
  if (!user.is_active) return false;
  if (!user.client_id) return false;
  return user.role === "CLIENT_MANAGER" || user.role === "SALESPERSON";
}
