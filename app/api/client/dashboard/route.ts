import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-guards";
import { fetchClientManagerDashboardData } from "@/lib/dashboard-data";

export async function GET(req: Request) {
  const guard = await requireRoles(["CLIENT_MANAGER", "AGENCY_ADMIN"]);
  if (guard.error) return guard.error;
  const { session } = guard;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId") || session!.clientId;

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  if (session!.role === "CLIENT_MANAGER" && session!.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await fetchClientManagerDashboardData(clientId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Client manager dashboard error:", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
