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
  }>;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description;
  if (body.unit_price !== undefined) updates.unit_price = Number(body.unit_price) || 0;
  if (body.category !== undefined) updates.category = body.category;
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.display_order !== undefined) updates.display_order = body.display_order;

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
