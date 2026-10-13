import type { UserRole } from "@/types";

export type DemoGuestRole = Extract<UserRole, "CLIENT_MANAGER" | "SALESPERSON">;

/** Pages a guest may render in Phase 2A. Everything else is denied. */
export function isDemoGuestPageAllowed(path: string, role: DemoGuestRole): boolean {
  if (role === "SALESPERSON") {
    return (
      path === "/sales/dashboard" ||
      path === "/sales/pipeline" ||
      path.startsWith("/sales/deals/")
    );
  }
  if (role === "CLIENT_MANAGER") {
    return path === "/client/dashboard";
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
  return false;
}

export function credentialsConflict(hasCrmSession: boolean, hasDemoCookie: boolean): boolean {
  return hasCrmSession && hasDemoCookie;
}
