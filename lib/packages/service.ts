import { createAdminClient } from "@/lib/supabase/admin";
import { omitCostFields } from "@/lib/commercial/money";
import { packageAvailability } from "./availability";
import { availableQty } from "@/lib/inventory/math";
import { expandPackageToLineItems } from "@/lib/quotations/packages";
import { logProductActivity } from "@/lib/products/service";
import type { QuotationLineItemInput } from "@/types";

export async function listPackages(opts: {
  clientId: string;
  q?: string;
  status?: string;
  canSeeCost: boolean;
}) {
  const supabase = createAdminClient();
  let q = supabase
    .from("commercial_packages")
    .select("*")
    .eq("client_id", opts.clientId)
    .order("name");
  if (opts.status && opts.status !== "ALL") q = q.eq("status", opts.status);
  else q = q.neq("status", "ARCHIVED");
  if (opts.q?.trim()) q = q.ilike("name", `%${opts.q.trim()}%`);
  const { data, error } = await q;
  if (error) return { error: error.message, packages: [] };
  const ids = (data ?? []).map((p) => p.id as string);
  const { data: items } = ids.length
    ? await supabase.from("commercial_package_items").select("*").in("package_id", ids).order("sort_order")
    : { data: [] as Array<Record<string, unknown>> };
  const packages = (data ?? []).map((pkg) => {
    const pkgItems = (items ?? []).filter((i) => i.package_id === pkg.id);
    return {
      ...pkg,
      item_count: pkgItems.filter((i) => i.item_type !== "SERVICE").length,
      service_count: pkgItems.filter((i) => i.item_type === "SERVICE").length,
    };
  });
  return { packages: omitCostFields(packages, opts.canSeeCost) };
}

export async function getPackage(clientId: string, packageId: string, canSeeCost: boolean) {
  const supabase = createAdminClient();
  const { data: pkg, error } = await supabase
    .from("commercial_packages")
    .select("*")
    .eq("client_id", clientId)
    .eq("id", packageId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!pkg) return { error: "Not found", status: 404 as const };
  const [{ data: sections }, { data: items }] = await Promise.all([
    supabase.from("commercial_package_sections").select("*").eq("package_id", packageId).order("sort_order"),
    supabase.from("commercial_package_items").select("*").eq("package_id", packageId).order("sort_order"),
  ]);
  const productIds = [...new Set((items ?? []).map((i) => i.product_id as string).filter(Boolean))];
  const { data: products } = productIds.length
    ? await supabase
        .from("products")
        .select("id, name, sku, selling_price, cost_price, currency, item_type, track_inventory, status, unit")
        .eq("client_id", clientId)
        .in("id", productIds)
    : { data: [] as Array<Record<string, unknown>> };
  const { data: balances } = productIds.length
    ? await supabase
        .from("inventory_balances")
        .select("product_id, variant_id, on_hand, reserved")
        .eq("client_id", clientId)
        .in("product_id", productIds)
    : { data: [] as Array<Record<string, unknown>> };
  const pMap = new Map((products ?? []).map((p) => [p.id as string, p]));
  const avail = new Map<string, number>();
  for (const b of balances ?? []) {
    const key = `${b.product_id}:${b.variant_id ?? ""}`;
    avail.set(key, (avail.get(key) ?? 0) + availableQty(Number(b.on_hand), Number(b.reserved)));
  }
  const components = (items ?? []).map((i) => {
    const product = pMap.get(i.product_id as string);
    const isService = i.item_type === "SERVICE" || product?.item_type === "SERVICE";
    return {
      id: i.id,
      item_type: i.item_type,
      product_id: i.product_id,
      variant_id: i.variant_id,
      quantity: i.quantity,
      optional: i.optional,
      section_id: i.section_id,
      sort_order: i.sort_order,
      price_override: i.price_override,
      variant_mode: i.variant_mode,
      product,
      isService,
      selling_price: i.price_override != null ? Number(i.price_override) : Number(product?.selling_price) || 0,
      cost_price: product?.cost_price ?? null,
    };
  });
  const availability = packageAvailability(
    components.map((c) => {
      const product = c.product as Record<string, unknown> | undefined;
      return {
        id: String(c.product_id ?? ""),
        name: String(product?.name ?? "Item"),
        requiredQty: Number(c.quantity) || 1,
        trackInventory: Boolean(product?.track_inventory) && c.item_type !== "SERVICE",
        isService: c.isService,
        optional: Boolean(c.optional),
        variantUnresolved: c.variant_mode !== "FIXED_VARIANT" && !c.variant_id,
        available: avail.get(`${c.product_id}:${c.variant_id ?? ""}`) ?? 0,
        archived: product?.status === "ARCHIVED",
        missingPrice: !(c.selling_price > 0) && pkg.pricing_mode === "SUM_OF_ITEMS",
      };
    })
  );
  const componentSelling = components.filter((c) => !c.optional).reduce((s, c) => s + c.selling_price * Number(c.quantity), 0);
  const componentCost = components.every((c) => c.cost_price != null)
    ? components.filter((c) => !c.optional).reduce((s, c) => s + Number(c.cost_price) * Number(c.quantity), 0)
    : null;
  const selling = pkg.pricing_mode === "FIXED_PRICE" ? Number(pkg.fixed_price) || 0 : componentSelling;
  const result = {
    ...pkg,
    sections: sections ?? [],
    items: components,
    availability,
    commercial: {
      componentSelling,
      packagePrice: selling,
      difference: selling - componentSelling,
      componentCost,
      margin: componentCost == null ? null : selling - componentCost,
      marginPercent: componentCost == null || selling <= 0 ? null : ((selling - componentCost) / selling) * 100,
    },
  };
  return { package: omitCostFields(result, canSeeCost) };
}

export async function createPackage(clientId: string, actorId: string, input: Record<string, unknown>) {
  const name = String(input.name ?? "").trim();
  if (!name) return { error: "Name is required", status: 400 as const };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("commercial_packages")
    .insert({
      client_id: clientId,
      name,
      code: input.code ? String(input.code).trim() : null,
      category_id: input.category_id || null,
      description: input.description ?? null,
      customer_facing_description: input.customer_facing_description ?? null,
      internal_notes: input.internal_notes ?? null,
      image_url: input.image_url ?? null,
      pricing_mode: input.pricing_mode === "FIXED_PRICE" ? "FIXED_PRICE" : "SUM_OF_ITEMS",
      fixed_price: input.fixed_price == null ? null : Number(input.fixed_price),
      currency: input.currency ?? "USD",
      status: input.status || "DRAFT",
      can_be_quoted: input.can_be_quoted !== false,
      presentation_mode: input.presentation_mode === "SHOW_PACKAGE_SUMMARY" ? "SHOW_PACKAGE_SUMMARY" : "SHOW_COMPONENTS",
      tags: input.tags ?? [],
      flexibility: input.flexibility || "flexible",
      created_by: actorId,
    })
    .select("*")
    .single();
  if (error) return { error: error.message, status: 500 as const };
  await logProductActivity(clientId, null, actorId, "package.created", { name }, data.id as string);
  return { package: data };
}

export async function updatePackage(
  clientId: string,
  packageId: string,
  actorId: string,
  input: Record<string, unknown>
) {
  const supabase = createAdminClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of [
    "name",
    "code",
    "category_id",
    "description",
    "customer_facing_description",
    "internal_notes",
    "image_url",
    "pricing_mode",
    "fixed_price",
    "currency",
    "status",
    "can_be_quoted",
    "presentation_mode",
    "tags",
    "flexibility",
    "discount_percent",
  ]) {
    if (input[key] !== undefined) updates[key] = input[key];
  }
  const { data, error } = await supabase
    .from("commercial_packages")
    .update(updates)
    .eq("id", packageId)
    .eq("client_id", clientId)
    .select("*")
    .single();
  if (error) return { error: error.message };
  await logProductActivity(clientId, null, actorId, "package.updated", updates, packageId);
  return { package: data };
}

export async function savePackageContents(
  clientId: string,
  packageId: string,
  actorId: string,
  payload: {
    sections?: Array<{ id?: string; name: string; sort_order: number }>;
    items?: Array<Record<string, unknown>>;
  }
) {
  const supabase = createAdminClient();
  if (payload.sections) {
    await supabase.from("commercial_package_sections").delete().eq("package_id", packageId);
    if (payload.sections.length) {
      await supabase.from("commercial_package_sections").insert(
        payload.sections.map((s, i) => ({
          id: s.id,
          client_id: clientId,
          package_id: packageId,
          name: s.name,
          sort_order: s.sort_order ?? i,
        }))
      );
    }
  }
  if (payload.items) {
    await supabase.from("commercial_package_items").delete().eq("package_id", packageId);
    if (payload.items.length) {
      await supabase.from("commercial_package_items").insert(
        payload.items.map((it, i) => ({
          client_id: clientId,
          package_id: packageId,
          section_id: it.section_id || null,
          item_type: it.item_type === "SERVICE" ? "SERVICE" : "PRODUCT",
          product_id: it.product_id || null,
          variant_id: it.variant_id || null,
          quantity: Number(it.quantity) || 1,
          optional: Boolean(it.optional),
          sort_order: it.sort_order ?? i,
          price_override: it.price_override == null ? null : Number(it.price_override),
          variant_mode: it.variant_mode || "FIXED_VARIANT",
          snapshot_name: it.snapshot_name ?? null,
          snapshot_sku: it.snapshot_sku ?? null,
          snapshot_unit: it.snapshot_unit ?? null,
          snapshot_unit_price: it.snapshot_unit_price == null ? null : Number(it.snapshot_unit_price),
        }))
      );
    }
    await logProductActivity(clientId, null, actorId, "package.items_changed", { count: payload.items.length }, packageId);
  }
  return getPackage(clientId, packageId, true);
}

export async function clonePackage(clientId: string, packageId: string, actorId: string) {
  const loaded = await getPackage(clientId, packageId, true);
  if ("error" in loaded && loaded.error) return loaded;
  const src = loaded.package as Record<string, unknown>;
  const created = await createPackage(clientId, actorId, {
    ...src,
    name: `${src.name} (copy)`,
    status: "DRAFT",
    code: src.code ? `${src.code}-COPY` : null,
  });
  if (!created.package) return created;
  const items = (src.items as Array<Record<string, unknown>>) ?? [];
  const sections = (src.sections as Array<{ name: string; sort_order: number }>) ?? [];
  await savePackageContents(clientId, created.package.id as string, actorId, { sections, items });
  return created;
}

export async function expandCommercialPackage(opts: {
  clientId: string;
  packageId: string;
  scale?: number;
  sectionId?: string | null;
}): Promise<{ lines: QuotationLineItemInput[]; error?: string }> {
  const loaded = await getPackage(opts.clientId, opts.packageId, true);
  if ("error" in loaded && loaded.error) return { lines: [], error: loaded.error };
  const pkg = loaded.package as Record<string, unknown>;
  const items = (pkg.items as Array<Record<string, unknown>>) ?? [];
  const components = items.map((c) => {
    const product = c.product as Record<string, unknown> | undefined;
    return {
      catalog_item_id: (product?.legacy_catalog_item_id as string | null) ?? null,
      item_name: String(product?.name ?? c.snapshot_name ?? "Item"),
      description: (product?.quotation_description as string | null) ?? (pkg.customer_facing_description as string | null),
      quantity: Number(c.quantity) || 1,
      unit: String(product?.unit ?? "Each"),
      unit_price: Number(c.selling_price) || 0,
      cost_price: c.cost_price != null ? Number(c.cost_price) : null,
      sku: (product?.sku as string | null) ?? null,
      is_optional: Boolean(c.optional),
    };
  });
  const pricingModel = pkg.pricing_mode === "FIXED_PRICE" ? "fixed" : "component_total";
  const lines = expandPackageToLineItems({
    packageId: opts.packageId,
    packageName: String(pkg.name),
    pricingModel,
    flexibility: String(pkg.flexibility ?? "flexible"),
    fixedPrice: pkg.fixed_price != null ? Number(pkg.fixed_price) : null,
    discountPercent: Number(pkg.discount_percent) || 0,
    components,
    sectionId: opts.sectionId,
    scale: opts.scale,
  }).map((line, i) => {
    const src = items[i];
    return {
      ...line,
      source_type: "PACKAGE" as const,
      product_id: (src?.product_id as string | null) ?? null,
      variant_id: (src?.variant_id as string | null) ?? null,
      package_id: opts.packageId,
    };
  });
  return { lines };
}
