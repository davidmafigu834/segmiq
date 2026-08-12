import { NextResponse } from "next/server";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import { fetchDailySalesPlan } from "@/lib/sales/intelligence/daily-plan-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;

  if (!session!.clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  try {
    const data = await fetchDailySalesPlan({
      userId: session!.userId,
      clientId: session!.clientId,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Daily sales plan GET error:", err);
    const message = err instanceof Error ? err.message : "Failed to load daily plan";
    if (/sales_action_states|sales_execution_settings|does not exist|relation/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Sales intelligence tables are not set up yet. Apply migration 087_sales_execution_intelligence.",
          code: "INTELLIGENCE_SCHEMA_MISSING",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Failed to load daily sales plan" }, { status: 500 });
  }
}
