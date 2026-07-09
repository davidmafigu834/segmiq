import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { canManageCatalog } from "@/lib/quotations/quote-access";
import { loadTemplateWithItems, saveTemplateItems } from "@/lib/quotations/templates";
import type { QuotationLineItemInput } from "@/types";

export async function GET(
  _req: Request,
  { params }: { params: { clientId: string; templateId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const full = await loadTemplateWithItems(supabase, params.templateId);
  if (!full || full.client_id !== params.clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ template: full });
}

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; templateId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json({ error: "Only managers can edit quote templates" }, { status: 403 });
  }

  const body = (await req.json()) as Partial<{
    name: string;
    description: string | null;
    tax_rate: number;
    other_amount: number;
    notes: string | null;
    terms: string | null;
    valid_for_days: number;
    is_active: boolean;
    display_order: number;
    items: QuotationLineItemInput[];
  }>;

  const supabase = createAdminClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of [
    "name",
    "description",
    "notes",
    "terms",
    "is_active",
    "display_order",
  ] as const) {
    if (body[key] !== undefined) {
      updates[key] = key === "name" ? (body.name as string).trim() : body[key];
    }
  }
  if (body.tax_rate !== undefined) updates.tax_rate = Number(body.tax_rate) || 0;
  if (body.other_amount !== undefined) updates.other_amount = Number(body.other_amount) || 0;
  if (body.valid_for_days !== undefined) updates.valid_for_days = body.valid_for_days;

  if (Object.keys(updates).length > 1) {
    const { error } = await supabase
      .from("quote_templates")
      .update(updates)
      .eq("id", params.templateId)
      .eq("client_id", params.clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.items !== undefined) {
    const { data: row } = await supabase
      .from("quote_templates")
      .select("tax_rate, other_amount")
      .eq("id", params.templateId)
      .maybeSingle();
    await saveTemplateItems(
      supabase,
      params.templateId,
      body.items,
      body.tax_rate ?? (Number(row?.tax_rate) || 0),
      body.other_amount ?? (Number(row?.other_amount) || 0)
    );
  }

  const full = await loadTemplateWithItems(supabase, params.templateId);
  return NextResponse.json({ template: full });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string; templateId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json({ error: "Only managers can edit quote templates" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("quote_templates")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", params.templateId)
    .eq("client_id", params.clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
