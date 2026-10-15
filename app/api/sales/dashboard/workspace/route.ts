import { NextResponse } from "next/server";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import { loadDailyWorkspace } from "@/lib/sales/dashboard/load-daily-workspace";

export const dynamic = "force-dynamic";

const VISIT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const session = guard.session;
  if (!session?.clientId) {
    return NextResponse.json({ error: "No company is selected for this account." }, { status: 403 });
  }

  const incoming = new URL(req.url).searchParams.get("visitId");
  const visitId = incoming && VISIT_ID.test(incoming) ? incoming : null;

  try {
    const { loadDemoDatasetForClient } = await import("@/lib/demo/provider");
    const demo = await loadDemoDatasetForClient(session.clientId);
    if (demo) {
      const { buildDemoDailyWorkspace } = await import("@/lib/demo/adapters/experience");
      return NextResponse.json(buildDemoDailyWorkspace(demo, session.userId, session.role));
    }
    const data = await loadDailyWorkspace({
      userId: session.userId,
      clientId: session.clientId,
      incomingVisitId: visitId,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[daily-workspace]", err);
    return NextResponse.json({ error: "Your sales today could not be loaded." }, { status: 500 });
  }
}
