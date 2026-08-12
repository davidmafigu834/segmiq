/**
 * Deal authorization helpers — mirror lead permissions.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { createAdminClient } from "@/lib/supabase/admin";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { CLIENT_MANAGER_READ_ONLY } from "@/lib/auth/permissions";
import type { UserRole } from "@/types";

type DealScope = {
  client_id: string;
  owner_id: string | null;
  originating_lead_id: string;
};

type AuthSession = {
  userId?: string | null;
  role?: UserRole | null;
  clientId?: string | null;
  alsoSells?: boolean | null;
};

export async function canReadDeal(
  dealId: string,
  req?: Request
): Promise<
  | { ok: true; deal: DealScope; userId: string; role: UserRole }
  | { ok: false; status: 401 | 403 | 404 }
> {
  const auth = req ? await getAuthFromRequest(req) : null;
  const session = (auth ?? (await getServerSession(authOptions))) as AuthSession | null;
  if (!session?.userId) return { ok: false, status: 401 };

  const supabase = createAdminClient();
  const { data: deal } = await supabase
    .from("deals")
    .select("client_id, owner_id, originating_lead_id")
    .eq("id", dealId)
    .maybeSingle();

  if (!deal) return { ok: false, status: 404 };

  const scope: DealScope = {
    client_id: deal.client_id as string,
    owner_id: (deal.owner_id as string | null) ?? null,
    originating_lead_id: deal.originating_lead_id as string,
  };

  if (session.role === "SUPER_ADMIN") {
    return { ok: true, deal: scope, userId: session.userId, role: session.role };
  }

  if (session.role === "CLIENT_MANAGER" && session.clientId === scope.client_id) {
    return {
      ok: true,
      deal: scope,
      userId: session.userId,
      role: session.role,
    };
  }

  if (canActAsSalesperson(session)) {
    if (scope.owner_id !== session.userId) return { ok: false, status: 403 };
    return {
      ok: true,
      deal: scope,
      userId: session.userId,
      role: session.role as UserRole,
    };
  }

  return { ok: false, status: 403 };
}

export async function canModifyDeal(
  dealId: string,
  req?: Request
): Promise<
  | { allowed: true; deal: DealScope; userId: string; role: UserRole }
  | { allowed: false; reason: string; status: 401 | 403 | 404 }
> {
  const auth = req ? await getAuthFromRequest(req) : null;
  const session = (auth ?? (await getServerSession(authOptions))) as AuthSession | null;
  if (!session?.userId) {
    return { allowed: false, reason: "Unauthorized", status: 401 };
  }

  const supabase = createAdminClient();
  const { data: deal } = await supabase
    .from("deals")
    .select("client_id, owner_id, originating_lead_id")
    .eq("id", dealId)
    .maybeSingle();

  if (!deal) {
    return { allowed: false, reason: "Not found", status: 404 };
  }

  const scope: DealScope = {
    client_id: deal.client_id as string,
    owner_id: (deal.owner_id as string | null) ?? null,
    originating_lead_id: deal.originating_lead_id as string,
  };

  if (session.role === "CLIENT_MANAGER" && !canActAsSalesperson(session)) {
    return { allowed: false, reason: CLIENT_MANAGER_READ_ONLY, status: 403 };
  }

  if (session.role === "SUPER_ADMIN") {
    return { allowed: true, deal: scope, userId: session.userId, role: session.role };
  }

  if (canActAsSalesperson(session)) {
    if (scope.owner_id !== session.userId) {
      return { allowed: false, reason: "Forbidden", status: 403 };
    }
    return {
      allowed: true,
      deal: scope,
      userId: session.userId,
      role: session.role as UserRole,
    };
  }

  return { allowed: false, reason: "Forbidden", status: 403 };
}
