import { NextResponse } from "next/server";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import { getSalesDashboardData } from "@/lib/sales/get-sales-dashboard-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;

  try {
    const data = await getSalesDashboardData({
      userId: session!.userId,
      clientId: session!.clientId ?? null,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Salesperson dashboard error:", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
