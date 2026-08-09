import { NextResponse } from "next/server";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import {
  fetchSalespersonLeadsDirectory,
  isAttentionFilter,
  isLeadsIntent,
  isLeadsPeriod,
  isLeadsSource,
  isLeadsStage,
  type AttentionFilter,
  type LeadsIntentFilter,
  type LeadsPeriodId,
  type LeadsSourceFilter,
  type LeadsStageFilter,
} from "@/lib/sales/leads-directory";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;

  const url = new URL(req.url);
  const periodRaw = url.searchParams.get("period") ?? "this_month";
  const period: LeadsPeriodId = isLeadsPeriod(periodRaw) ? periodRaw : "this_month";
  const sourceRaw = url.searchParams.get("source") ?? "all";
  const source: LeadsSourceFilter = isLeadsSource(sourceRaw) ? sourceRaw : "all";
  const stageRaw = url.searchParams.get("stage") ?? "all";
  const stage: LeadsStageFilter = isLeadsStage(stageRaw) ? stageRaw : "all";
  const intentRaw = url.searchParams.get("intent") ?? "all";
  const intent: LeadsIntentFilter = isLeadsIntent(intentRaw) ? intentRaw : "all";
  const attentionRaw = url.searchParams.get("attention") ?? "none";
  const attention: AttentionFilter = isAttentionFilter(attentionRaw) ? attentionRaw : "none";
  const search = url.searchParams.get("search") ?? "";
  const page = Number(url.searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20") || 20;

  try {
    const data = await fetchSalespersonLeadsDirectory({
      userId: session!.userId,
      period,
      source,
      stage,
      intent,
      attention,
      search,
      page,
      pageSize,
      customFrom: url.searchParams.get("from"),
      customTo: url.searchParams.get("to"),
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Sales leads directory error:", err);
    return NextResponse.json({ error: "Failed to load leads" }, { status: 500 });
  }
}
