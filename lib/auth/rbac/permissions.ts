/**
 * SegmiQ permission catalogue (Phase 3).
 *
 * SECURITY INVARIANTS:
 * 1. Authentication ≠ authorization.
 * 2. Unknown permissions default to DENY.
 * 3. Frontend permission checks are UX only — APIs must enforce server-side.
 * 4. Resource scope (assignment / ownership) is separate from role permissions.
 * 5. platform.* must never be granted to organisation roles.
 * 6. Impersonation uses the effective (impersonated) role's permissions.
 */

export const P = {
  // Leads
  LEADS_READ_ASSIGNED: "leads.read_assigned",
  LEADS_READ_ALL: "leads.read_all",
  LEADS_CREATE: "leads.create",
  LEADS_UPDATE_ASSIGNED: "leads.update_assigned",
  LEADS_ASSIGN: "leads.assign",
  LEADS_EXPORT: "leads.export",

  // Deals
  DEALS_READ_ASSIGNED: "deals.read_assigned",
  DEALS_READ_ALL: "deals.read_all",
  DEALS_CREATE: "deals.create",
  DEALS_UPDATE_ASSIGNED: "deals.update_assigned",

  // Quotes
  QUOTES_READ: "quotes.read",
  QUOTES_CREATE: "quotes.create",
  QUOTES_UPDATE: "quotes.update",
  QUOTES_SEND: "quotes.send",
  QUOTES_APPROVE: "quotes.approve",
  QUOTES_CATALOG_MANAGE: "quotes.catalog.manage",

  // WhatsApp
  WHATSAPP_READ_ASSIGNED: "whatsapp.read_assigned",
  WHATSAPP_READ_ALL: "whatsapp.read_all",
  WHATSAPP_SEND: "whatsapp.send",
  WHATSAPP_ASSIGN: "whatsapp.assign",
  WHATSAPP_CONNECTION_VIEW: "whatsapp.connection.view",
  WHATSAPP_CONNECTION_MANAGE: "whatsapp.connection.manage",

  // Documents (coarse; fine-grained docs catalogue remains in lib/documents)
  DOCUMENTS_READ: "documents.read",
  DOCUMENTS_UPLOAD: "documents.upload",
  DOCUMENTS_MANAGE: "documents.manage",

  // Commercial / inventory (coarse aliases; detailed commercial catalogue remains)
  PRODUCTS_READ: "products.read",
  PRODUCTS_MANAGE: "products.manage",
  INVENTORY_READ: "inventory.read",
  INVENTORY_MANAGE: "inventory.manage",
  PACKAGES_READ: "packages.read",
  PACKAGES_MANAGE: "packages.manage",

  // Calendar
  CALENDAR_READ_OWN: "calendar.read_own",
  CALENDAR_READ_TEAM: "calendar.read_team",
  CALENDAR_MANAGE_OWN: "calendar.manage_own",

  // Agent
  AGENT_USE: "agent.use",
  AGENT_MANAGE: "agent.manage",
  AGENT_APPROVE: "agent.approve",

  // Team
  TEAM_READ: "team.read",
  TEAM_MANAGE: "team.manage",

  // Settings
  SETTINGS_READ: "settings.read",
  SETTINGS_MANAGE: "settings.manage",
  SETTINGS_INTEGRATIONS: "settings.integrations",
  SETTINGS_WHATSAPP: "settings.whatsapp",
  SETTINGS_AGENT: "settings.agent",

  // Cloud company admin (organisation on Cloud subdomain)
  CLOUD_SETTINGS_MANAGE: "cloud.settings.manage",
  CLOUD_TEAM_MANAGE: "cloud.team.manage",

  // Billing / analytics / export / compliance
  BILLING_READ: "billing.read",
  BILLING_MANAGE: "billing.manage",
  ANALYTICS_READ_OWN: "analytics.read_own",
  ANALYTICS_READ_ALL: "analytics.read_all",
  DATA_EXPORT: "data.export",
  COMPLIANCE_READ: "compliance.read",
  COMPLIANCE_REVIEW: "compliance.review",

  // Organisation security (Phase 6)
  SECURITY_AUDIT_READ: "security.audit.read",
  SECURITY_SETTINGS_MANAGE: "security.settings.manage",

  // Platform (SUPER_ADMIN only)
  PLATFORM_CLIENTS_READ: "platform.clients.read",
  PLATFORM_CLIENTS_MANAGE: "platform.clients.manage",
  PLATFORM_IMPERSONATE: "platform.impersonate",
  PLATFORM_BILLING_MANAGE: "platform.billing.manage",
  PLATFORM_SECURITY_READ: "platform.security.read",
} as const;

export type Permission = (typeof P)[keyof typeof P];

export const ALL_PERMISSIONS = Object.values(P) as Permission[];

export const PLATFORM_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter((p) =>
  p.startsWith("platform.")
);

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}
