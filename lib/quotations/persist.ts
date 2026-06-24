import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuotationLineItemInput } from "@/types";
import { computeTotals, lineAmount } from "@/lib/quotations/totals";

/**
 * Replace a quotation's line items and recompute + persist its totals.
 * Returns the computed totals.
 */
export async function saveItemsAndTotals(
  supabase: SupabaseClient,
  quotationId: string,
  items: QuotationLineItemInput[],
  taxRate: number,
  otherAmount: number
): Promise<{ subtotal: number; taxAmount: number; total: number }> {
  const clean = items
    .filter((it) => (it.item_name ?? "").trim().length > 0)
    .map((it, idx) => ({
      quotation_id: quotationId,
      catalog_item_id: it.catalog_item_id ?? null,
      item_name: it.item_name.trim(),
      description: it.description?.trim() || null,
      unit_price: Number(it.unit_price) || 0,
      quantity: Number(it.quantity) || 0,
      amount: lineAmount(it.unit_price, it.quantity),
      group_label: it.group_label?.trim() || null,
      sort_order: idx,
    }));

  await supabase.from("quotation_line_items").delete().eq("quotation_id", quotationId);
  if (clean.length > 0) {
    await supabase.from("quotation_line_items").insert(clean);
  }

  const totals = computeTotals(clean, taxRate, otherAmount);
  await supabase
    .from("quotations")
    .update({
      subtotal: totals.subtotal,
      tax_rate: Number(taxRate) || 0,
      tax_amount: totals.taxAmount,
      other_amount: Number(otherAmount) || 0,
      total: totals.total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", quotationId);

  return totals;
}

export async function loadQuotationWithItems(
  supabase: SupabaseClient,
  quotationId: string
): Promise<Record<string, unknown> | null> {
  const { data: quote } = await supabase
    .from("quotations")
    .select("*")
    .eq("id", quotationId)
    .maybeSingle();
  if (!quote) return null;
  const { data: items } = await supabase
    .from("quotation_line_items")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("sort_order", { ascending: true });
  return { ...quote, items: items ?? [] };
}
