import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { logQuotationEvent } from "@/lib/quotations/events";
import { loadQuotationWithItems } from "@/lib/quotations/persist";
import { notifyQuotationAlert } from "@/lib/quotations/notify";
import {
  actorCanApproveTargets,
  awaitingApproverLabel,
  targetsFromUnknownRules,
} from "@/lib/quotations/approver-authority";

/** Manager approves, requests changes, or rejects a pending quotation. */
export async function POST(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  if (access.actor.role === "SALESPERSON") {
    return NextResponse.json({ error: "Only managers can approve quotations" }, { status: 403 });
  }

  const body = (await req.json()) as {
    decision: "approve" | "reject" | "request_changes";
    note?: string;
  };

  if (!["approve", "reject", "request_changes"].includes(body.decision)) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotations")
    .select("status, deal_id, approval_status, prepared_by_id, quote_number, lead_id")
    .eq("id", params.quotationId)
    .single();

  if (!quote || (quote.approval_status !== "pending" && quote.status !== "pending_approval")) {
    return NextResponse.json({ error: "Quotation is not pending approval" }, { status: 400 });
  }

  const { data: pendingRequests } = await supabase
    .from("quotation_approval_requests")
    .select("id, triggered_rules")
    .eq("quotation_id", params.quotationId)
    .eq("status", "pending");
  const requestIds = (pendingRequests ?? []).map((row) => row.id as string);
  let targets = (pendingRequests ?? []).flatMap((row) => targetsFromUnknownRules(row.triggered_rules));
  if (requestIds.length > 0) {
    const { data: steps } = await supabase
      .from("quotation_approval_steps")
      .select("approver_role, approver_user_id, status")
      .in("request_id", requestIds)
      .eq("status", "pending");
    if (steps && steps.length > 0) {
      targets = steps.map((step) => ({
        approverRole: (step.approver_role as string | null) ?? null,
        approverUserId: (step.approver_user_id as string | null) ?? null,
      }));
    }
  }
  if (!actorCanApproveTargets({ id: access.actor.id, role: access.actor.role }, targets)) {
    return NextResponse.json(
      { error: awaitingApproverLabel(targets) },
      { status: 403 }
    );
  }

  const now = new Date().toISOString();
  const note = body.note?.trim() || null;
  const salespersonId = quote.prepared_by_id as string | null;
  const quoteLabel = (quote.quote_number as string) || "quotation";

  if (body.decision === "approve") {
    await supabase
      .from("quotations")
      .update({
        status: "draft",
        approval_status: "approved",
        approved_at: now,
        approved_by_id: access.actor.id,
        approval_note: note,
        updated_at: now,
      })
      .eq("id", params.quotationId);

    await supabase
      .from("quotation_approval_requests")
      .update({
        status: "approved",
        decided_by_id: access.actor.id,
        decided_at: now,
        decision_note: note,
      })
      .eq("quotation_id", params.quotationId)
      .eq("status", "pending");

    await logQuotationEvent(supabase, {
      quotationId: params.quotationId,
      clientId: access.clientId,
      leadId: access.leadId,
      dealId: (quote.deal_id as string) || null,
      actor: { id: access.actor.id, name: access.actor.name },
      eventType: "APPROVED",
      eventData: { note },
    });

    if (salespersonId) {
      await notifyQuotationAlert({
        userId: salespersonId,
        leadId: access.leadId,
        quotationId: params.quotationId,
        message: `${quoteLabel} was approved. You can send it now.`,
      });
    }
  } else if (body.decision === "request_changes") {
    await supabase
      .from("quotations")
      .update({
        status: "draft",
        approval_status: "changes_requested",
        approval_note: note,
        updated_at: now,
      })
      .eq("id", params.quotationId);

    await supabase
      .from("quotation_approval_requests")
      .update({
        status: "changes_requested",
        decided_by_id: access.actor.id,
        decided_at: now,
        decision_note: note,
      })
      .eq("quotation_id", params.quotationId)
      .eq("status", "pending");

    await logQuotationEvent(supabase, {
      quotationId: params.quotationId,
      clientId: access.clientId,
      leadId: access.leadId,
      dealId: (quote.deal_id as string) || null,
      actor: { id: access.actor.id, name: access.actor.name },
      eventType: "CHANGES_REQUESTED",
      eventData: { note },
    });

    if (salespersonId) {
      await notifyQuotationAlert({
        userId: salespersonId,
        leadId: access.leadId,
        quotationId: params.quotationId,
        message: `Changes requested on ${quoteLabel}${note ? `: ${note}` : ""}`,
      });
    }
  } else {
    await supabase
      .from("quotations")
      .update({
        status: "draft",
        approval_status: "rejected",
        approval_note: note,
        updated_at: now,
      })
      .eq("id", params.quotationId);

    await supabase
      .from("quotation_approval_requests")
      .update({
        status: "rejected",
        decided_by_id: access.actor.id,
        decided_at: now,
        decision_note: note,
      })
      .eq("quotation_id", params.quotationId)
      .eq("status", "pending");

    await logQuotationEvent(supabase, {
      quotationId: params.quotationId,
      clientId: access.clientId,
      leadId: access.leadId,
      dealId: (quote.deal_id as string) || null,
      actor: { id: access.actor.id, name: access.actor.name },
      eventType: "REJECTED",
      eventData: { note },
    });

    if (salespersonId) {
      await notifyQuotationAlert({
        userId: salespersonId,
        leadId: access.leadId,
        quotationId: params.quotationId,
        message: `${quoteLabel} was rejected${note ? `: ${note}` : ""}`,
      });
    }
  }

  const updated = await loadQuotationWithItems(supabase, params.quotationId);
  return NextResponse.json({ quotation: updated });
}
