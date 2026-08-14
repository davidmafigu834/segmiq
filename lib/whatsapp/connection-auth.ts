import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { UserRole } from "@/types";

export type WhatsAppConnectionAdmin = {
  userId: string;
  clientId: string;
  role: UserRole;
};

export function canManageWhatsAppConnection(session: {
  userId?: string | null;
  clientId?: string | null;
  role?: UserRole | null;
} | null): session is { userId: string; clientId: string; role: "CLIENT_MANAGER" } {
  return Boolean(
    session?.userId && session.clientId && session.role === "CLIENT_MANAGER"
  );
}

export async function requireWhatsAppConnectionAdmin(): Promise<
  | { ok: true; admin: WhatsAppConnectionAdmin }
  | { ok: false; status: 401 | 403; error: string }
> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return { ok: false, status: 401, error: "Unauthorized" };
  if (!canManageWhatsAppConnection(session)) {
    return { ok: false, status: 403, error: "Only a company manager can manage WhatsApp connections" };
  }
  return {
    ok: true,
    admin: { userId: session.userId, clientId: session.clientId, role: session.role },
  };
}

export async function requireWhatsAppTenantMember(): Promise<
  | { ok: true; userId: string; clientId: string; role: UserRole }
  | { ok: false; status: 401 | 403; error: string }
> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return { ok: false, status: 401, error: "Unauthorized" };
  if (!session.clientId || !["CLIENT_MANAGER", "SALESPERSON"].includes(session.role ?? "")) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return {
    ok: true,
    userId: session.userId,
    clientId: session.clientId,
    role: session.role as UserRole,
  };
}
