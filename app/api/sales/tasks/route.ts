import { NextResponse } from "next/server";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import { fetchSalespersonTasks } from "@/lib/sales/tasks/sales-tasks-data";
import type { SalesTaskView } from "@/lib/sales/tasks/types";

export const dynamic = "force-dynamic";

const VIEWS = new Set<SalesTaskView>(["mine", "assigned", "created", "all"]);

export async function GET(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;

  const url = new URL(req.url);
  const viewRaw = (url.searchParams.get("view") ?? "mine") as SalesTaskView;
  const view = VIEWS.has(viewRaw) ? viewRaw : "mine";

  try {
    if (session?.clientId) {
      const { loadDemoDatasetForClient } = await import("@/lib/demo/provider");
      const demo = await loadDemoDatasetForClient(session.clientId);
      if (demo) {
        const { buildDemoTasks } = await import("@/lib/demo/adapters/experience");
        return NextResponse.json(buildDemoTasks(demo, session.userId, session.role, view));
      }
    }
    const data = await fetchSalespersonTasks({
      userId: session!.userId,
      clientId: session!.clientId,
      view,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Sales tasks error:", err);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
}
