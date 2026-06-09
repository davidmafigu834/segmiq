import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { aggregateLossAnalysis } from "@/lib/loss-analysis";

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
  const windowDays = daysParam ? Math.min(90, Math.max(7, parseInt(daysParam, 10) || 30)) : 30;

  try {
    const analysis = await aggregateLossAnalysis(clientId, windowDays);
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("Client loss report error:", err);
    return NextResponse.json({ error: "Failed to load loss analysis" }, { status: 500 });
  }
}
