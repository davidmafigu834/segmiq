import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeClientReport } from "@/lib/client-report";

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

  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const label = url.searchParams.get("label")?.trim() || "Report";

  if (!fromStr || !toStr) {
    return NextResponse.json({ error: "from and to ISO dates required" }, { status: 400 });
  }

  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  try {
    const report = await computeClientReport(resolved.clientId, from, to, label);
    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e: unknown) {
    console.error("[reports/client]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Report failed" },
      { status: 500 }
    );
  }
}
