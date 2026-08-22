import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuotationLineItemInput } from "@/types";
import { logQuotationEvent } from "@/lib/quotations/events";
import { commercialFingerprint } from "@/lib/quotations/fingerprint";
import { computeQuotationTotals } from "@/lib/quotations/totals";

export async function invalidateApprovalIfStale(
  supabase: SupabaseClient,
  opts: {
    quotationId: string;
    clientId: string;
    leadId: string | null;
    dealId: string | null;
    actor: { id: string | null; name: string };
    currentFingerprint: string | null | undefined;
    approvalStatus: string | null | undefined;
    items: QuotationLineItemInput[];
    discountPercent: number;
    otherAmount: number;
    taxRate: number;
    paymentTermsLabel: string | null;
    validUntil: string | null;
    currency: string | null;
  }
): Promise<{ invalidated: boolean; fingerprint: string }> {
  const totals = computeQuotationTotals(opts.items, {
    fallbackTaxRate: opts.taxRate,
    otherAmount: opts.otherAmount,
    discountPercent: opts.discountPercent,
  });
  const fingerprint = commercialFingerprint({
    items: opts.items,
    discountPercent: opts.discountPercent,
    otherAmount: opts.otherAmount,
    taxRate: opts.taxRate,
    paymentTermsLabel: opts.paymentTermsLabel,
    validUntil: opts.validUntil,
    currency: opts.currency,
    total: totals.total,
  });

  const watched = opts.approvalStatus === "pending" || opts.approvalStatus === "approved";
  if (!watched || !opts.currentFingerprint || opts.currentFingerprint === fingerprint) {
    return { invalidated: false, fingerprint };
  }

  await supabase
    .from("quotations")
    .update({
      approval_status: "required",
      status: "draft",
      approved_at: null,
      approved_by_id: null,
      approval_snapshot: null,
      commercial_fingerprint: fingerprint,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.quotationId);

  await supabase
    .from("quotation_approval_requests")
    .update({ status: "invalidated" })
    .eq("quotation_id", opts.quotationId)
    .eq("status", "pending");

  await supabase
    .from("quotation_approval_requests")
    .update({ status: "invalidated" })
    .eq("quotation_id", opts.quotationId)
    .eq("status", "approved")
    .is("decided_at", null);

  await logQuotationEvent(supabase, {
    quotationId: opts.quotationId,
    clientId: opts.clientId,
    leadId: opts.leadId,
    dealId: opts.dealId,
    actor: opts.actor,
    eventType: "APPROVAL_INVALIDATED",
    eventData: { previousFingerprint: opts.currentFingerprint, fingerprint },
  });

  return { invalidated: true, fingerprint };
}
