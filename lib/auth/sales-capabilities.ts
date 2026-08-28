import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/types";

/** PostgREST filter: active salespeople + managers with also_sells enabled. */
export const ROUND_ROBIN_ELIGIBLE_OR =
  "role.eq.SALESPERSON,and(role.eq.CLIENT_MANAGER,also_sells.eq.true)";

export type SalesCapableSession = {
  userId?: string | null;
  role?: UserRole | string | null;
  alsoSells?: boolean | null;
};

export type RoundRobinEligibleUser = {
  id: string;
  name: string;
  role?: string;
  also_sells?: boolean | null;
  is_active?: boolean;
  round_robin_order?: number;
  email?: string | null;
  phone?: string | null;
  notification_prefs?: unknown;
};

const DEFAULT_ROUND_ROBIN_SELECT =
  "id, name, email, phone, notification_prefs, round_robin_order, role, also_sells, is_active";

/** True when the user can perform salesperson actions (portal, calls, assigned leads). */
export function canActAsSalesperson(session: SalesCapableSession): boolean {
  if (!session?.userId) return false;
  if (session.role === "SALESPERSON") return true;
  return session.role === "CLIENT_MANAGER" && Boolean(session.alsoSells);
}

/** Sales Command Center API: salespeople, company managers, or super admin with a company. */
export function canUseSalesCommand(
  session: SalesCapableSession & { clientId?: string | null; isImpersonating?: boolean }
): boolean {
  if (!session?.userId) return false;
  if (canActAsSalesperson(session)) return true;
  if (session.role === "CLIENT_MANAGER") return true;
  if (session.role === "SUPER_ADMIN") {
    return Boolean(session.clientId || session.isImpersonating);
  }
  return false;
}

export function isRoundRobinEligibleUser(user: {
  role: string;
  also_sells?: boolean | null;
  is_active?: boolean;
}): boolean {
  if (user.is_active === false) return false;
  if (user.role === "SALESPERSON") return true;
  return user.role === "CLIENT_MANAGER" && Boolean(user.also_sells);
}

type FetchRoundRobinOptions = {
  activeOnly?: boolean;
  select?: string;
  excludeUserId?: string;
};

/** Fetch users eligible for lead assignment and round-robin rotation. */
export async function fetchRoundRobinEligibleUsers(
  supabase: SupabaseClient,
  clientId: string,
  options?: FetchRoundRobinOptions
) {
  const select = options?.select ?? DEFAULT_ROUND_ROBIN_SELECT;
  let query = supabase
    .from("users")
    .select(select)
    .eq("client_id", clientId)
    .or(ROUND_ROBIN_ELIGIBLE_OR);

  if (options?.activeOnly !== false) {
    query = query.eq("is_active", true);
  }
  if (options?.excludeUserId) {
    query = query.neq("id", options.excludeUserId);
  }

  return query.order("round_robin_order", { ascending: true });
}

export async function getNextRoundRobinOrder(
  supabase: SupabaseClient,
  clientId: string
): Promise<number> {
  const { data: maxRow } = await supabase
    .from("users")
    .select("round_robin_order")
    .eq("client_id", clientId)
    .or(ROUND_ROBIN_ELIGIBLE_OR)
    .order("round_robin_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Number((maxRow as { round_robin_order?: number } | null)?.round_robin_order ?? -1) + 1;
}

/** Verify a user id belongs to the client's round-robin pool. */
export async function isRoundRobinEligibleUserId(
  supabase: SupabaseClient,
  clientId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("id, role, also_sells, is_active")
    .eq("client_id", clientId)
    .eq("id", userId)
    .maybeSingle();

  if (!data) return false;
  return isRoundRobinEligibleUser(data as { role: string; also_sells?: boolean; is_active?: boolean });
}
