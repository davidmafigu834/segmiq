import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotationForLead } from "@/lib/quotations/quote-access";
import { allocateQuoteNumber, ensureQuotationSettings } from "@/lib/quotations/quote-number";
import { saveItemsAndTotals, loadQuotationWithItems } from "@/lib/quotations/persist";
import { loadTemplateWithItems, templateItemsToQuotationInputs } from "@/lib/quotations/templates";
import { logQuotationEvent } from "@/lib/quotations/events";
import {
  ensureBuiltinQuoteTemplates,
  parseVirtualBuiltinId,
} from "@/lib/quotations/layouts/ensure-builtin";
import { getBuiltinTemplate } from "@/lib/quotations/layouts/registry";
import type { QuotationLineItemInput } from "@/types";
import { addDays, format } from "date-fns";

export async function GET(req: Request, { params }: { params: { leadId: string } }) {
  const access = await canManageQuotationForLead(params.leadId, req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("*")
    .eq("lead_id", params.leadId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quotations: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const access = await canManageQuotationForLead(params.leadId, req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const body = (await req.json().catch(() => ({}))) as {
    items?: QuotationLineItemInput[];
    tax_rate?: number;
    other_amount?: number;
    valid_until?: string | null;
    notes?: string | null;
    terms?: string | null;
    templateId?: string;
    dealId?: string | null;
  };

  const { data: lead } = await supabase
    .from("leads")
    .select("name, phone, email, active_deal_id")
    .eq("id", params.leadId)
    .single();

  const settings = await ensureQuotationSettings(supabase, access.lead.client_id);

  let templateItems: QuotationLineItemInput[] | undefined;
  let templateTax: number | undefined;
  let templateOther: number | undefined;
  let templateNotes: string | null | undefined;
  let templateTerms: string | null | undefined;
  let templateValidDays: number | undefined;
  let templatePayment: string | null | undefined;
  let templateWarranty: string | null | undefined;
  let resolvedTemplateId: string | null = null;
  let templateLayoutKey: string | null = null;
  let templateLayoutVersion: number | null = null;

  if (body.templateId) {
    const virtualKey = parseVirtualBuiltinId(body.templateId);
    let templateId = body.templateId;
    if (virtualKey) {
      await ensureBuiltinQuoteTemplates(supabase, access.lead.client_id).catch(() => null);
      const { data: builtinRow } = await supabase
        .from("quote_templates")
        .select("id")
        .eq("client_id", access.lead.client_id)
        .eq("builtin_key", virtualKey)
        .maybeSingle();
      templateId = (builtinRow?.id as string | undefined) ?? "";
      templateLayoutKey = virtualKey;
      templateLayoutVersion = getBuiltinTemplate(virtualKey)?.layoutVersion ?? 1;
    }
    if (templateId) {
      const template = await loadTemplateWithItems(supabase, templateId);
      if (!template || template.client_id !== access.lead.client_id) {
        if (!virtualKey) {
          return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }
      } else {
        resolvedTemplateId = template.id as string;
        templateLayoutKey =
          (template.layout_key as string | null) ||
          (template.builtin_key as string | null) ||
          templateLayoutKey;
        templateLayoutVersion =
          Number(template.layout_version) ||
          getBuiltinTemplate(templateLayoutKey)?.layoutVersion ||
          1;
        templateItems = templateItemsToQuotationInputs(
          (template.items as Record<string, unknown>[]) ?? []
        );
        templateTax = Number(template.tax_rate) || 0;
        templateOther = Number(template.other_amount) || 0;
        templateNotes = (template.notes as string | null) ?? null;
        templateTerms = (template.terms as string | null) ?? null;
        templateValidDays = Number(template.valid_for_days) || 30;
        templatePayment = (template.payment_terms_label as string | null) ?? null;
        templateWarranty = (template.warranty_terms as string | null) ?? null;
      }
    }
  }

  const taxRate = body.tax_rate ?? templateTax ?? (Number(settings.default_tax_rate) || 0);
  const validDays =
    templateValidDays ??
    (settings.default_validity_days != null ? Number(settings.default_validity_days) : 14);
  const validUntil =
    body.valid_until ?? format(addDays(new Date(), validDays > 0 ? validDays : 14), "yyyy-MM-dd");

  const dealId =
    (typeof body.dealId === "string" && body.dealId.trim()) ||
    (lead?.active_deal_id as string | null) ||
    null;

  if (!dealId) {
    return NextResponse.json(
      { error: "Select a Deal before creating a quotation" },
      { status: 400 }
    );
  }

  // Verify Deal belongs to this lead/client and resolve owner
  const { data: deal } = await supabase
    .from("deals")
    .select("id, client_id, originating_lead_id, owner_id, name")
    .eq("id", dealId)
    .maybeSingle();

  if (!deal || deal.client_id !== access.lead.client_id) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }
  if (deal.originating_lead_id !== params.leadId) {
    return NextResponse.json(
      { error: "Deal does not belong to this customer/lead" },
      { status: 400 }
    );
  }

  let preparedById = access.actor.id;
  let preparedByName = access.actor.name;
  if (deal.owner_id) {
    const { data: owner } = await supabase
      .from("users")
      .select("id, name")
      .eq("id", deal.owner_id)
      .maybeSingle();
    if (owner) {
      preparedById = owner.id as string;
      preparedByName = ((owner.name as string) || "").trim() || preparedByName;
    }
  }
  if (!preparedByName || preparedByName === "Unknown") {
    const { data: actorUser } = await supabase
      .from("users")
      .select("name")
      .eq("id", access.actor.id)
      .maybeSingle();
    preparedByName = ((actorUser?.name as string) || "").trim() || "Unassigned";
  }

  // Assign immutable company-scoped identity at creation (not on send).
  const quoteNumber = await allocateQuoteNumber(supabase, access.lead.client_id);

  const paymentTerms =
    (settings.default_payment_terms as string | null)?.trim() || null;

  const { data: quote, error } = await supabase
    .from("quotations")
    .insert({
      client_id: access.lead.client_id,
      lead_id: params.leadId,
      deal_id: dealId,
      quote_number: quoteNumber,
      status: "draft",
      customer_name: (lead?.name as string | null) ?? null,
      customer_phone: (lead?.phone as string | null) ?? null,
      customer_email: (lead?.email as string | null) ?? null,
      tax_rate: taxRate,
      other_amount: body.other_amount ?? templateOther ?? 0,
      currency: (settings.default_currency as string) || "USD",
      valid_until: validUntil,
      notes: body.notes ?? templateNotes ?? null,
      terms: body.terms ?? templateTerms ?? (settings.default_terms as string | null) ?? null,
      payment_terms_label: templatePayment || paymentTerms,
      warranty_terms: templateWarranty ?? null,
      prepared_by_id: preparedById,
      prepared_by_name: preparedByName,
      revision_number: 1,
      template_id: resolvedTemplateId,
      template_layout_key: templateLayoutKey,
      template_layout_version: templateLayoutVersion,
      template_fields: {},
    })
    .select("*")
    .single();

  let created = quote;
  if (error || !created) {
    // Fallback without enterprise columns (pre-migration environments)
    const { data: legacy, error: legacyErr } = await supabase
      .from("quotations")
      .insert({
        client_id: access.lead.client_id,
        lead_id: params.leadId,
        deal_id: dealId,
        quote_number: quoteNumber,
        status: "draft",
        customer_name: (lead?.name as string | null) ?? null,
        customer_phone: (lead?.phone as string | null) ?? null,
        customer_email: (lead?.email as string | null) ?? null,
        tax_rate: taxRate,
        other_amount: body.other_amount ?? templateOther ?? 0,
        currency: (settings.default_currency as string) || "USD",
        valid_until: validUntil,
        notes: body.notes ?? templateNotes ?? null,
        terms: body.terms ?? templateTerms ?? (settings.default_terms as string | null) ?? null,
        prepared_by_id: preparedById,
        prepared_by_name: preparedByName,
        revision_number: 1,
      })
      .select("*")
      .single();
    if (legacyErr || !legacy) {
      return NextResponse.json(
        { error: error?.message ?? legacyErr?.message ?? "Create failed" },
        { status: 500 }
      );
    }
    created = legacy;
  }

  const itemsToSave = body.items?.length ? body.items : templateItems;
  if (itemsToSave?.length) {
    await saveItemsAndTotals(
      supabase,
      created.id as string,
      itemsToSave,
      taxRate,
      body.other_amount ?? templateOther ?? 0
    );
  }

  await logQuotationEvent(supabase, {
    quotationId: created.id as string,
    clientId: access.lead.client_id,
    leadId: params.leadId,
    dealId,
    actor: { id: access.actor.id, name: preparedByName },
    eventType: "CREATED",
    eventData: { quote_number: quoteNumber, deal_id: dealId },
  });

  const full = await loadQuotationWithItems(supabase, created.id as string);
  return NextResponse.json({ quotation: full }, { status: 201 });
}
