import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireClientAccessFromRequest } from "@/lib/api-guards";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("salesperson_saved_items")
    .select("*")
    .eq("client_id", params.clientId)
    .eq("user_id", g.session.userId)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const body = (await req.json()) as {
    name: string;
    description?: string | null;
    unit_price?: number;
    category?: string | null;
    display_order?: number;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const name = body.name.trim();
  const now = new Date().toISOString();
  const row = {
    name,
    description: body.description?.trim() || null,
    unit_price: Number(body.unit_price) || 0,
    category: body.category?.trim() || null,
    display_order: body.display_order ?? 0,
    updated_at: now,
  };

  const { data: existing } = await supabase
    .from("salesperson_saved_items")
    .select("id")
    .eq("client_id", params.clientId)
    .eq("user_id", g.session.userId)
    .ilike("name", name)
    .eq("is_active", true)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("salesperson_saved_items")
      .update(row)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data, updated: true });
  }

  const { data, error } = await supabase
    .from("salesperson_saved_items")
    .insert({
      client_id: params.clientId,
      user_id: g.session.userId,
      ...row,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data, updated: false }, { status: 201 });
}
