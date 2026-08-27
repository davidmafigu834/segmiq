import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import type { LearningPermission } from "./types";
import type { UserRole } from "@/types";

/**
 * Learning permissions map onto existing roles. They are named so Quality Center
 * can later split them without rewriting callers.
 */
const ROLE_PERMISSIONS: Record<UserRole, LearningPermission[]> = {
  SUPER_ADMIN: [
    "agent.learning.view",
    "agent.learning.submit",
    "agent.learning.review",
    "agent.learning.approve",
    "agent.learning.reject",
    "agent.learning.manage",
    "agent.learning.settings",
    "agent.learning.excludeConversation",
  ],
  CLIENT_MANAGER: [
    "agent.learning.view",
    "agent.learning.submit",
    "agent.learning.review",
    "agent.learning.approve",
    "agent.learning.reject",
    "agent.learning.manage",
    "agent.learning.settings",
    "agent.learning.excludeConversation",
  ],
  SALESPERSON: [
    "agent.learning.view",
    "agent.learning.submit",
    "agent.learning.excludeConversation",
  ],
};

export function hasLearningPermission(role: UserRole | null | undefined, permission: LearningPermission): boolean {
  if (!role) return false;
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

/** Server-side tenant scope. Never trust a company id produced by a model. */
export function resolveLearningClientScope(opts: {
  role: UserRole;
  authClientId: string | null;
  requestedClientId: string | null;
}): { ok: true; clientId: string } | { ok: false } {
  if (opts.role === "SUPER_ADMIN") {
    const clientId = opts.requestedClientId ?? opts.authClientId;
    if (!clientId) return { ok: false };
    return { ok: true, clientId };
  }
  if (!opts.authClientId) return { ok: false };
  if (opts.requestedClientId && opts.requestedClientId !== opts.authClientId) return { ok: false };
  return { ok: true, clientId: opts.authClientId };
}

export async function requireLearningAccess(
  req: Request,
  permission: LearningPermission
): Promise<
  | { ok: true; clientId: string; userId: string; role: UserRole }
  | { ok: false; status: number; error: string }
> {
  const auth = await resolveApiAuth(req);
  if (!auth) return { ok: false, status: 401, error: "Unauthorized" };
  if (!hasLearningPermission(auth.role as UserRole, permission)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  const url = new URL(req.url);
  const requested = url.searchParams.get("clientId");
  const scoped = resolveLearningClientScope({
    role: auth.role as UserRole,
    authClientId: auth.clientId,
    requestedClientId: requested,
  });
  if (!scoped.ok) {
    return {
      ok: false,
      status: auth.role === "SUPER_ADMIN" && !requested && !auth.clientId ? 400 : 403,
      error: auth.role === "SUPER_ADMIN" && !requested && !auth.clientId ? "clientId required" : "Forbidden",
    };
  }
  return { ok: true, clientId: scoped.clientId, userId: auth.userId, role: auth.role as UserRole };
}

export async function requireConversationLearningAccess(
  req: Request,
  leadClientId: string,
  assignedToId: string | null,
  permission: LearningPermission
): Promise<
  | { ok: true; clientId: string; userId: string; role: UserRole }
  | { ok: false; status: number; error: string }
> {
  const auth = await resolveApiAuth(req);
  if (!auth) return { ok: false, status: 401, error: "Unauthorized" };
  if (!hasLearningPermission(auth.role as UserRole, permission)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  if (auth.role === "SUPER_ADMIN") {
    return { ok: true, clientId: leadClientId, userId: auth.userId, role: auth.role };
  }
  if (auth.clientId !== leadClientId) return { ok: false, status: 403, error: "Forbidden" };
  if (auth.role === "SALESPERSON" && assignedToId !== auth.userId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, clientId: leadClientId, userId: auth.userId, role: auth.role as UserRole };
}
