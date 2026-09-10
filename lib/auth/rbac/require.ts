import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { hasPermission, type PermissionActor } from "./resolve";
import type { Permission } from "./permissions";
import type { UserRole } from "@/types";
import { assertMfaApiAccess, evaluateMfaAssurance } from "@/lib/auth/mfa/assurance";

export type AuthzContext = PermissionActor & {
  sessionId?: string | null;
  sessionVersion?: number;
};

function toActor(
  auth: {
    userId: string;
    role: UserRole;
    clientId: string | null;
    alsoSells?: boolean;
    isImpersonating?: boolean;
    sessionId?: string | null;
    sessionVersion?: number;
  }
): AuthzContext {
  return {
    userId: auth.userId,
    role: auth.role,
    clientId: auth.clientId ?? null,
    alsoSells: auth.alsoSells,
    isImpersonating: Boolean(auth.isImpersonating),
    sessionId: auth.sessionId,
    sessionVersion: auth.sessionVersion,
  };
}

/**
 * Cookie or Bearer auth + required permission.
 * SECURITY: permissions are derived server-side from role/flags — never from request body.
 */
export async function requirePermission(
  permission: Permission,
  req?: Request
): Promise<{ ok: true; auth: AuthzContext } | { error: NextResponse }> {
  const auth = req ? await getAuthFromRequest(req) : null;
  const session = auth
    ? null
    : await getServerSession(authOptions);

  const actorSource = auth
    ? auth
    : session?.userId
      ? {
          userId: session.userId,
          role: session.role,
          clientId: session.clientId ?? null,
          alsoSells: session.alsoSells,
          isImpersonating: Boolean(session.isImpersonating),
          sessionId: session.sessionId,
          sessionVersion: session.sessionVersion,
        }
      : null;

  if (!actorSource?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const assurance = await evaluateMfaAssurance({
    userId: actorSource.userId,
    role: actorSource.role,
    clientId: actorSource.clientId ?? null,
  });
  const mfaGate = assertMfaApiAccess(assurance, req ?? null);
  if (!mfaGate.ok) return { error: mfaGate.response };

  const authz = toActor(actorSource);
  if (!hasPermission(authz, permission)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, auth: authz };
}

export async function requireAnyPermission(
  permissions: readonly Permission[],
  req?: Request
): Promise<{ ok: true; auth: AuthzContext } | { error: NextResponse }> {
  const auth = req ? await getAuthFromRequest(req) : null;
  const session = auth ? null : await getServerSession(authOptions);
  const actorSource = auth
    ? auth
    : session?.userId
      ? {
          userId: session.userId,
          role: session.role,
          clientId: session.clientId ?? null,
          alsoSells: session.alsoSells,
          isImpersonating: Boolean(session.isImpersonating),
          sessionId: session.sessionId,
          sessionVersion: session.sessionVersion,
        }
      : null;

  if (!actorSource?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const assurance = await evaluateMfaAssurance({
    userId: actorSource.userId,
    role: actorSource.role,
    clientId: actorSource.clientId ?? null,
  });
  const mfaGate = assertMfaApiAccess(assurance, req ?? null);
  if (!mfaGate.ok) return { error: mfaGate.response };

  const authz = toActor(actorSource);
  if (!permissions.some((p) => hasPermission(authz, p))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, auth: authz };
}
