import { NextResponse } from "next/server";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import {
  fetchSalespersonReports,
  type SalesReportGranularity,
  type SalesReportPeriodId,
  type SalesReportSourceFilter,
} from "@/lib/sales/sales-reports-data";

export const dynamic = "force-dynamic";

const PERIODS = new Set<SalesReportPeriodId>([
  "last_7",
  "last_30",
  "last_90",
  "this_month",
  "last_month",
  "this_quarter",
  "custom",
]);

const SOURCES = new Set<SalesReportSourceFilter>([
  "all",
  "whatsapp",
  "facebook",
  "referral",
  "website",
  "manual",
  "other",
]);

const GRANULARITIES = new Set<SalesReportGranularity>(["daily", "weekly", "monthly"]);

export async function GET(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;

  const url = new URL(req.url);
  const periodRaw = (url.searchParams.get("period") ?? "last_30") as SalesReportPeriodId;
  const period = PERIODS.has(periodRaw) ? periodRaw : "last_30";
  const sourceRaw = (url.searchParams.get("source") ?? "all") as SalesReportSourceFilter;
  const source = SOURCES.has(sourceRaw) ? sourceRaw : "all";
  const granRaw = url.searchParams.get("granularity") as SalesReportGranularity | null;
  const granularity = granRaw && GRANULARITIES.has(granRaw) ? granRaw : null;

  try {
    const data = await fetchSalespersonReports({
      userId: session!.userId,
      period,
      source,
      granularity,
      customFrom: url.searchParams.get("from"),
      customTo: url.searchParams.get("to"),
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Sales reports error:", err);
    return NextResponse.json({ error: "Failed to load reports" }, { status: 500 });
  }
}
