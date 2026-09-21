import { NextResponse } from "next/server";
import { findReportById, requireTeamReportAccess, toDetail } from "@/lib/sales/weekly-team-report";
import { renderWeeklyTeamReportPdf } from "@/lib/sales/weekly-team-report/pdf";
import { getObject, isR2Configured, isWeeklyTeamReportKeyForClient } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: { reportId: string } }
) {
  const access = await requireTeamReportAccess(req, "download");
  if ("error" in access) return access.error;

  const report = await findReportById(access.clientId, params.reportId);
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (report.generation_status !== "ready") {
    return NextResponse.json({ error: "Report is not ready" }, { status: 409 });
  }

  let buffer: Buffer | null = null;
  if (report.file_key && isR2Configured() && isWeeklyTeamReportKeyForClient(access.clientId, report.file_key)) {
    try {
      buffer = await getObject(report.file_key);
    } catch {
      buffer = null;
    }
  }
  if (!buffer) {
    const detail = toDetail(report);
    if (!detail.payload) {
      return NextResponse.json({ error: "Report document is unavailable" }, { status: 409 });
    }
    buffer = await renderWeeklyTeamReportPdf(detail.payload);
  }

  const filename = `weekly-sales-report-${report.period_start_date}.pdf`;
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
