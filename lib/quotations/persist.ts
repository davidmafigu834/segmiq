import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuotationLineItemInput, QuotationSectionDef } from "@/types";
import { computeLine, computeQuotationTotals } from "@/lib/quotations/totals";
import { normalizeUnit } from "@/lib/quotations/units";

function newSectionId(): string {
  return `sec_${Math.random().toString(36).slice(2, 10)}`;
}

/** Ensure sections exist; migrate legacy group_label rows into sections. */
export function ensureSections(
  sections: QuotationSectionDef[] | null | undefined,
  items: { group_label?: string | null; section_id?: string | null }[]
): QuotationSectionDef[] {
  if (sections && sections.length > 0) {
    return [...sections].sort((a, b) => a.sort_order - b.sort_order);
  }

  const labels: string[] = [];
  for (const it of items) {
    const label = (it.group_label ?? "").trim() || "Items";
    if (!labels.includes(label)) labels.push(label);
  }
  if (labels.length === 0) labels.push("Items");

  return labels.map((title, idx) => ({
    id: newSectionId(),
    title,
    sort_order: idx,
  }));
}

export function mapItemsToSections(
  items: QuotationLineItemInput[],
  sections: QuotationSectionDef[]
): QuotationLineItemInput[] {
  const byTitle = new Map(sections.map((s) => [s.title.toLowerCase(), s.id]));
  const defaultId = sections[0]?.id ?? null;
  return items.map((it) => {
    if (it.section_id && sections.some((s) => s.id === it.section_id)) return it;
    const fromGroup = (it.group_label ?? "").trim();
    const sid = fromGroup ? byTitle.get(fromGroup.toLowerCase()) : defaultId;
    return { ...it, section_id: sid ?? defaultId };
  });
}

/**
 * Replace a quotation's line items and recompute + persist its totals.
 * Returns the computed totals.
 */
export async function saveItemsAndTotals(
  supabase: SupabaseClient,
  quotationId: string,
  items: QuotationLineItemInput[],
  taxRate: number,
  otherAmount: number,
  opts?: { discountPercent?: number; sections?: QuotationSectionDef[] }
): Promise<{ subtotal: number; taxAmount: number; total: number }> {
  const discountPercent = Number(opts?.discountPercent) || 0;
  const sections = ensureSections(opts?.sections, items);
  const mapped = mapItemsToSections(items, sections);

  const clean = mapped
    .filter((it) => (it.item_name ?? "").trim().length > 0)
    .map((it, idx) => {
      const line = computeLine(it, taxRate);
      return {
        quotation_id: quotationId,
        catalog_item_id: it.catalog_item_id ?? null,
        item_name: it.item_name.trim(),
        description: it.description?.trim() || null,
        unit_price: Number(it.unit_price) || 0,
        quantity: Number(it.quantity) || 0,
        amount: line.total,
        group_label:
          sections.find((s) => s.id === it.section_id)?.title ??
          (it.group_label?.trim() || null),
        section_id: it.section_id ?? sections[0]?.id ?? null,
        unit: normalizeUnit(it.unit),
        sku: it.sku?.trim() || null,
        discount_percent: Number(it.discount_percent) || 0,
        discount_amount: Number(it.discount_amount) || 0,
        tax_rate: it.tax_rate != null ? Number(it.tax_rate) : null,
        tax_inclusive: Boolean(it.tax_inclusive),
        is_optional: Boolean(it.is_optional),
        option_group: it.option_group?.trim() || null,
        cost_price: it.cost_price != null ? Number(it.cost_price) : null,
        image_url: it.image_url?.trim() || null,
        sort_order: idx,
      };
    });

  await supabase.from("quotation_line_items").delete().eq("quotation_id", quotationId);
  if (clean.length > 0) {
    const { error } = await supabase.from("quotation_line_items").insert(clean);
    if (error) {
      // Fallback without new columns if migration not applied yet
      const legacy = clean.map((row) => ({
        quotation_id: row.quotation_id,
        catalog_item_id: row.catalog_item_id,
        item_name: row.item_name,
        description: row.description,
        unit_price: row.unit_price,
        quantity: row.quantity,
        amount: row.amount,
        group_label: row.group_label,
        sort_order: row.sort_order,
      }));
      await supabase.from("quotation_line_items").insert(legacy);
    }
  }

  const totals = computeQuotationTotals(clean, {
    fallbackTaxRate: taxRate,
    otherAmount,
    discountPercent,
  });

  await supabase
    .from("quotations")
    .update({
      subtotal: totals.subtotal,
      tax_rate: Number(taxRate) || 0,
      tax_amount: totals.taxAmount,
      other_amount: Number(otherAmount) || 0,
      discount_percent: discountPercent,
      total: totals.total,
      sections,
      updated_at: new Date().toISOString(),
    })
    .eq("id", quotationId);

  return {
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    total: totals.total,
  };
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

  const sections = ensureSections(
    (quote.sections as QuotationSectionDef[] | null) ?? [],
    (items ?? []) as { group_label?: string | null; section_id?: string | null }[]
  );

  return { ...quote, sections, items: items ?? [] };
}
