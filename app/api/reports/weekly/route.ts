import { NextResponse } from "next/server";
import { background } from "@/lib/background";
import {
  generateWeeklyTeamReport,
  listReports,
  previousCompletedWeek,
  requireTeamReportAccess,
  toListItem,
  weekContaining,
} from "@/lib/sales/weekly-team-report";
import { weekFromMonday } from "@/lib/sales/weekly-team-report/period";
import { resolveSalesTimezone } from "@/lib/sales/intelligence/timezone";
import { resolveClientTimezone } from "@/lib/sales/weekly-team-report/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const access = await requireTeamReportAccess(req, "view");
  if ("error" in access) return access.error;

  const url = new URL(req.url);
  const limit = Math.min(52, Math.max(1, Number(url.searchParams.get("limit") ?? 24) || 24));
  const rows = await listReports(access.clientId, limit);
  return NextResponse.json({
    reports: rows.map(toListItem),
    latest: rows[0] ? toListItem(rows[0]) : null,
  });
}

export async function POST(req: Request) {
  const access = await requireTeamReportAccess(req, "generate");
  if ("error" in access) return access.error;

  let body: { periodStartDate?: string; force?: boolean } = {};
  try {
    body = (await req.json()) as { periodStartDate?: string; force?: boolean };
  } catch {
    body = {};
  }

  const timezone = resolveSalesTimezone(await resolveClientTimezone(access.clientId));
  const now = new Date();
  const period = body.periodStartDate
    ? weekFromMonday(body.periodStartDate, timezone)
    : previousCompletedWeek(now, timezone);

  const resultPromise = generateWeeklyTeamReport({
    clientId: access.clientId,
    period,
    generatedByKind: "user",
    generatedByUserId: access.auth.userId,
    force: Boolean(body.force),
  });

  background("weekly-team-report.manual", async () => {
    await resultPromise;
  });

  const currentWeek = weekContaining(now, timezone);
  return NextResponse.json(
    {
      accepted: true,
      periodStartDate: period.startDate,
      periodEndDate: period.endDate,
      currentWeekStart: currentWeek.startDate,
    },
    { status: 202 }
  );
}
