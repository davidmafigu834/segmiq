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
    const data = await fetchSalespersonTasks({
      userId: session!.userId,
      view,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Sales tasks error:", err);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
}
