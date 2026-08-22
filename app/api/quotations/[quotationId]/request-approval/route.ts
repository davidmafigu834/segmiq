import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { logQuotationEvent } from "@/lib/quotations/events";
import { runCommercialCheck, totalsForCheck } from "@/lib/quotations/commercial-check";
import { loadQuotationWithItems } from "@/lib/quotations/persist";
import { evaluateQuoteGovernance } from "@/lib/quotations/evaluate-send";
import { commercialFingerprint } from "@/lib/quotations/fingerprint";
import { buildCommercialSnapshot } from "@/lib/quotations/approval-engine";
import { notifyApprovers } from "@/lib/quotations/notify";
import type { QuotationLineItemInput } from "@/types";

export async function POST(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const body = (await req.json().catch(() => ({}))) as { note?: string };
  const supabase = createAdminClient();
  const full = await loadQuotationWithItems(supabase, params.quotationId);
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const status = String(full.status);
  if (status !== "draft" && status !== "pending_approval" && status !== "approved") {
    return NextResponse.json(
      { error: "Only draft quotations can be submitted for approval" },
      { status: 400 }
    );
  }

  const items = (full.items as QuotationLineItemInput[]) ?? [];
  const totals = totalsForCheck(
    items,
    Number(full.tax_rate) || 0,
    Number(full.other_amount) || 0,
    Number(full.discount_percent) || 0
  );
  const evald = await evaluateQuoteGovernance(supabase, full as never, access.actor.role);

  if (!evald.approval.required) {
    return NextResponse.json({ error: "Approval is not required for this quotation" }, { status: 400 });
  }

  const check = runCommercialCheck({
    status,
    approvalStatus: "not_required",
    customerName: full.customer_name as string | null,
    dealId: full.deal_id as string | null,
    currency: full.currency as string,
    validUntil: full.valid_until as string | null,
    paymentTermsLabel: full.payment_terms_label as string | null,
    items,
    totals,
    governance: null,
    approval: null,
  });
  const blockers = check.items.filter(
    (c) => c.status === "block" && !["approval", "discount", "margin"].includes(c.id)
  );
  if (blockers.length) {
    return NextResponse.json(
      {
        error: "Complete commercial check before requesting approval",
        blockers: blockers.map((c) => c.action || c.label),
      },
      { status: 400 }
    );
  }

  const fingerprint = commercialFingerprint({
    items,
    discountPercent: Number(full.discount_percent) || 0,
    otherAmount: Number(full.other_amount) || 0,
    taxRate: Number(full.tax_rate) || 0,
    paymentTermsLabel: full.payment_terms_label as string | null,
    validUntil: full.valid_until as string | null,
    currency: full.currency as string | null,
    total: totals.total,
  });

  const snapshot = buildCommercialSnapshot({
    quoteNumber: (full.quote_number as string | null) ?? null,
    revisionNumber: Number(full.revision_number) || 1,
    totals,
    currency: (full.currency as string) || "USD",
    paymentTermsLabel: full.payment_terms_label as string | null,
    validUntil: full.valid_until as string | null,
    fingerprint,
    governance: evald.governance,
    items,
  });

  await supabase
    .from("quotation_approval_requests")
    .update({ status: "cancelled" })
    .eq("quotation_id", params.quotationId)
    .eq("status", "pending");

  const { data: request, error: reqErr } = await supabase
    .from("quotation_approval_requests")
    .insert({
      client_id: access.clientId,
      quotation_id: params.quotationId,
      revision_number: Number(full.revision_number) || 1,
      status: "pending",
      reason: body.note?.trim() || null,
      commercial_snapshot: snapshot,
      triggered_rules: evald.approval.rules,
      fingerprint,
      requested_by_id: access.actor.id,
    })
    .select("id")
    .single();

  if (!reqErr && request) {
    const groups = new Map<number, typeof evald.approval.rules>();
    for (const rule of evald.approval.rules) {
      const g = rule.sequenceGroup || 1;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(rule);
    }
    const steps = [...groups.entries()].flatMap(([seq, rules]) =>
      rules.map((rule) => ({
        request_id: request.id,
        client_id: access.clientId,
        sequence_group: seq,
        approver_role: rule.approverRole,
        approver_user_id: rule.approverUserId,
        status: "pending",
      }))
    );
    if (steps.length) await supabase.from("quotation_approval_steps").insert(steps);
  }

  await supabase
    .from("quotations")
    .update({
      status: "draft",
      approval_status: "pending",
      approval_required_reasons: evald.approval.reasons,
      approval_note: body.note?.trim() || null,
      approval_requested_at: new Date().toISOString(),
      approval_requested_by_id: access.actor.id,
      approval_snapshot: snapshot,
      commercial_fingerprint: fingerprint,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.quotationId);

  await logQuotationEvent(supabase, {
    quotationId: params.quotationId,
    clientId: access.clientId,
    leadId: access.leadId,
    dealId: (full.deal_id as string) || null,
    actor: { id: access.actor.id, name: access.actor.name },
    eventType: String(full.approval_status) === "changes_requested" ? "RESUBMITTED" : "APPROVAL_REQUESTED",
    eventData: {
      reasons: evald.approval.reasons,
      note: body.note?.trim() || null,
      total: totals.total,
      fingerprint,
    },
  });

  await notifyApprovers({
    clientId: access.clientId,
    leadId: access.leadId,
    quotationId: params.quotationId,
    excludeUserId: access.actor.id,
    message: `Approval requested for ${(full.quote_number as string) || "quotation"} (${totals.total})`,
    targets: evald.approval.rules.map((rule) => ({
      approverRole: rule.approverRole,
      approverUserId: rule.approverUserId,
    })),
  });

  const updated = await loadQuotationWithItems(supabase, params.quotationId);
  return NextResponse.json({ quotation: updated, reasons: evald.approval.reasons, rules: evald.approval.rules });
}
