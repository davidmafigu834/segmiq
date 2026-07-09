import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";
import { saveItemsAndTotals } from "@/lib/quotations/persist";
import type { QuotationLineItemInput } from "@/types";

type Actor = { id: string; name: string };

export function baseQuoteNumber(quoteNumber: string | null): string | null {
  if (!quoteNumber) return null;
  return quoteNumber.replace(/-R\d+$/, "") || quoteNumber;
}

export function revisionQuoteNumber(base: string, revisionNumber: number): string {
  return `${base}-R${revisionNumber}`;
}

/** Copy a quotation (and its line items) as a new draft on the given lead. */
export async function copyQuotationAsDraft(
  supabase: SupabaseClient,
  opts: {
    sourceQuotationId: string;
    targetLeadId: string;
    clientId: string;
    actor: Actor;
    parentQuotationId?: string | null;
    revisionNumber?: number;
  }
): Promise<{ id: string } | null> {
  const { data: source } = await supabase
    .from("quotations")
    .select("*")
    .eq("id", opts.sourceQuotationId)
    .maybeSingle();
  if (!source) return null;

  const { data: sourceItems } = await supabase
    .from("quotation_line_items")
    .select("catalog_item_id, item_name, description, unit_price, quantity, group_label, sort_order")
    .eq("quotation_id", opts.sourceQuotationId)
    .order("sort_order", { ascending: true });

  const validUntil = source.valid_until
    ? (source.valid_until as string)
    : format(addDays(new Date(), 30), "yyyy-MM-dd");

  const { data: created, error } = await supabase
    .from("quotations")
    .insert({
      client_id: opts.clientId,
      lead_id: opts.targetLeadId,
      status: "draft",
      customer_name: source.customer_name,
      customer_phone: source.customer_phone,
      customer_email: source.customer_email,
      tax_rate: source.tax_rate,
      other_amount: source.other_amount,
      currency: source.currency,
      valid_until: validUntil,
      notes: source.notes,
      terms: source.terms,
      prepared_by_id: opts.actor.id,
      prepared_by_name: opts.actor.name,
      parent_quotation_id: opts.parentQuotationId ?? null,
      revision_number: opts.revisionNumber ?? 1,
    })
    .select("id")
    .single();

  if (error || !created) return null;

  const items: QuotationLineItemInput[] = (sourceItems ?? []).map((it) => ({
    catalog_item_id: it.catalog_item_id as string | null,
    item_name: it.item_name as string,
    description: (it.description as string | null) ?? null,
    unit_price: Number(it.unit_price) || 0,
    quantity: Number(it.quantity) || 1,
    group_label: (it.group_label as string | null) ?? null,
  }));

  if (items.length > 0) {
    await saveItemsAndTotals(
      supabase,
      created.id as string,
      items,
      Number(source.tax_rate) || 0,
      Number(source.other_amount) || 0
    );
  }

  return { id: created.id as string };
}
