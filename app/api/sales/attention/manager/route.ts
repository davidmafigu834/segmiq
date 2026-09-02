import { NextResponse } from "next/server";
import { requireSessionFromRequest } from "@/lib/api-guards";
import { getManagerSalesAttentionAggregate } from "@/lib/sales/attention/manager-aggregate";
import { getAttentionMetrics } from "@/lib/sales/attention/observability";
import type { ManagerActor } from "@/lib/agent/manager/types";

export const dynamic = "force-dynamic";

/**
 * Manager-facing aggregate attention (not private salesperson focus dumps).
 * Requires CLIENT_MANAGER or SUPER_ADMIN.
 */
export async function GET(req: Request) {
  const guard = await requireSessionFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;

  if (!session!.clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }
  if (session!.role !== "CLIENT_MANAGER" && session!.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Manager permission required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const includeMetrics = url.searchParams.get("metrics") === "1";

  try {
    const actor: ManagerActor = {
      userId: session!.userId,
      clientId: session!.clientId,
      role: session!.role as ManagerActor["role"],
      name: session!.user?.name ?? "Manager",
      alsoSells: Boolean((session as { alsoSells?: boolean }).alsoSells),
    };

    const aggregate = await getManagerSalesAttentionAggregate({ actor });

    let metrics = null;
    if (includeMetrics) {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      metrics = await getAttentionMetrics({
        clientId: session!.clientId,
        sinceIso: since.toISOString(),
      });
    }

    return NextResponse.json({ ...aggregate, metrics });
  } catch (err) {
    console.error("Manager sales attention GET error:", err);
    return NextResponse.json({ error: "Failed to load attention aggregate" }, { status: 500 });
  }
}
