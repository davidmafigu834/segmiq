import { NextResponse } from "next/server";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import {
  fetchSalespersonQuotes,
  isQuotesPeriod,
  isQuotesSource,
  isQuotesStatus,
  type QuotesPeriodId,
  type QuotesSourceFilter,
  type QuotesStatusFilter,
} from "@/lib/sales/quotes";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;

  const url = new URL(req.url);
  const periodRaw = url.searchParams.get("period") ?? "this_month";
  const period: QuotesPeriodId = isQuotesPeriod(periodRaw) ? periodRaw : "this_month";
  const sourceRaw = url.searchParams.get("source") ?? "all";
  const source: QuotesSourceFilter = isQuotesSource(sourceRaw) ? sourceRaw : "all";
  const statusRaw = url.searchParams.get("status") ?? "all";
  const status: QuotesStatusFilter = isQuotesStatus(statusRaw) ? statusRaw : "all";

  try {
    const data = await fetchSalespersonQuotes({
      userId: session!.userId,
      period,
      source,
      status,
      customFrom: url.searchParams.get("from"),
      customTo: url.searchParams.get("to"),
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Sales quotes error:", err);
    return NextResponse.json({ error: "Failed to load quotations" }, { status: 500 });
  }
}
