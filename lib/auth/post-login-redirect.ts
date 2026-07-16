import type { ClientMode, UserRole } from "@/types";
import { homeForRole } from "@/lib/auth/impersonation";

/** Resolve a safe in-app path from callbackUrl (absolute or relative). */
export function sanitizeCallbackPath(callbackUrl: string | null | undefined): string | null {
  if (!callbackUrl?.trim()) return null;
  const raw = callbackUrl.trim();
  try {
    if (raw.startsWith("/") && !raw.startsWith("//")) {
      return raw.split("#")[0] ?? raw;
    }
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://segmiq.com";
    const url = new URL(raw, base);
    const allowedHost = new URL(base).host;
    if (url.host !== allowedHost) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function postLoginPath(input: {
  role: UserRole;
  clientMode?: ClientMode | null;
  clientId?: string | null;
  callbackUrl?: string | null;
}): string {
  const callback = sanitizeCallbackPath(input.callbackUrl ?? null);
  if (callback && callback !== "/login" && !callback.startsWith("/login?")) {
    return callback;
  }

  if ((input.role === "SALESPERSON" || input.role === "CLIENT_MANAGER") && !input.clientId) {
    return "/login?reason=no_client";
  }

  return homeForRole(input.role, input.clientMode ?? "team");
}
