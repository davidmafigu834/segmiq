import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { canAccessClient } from "@/lib/auth/permissions";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import {
  requirePermission as requirePermissionRbac,
  type Permission,
} from "@/lib/auth/rbac";
import {
  assertMfaApiAccess,
  evaluateMfaAssurance,
  type MfaAssurance,
} from "@/lib/auth/mfa/assurance";
import type { UserRole } from "@/types";

export type GuardSession = {
  userId: string;
  role: UserRole;
  clientId: string | null;
  alsoSells?: boolean;
  sessionId?: string | null;
  user?: { name?: string | null };
  clientMode?: "team" | "solo";
  mfaRequired?: boolean;
  mfaSatisfied?: boolean;
  mfaEnrolmentRequired?: boolean;
};

async function enforceMfa(
  session: GuardSession,
  req?: Request
): Promise<{ error: NextResponse } | null> {
  const assurance: MfaAssurance =
    session.mfaSatisfied != null
      ? {
          mfaRequired: Boolean(session.mfaRequired),
          mfaSatisfied: Boolean(session.mfaSatisfied),
          mfaEnrolmentRequired: Boolean(session.mfaEnrolmentRequired),
        }
      : await evaluateMfaAssurance({
          userId: session.userId,
          role: session.role,
          clientId: session.clientId,
        });
  const gate = assertMfaApiAccess(assurance, req ?? null);
  if (!gate.ok) return { error: gate.response };
  session.mfaRequired = assurance.mfaRequired;
  session.mfaSatisfied = assurance.mfaSatisfied;
  session.mfaEnrolmentRequired = assurance.mfaEnrolmentRequired;
  return null;
}

export async function requireSession(req?: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const g: GuardSession = {
    userId: session.userId,
    role: session.role,
    clientId: session.clientId,
    alsoSells: session.alsoSells,
    sessionId: session.sessionId,
    clientMode: session.clientMode,
  };
  const mfaErr = await enforceMfa(g, req);
  if (mfaErr) return mfaErr;
  return { session: g };
}

/** Cookie session or Bearer JWT — for mobile app routes that used requireSession. */
export async function requireSessionFromRequest(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const session: GuardSession = {
    userId: auth.userId,
    role: auth.role,
    clientId: auth.clientId,
    alsoSells: auth.alsoSells,
    sessionId: auth.sessionId,
    mfaRequired: auth.mfaRequired,
    mfaSatisfied: auth.mfaSatisfied,
    mfaEnrolmentRequired: auth.mfaEnrolmentRequired,
  };
  const mfaErr = await enforceMfa(session, req);
  if (mfaErr) return mfaErr;
  return { session };
}

export async function requireClientAccessFromRequest(req: Request, clientId: string) {
  const g = await requireSessionFromRequest(req);
  if ("error" in g) return g;
  if (!canAccessClient(g.session.role, g.session.clientId, clientId)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return g;
}

export async function requireRoles(roles: UserRole[], req?: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!roles.includes(session.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const g: GuardSession = {
    userId: session.userId,
    role: session.role,
    clientId: session.clientId,
    alsoSells: session.alsoSells,
    sessionId: session.sessionId,
  };
  const mfaErr = await enforceMfa(g, req);
  if (mfaErr) return mfaErr;
  return { session: g };
}

/** Cookie session or Bearer JWT — for mobile app API routes. */
export async function requireRolesFromRequest(req: Request, roles: UserRole[]) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!roles.includes(auth.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const session: GuardSession = {
    userId: auth.userId,
    role: auth.role,
    clientId: auth.clientId,
    alsoSells: auth.alsoSells,
    sessionId: auth.sessionId,
    mfaRequired: auth.mfaRequired,
    mfaSatisfied: auth.mfaSatisfied,
    mfaEnrolmentRequired: auth.mfaEnrolmentRequired,
  };
  const mfaErr = await enforceMfa(session, req);
  if (mfaErr) return mfaErr;
  return { session };
}

/** Salesperson or manager with also_sells enabled. */
export async function requireSalesActor(req?: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canActAsSalesperson(session)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const g: GuardSession = {
    userId: session.userId,
    role: session.role,
    clientId: session.clientId,
    alsoSells: session.alsoSells,
    sessionId: session.sessionId,
  };
  const mfaErr = await enforceMfa(g, req);
  if (mfaErr) return mfaErr;
  return { session: g };
}

/** Bearer or cookie — salesperson or selling manager. */
export async function requireSalesActorFromRequest(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canActAsSalesperson(auth)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const session: GuardSession = {
    userId: auth.userId,
    role: auth.role,
    clientId: auth.clientId,
    alsoSells: auth.alsoSells,
    sessionId: auth.sessionId,
    mfaRequired: auth.mfaRequired,
    mfaSatisfied: auth.mfaSatisfied,
    mfaEnrolmentRequired: auth.mfaEnrolmentRequired,
  };
  const mfaErr = await enforceMfa(session, req);
  if (mfaErr) return mfaErr;
  return { session };
}

export async function requirePermission(permission: Permission, req?: Request) {
  return requirePermissionRbac(permission, req);
}
