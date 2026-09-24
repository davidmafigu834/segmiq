import { NextResponse } from "next/server";
import { findReportById, requireTeamReportAccess, toDetail } from "@/lib/sales/weekly-team-report";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { reportId: string } }
) {
  const access = await requireTeamReportAccess(req, "view");
  if ("error" in access) return access.error;

  const { loadDemoDatasetForClient } = await import("@/lib/demo/provider");
  const demo = await loadDemoDatasetForClient(access.clientId);
  if (demo) {
    const { buildDemoWeeklyDetail, demoWeeklyReportId } = await import("@/lib/demo/adapters/weekly");
    const detail = buildDemoWeeklyDetail(demo);
    if (params.reportId !== detail.id && params.reportId !== demoWeeklyReportId()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ report: detail });
  }

  const report = await findReportById(access.clientId, params.reportId);
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ report: toDetail(report) });
}
