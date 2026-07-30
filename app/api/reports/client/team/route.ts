import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeClientTeamReport, type TeamPeriodId } from "@/lib/client-team-report";

export const dynamic = "force-dynamic";

function resolveTargetClientId(session: Session, url: URL): { clientId: string } | { error: string; status: number } {
  const q = url.searchParams.get("clientId");
  if (session.role === "SUPER_ADMIN") {
    if (!q) {
      return { error: "clientId query param required for agency admin", status: 400 };
    }
    return { clientId: q };
  }
  if (session.role === "CLIENT_MANAGER") {
    if (!session.clientId) {
      return { error: "Forbidden", status: 403 };
    }
    if (q && q !== session.clientId) {
      return { error: "Forbidden", status: 403 };
    }
    return { clientId: session.clientId };
  }
  return { error: "Forbidden", status: 403 };
}

function parsePeriod(v: string | null): TeamPeriodId {
  if (v === "last_month" || v === "last_90") return v;
  return "this_month";
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const resolved = resolveTargetClientId(session, url);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const period = parsePeriod(url.searchParams.get("period"));

  try {
    const report = await computeClientTeamReport(resolved.clientId, period);
    return NextResponse.json(report, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (e: unknown) {
    console.error("[reports/client/team]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Team report failed" },
      { status: 500 }
    );
  }
}
