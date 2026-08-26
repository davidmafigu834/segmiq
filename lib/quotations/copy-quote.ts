import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";
import { saveItemsAndTotals } from "@/lib/quotations/persist";
import { allocateQuoteNumber } from "@/lib/quotations/quote-number";
import type { QuotationLineItemInput, QuotationSectionDef } from "@/types";

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
    revisionNote?: string | null;
    /** When true (duplicate), always allocate a new company quote number. */
    allocateNewNumber?: boolean;
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
    .select(
      "catalog_item_id, item_name, description, unit_price, quantity, group_label, sort_order, section_id, unit, sku, discount_percent, discount_amount, tax_rate, tax_inclusive, is_optional, option_group, cost_price, image_url, catalog_unit_price, price_override, package_id, package_locked, offer_option_id, option_state, source_type, product_id, variant_id, package_expansion, warranty_snapshot"
    )
    .eq("quotation_id", opts.sourceQuotationId)
    .order("sort_order", { ascending: true });

  const validUntil = source.valid_until
    ? (source.valid_until as string)
    : format(addDays(new Date(), 30), "yyyy-MM-dd");

  const isRevision = Boolean(opts.parentQuotationId);
  const quoteNumber =
    opts.allocateNewNumber || !isRevision
      ? await allocateQuoteNumber(supabase, opts.clientId)
      : ((source.quote_number as string | null) ??
        (await allocateQuoteNumber(supabase, opts.clientId)));

  const insertPayload: Record<string, unknown> = {
    client_id: opts.clientId,
    lead_id: opts.targetLeadId,
    deal_id: source.deal_id ?? null,
    status: "draft",
    quote_number: quoteNumber,
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
  };

  insertPayload.discount_percent = source.discount_percent ?? 0;
  insertPayload.payment_terms_label = source.payment_terms_label ?? null;
  insertPayload.payment_schedule = source.payment_schedule ?? [];
  insertPayload.delivery_terms = source.delivery_terms ?? null;
  insertPayload.warranty_terms = source.warranty_terms ?? null;
  insertPayload.commercial_notes = source.commercial_notes ?? null;
  insertPayload.customer_obligations = source.customer_obligations ?? null;
  insertPayload.sections = source.sections ?? [];
  insertPayload.note_blocks = source.note_blocks ?? [];
  insertPayload.timeline_milestones = source.timeline_milestones ?? [];
  insertPayload.revision_note = opts.revisionNote ?? null;
  insertPayload.approval_status = "not_required";
  insertPayload.template_id = source.template_id ?? null;
  insertPayload.template_layout_key = source.template_layout_key ?? null;
  insertPayload.template_layout_version = source.template_layout_version ?? null;
  insertPayload.template_fields = source.template_fields ?? {};
  insertPayload.project_summary = source.project_summary ?? null;

  let created: { id: string } | null = null;
  {
    const { data, error } = await supabase.from("quotations").insert(insertPayload).select("id").single();
    if (error) {
      const { data: legacy, error: legacyErr } = await supabase
        .from("quotations")
        .insert({
          client_id: opts.clientId,
          lead_id: opts.targetLeadId,
          deal_id: source.deal_id ?? null,
          status: "draft",
          quote_number: quoteNumber,
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
      if (legacyErr || !legacy) return null;
      created = legacy as { id: string };
    } else {
      created = data as { id: string };
    }
  }

  if (!created) return null;

  const items: QuotationLineItemInput[] = (sourceItems ?? []).map((it) => ({
    catalog_item_id: it.catalog_item_id as string | null,
    item_name: it.item_name as string,
    description: (it.description as string | null) ?? null,
    unit_price: Number(it.unit_price) || 0,
    quantity: Number(it.quantity) || 1,
    group_label: (it.group_label as string | null) ?? null,
    section_id: (it.section_id as string | null) ?? null,
    unit: (it.unit as string | null) ?? "Each",
    sku: (it.sku as string | null) ?? null,
    discount_percent: Number(it.discount_percent) || 0,
    discount_amount: Number(it.discount_amount) || 0,
    tax_rate: it.tax_rate != null ? Number(it.tax_rate) : null,
    tax_inclusive: Boolean(it.tax_inclusive),
    is_optional: Boolean(it.is_optional),
    option_group: (it.option_group as string | null) ?? null,
    cost_price: it.cost_price != null ? Number(it.cost_price) : null,
    image_url: (it.image_url as string | null) ?? null,
    catalog_unit_price: it.catalog_unit_price != null ? Number(it.catalog_unit_price) : null,
    price_override: Boolean(it.price_override),
    package_id: (it.package_id as string | null) ?? null,
    package_locked: Boolean(it.package_locked),
    offer_option_id: (it.offer_option_id as string | null) ?? null,
    option_state: (it.option_state as string | null) ?? undefined,
  }));

  if (items.length > 0) {
    await saveItemsAndTotals(
      supabase,
      created.id,
      items,
      Number(source.tax_rate) || 0,
      Number(source.other_amount) || 0,
      {
        discountPercent: Number(source.discount_percent) || 0,
        sections: (source.sections as QuotationSectionDef[] | null) ?? undefined,
      }
    );
  }

  return { id: created.id };
}
