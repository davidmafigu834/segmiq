import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { canManageCatalog } from "@/lib/quotations/quote-access";

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; packageId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json({ error: "Only managers can edit packages" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["name", "description", "pricing_model", "flexibility", "currency", "notes"] as const) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.fixed_price !== undefined) updates.fixed_price = body.fixed_price == null ? null : Number(body.fixed_price);
  if (body.discount_percent !== undefined) updates.discount_percent = Number(body.discount_percent) || 0;
  if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
  if (body.display_order !== undefined) updates.display_order = Number(body.display_order) || 0;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quotation_packages")
    .update(updates)
    .eq("id", params.packageId)
    .eq("client_id", params.clientId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(body.components)) {
    await supabase.from("quotation_package_components").delete().eq("package_id", params.packageId);
    const comps = (body.components as Array<Record<string, unknown>>).filter((c) => String(c.item_name ?? "").trim());
    if (comps.length) {
      await supabase.from("quotation_package_components").insert(
        comps.map((c, idx) => ({
          package_id: params.packageId,
          catalog_item_id: (c.catalog_item_id as string | null) ?? null,
          item_name: String(c.item_name).trim(),
          description: (c.description as string | null) ?? null,
          quantity: Number(c.quantity) || 1,
          unit: (c.unit as string) ?? "Each",
          unit_price: Number(c.unit_price) || 0,
          cost_price: c.cost_price != null ? Number(c.cost_price) : null,
          sku: (c.sku as string | null) ?? null,
          is_optional: Boolean(c.is_optional),
          sort_order: idx,
        }))
      );
    }
  }

  return NextResponse.json({ package: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string; packageId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json({ error: "Only managers can edit packages" }, { status: 403 });
  }
  const supabase = createAdminClient();
  await supabase
    .from("quotation_packages")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", params.packageId)
    .eq("client_id", params.clientId);
  return NextResponse.json({ success: true });
}
