import { NextResponse } from "next/server";
import { requireRolesFromRequest } from "@/lib/api-guards";
import { fetchSalespersonDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireRolesFromRequest(req, ["SALESPERSON"]);
  if (guard.error) return guard.error;
  const { session } = guard;

  try {
    const data = await fetchSalespersonDashboardData(session!.userId);
    return NextResponse.json({ ...data });
  } catch (err) {
    console.error("Salesperson dashboard error:", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
