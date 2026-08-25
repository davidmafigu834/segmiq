import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { proposalDealValueUpdate } from "@/lib/deal-value";
import { saveItemsAndTotals, loadQuotationWithItems } from "@/lib/quotations/persist";
import { logQuotationEvent } from "@/lib/quotations/events";
import { isQuotationEditable } from "@/lib/quotations/lifecycle";
import type {
  QuotationLineItemInput,
  QuotationNoteBlock,
  QuotationPaymentScheduleRow,
  QuotationSectionDef,
  QuotationStatus,
  QuotationTimelineMilestone,
} from "@/types";

export async function GET(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const full = await loadQuotationWithItems(supabase, params.quotationId);
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ quotation: full });
}

export async function PATCH(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const body = (await req.json()) as Partial<{
    customer_name: string | null;
    customer_phone: string | null;
    customer_email: string | null;
    valid_until: string | null;
    notes: string | null;
    terms: string | null;
    tax_rate: number;
    other_amount: number;
    discount_percent: number;
    currency: string;
    payment_terms_label: string | null;
    payment_schedule: QuotationPaymentScheduleRow[];
    delivery_terms: string | null;
    warranty_terms: string | null;
    commercial_notes: string | null;
    customer_obligations: string | null;
    sections: QuotationSectionDef[];
    note_blocks: QuotationNoteBlock[];
    timeline_milestones: QuotationTimelineMilestone[];
    items: QuotationLineItemInput[];
    status: QuotationStatus;
    declined_reason: string | null;
    deal_id: string | null;
    silent: boolean;
    expected_updated_at?: string;
    offer_options?: Array<{ id: string; label: string; description?: string | null }>;
    template_fields?: Record<string, unknown>;
    project_summary?: string | null;
    template_layout_key?: string | null;
  }>;

  const { data: current } = await supabase
    .from("quotations")
    .select(
      "tax_rate, other_amount, discount_percent, total, status, sections, deal_id, approval_status, commercial_fingerprint, payment_terms_label, valid_until, currency, updated_at"
    )
    .eq("id", params.quotationId)
    .single();

  if (body.expected_updated_at && current?.updated_at && body.expected_updated_at !== current.updated_at) {
    return NextResponse.json(
      { error: "This quotation was updated by someone else. Reload and try again." },
      { status: 409 }
    );
  }

  const isDraft = isQuotationEditable(String(current?.status ?? ""));
  const hasContentChanges =
    body.customer_name !== undefined ||
    body.customer_phone !== undefined ||
    body.customer_email !== undefined ||
    body.valid_until !== undefined ||
    body.notes !== undefined ||
    body.terms !== undefined ||
    body.tax_rate !== undefined ||
    body.other_amount !== undefined ||
    body.discount_percent !== undefined ||
    body.currency !== undefined ||
    body.payment_terms_label !== undefined ||
    body.payment_schedule !== undefined ||
    body.delivery_terms !== undefined ||
    body.warranty_terms !== undefined ||
    body.commercial_notes !== undefined ||
    body.customer_obligations !== undefined ||
    body.sections !== undefined ||
    body.note_blocks !== undefined ||
    body.timeline_milestones !== undefined ||
    body.offer_options !== undefined ||
    body.items !== undefined ||
    body.deal_id !== undefined ||
    body.template_fields !== undefined ||
    body.project_summary !== undefined;

  if (!isDraft && hasContentChanges) {
    return NextResponse.json(
      { error: "Sent quotations are locked. Create a revision to make changes." },
      { status: 409 }
    );
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of [
    "customer_name",
    "customer_phone",
    "customer_email",
    "valid_until",
    "notes",
    "terms",
    "payment_terms_label",
    "delivery_terms",
    "warranty_terms",
    "commercial_notes",
    "customer_obligations",
    "declined_reason",
    "deal_id",
  ] as const) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.currency !== undefined) updates.currency = body.currency;
  if (body.discount_percent !== undefined) updates.discount_percent = Number(body.discount_percent) || 0;
  if (body.payment_schedule !== undefined) updates.payment_schedule = body.payment_schedule;
  if (body.sections !== undefined) updates.sections = body.sections;
  if (body.note_blocks !== undefined) updates.note_blocks = body.note_blocks;
  if (body.timeline_milestones !== undefined) updates.timeline_milestones = body.timeline_milestones;
  if (body.offer_options !== undefined) updates.offer_options = body.offer_options;
  if (body.template_fields !== undefined) updates.template_fields = body.template_fields;
  if (body.project_summary !== undefined) updates.project_summary = body.project_summary;
  if (body.template_layout_key !== undefined) updates.template_layout_key = body.template_layout_key;

  if (body.status !== undefined) {
    updates.status = body.status;
    if (body.status === "accepted") {
      updates.accepted_at = new Date().toISOString();
      const total = Number(current?.total) || 0;
      const proposalValue = proposalDealValueUpdate(total);
      if (proposalValue) {
        await supabase.from("leads").update(proposalValue).eq("id", access.leadId);
      }
      await logQuotationEvent(supabase, {
        quotationId: params.quotationId,
        clientId: access.clientId,
        leadId: access.leadId,
        dealId: (current?.deal_id as string) || null,
        actor: { id: access.actor.id, name: access.actor.name },
        eventType: "ACCEPTED",
      });
      const { hookQuotationTerminal, DOMAIN_EVENT_TYPES } = await import("@/lib/agent/proactive");
      void hookQuotationTerminal({
        clientId: access.clientId,
        quotationId: params.quotationId,
        type: DOMAIN_EVENT_TYPES.QUOTATION_ACCEPTED,
        leadId: access.leadId,
        actorType: "HUMAN",
        actorId: access.actor.id,
      });
    }
    if (body.status === "rejected") {
      await logQuotationEvent(supabase, {
        quotationId: params.quotationId,
        clientId: access.clientId,
        leadId: access.leadId,
        dealId: (current?.deal_id as string) || null,
        actor: { id: access.actor.id, name: access.actor.name },
        eventType: "DECLINED",
        eventData: { reason: body.declined_reason ?? null },
      });
      const { hookQuotationTerminal, DOMAIN_EVENT_TYPES } = await import("@/lib/agent/proactive");
      void hookQuotationTerminal({
        clientId: access.clientId,
        quotationId: params.quotationId,
        type: DOMAIN_EVENT_TYPES.QUOTATION_DECLINED,
        leadId: access.leadId,
        actorType: "HUMAN",
        actorId: access.actor.id,
      });
    }
  }

  if (Object.keys(updates).length > 1) {
    const { error } = await supabase.from("quotations").update(updates).eq("id", params.quotationId);
    if (error && (updates.template_fields !== undefined || updates.project_summary !== undefined || updates.template_layout_key !== undefined)) {
      delete updates.template_fields;
      delete updates.project_summary;
      delete updates.template_layout_key;
      await supabase.from("quotations").update(updates).eq("id", params.quotationId);
    }
  }

  const taxRate = body.tax_rate ?? (Number(current?.tax_rate) || 0);
  const other = body.other_amount ?? (Number(current?.other_amount) || 0);
  const discountPercent =
    body.discount_percent ?? (Number(current?.discount_percent) || 0);
  const sections =
    body.sections ?? ((current?.sections as QuotationSectionDef[] | null) ?? undefined);

  if (body.items !== undefined) {
    await saveItemsAndTotals(supabase, params.quotationId, body.items, taxRate, other, {
      discountPercent,
      sections,
    });
  } else if (
    body.tax_rate !== undefined ||
    body.other_amount !== undefined ||
    body.discount_percent !== undefined
  ) {
    const { data: items } = await supabase
      .from("quotation_line_items")
      .select(
        "unit_price, quantity, item_name, description, group_label, catalog_item_id, section_id, unit, sku, discount_percent, discount_amount, tax_rate, tax_inclusive, is_optional, option_group, cost_price, image_url"
      )
      .eq("quotation_id", params.quotationId)
      .order("sort_order", { ascending: true });
    await saveItemsAndTotals(
      supabase,
      params.quotationId,
      (items ?? []) as QuotationLineItemInput[],
      taxRate,
      other,
      { discountPercent, sections }
    );
  }

  const full = await loadQuotationWithItems(supabase, params.quotationId);
  if (full && hasContentChanges) {
    const { invalidateApprovalIfStale } = await import("@/lib/quotations/approval-state");
    await invalidateApprovalIfStale(supabase, {
      quotationId: params.quotationId,
      clientId: access.clientId,
      leadId: access.leadId,
      dealId: (full.deal_id as string) || null,
      actor: { id: access.actor.id, name: access.actor.name },
      currentFingerprint: (current?.commercial_fingerprint as string | null) ?? null,
      approvalStatus: (current?.approval_status as string | null) ?? null,
      items: (full.items as QuotationLineItemInput[]) ?? [],
      discountPercent: Number(full.discount_percent) || 0,
      otherAmount: Number(full.other_amount) || 0,
      taxRate: Number(full.tax_rate) || 0,
      paymentTermsLabel: (full.payment_terms_label as string | null) ?? null,
      validUntil: (full.valid_until as string | null) ?? null,
      currency: (full.currency as string | null) ?? null,
    });
  }
  return NextResponse.json({ quotation: full });
}

export async function DELETE(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotations")
    .select("status")
    .eq("id", params.quotationId)
    .single();
  if (quote && quote.status !== "draft") {
    return NextResponse.json({ error: "Only draft quotations can be deleted" }, { status: 400 });
  }

  const { error } = await supabase.from("quotations").delete().eq("id", params.quotationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
