import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { logQuotationEvent } from "@/lib/quotations/events";
import { runCommercialCheck, totalsForCheck } from "@/lib/quotations/commercial-check";
import { loadQuotationWithItems } from "@/lib/quotations/persist";
import type { QuotationLineItemInput } from "@/types";

/** Request internal commercial approval when guardrails require it. */
export async function POST(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const body = (await req.json().catch(() => ({}))) as { note?: string };
  const supabase = createAdminClient();
  const full = await loadQuotationWithItems(supabase, params.quotationId);
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (full.status !== "draft" && full.status !== "pending_approval") {
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

  const check = runCommercialCheck({
    status: String(full.status),
    customerName: full.customer_name as string | null,
    dealId: full.deal_id as string | null,
    currency: full.currency as string,
    validUntil: full.valid_until as string | null,
    paymentTermsLabel: full.payment_terms_label as string | null,
    items,
    totals,
  });

  if (!check.canSend) {
    return NextResponse.json(
      {
        error: "Complete commercial check before requesting approval",
        blockers: check.items.filter((c) => c.status === "block").map((c) => c.action || c.label),
      },
      { status: 400 }
    );
  }

  const reasons = ["Manual approval requested"];

  await supabase
    .from("quotations")
    .update({
      status: "pending_approval",
      approval_status: "pending",
      approval_required_reasons: reasons,
      approval_note: body.note?.trim() || null,
      approval_requested_at: new Date().toISOString(),
      approval_requested_by_id: access.actor.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.quotationId);

  await logQuotationEvent(supabase, {
    quotationId: params.quotationId,
    clientId: access.clientId,
    leadId: access.leadId,
    dealId: (full.deal_id as string) || null,
    actor: { id: access.actor.id, name: access.actor.name },
    eventType: "APPROVAL_REQUESTED",
    eventData: { reasons, note: body.note?.trim() || null, total: totals.total },
  });

  const updated = await loadQuotationWithItems(supabase, params.quotationId);
  return NextResponse.json({ quotation: updated, reasons });
}
