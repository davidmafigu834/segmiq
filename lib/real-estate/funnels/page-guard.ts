import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import { shouldRedirectFromRealEstateRoute } from "@/lib/real-estate/gating";
import type { ShareActor } from "@/lib/real-estate/agent-listing-pages/policy";

/** Session, shell props and display name for the agent Funnels pages. Redirects anyone who cannot market listings. */
export async function funnelsPageContext() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session) || !session.clientId) redirect("/login");
  const db = createAdminClient();
  const [{ data: client }, { data: user }] = await Promise.all([
    db.from("clients").select("business_type").eq("id", session.clientId).maybeSingle(),
    db.from("users").select("name").eq("id", session.userId).maybeSingle(),
  ]);
  if (shouldRedirectFromRealEstateRoute(client?.business_type)) redirect("/sales/dashboard");
  const shell = await loadSalesShellProps(session);
  const name = (user as { name?: string } | null)?.name?.trim() || "Agent";
  const actor: ShareActor = { userId: session.userId, role: session.role, clientId: session.clientId, alsoSells: session.alsoSells };
  return {
    db,
    actor,
    shell,
    me: {
      name,
      first: name.split(/\s+/)[0] ?? name,
      role: session.role === "CLIENT_MANAGER" ? "Sales Manager" : "Property Sales Negotiator",
    },
  };
}
