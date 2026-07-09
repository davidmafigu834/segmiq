import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotationForLead } from "@/lib/quotations/quote-access";
import { ensureQuotationSettings } from "@/lib/quotations/quote-number";
import { saveItemsAndTotals, loadQuotationWithItems } from "@/lib/quotations/persist";
import { loadTemplateWithItems, templateItemsToQuotationInputs } from "@/lib/quotations/templates";
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
  };

  const { data: lead } = await supabase
    .from("leads")
    .select("name, phone, email")
    .eq("id", params.leadId)
    .single();

  const settings = await ensureQuotationSettings(supabase, access.lead.client_id);

  let templateItems: QuotationLineItemInput[] | undefined;
  let templateTax: number | undefined;
  let templateOther: number | undefined;
  let templateNotes: string | null | undefined;
  let templateTerms: string | null | undefined;
  let templateValidDays: number | undefined;

  if (body.templateId) {
    const template = await loadTemplateWithItems(supabase, body.templateId);
    if (!template || template.client_id !== access.lead.client_id) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    templateItems = templateItemsToQuotationInputs(
      (template.items as Record<string, unknown>[]) ?? []
    );
    templateTax = Number(template.tax_rate) || 0;
    templateOther = Number(template.other_amount) || 0;
    templateNotes = (template.notes as string | null) ?? null;
    templateTerms = (template.terms as string | null) ?? null;
    templateValidDays = Number(template.valid_for_days) || 30;
  }

  const taxRate = body.tax_rate ?? templateTax ?? (Number(settings.default_tax_rate) || 0);
  const validUntil =
    body.valid_until ??
    format(addDays(new Date(), templateValidDays ?? 30), "yyyy-MM-dd");

  const { data: quote, error } = await supabase
    .from("quotations")
    .insert({
      client_id: access.lead.client_id,
      lead_id: params.leadId,
      status: "draft",
      customer_name: (lead?.name as string | null) ?? null,
      customer_phone: (lead?.phone as string | null) ?? null,
      customer_email: (lead?.email as string | null) ?? null,
      tax_rate: taxRate,
      other_amount: body.other_amount ?? templateOther ?? 0,
      valid_until: validUntil,
      notes: body.notes ?? templateNotes ?? null,
      terms: body.terms ?? templateTerms ?? (settings.default_terms as string | null) ?? null,
      prepared_by_id: access.actor.id,
      prepared_by_name: access.actor.name,
    })
    .select("*")
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: error?.message ?? "Create failed" }, { status: 500 });
  }

  const itemsToSave = body.items?.length ? body.items : templateItems;
  if (itemsToSave?.length) {
    await saveItemsAndTotals(
      supabase,
      quote.id as string,
      itemsToSave,
      taxRate,
      body.other_amount ?? templateOther ?? 0
    );
  }

  const full = await loadQuotationWithItems(supabase, quote.id as string);
  return NextResponse.json({ quotation: full }, { status: 201 });
}
