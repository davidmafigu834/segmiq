import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { canManageCatalog } from "@/lib/quotations/quote-access";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { resolveMarginVisibility, stripCostFromUnknown } from "@/lib/quotations/governance";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

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

  const { data: settings } = await supabase
    .from("quotation_settings")
    .select("margin_visibility, salesperson_can_see_cost, salesperson_can_see_margin")
    .eq("client_id", params.clientId)
    .maybeSingle();
  const isManager = g.session.role === "CLIENT_MANAGER" || g.session.role === "SUPER_ADMIN";
  const canSeeCost = resolveMarginVisibility(settings ?? {}, isManager) === "full";
  const items = canSeeCost ? data ?? [] : stripCostFromUnknown(data ?? [], false);
  return NextResponse.json({ items });
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
    sku?: string | null;
    unit?: string | null;
    cost_price?: number | null;
    min_selling_price?: number | null;
    tax_rate?: number | null;
    warranty?: string | null;
    currency?: string;
    item_kind?: string;
    requires_approval?: boolean;
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
      sku: body.sku ?? null,
      unit: body.unit ?? "Each",
      cost_price: body.cost_price != null ? Number(body.cost_price) : null,
      min_selling_price: body.min_selling_price != null ? Number(body.min_selling_price) : null,
      tax_rate: body.tax_rate != null ? Number(body.tax_rate) : null,
      warranty: body.warranty ?? null,
      currency: body.currency ?? "USD",
      item_kind: body.item_kind === "service" ? "service" : "product",
      requires_approval: Boolean(body.requires_approval),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
