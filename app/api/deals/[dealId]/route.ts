import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canModifyDeal,
  canReadDeal,
  closeDealLost,
  closeDealWon,
  getDealCompleteness,
  getDealCommercialValue,
  getDealNextActionState,
  getDealTimeline,
  latestQuoteTotal,
  updateDealFields,
  updateDealStage,
} from "@/lib/sales/deals";
import type { DealRow, LeadRow, QuotationRow } from "@/types";

export async function GET(
  req: Request,
  { params }: { params: { dealId: string } }
) {
  const access = await canReadDeal(params.dealId, req);
  if (!access.ok) {
    return NextResponse.json(
      { error: "Not found" },
      { status: access.status === 401 ? 401 : 404 }
    );
  }

  const supabase = createAdminClient();
  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("id", params.dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const dealRow = deal as DealRow;

  const [{ data: lead }, { data: quotes }, timeline] = await Promise.all([
    supabase
      .from("leads")
      .select("*")
      .eq("id", dealRow.originating_lead_id)
      .maybeSingle(),
    supabase
      .from("quotations")
      .select("*")
      .or(
        `deal_id.eq.${dealRow.id},and(lead_id.eq.${dealRow.originating_lead_id},deal_id.is.null)`
      )
      .order("created_at", { ascending: false }),
    getDealTimeline({
      dealId: dealRow.id,
      originatingLeadId: dealRow.originating_lead_id,
    }),
  ]);

  const quoteRows = (quotes ?? []) as QuotationRow[];
  const commercial = getDealCommercialValue(dealRow, {
    latestQuoteTotal: latestQuoteTotal(quoteRows),
  });
  const completeness = getDealCompleteness(dealRow, {
    latestQuoteTotal: latestQuoteTotal(quoteRows),
  });
  const nextAction = getDealNextActionState(dealRow);

  return NextResponse.json({
    deal: dealRow,
    lead: lead as LeadRow | null,
    quotes: quoteRows,
    commercial,
    completeness,
    nextAction,
    timeline,
  });
}

const patchSchema = z.object({
  stage: z
    .enum(["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"])
    .optional(),
  close: z
    .object({
      outcome: z.enum(["WON", "LOST"]),
      wonValue: z.number().nonnegative().optional(),
      wonAt: z.string().optional(),
      lostReason: z.string().optional(),
      notes: z.string().max(2000).nullable().optional(),
    })
    .optional(),
  name: z.string().min(1).max(200).optional(),
  service_summary: z.string().max(500).nullable().optional(),
  location: z.string().max(300).nullable().optional(),
  buying_timeframe: z.string().max(120).nullable().optional(),
  decision_maker_status: z.enum(["YES", "NO", "UNKNOWN"]).nullable().optional(),
  decision_maker_name: z.string().max(200).nullable().optional(),
  expected_decision_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  customer_budget: z.number().nonnegative().nullable().optional(),
  sales_estimate: z.number().nonnegative().nullable().optional(),
  estimated_value: z.number().nonnegative().nullable().optional(),
  estimated_value_min: z.number().nonnegative().nullable().optional(),
  estimated_value_max: z.number().nonnegative().nullable().optional(),
  value_status: z.enum(["KNOWN", "RANGE", "PENDING_ESTIMATE"]).optional(),
  value_basis: z
    .enum(["CUSTOMER_BUDGET", "SALES_ESTIMATE", "LATEST_QUOTE", "WON_VALUE"])
    .nullable()
    .optional(),
  next_action_at: z.string().nullable().optional(),
  next_action_label: z.string().max(300).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { dealId: string } }
) {
  const check = await canModifyDeal(params.dealId, req);
  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data = parsed.data;

  if (data.close?.outcome === "WON") {
    const result = await closeDealWon({
      dealId: params.dealId,
      actorId: check.userId,
      wonValue: data.close.wonValue ?? 0,
      wonAt: data.close.wonAt,
      notes: data.close.notes,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ deal: result.deal });
  }

  if (data.close?.outcome === "LOST") {
    const result = await closeDealLost({
      dealId: params.dealId,
      actorId: check.userId,
      lostReason: data.close.lostReason ?? "",
      notes: data.close.notes,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ deal: result.deal });
  }

  if (data.stage) {
    const result = await updateDealStage({
      dealId: params.dealId,
      actorId: check.userId,
      stage: data.stage,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ deal: result.deal });
  }

  const fieldPatch = { ...data };
  delete fieldPatch.close;
  delete fieldPatch.stage;

  if (Object.keys(fieldPatch).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const result = await updateDealFields({
    dealId: params.dealId,
    actorId: check.userId,
    patch: fieldPatch,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ deal: result.deal });
}
