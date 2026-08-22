import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { canManageCatalog } from "@/lib/quotations/quote-access";
import { stripCostFromUnknown, resolveMarginVisibility } from "@/lib/quotations/governance";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isManager = session.role === "CLIENT_MANAGER" || session.role === "SUPER_ADMIN";
  const all = new URL(req.url).searchParams.get("all") === "1" && isManager;
  const supabase = createAdminClient();
  let query = supabase
    .from("quotation_packages")
    .select("*")
    .eq("client_id", params.clientId)
    .order("display_order", { ascending: true });
  if (!all) query = query.eq("is_active", true);
  const { data: packages, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (packages ?? []).map((p) => p.id as string);
  const { data: components } = ids.length
    ? await supabase.from("quotation_package_components").select("*").in("package_id", ids).order("sort_order")
    : { data: [] };

  const { data: settings } = await supabase
    .from("quotation_settings")
    .select("margin_visibility, salesperson_can_see_cost, salesperson_can_see_margin")
    .eq("client_id", params.clientId)
    .maybeSingle();
  const canSeeCost = resolveMarginVisibility(settings ?? {}, isManager) === "full";

  const byPkg = new Map<string, unknown[]>();
  for (const c of components ?? []) {
    const pid = c.package_id as string;
    if (!byPkg.has(pid)) byPkg.set(pid, []);
    byPkg.get(pid)!.push(canSeeCost ? c : stripCostFromUnknown(c, false));
  }

  return NextResponse.json({
    packages: (packages ?? []).map((p) => ({
      ...p,
      components: byPkg.get(p.id as string) ?? [],
    })),
  });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageCatalog(session.role)) {
    const { data: settings } = await createAdminClient()
      .from("quotation_settings")
      .select("salesperson_can_create_package")
      .eq("client_id", params.clientId)
      .maybeSingle();
    if (!settings?.salesperson_can_create_package) {
      return NextResponse.json({ error: "Only managers can create packages" }, { status: 403 });
    }
  }

  const body = (await req.json()) as {
    name: string;
    description?: string | null;
    pricing_model?: string;
    flexibility?: string;
    fixed_price?: number | null;
    discount_percent?: number;
    currency?: string;
    notes?: string | null;
    components?: Array<{
      catalog_item_id?: string | null;
      item_name: string;
      description?: string | null;
      quantity?: number;
      unit?: string;
      unit_price?: number;
      cost_price?: number | null;
      sku?: string | null;
      is_optional?: boolean;
    }>;
  };
  if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: pkg, error } = await supabase
    .from("quotation_packages")
    .insert({
      client_id: params.clientId,
      name: body.name.trim(),
      description: body.description ?? null,
      pricing_model: body.pricing_model ?? "component_total",
      flexibility: body.flexibility ?? "flexible",
      fixed_price: body.fixed_price != null ? Number(body.fixed_price) : null,
      discount_percent: Number(body.discount_percent) || 0,
      currency: body.currency ?? "USD",
      notes: body.notes ?? null,
    })
    .select("*")
    .single();
  if (error || !pkg) return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });

  const comps = (body.components ?? []).filter((c) => c.item_name?.trim());
  if (comps.length) {
    await supabase.from("quotation_package_components").insert(
      comps.map((c, idx) => ({
        package_id: pkg.id,
        catalog_item_id: c.catalog_item_id ?? null,
        item_name: c.item_name.trim(),
        description: c.description ?? null,
        quantity: Number(c.quantity) || 1,
        unit: c.unit ?? "Each",
        unit_price: Number(c.unit_price) || 0,
        cost_price: c.cost_price != null ? Number(c.cost_price) : null,
        sku: c.sku ?? null,
        is_optional: Boolean(c.is_optional),
        sort_order: idx,
      }))
    );
  }

  return NextResponse.json({ package: pkg }, { status: 201 });
}
