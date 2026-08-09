import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { getLeadLocationAnalysis } from "@/lib/lead-location-analysis";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role === "SALESPERSON") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  if (!canAccessClient(session.role, session.clientId, clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const daysParam = searchParams.get("days");
  const windowDays = daysParam
    ? Math.min(365, Math.max(7, parseInt(daysParam, 10) || 90))
    : 90;

  try {
    const analysis = await getLeadLocationAnalysis(clientId, windowDays);
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Client location report error:", error);
    return NextResponse.json(
      { error: "Failed to load lead locations" },
      { status: 500 }
    );
  }
}
