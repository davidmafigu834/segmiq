import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  QuotationApprovalPolicyRow,
  QuotationLineItemInput,
  QuotationSettingsRow,
} from "@/types";
import { computeQuotationTotals } from "@/lib/quotations/totals";
import { evaluateGovernance } from "@/lib/quotations/governance";
import { evaluateApprovalRequirement } from "@/lib/quotations/approval-engine";
import { validateQuotationForSend } from "@/lib/quotations/send-validation";

export async function loadPolicies(
  supabase: SupabaseClient,
  clientId: string
): Promise<QuotationApprovalPolicyRow[]> {
  const { data } = await supabase
    .from("quotation_approval_policies")
    .select("*")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("priority", { ascending: true });
  return (data ?? []) as QuotationApprovalPolicyRow[];
}

export async function evaluateQuoteGovernance(
  supabase: SupabaseClient,
  quote: Record<string, unknown> & { items?: QuotationLineItemInput[] },
  role: string
) {
  const items = (quote.items as QuotationLineItemInput[]) ?? [];
  const { data: settings } = await supabase
    .from("quotation_settings")
    .select("*")
    .eq("client_id", quote.client_id as string)
    .maybeSingle();
  const policies = await loadPolicies(supabase, quote.client_id as string);
  const totals = computeQuotationTotals(items, {
    fallbackTaxRate: Number(quote.tax_rate) || 0,
    otherAmount: Number(quote.other_amount) || 0,
    discountPercent: Number(quote.discount_percent) || 0,
  });
  const s = (settings ?? {}) as Partial<QuotationSettingsRow>;
  const governance = evaluateGovernance({
    items,
    totals,
    settings: s,
    role,
    paymentTermsLabel: quote.payment_terms_label as string | null,
    defaultPaymentTerms: s.default_payment_terms,
  });
  const approval = evaluateApprovalRequirement({
    items,
    totals,
    settings: s,
    policies,
    role,
    paymentTermsLabel: quote.payment_terms_label as string | null,
  });
  return { settings: s, totals, governance, approval };
}

export async function gateQuotationSend(
  supabase: SupabaseClient,
  quote: Record<string, unknown> & { items?: QuotationLineItemInput[] },
  role: string
) {
  const evald = await evaluateQuoteGovernance(supabase, quote, role);
  return {
    ...evald,
    gate: validateQuotationForSend({
      status: String(quote.status),
      approval_status: (quote.approval_status as string | null) ?? null,
      customer_name: quote.customer_name as string | null,
      deal_id: quote.deal_id as string | null,
      currency: quote.currency as string | null,
      valid_until: quote.valid_until as string | null,
      payment_terms_label: quote.payment_terms_label as string | null,
      tax_rate: Number(quote.tax_rate) || 0,
      other_amount: Number(quote.other_amount) || 0,
      discount_percent: Number(quote.discount_percent) || 0,
      items: (quote.items as QuotationLineItemInput[]) ?? [],
      governance: evald.governance,
      approval: evald.approval,
    }),
  };
}
