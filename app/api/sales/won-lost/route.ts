import { NextResponse } from "next/server";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import {
  fetchSalespersonWonLost,
  isWonLostPeriod,
  isWonLostSource,
  type OutcomeTab,
  type WonLostGranularity,
  type WonLostPeriodId,
  type WonLostSourceFilter,
} from "@/lib/sales/outcomes";

export const dynamic = "force-dynamic";

const OUTCOMES = new Set<OutcomeTab>(["all", "won", "lost"]);
const GRANULARITIES = new Set<WonLostGranularity>(["weekly", "monthly"]);

export async function GET(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;

  const url = new URL(req.url);
  const periodRaw = url.searchParams.get("period") ?? "this_month";
  const period: WonLostPeriodId = isWonLostPeriod(periodRaw) ? periodRaw : "this_month";
  const sourceRaw = url.searchParams.get("source") ?? "all";
  const source: WonLostSourceFilter = isWonLostSource(sourceRaw) ? sourceRaw : "all";
  const outcomeRaw = (url.searchParams.get("outcome") ?? "all") as OutcomeTab;
  const outcome = OUTCOMES.has(outcomeRaw) ? outcomeRaw : "all";
  const granRaw = url.searchParams.get("granularity") as WonLostGranularity | null;
  const granularity = granRaw && GRANULARITIES.has(granRaw) ? granRaw : null;

  try {
    if (session?.clientId) {
      const { loadDemoDatasetForClient } = await import("@/lib/demo/provider");
      const demo = await loadDemoDatasetForClient(session.clientId);
      if (demo) {
        const { buildDemoWonLost } = await import("@/lib/demo/adapters/experience");
        return NextResponse.json(buildDemoWonLost(demo, session.userId, session.role, period));
      }
    }
    const data = await fetchSalespersonWonLost({
      userId: session!.userId,
      period,
      source,
      outcome,
      granularity,
      customFrom: url.searchParams.get("from"),
      customTo: url.searchParams.get("to"),
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Sales won-lost error:", err);
    return NextResponse.json({ error: "Failed to load won & lost" }, { status: 500 });
  }
}
