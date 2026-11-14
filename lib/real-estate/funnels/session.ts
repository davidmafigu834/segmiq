import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import type { ShareActor } from "@/lib/real-estate/agent-listing-pages/policy";

/** The signed-in agent as a share actor, or null when the session cannot market listings. */
export async function funnelActor(): Promise<ShareActor | null> {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !session.clientId || !canActAsSalesperson(session)) return null;
  return { userId: session.userId, role: session.role, clientId: session.clientId, alsoSells: session.alsoSells };
}
