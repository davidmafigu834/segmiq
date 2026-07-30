import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeAgencyReport, parseClientIds, parseSources } from "@/lib/agency-report";
import type { AgencyReportFilters } from "@/lib/agency-report";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
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

  const filters: AgencyReportFilters = {
    clientIds: parseClientIds(url.searchParams),
    sources: parseSources(url.searchParams),
  };

  try {
    const report = await computeAgencyReport(from, to, label, filters);
    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e: unknown) {
    console.error("[reports/agency]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Report failed" },
      { status: 500 }
    );
  }
}
