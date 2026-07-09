import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { saveItemsAndTotals, loadQuotationWithItems } from "@/lib/quotations/persist";
import type { QuotationLineItemInput, QuotationStatus } from "@/types";

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
    items: QuotationLineItemInput[];
    status: QuotationStatus;
  }>;

  const { data: current } = await supabase
    .from("quotations")
    .select("tax_rate, other_amount, total, status")
    .eq("id", params.quotationId)
    .single();

  const isDraft = (current?.status as string | undefined) === "draft";
  const hasContentChanges =
    body.customer_name !== undefined ||
    body.customer_phone !== undefined ||
    body.customer_email !== undefined ||
    body.valid_until !== undefined ||
    body.notes !== undefined ||
    body.terms !== undefined ||
    body.tax_rate !== undefined ||
    body.other_amount !== undefined ||
    body.items !== undefined;

  if (!isDraft && hasContentChanges) {
    return NextResponse.json(
      { error: "Sent quotations are locked. Create a revision to make changes." },
      { status: 409 }
    );
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["customer_name", "customer_phone", "customer_email", "valid_until", "notes", "terms"] as const) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (body.status !== undefined) {
    updates.status = body.status;
    if (body.status === "accepted") {
      updates.accepted_at = new Date().toISOString();
      // Carry the accepted total onto the lead so a future win is pre-filled.
      const total = Number(current?.total) || 0;
      if (total > 0) {
        await supabase.from("leads").update({ deal_value: total }).eq("id", access.leadId);
      }
    }
  }

  if (Object.keys(updates).length > 1) {
    await supabase.from("quotations").update(updates).eq("id", params.quotationId);
  }

  if (body.items !== undefined) {
    const taxRate = body.tax_rate ?? (Number(current?.tax_rate) || 0);
    const other = body.other_amount ?? (Number(current?.other_amount) || 0);
    await saveItemsAndTotals(supabase, params.quotationId, body.items, taxRate, other);
  } else if (body.tax_rate !== undefined || body.other_amount !== undefined) {
    // Totals depend on tax/other even without item changes — reload items and recompute.
    const { data: items } = await supabase
      .from("quotation_line_items")
      .select("unit_price, quantity, item_name, description, group_label, catalog_item_id")
      .eq("quotation_id", params.quotationId)
      .order("sort_order", { ascending: true });
    const taxRate = body.tax_rate ?? (Number(current?.tax_rate) || 0);
    const other = body.other_amount ?? (Number(current?.other_amount) || 0);
    await saveItemsAndTotals(
      supabase,
      params.quotationId,
      (items ?? []) as QuotationLineItemInput[],
      taxRate,
      other
    );
  }

  const full = await loadQuotationWithItems(supabase, params.quotationId);
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
