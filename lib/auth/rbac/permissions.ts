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

  // Social Inbox (Facebook / Instagram sales workspace — not WhatsApp)
  SOCIAL_INBOX_VIEW: "socialInbox.view",
  SOCIAL_INBOX_REPLY: "socialInbox.reply",
  SOCIAL_INBOX_ASSIGN: "socialInbox.assign",
  SOCIAL_INBOX_CONVERT_LEAD: "socialInbox.convertLead",
  SOCIAL_INBOX_CREATE_DEAL: "socialInbox.createDeal",
  SOCIAL_INBOX_CREATE_QUOTATION: "socialInbox.createQuotation",
  SOCIAL_INBOX_MANAGE_CHANNELS: "socialInbox.manageChannels",
  SOCIAL_INBOX_VIEW_TEAM: "socialInbox.viewTeam",
  SOCIAL_INBOX_MANAGE_TEAM: "socialInbox.manageTeam",

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
  REPORTS_TEAM_VIEW: "reports.team.view",
  REPORTS_TEAM_DOWNLOAD: "reports.team.download",
  REPORTS_TEAM_GENERATE: "reports.team.generate",
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
  PLATFORM_INTEGRATIONS_DIAGNOSE: "platform.integrations.diagnose",

  // Privileged client-data access (Phase 7).
  // These govern the Support Access workflow itself — they never grant data access.
  SUPPORT_ACCESS_REQUEST: "platform.support.request",
  SUPPORT_ACCESS_APPROVE: "platform.support.approve",
  SUPPORT_ACCESS_REVOKE: "platform.support.revoke",
  SUPPORT_ACCESS_AUDIT_READ: "platform.support.audit.read",
  /** Mass export of one organisation's client data — stricter than viewing one record. */
  CLIENT_DATA_EXPORT: "platform.clientData.export",
  /** Emergency access outside the ordinary support workflow. */
  PLATFORM_BREAK_GLASS: "platform.breakGlass",
} as const;

export type Permission = (typeof P)[keyof typeof P];

export const ALL_PERMISSIONS = Object.values(P) as Permission[];

export const PLATFORM_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter((p) =>
  p.startsWith("platform.")
);

/**
 * Organisation permissions that read or write a customer's business data.
 *
 * SECURITY (Phase 7): SUPER_ADMIN does NOT hold these by default. They are
 * granted only for the duration of an active, scoped Support Access grant —
 * see lib/security/support-access.
 */
export const CLIENT_DATA_PERMISSIONS: Permission[] = [
  P.LEADS_READ_ASSIGNED,
  P.LEADS_READ_ALL,
  P.LEADS_CREATE,
  P.LEADS_UPDATE_ASSIGNED,
  P.LEADS_ASSIGN,
  P.LEADS_EXPORT,
  P.DEALS_READ_ASSIGNED,
  P.DEALS_READ_ALL,
  P.DEALS_CREATE,
  P.DEALS_UPDATE_ASSIGNED,
  P.QUOTES_READ,
  P.QUOTES_CREATE,
  P.QUOTES_UPDATE,
  P.QUOTES_SEND,
  P.QUOTES_APPROVE,
  P.WHATSAPP_READ_ASSIGNED,
  P.WHATSAPP_READ_ALL,
  P.WHATSAPP_SEND,
  P.WHATSAPP_ASSIGN,
  P.SOCIAL_INBOX_VIEW,
  P.SOCIAL_INBOX_REPLY,
  P.SOCIAL_INBOX_ASSIGN,
  P.SOCIAL_INBOX_CONVERT_LEAD,
  P.SOCIAL_INBOX_CREATE_DEAL,
  P.SOCIAL_INBOX_CREATE_QUOTATION,
  P.SOCIAL_INBOX_VIEW_TEAM,
  P.DOCUMENTS_READ,
  P.DOCUMENTS_UPLOAD,
  P.DOCUMENTS_MANAGE,
  P.CALENDAR_READ_OWN,
  P.CALENDAR_READ_TEAM,
  P.CALENDAR_MANAGE_OWN,
  P.AGENT_USE,
  P.AGENT_APPROVE,
  P.DATA_EXPORT,
  P.ANALYTICS_READ_OWN,
  P.ANALYTICS_READ_ALL,
  P.REPORTS_TEAM_VIEW,
  P.REPORTS_TEAM_DOWNLOAD,
  P.REPORTS_TEAM_GENERATE,
];

export function isClientDataPermission(permission: Permission): boolean {
  return CLIENT_DATA_PERMISSIONS.includes(permission);
}

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}
