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
  const { data: client } = await supabase.from("clients").select("commercial_flags").eq("id", params.clientId).maybeSingle();
  const flags = (client?.commercial_flags ?? {}) as Record<string, unknown>;
  const productsV2 = flags["products.v2.enabled"] !== false;

  let items: unknown[] = [];
  if (productsV2) {
    let pq = supabase
      .from("products")
      .select("*")
      .eq("client_id", params.clientId)
      .order("name", { ascending: true });
    if (!includeInactive) pq = pq.eq("status", "ACTIVE");
    const { data: products, error: pErr } = await pq;
    if (!pErr && (products?.length ?? 0) > 0) {
      items = (products ?? []).map((p) => ({
        id: p.legacy_catalog_item_id ?? p.id,
        client_id: p.client_id,
        name: p.name,
        description: p.quotation_description ?? p.description,
        unit_price: p.selling_price,
        category: null,
        currency: p.currency,
        is_active: p.status === "ACTIVE",
        display_order: 0,
        created_at: p.created_at,
        updated_at: p.updated_at,
        sku: p.sku,
        unit: p.unit,
        cost_price: p.cost_price,
        min_selling_price: p.min_selling_price,
        tax_rate: p.tax_rate,
        image_url: p.primary_image_url,
        warranty: p.warranty,
        item_kind: p.item_type === "SERVICE" ? "service" : "product",
        requires_approval: p.requires_technical_confirmation,
        product_id: p.id,
      }));
    }
  }
  if (items.length === 0) {
    let query = supabase
      .from("product_catalog")
      .select("*")
      .eq("client_id", params.clientId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (!includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    items = data ?? [];
  }

  const { data: settings } = await supabase
    .from("quotation_settings")
    .select("margin_visibility, salesperson_can_see_cost, salesperson_can_see_margin")
    .eq("client_id", params.clientId)
    .maybeSingle();
  const isManager = g.session.role === "CLIENT_MANAGER" || g.session.role === "SUPER_ADMIN";
  const canSeeCost = resolveMarginVisibility(settings ?? {}, isManager) === "full";
  const safe = canSeeCost ? items : stripCostFromUnknown(items, false);
  return NextResponse.json({ items: safe });
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
  try {
    const { createProduct } = await import("@/lib/products/service");
    await createProduct(params.clientId, session.userId, {
      name: body.name.trim(),
      description: body.description ?? null,
      quotation_description: body.description ?? null,
      selling_price: Number(body.unit_price) || 0,
      sku: body.sku ?? null,
      unit: body.unit ?? "Each",
      cost_price: body.cost_price,
      min_selling_price: body.min_selling_price,
      tax_rate: body.tax_rate,
      warranty: body.warranty,
      currency: body.currency ?? "USD",
      item_type: body.item_kind === "service" ? "SERVICE" : "PRODUCT",
      track_inventory: false,
      legacy_catalog_item_id: data.id,
    });
  } catch {
    /* adapter best-effort */
  }
  return NextResponse.json({ item: data }, { status: 201 });
}
