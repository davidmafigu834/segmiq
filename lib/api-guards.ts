import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { canAccessClient } from "@/lib/auth/permissions";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import type { UserRole } from "@/types";

export type GuardSession = {
  userId: string;
  role: UserRole;
  clientId: string | null;
  alsoSells?: boolean;
  user?: { name?: string | null };
  clientMode?: "team" | "solo";
};

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
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
  };
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

export async function requireRoles(roles: UserRole[]) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!roles.includes(session.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
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
  };
  return { session };
}

/** Salesperson or manager with also_sells enabled. */
export async function requireSalesActor() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canActAsSalesperson(session)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
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
  };
  return { session };
}
