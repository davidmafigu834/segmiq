import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { P } from "@/lib/auth/rbac";
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
  alsoSells?: boolean | null;
  isImpersonating?: boolean;
} | null): boolean {
  if (!session?.userId || !session.clientId) return false;
  return hasPermission(
    {
      userId: session.userId,
      role: session.role ?? "SALESPERSON",
      clientId: session.clientId,
      alsoSells: session.alsoSells,
      isImpersonating: session.isImpersonating,
    },
    P.WHATSAPP_CONNECTION_MANAGE
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
    admin: {
      userId: session.userId,
      clientId: session.clientId as string,
      role: session.role,
    },
  };
}

export async function requireWhatsAppTenantMember(): Promise<
  | { ok: true; userId: string; clientId: string; role: UserRole }
  | { ok: false; status: 401 | 403; error: string }
> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return { ok: false, status: 401, error: "Unauthorized" };
  if (!session.clientId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  const canView = hasPermission(
    {
      userId: session.userId,
      role: session.role,
      clientId: session.clientId,
      alsoSells: session.alsoSells,
      isImpersonating: Boolean(session.isImpersonating),
    },
    P.WHATSAPP_CONNECTION_VIEW
  );
  if (!canView) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return {
    ok: true,
    userId: session.userId,
    clientId: session.clientId,
    role: session.role as UserRole,
  };
}
