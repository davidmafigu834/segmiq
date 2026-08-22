import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { canManageCatalog } from "@/lib/quotations/quote-access";

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; itemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json({ error: "Only managers can edit the catalog" }, { status: 403 });
  }

  const body = (await req.json()) as Partial<{
    name: string;
    description: string | null;
    unit_price: number;
    category: string | null;
    is_active: boolean;
    display_order: number;
    sku: string | null;
    unit: string | null;
    cost_price: number | null;
    min_selling_price: number | null;
    tax_rate: number | null;
    warranty: string | null;
    currency: string;
    item_kind: string;
    requires_approval: boolean;
  }>;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description;
  if (body.unit_price !== undefined) updates.unit_price = Number(body.unit_price) || 0;
  if (body.category !== undefined) updates.category = body.category;
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.display_order !== undefined) updates.display_order = body.display_order;
  if (body.sku !== undefined) updates.sku = body.sku;
  if (body.unit !== undefined) updates.unit = body.unit;
  if (body.cost_price !== undefined) updates.cost_price = body.cost_price == null ? null : Number(body.cost_price);
  if (body.min_selling_price !== undefined) {
    updates.min_selling_price = body.min_selling_price == null ? null : Number(body.min_selling_price);
  }
  if (body.tax_rate !== undefined) updates.tax_rate = body.tax_rate == null ? null : Number(body.tax_rate);
  if (body.warranty !== undefined) updates.warranty = body.warranty;
  if (body.currency !== undefined) updates.currency = body.currency;
  if (body.item_kind !== undefined) updates.item_kind = body.item_kind === "service" ? "service" : "product";
  if (body.requires_approval !== undefined) updates.requires_approval = Boolean(body.requires_approval);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("product_catalog")
    .update(updates)
    .eq("id", params.itemId)
    .eq("client_id", params.clientId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string; itemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json({ error: "Only managers can edit the catalog" }, { status: 403 });
  }

  // Soft delete so existing quote line items keep their reference.
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("product_catalog")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", params.itemId)
    .eq("client_id", params.clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
