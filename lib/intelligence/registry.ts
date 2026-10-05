/**
 * Staff and portal tools are separate allowlists.
 * The model never chooses a tenant. client_id always comes from the session.
 */

export const RISK_LEVELS = ["READ", "PREPARE", "WRITE_LOW", "WRITE_HIGH"] as const;
export type IntelligenceRisk = (typeof RISK_LEVELS)[number];

export const PORTAL_TOOLS = [
  "get_my_projects",
  "get_my_project",
  "get_my_payment_summary",
  "get_my_installation",
  "get_my_assets",
  "get_my_warranties",
  "get_my_documents",
  "get_my_support_cases",
] as const;

export const STAFF_TOOLS = [
  "get_project_summary",
  "get_project_attention",
  "get_payment_summary",
  "get_installation",
  "get_lead_summary",
  "list_operations_attention",
  "list_sales_focus",
  "search_company_policy",
  "prepare_installation_brief",
  "draft_customer_update",
  "draft_message",
  "prepare_support_brief",
  "add_project_note",
  "create_project_task",
  "schedule_sales_follow_up",
  "schedule_installation",
] as const;

/** Human-only. The agent must not call these. */
export const PROHIBITED_TOOLS = [
  "reverse_payment",
  "change_price",
  "approve_discount",
  "approve_quotation",
  "approve_credit",
  "delete_financial_record",
  "delete_customer",
  "override_qa",
  "mark_commissioning_passed",
  "confirm_electrical_safety",
  "change_warranty_dates",
  "issue_refund",
  "confirm_payment",
] as const;

const PORTAL = new Set<string>(PORTAL_TOOLS);
const STAFF = new Set<string>(STAFF_TOOLS);

export function portalToolAllowed(name: string): boolean {
  return PORTAL.has(name);
}

export function staffToolAllowed(name: string): boolean {
  return STAFF.has(name) && !PROHIBITED_TOOLS.includes(name as (typeof PROHIBITED_TOOLS)[number]);
}

export function toolRisk(name: string): IntelligenceRisk {
  if (name.startsWith("draft_") || name.startsWith("prepare_")) return "PREPARE";
  if (name === "schedule_installation") return "WRITE_HIGH";
  if (name === "create_project_task" || name === "schedule_sales_follow_up" || name === "add_project_note") return "WRITE_LOW";
  return "READ";
}
