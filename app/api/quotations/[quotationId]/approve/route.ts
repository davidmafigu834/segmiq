import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { logQuotationEvent } from "@/lib/quotations/events";
import { loadQuotationWithItems } from "@/lib/quotations/persist";

/** Manager approves or requests changes on a pending quotation. */
export async function POST(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  if (access.actor.role === "SALESPERSON") {
    return NextResponse.json({ error: "Only managers can approve quotations" }, { status: 403 });
  }

  const body = (await req.json()) as {
    decision: "approve" | "reject";
    note?: string;
  };

  if (body.decision !== "approve" && body.decision !== "reject") {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotations")
    .select("status, deal_id")
    .eq("id", params.quotationId)
    .single();

  if (!quote || quote.status !== "pending_approval") {
    return NextResponse.json({ error: "Quotation is not pending approval" }, { status: 400 });
  }

  if (body.decision === "approve") {
    await supabase
      .from("quotations")
      .update({
        status: "approved",
        approval_status: "approved",
        approved_at: new Date().toISOString(),
        approved_by_id: access.actor.id,
        approval_note: body.note?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.quotationId);

    await logQuotationEvent(supabase, {
      quotationId: params.quotationId,
      clientId: access.clientId,
      leadId: access.leadId,
      dealId: (quote.deal_id as string) || null,
      actor: { id: access.actor.id, name: access.actor.name },
      eventType: "APPROVED",
      eventData: { note: body.note?.trim() || null },
    });
  } else {
    await supabase
      .from("quotations")
      .update({
        status: "draft",
        approval_status: "rejected",
        approval_note: body.note?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.quotationId);

    await logQuotationEvent(supabase, {
      quotationId: params.quotationId,
      clientId: access.clientId,
      leadId: access.leadId,
      dealId: (quote.deal_id as string) || null,
      actor: { id: access.actor.id, name: access.actor.name },
      eventType: "CHANGES_REQUESTED",
      eventData: { note: body.note?.trim() || null },
    });
  }

  const updated = await loadQuotationWithItems(supabase, params.quotationId);
  return NextResponse.json({ quotation: updated });
}
