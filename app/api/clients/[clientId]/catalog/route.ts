import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { canManageCatalog } from "@/lib/quotations/quote-access";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const includeInactive = url.searchParams.get("all") === "1";

  const supabase = createAdminClient();
  let query = supabase
    .from("product_catalog")
    .select("*")
    .eq("client_id", params.clientId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json({ error: "Only managers can edit the catalog" }, { status: 403 });
  }

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
  const { data, error } = await supabase
    .from("product_catalog")
    .insert({
      client_id: params.clientId,
      name: body.name.trim(),
      description: body.description ?? null,
      unit_price: Number(body.unit_price) || 0,
      category: body.category ?? null,
      display_order: body.display_order ?? 0,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
