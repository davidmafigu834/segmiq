import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireClientAccessFromRequest } from "@/lib/api-guards";

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; itemId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

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
    .from("salesperson_saved_items")
    .update(updates)
    .eq("id", params.itemId)
    .eq("client_id", params.clientId)
    .eq("user_id", g.session.userId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string; itemId: string } }
) {
  const g = await requireClientAccessFromRequest(_req, params.clientId);
  if ("error" in g) return g.error;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("salesperson_saved_items")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", params.itemId)
    .eq("client_id", params.clientId)
    .eq("user_id", g.session.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
