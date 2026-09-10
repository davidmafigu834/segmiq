import { P, type Permission, PLATFORM_PERMISSIONS, ALL_PERMISSIONS } from "./permissions";
import type { UserRole } from "@/types";

/**
 * Fixed role → permission profiles.
 * SUPER_ADMIN is a platform role (not "manager + more").
 * also_sells adds personal sales write capabilities for managers.
 */

const SALESPERSON_PERMS: Permission[] = [
  P.LEADS_READ_ASSIGNED,
  P.LEADS_CREATE,
  P.LEADS_UPDATE_ASSIGNED,
  P.DEALS_READ_ASSIGNED,
  P.DEALS_CREATE,
  P.DEALS_UPDATE_ASSIGNED,
  P.QUOTES_READ,
  P.QUOTES_CREATE,
  P.QUOTES_UPDATE,
  P.QUOTES_SEND,
  P.WHATSAPP_READ_ASSIGNED,
  P.WHATSAPP_SEND,
  P.WHATSAPP_CONNECTION_VIEW,
  P.DOCUMENTS_READ,
  P.DOCUMENTS_UPLOAD,
  P.PRODUCTS_READ,
  P.INVENTORY_READ,
  P.PACKAGES_READ,
  P.CALENDAR_READ_OWN,
  P.CALENDAR_MANAGE_OWN,
  P.AGENT_USE,
  P.TEAM_READ,
  P.SETTINGS_READ,
  P.ANALYTICS_READ_OWN,
  P.COMPLIANCE_READ,
];

/** Organisation oversight + commercial management (CLIENT_MANAGER). */
const MANAGER_BASE: Permission[] = [
  P.LEADS_READ_ALL,
  P.LEADS_CREATE,
  P.LEADS_ASSIGN,
  P.LEADS_EXPORT,
  P.DEALS_READ_ALL,
  P.DEALS_CREATE,
  P.QUOTES_READ,
  P.QUOTES_CREATE,
  P.QUOTES_UPDATE,
  P.QUOTES_SEND,
  P.QUOTES_APPROVE,
  P.QUOTES_CATALOG_MANAGE,
  P.WHATSAPP_READ_ALL,
  P.WHATSAPP_ASSIGN,
  P.WHATSAPP_CONNECTION_VIEW,
  P.WHATSAPP_CONNECTION_MANAGE,
  P.DOCUMENTS_READ,
  P.DOCUMENTS_UPLOAD,
  P.DOCUMENTS_MANAGE,
  P.PRODUCTS_READ,
  P.PRODUCTS_MANAGE,
  P.INVENTORY_READ,
  P.INVENTORY_MANAGE,
  P.PACKAGES_READ,
  P.PACKAGES_MANAGE,
  P.CALENDAR_READ_TEAM,
  P.AGENT_USE,
  P.AGENT_MANAGE,
  P.AGENT_APPROVE,
  P.TEAM_READ,
  P.TEAM_MANAGE,
  P.SETTINGS_READ,
  P.SETTINGS_MANAGE,
  P.SETTINGS_INTEGRATIONS,
  P.SETTINGS_WHATSAPP,
  P.SETTINGS_AGENT,
  P.CLOUD_SETTINGS_MANAGE,
  P.CLOUD_TEAM_MANAGE,
  P.BILLING_READ,
  P.BILLING_MANAGE,
  P.ANALYTICS_READ_ALL,
  P.DATA_EXPORT,
  P.COMPLIANCE_READ,
  P.COMPLIANCE_REVIEW,
  P.SECURITY_AUDIT_READ,
  P.SECURITY_SETTINGS_MANAGE,
];

/**
 * Personal sales writes (also_sells managers).
 * Matches canModifyLead / canModifyDeal / WhatsApp send ownership rules.
 */
const ALSO_SELLS_EXTRAS: Permission[] = [
  P.LEADS_READ_ASSIGNED,
  P.LEADS_UPDATE_ASSIGNED,
  P.DEALS_READ_ASSIGNED,
  P.DEALS_UPDATE_ASSIGNED,
  P.WHATSAPP_READ_ASSIGNED,
  P.WHATSAPP_SEND,
  P.CALENDAR_READ_OWN,
  P.CALENDAR_MANAGE_OWN,
  P.ANALYTICS_READ_OWN,
];

function unique(perms: Permission[]): Permission[] {
  return Array.from(new Set(perms));
}

export function permissionsForOrgRole(
  role: UserRole | string,
  opts?: { alsoSells?: boolean }
): Permission[] {
  if (role === "SALESPERSON") {
    return [...SALESPERSON_PERMS];
  }
  if (role === "CLIENT_MANAGER") {
    if (opts?.alsoSells) {
      return unique([...MANAGER_BASE, ...ALSO_SELLS_EXTRAS]);
    }
    return [...MANAGER_BASE];
  }
  return [];
}

export function permissionsForSuperAdmin(): Permission[] {
  return unique([
    ...ALL_PERMISSIONS.filter((p) => !p.startsWith("platform.")),
    ...PLATFORM_PERMISSIONS,
  ]);
}

export { ALSO_SELLS_EXTRAS, SALESPERSON_PERMS, MANAGER_BASE as MANAGER_PERMS };
