import type { UserRole } from "@/types";

export type DemoGuestRole = Extract<UserRole, "CLIENT_MANAGER" | "SALESPERSON">;

/** Pages a guest may render in Phase 2A. Everything else is denied. */
export function isDemoGuestPageAllowed(path: string, role: DemoGuestRole): boolean {
  if (role === "SALESPERSON") {
    return (
      path === "/sales/dashboard" ||
      path === "/sales/pipeline" ||
      path.startsWith("/sales/deals/") ||
      path === "/sales/inbox" ||
      path.startsWith("/sales/inbox/") ||
      path === "/sales/leads" ||
      path === "/sales/quotes" ||
      path.startsWith("/sales/quotes/") ||
      path === "/sales/tasks" ||
      path.startsWith("/sales/tasks/") ||
      path === "/sales/followups" ||
      path.startsWith("/sales/followups/") ||
      path === "/sales/calendar" ||
      path === "/sales/reports" ||
      path === "/sales/won-lost" ||
      path === "/sales/goals" ||
      path === "/sales/command" ||
      path === "/sales/toolbox" ||
      path === "/sales/social-inbox"
    );
  }
  if (role === "CLIENT_MANAGER") {
    return (
      path === "/client/dashboard" ||
      path === "/client/leads" ||
      path.startsWith("/client/leads/") ||
      path === "/client/inbox" ||
      path === "/client/quotations" ||
      path.startsWith("/client/quotations/") ||
      path === "/client/customers" ||
      path.startsWith("/client/deals/") ||
      path === "/client/team" ||
      path.startsWith("/client/team/") ||
      path === "/client/calendar" ||
      path === "/client/reports" ||
      path === "/client/social-inbox" ||
      path === "/client/command" ||
      path === "/client/products" ||
      path === "/client/inventory" ||
      path === "/client/packages" ||
      path === "/client/documents" ||
      path === "/client/agent"
    );
  }
  return false;
}

export function demoGuestHome(role: DemoGuestRole): string {
  return role === "CLIENT_MANAGER" ? "/client/dashboard" : "/sales/dashboard";
}

/** APIs a guest may call. Unlisted routes are refused before the handler runs. */
export function isDemoGuestApiAllowed(path: string, method: string): boolean {
  const verb = method.toUpperCase();
  if (path === "/api/auth/session" && verb === "GET") return true;
  if (path === "/api/auth/csrf" && verb === "GET") return true;
  if (path === "/api/demo/status" && verb === "GET") return true;
  if (path === "/api/demo/persona" && verb === "POST") return true;
  if (path === "/api/demo/session/reset" && verb === "POST") return true;
  if (/^\/api\/deals\/[^/]+$/.test(path) && (verb === "GET" || verb === "PATCH")) return true;
  if (verb === "GET" && path === "/api/inbox/conversations") return true;
  if (verb === "GET" && /^\/api\/inbox\/conversations\/[^/]+\/messages$/.test(path)) return true;
  if (verb === "GET" && path === "/api/inbox/quick-replies") return true;
  if (verb === "GET" && path === "/api/sales/leads") return true;
  if (verb === "GET" && path === "/api/sales/quotes") return true;
  if (verb === "GET" && path === "/api/sales/tasks") return true;
  if (verb === "GET" && path === "/api/sales/won-lost") return true;
  if (verb === "GET" && path === "/api/sales/reports") return true;
  if (verb === "GET" && path === "/api/sales/goals") return true;
  if (verb === "GET" && path === "/api/sales/daily-plan") return true;
  if (verb === "GET" && path === "/api/sales/dashboard/workspace") return true;
  if (verb === "GET" && path === "/api/sales/app/leads") return true;
  if (verb === "GET" && /^\/api\/leads\/[^/]+$/.test(path)) return true;
  if ((verb === "GET" || verb === "POST") && path === "/api/agent/sales/command") return true;
  if (verb === "GET" && /^\/api\/sales\/copilot\/conversations\/[^/]+$/.test(path)) return true;
  if (verb === "POST" && /^\/api\/sales\/copilot\/work-items\/[^/]+$/.test(path)) return true;
  if (verb === "GET" && /^\/api\/client\/team\/[^/]+$/.test(path)) return true;
  return false;
}

export function credentialsConflict(hasCrmSession: boolean, hasDemoCookie: boolean): boolean {
  return hasCrmSession && hasDemoCookie;
}
