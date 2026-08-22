import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuotationLineItemInput } from "@/types";
import { computeTotals, lineAmount } from "@/lib/quotations/totals";

export async function saveTemplateItems(
  supabase: SupabaseClient,
  templateId: string,
  items: QuotationLineItemInput[],
  taxRate: number,
  otherAmount: number
): Promise<void> {
  const clean = items
    .filter((it) => (it.item_name ?? "").trim().length > 0)
    .map((it, idx) => ({
      template_id: templateId,
      catalog_item_id: it.catalog_item_id ?? null,
      item_name: it.item_name.trim(),
      description: it.description?.trim() || null,
      unit_price: Number(it.unit_price) || 0,
      quantity: Number(it.quantity) || 0,
      group_label: it.group_label?.trim() || null,
      unit: it.unit?.trim() || "Each",
      sku: it.sku?.trim() || null,
      is_optional: Boolean(it.is_optional),
      sort_order: idx,
    }));

  await supabase.from("quote_template_line_items").delete().eq("template_id", templateId);
  if (clean.length > 0) {
    await supabase.from("quote_template_line_items").insert(clean);
  }

  await supabase
    .from("quote_templates")
    .update({
      tax_rate: Number(taxRate) || 0,
      other_amount: Number(otherAmount) || 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);
}

export async function loadTemplateWithItems(
  supabase: SupabaseClient,
  templateId: string
): Promise<Record<string, unknown> | null> {
  const { data: template } = await supabase
    .from("quote_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();
  if (!template) return null;
  const { data: items } = await supabase
    .from("quote_template_line_items")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });
  return { ...template, items: items ?? [] };
}

export function templateItemsToQuotationInputs(
  items: Record<string, unknown>[]
): QuotationLineItemInput[] {
  return items.map((it) => ({
    catalog_item_id: (it.catalog_item_id as string | null) ?? null,
    item_name: it.item_name as string,
    description: (it.description as string | null) ?? null,
    unit_price: Number(it.unit_price) || 0,
    quantity: Number(it.quantity) || 1,
    group_label: (it.group_label as string | null) ?? null,
    section_id: (it.section_id as string | null) ?? null,
    unit: (it.unit as string | null) ?? "Each",
    sku: (it.sku as string | null) ?? null,
    discount_percent: Number(it.discount_percent) || 0,
    is_optional: Boolean(it.is_optional),
    package_id: (it.package_id as string | null) ?? null,
    offer_option_id: (it.offer_option_id as string | null) ?? null,
  }));
}

export function templateSubtotal(items: Record<string, unknown>[]): number {
  return computeTotals(
    templateItemsToQuotationInputs(items).map((it) => ({
      ...it,
      amount: lineAmount(it.unit_price, it.quantity),
    })),
    0,
    0
  ).subtotal;
}
