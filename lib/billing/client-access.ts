import { createAdminClient } from "@/lib/supabase/admin";
import type { ClientMode } from "@/types";

export type BillingSession = {
  userId?: string | null;
  role?: string | null;
  clientId?: string | null;
  clientMode?: ClientMode | null;
};

/** True when the client record is in solo operator mode. */
export async function isClientSoloMode(clientId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("clients").select("mode").eq("id", clientId).maybeSingle();
  return (data as { mode?: string } | null)?.mode === "solo";
}

/**
 * Sync gate used by Company Billing UI tests and `canAccessClientBilling`.
 * Team salespeople never see company billing; solo operators use `/solo/billing`.
 */
export function resolveBillingAccess(
  session: BillingSession
): "deny" | "allow" | "solo-lookup" {
  if (!session.userId || !session.clientId) return "deny";
  if (session.role === "CLIENT_MANAGER") return "allow";
  if (session.role === "SALESPERSON") {
    if (session.clientMode === "solo") return "allow";
    if (session.clientMode === "team") return "deny";
    return "solo-lookup";
  }
  return "deny";
}

/**
 * Client Manager on team clients; sole active salesperson on solo clients.
 * API routes should still verify invoice.client_id === session.clientId.
 */
export async function canAccessClientBilling(session: BillingSession): Promise<
  | { ok: true; clientId: string }
  | { ok: false }
> {
  const decision = resolveBillingAccess(session);
  const clientId = session.clientId ?? null;
  if (decision === "deny" || !clientId) return { ok: false };
  if (decision === "allow") return { ok: true, clientId };
  if (await isClientSoloMode(clientId)) return { ok: true, clientId };
  return { ok: false };
}

export function soloBillingPath(): string {
  return "/solo/billing";
}

export async function clientBillingPath(clientId: string): Promise<string> {
  return (await isClientSoloMode(clientId)) ? soloBillingPath() : "/client/billing";
}
