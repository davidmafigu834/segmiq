import type { ClientMode, UserRole } from "@/types";

export function homeForRole(role: UserRole, clientMode: ClientMode = "team"): string {
  if (role === "AGENCY_ADMIN") return "/dashboard";
  if (role === "CLIENT_MANAGER") return "/client/dashboard";
  if (role === "SALESPERSON" && clientMode === "solo") return "/solo/dashboard";
  return "/sales/dashboard";
}

export function roleLabel(role: UserRole): string {
  if (role === "CLIENT_MANAGER") return "Manager";
  if (role === "SALESPERSON") return "Salesperson";
  return role;
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
