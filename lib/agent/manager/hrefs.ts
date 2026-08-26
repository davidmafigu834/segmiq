import type { ManagerEntityType } from "./types";

export function managerHref(entityType: ManagerEntityType, id: string): string {
  switch (entityType) {
    case "LEAD":
      return `/client/leads?lead=${id}`;
    case "CUSTOMER":
      return `/client/customers?contact=${id}`;
    case "DEAL":
      return `/client/deals/${id}`;
    case "QUOTATION":
      return `/client/quotations?quote=${id}`;
    case "CONVERSATION":
    case "TASK":
    case "APPOINTMENT":
      return `/client/inbox?lead=${id}`;
    case "SUPPORT_CASE":
      return `/client/inbox?lead=${id}&view=support`;
    case "USER":
      return `/client/team/${id}`;
    case "PROACTIVE_ACTION":
    case "AGENT_ACTIVITY":
      return `/client/agent`;
    case "PRODUCT":
      return `/client/products/${id}`;
    case "PACKAGE":
      return `/client/packages/${id}`;
    case "INVENTORY":
      return `/client/inventory`;
    default:
      return `/client/dashboard`;
  }
}

export function conversationHref(leadId: string): string {
  return `/client/inbox?lead=${leadId}`;
}

export function settingsHref(section: "agent" | "proactive" | "commercial"): string {
  if (section === "proactive") return "/client/settings/agent";
  if (section === "commercial") return "/client/quote-settings";
  return "/client/settings/agent";
}
