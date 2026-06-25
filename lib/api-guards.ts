import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import type { UserRole } from "@/types";

export type GuardSession = {
  userId: string;
  role: UserRole;
  clientId: string | null;
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
  };
  return { session };
}
