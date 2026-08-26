import { createAdminClient } from "@/lib/supabase/admin";
import { omitCostFields } from "@/lib/commercial/money";
import { availableQty, stockStatus } from "@/lib/inventory/math";
import type { ProductItemType, ProductStatus } from "@/lib/commercial/types";

export type ProductListQuery = {
  clientId: string;
  q?: string;
  type?: ProductItemType | "ALL";
  categoryId?: string | null;
  brand?: string | null;
  status?: ProductStatus | "ALL";
  inventoryStatus?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "NOT_TRACKED" | "ALL";
  page?: number;
  limit?: number;
  canSeeCost: boolean;
};

function applySearchFilter<T extends { or: (f: string) => T }>(query: T, q: string | undefined): T {
  const term = (q ?? "").trim();
  if (!term) return query;
  const like = `%${term.replace(/[%_,]/g, "")}%`;
  return query.or(
    `name.ilike.${like},sku.ilike.${like},barcode.ilike.${like},brand.ilike.${like},internal_code.ilike.${like}`
  );
}

export async function listProducts(opts: ProductListQuery) {
  const supabase = createAdminClient();
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("products")
    .select(
      "id, client_id, item_type, name, sku, barcode, brand, category_id, status, unit, selling_price, currency, tax_rate, cost_price, track_inventory, allow_fractional_qty, can_be_quoted, primary_image_url, warranty, quotation_description, description, created_at, updated_at",
      { count: "exact" }
    )
    .eq("client_id", opts.clientId)
    .order("name", { ascending: true })
    .range(from, to);

  if (opts.type && opts.type !== "ALL") query = query.eq("item_type", opts.type);
  if (opts.status && opts.status !== "ALL") query = query.eq("status", opts.status);
  else query = query.neq("status", "ARCHIVED");
  if (opts.categoryId) query = query.eq("category_id", opts.categoryId);
  if (opts.brand) query = query.ilike("brand", opts.brand);
  query = applySearchFilter(query, opts.q);

  const { data, error, count } = await query;
  if (error) return { error: error.message, items: [], total: 0, page, limit };

  let items = (data ?? []) as Array<Record<string, unknown>>;
  const categoryIds = [...new Set(items.map((p) => p.category_id as string | null).filter(Boolean))] as string[];
  const catNames = new Map<string, string>();
  if (categoryIds.length) {
    const { data: cats } = await supabase.from("product_categories").select("id, name").in("id", categoryIds);
    for (const c of cats ?? []) catNames.set(c.id as string, c.name as string);
  }

  const trackedIds = items.filter((p) => p.track_inventory && p.item_type !== "SERVICE").map((p) => p.id as string);
  const onHandMap = new Map<string, number>();
  const reservedMap = new Map<string, number>();
  const reorderMap = new Map<string, number | null>();
  if (trackedIds.length) {
    const { data: balances } = await supabase
      .from("inventory_balances")
      .select("product_id, on_hand, reserved, reorder_level")
      .eq("client_id", opts.clientId)
      .in("product_id", trackedIds);
    for (const b of balances ?? []) {
      const id = b.product_id as string;
      onHandMap.set(id, (onHandMap.get(id) ?? 0) + (Number(b.on_hand) || 0));
      reservedMap.set(id, (reservedMap.get(id) ?? 0) + (Number(b.reserved) || 0));
      const reorder = b.reorder_level == null ? null : Number(b.reorder_level);
      const prev = reorderMap.get(id);
      if (reorder != null && (prev == null || reorder < prev)) reorderMap.set(id, reorder);
    }
  }

  items = items.map((p) => {
    const id = p.id as string;
    const track = Boolean(p.track_inventory) && p.item_type !== "SERVICE";
    const onHand = onHandMap.get(id) ?? 0;
    const reserved = reservedMap.get(id) ?? 0;
    const available = availableQty(onHand, reserved);
    return {
      ...p,
      category_name: p.category_id ? catNames.get(p.category_id as string) ?? null : null,
      on_hand: track ? onHand : null,
      reserved: track ? reserved : null,
      available_qty: track ? available : null,
      inventory_status: stockStatus({
        trackInventory: track,
        available,
        reorderLevel: reorderMap.get(id) ?? null,
      }),
    };
  });

  if (opts.inventoryStatus && opts.inventoryStatus !== "ALL") {
    items = items.filter((p) => p.inventory_status === opts.inventoryStatus);
  }

  const typeCounts = await countProductTypes(opts);

  return {
    items: omitCostFields(items, opts.canSeeCost),
    total: count ?? items.length,
    page,
    limit,
    typeCounts,
  };
}

async function countProductTypes(opts: ProductListQuery) {
  const supabase = createAdminClient();
  async function countFor(type?: ProductItemType) {
    let q = supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("client_id", opts.clientId);
    if (opts.status && opts.status !== "ALL") q = q.eq("status", opts.status);
    else q = q.neq("status", "ARCHIVED");
    if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
    if (opts.brand) q = q.ilike("brand", opts.brand);
    if (type) q = q.eq("item_type", type);
    q = applySearchFilter(q, opts.q);
    const { count } = await q;
    return count ?? 0;
  }
  const [all, products, services] = await Promise.all([countFor(), countFor("PRODUCT"), countFor("SERVICE")]);
  return { all, products, services };
}

export async function getProduct(clientId: string, productId: string, canSeeCost: boolean) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("client_id", clientId)
    .eq("id", productId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Not found", status: 404 as const };
  const [{ data: variants }, { data: attrDefs }, { data: balances }] = await Promise.all([
    supabase.from("product_variants").select("*").eq("product_id", productId).order("name"),
    supabase.from("product_attribute_defs").select("*").eq("product_id", productId).order("sort_order"),
    supabase.from("inventory_balances").select("*").eq("client_id", clientId).eq("product_id", productId),
  ]);
  const categoryId = data.category_id as string | null;
  const [{ data: category }, { data: packageItems }, { data: locations }] = await Promise.all([
    categoryId
      ? supabase.from("product_categories").select("id, name").eq("id", categoryId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("commercial_package_items").select("package_id").eq("product_id", productId),
    supabase.from("inventory_locations").select("id, name, status").eq("client_id", clientId),
  ]);
  const packageIds = [...new Set((packageItems ?? []).map((i) => i.package_id as string))];
  const { data: usedPackages } = packageIds.length
    ? await supabase
        .from("commercial_packages")
        .select("id, name, status")
        .eq("client_id", clientId)
        .in("id", packageIds)
        .neq("status", "ARCHIVED")
    : { data: [] as Array<{ id: string; name: string; status: string }> };
  const locName = new Map((locations ?? []).map((l) => [l.id as string, l.name as string]));
  const locationRows = (balances ?? []).map((b) => {
    const onHand = Number(b.on_hand) || 0;
    const reserved = Number(b.reserved) || 0;
    return {
      locationId: b.location_id as string,
      name: locName.get(b.location_id as string) ?? "Location",
      onHand,
      reserved,
      available: availableQty(onHand, reserved),
      reorderLevel: b.reorder_level == null ? null : Number(b.reorder_level),
    };
  });
  const onHand = locationRows.reduce((s, l) => s + l.onHand, 0);
  const reserved = locationRows.reduce((s, l) => s + l.reserved, 0);
  const available = availableQty(onHand, reserved);
  const track = Boolean(data.track_inventory) && data.item_type !== "SERVICE";
  const reorderLevels = locationRows.map((l) => l.reorderLevel).filter((n): n is number => n != null);
  const inventory = {
    trackInventory: track,
    onHand: track ? onHand : null,
    reserved: track ? reserved : null,
    available: track ? available : null,
    reorderLevel: reorderLevels.length ? Math.min(...reorderLevels) : null,
    status: stockStatus({
      trackInventory: track,
      available,
      reorderLevel: reorderLevels.length ? Math.min(...reorderLevels) : null,
    }),
    locations: track ? locationRows : [],
  };
  return {
    product: omitCostFields(
      {
        ...data,
        variants: variants ?? [],
        attributeDefs: attrDefs ?? [],
        balances: balances ?? [],
        category: category ?? null,
        usedInPackages: usedPackages ?? [],
        packageCount: (usedPackages ?? []).length,
        inventory,
      },
      canSeeCost
    ),
  };
}

export async function skuExists(clientId: string, sku: string, exclude?: { productId?: string; variantId?: string }) {
  const trimmed = sku.trim();
  if (!trimmed) return false;
  const supabase = createAdminClient();
  let pq = supabase.from("products").select("id").eq("client_id", clientId).ilike("sku", trimmed).limit(1);
  if (exclude?.productId) pq = pq.neq("id", exclude.productId);
  const { data: products } = await pq;
  if (products?.length) return true;
  let vq = supabase.from("product_variants").select("id").eq("client_id", clientId).ilike("sku", trimmed).limit(1);
  if (exclude?.variantId) vq = vq.neq("id", exclude.variantId);
  const { data: variants } = await vq;
  return Boolean(variants?.length);
}

export async function createProduct(
  clientId: string,
  actorId: string,
  input: Record<string, unknown>
): Promise<{ product?: Record<string, unknown>; error?: string; status?: number }> {
  const name = String(input.name ?? "").trim();
  if (!name) return { error: "Name is required", status: 400 };
  const sku = input.sku != null ? String(input.sku).trim() || null : null;
  if (sku && (await skuExists(clientId, sku))) {
    return { error: "SKU already exists for this company", status: 409 };
  }
  const itemType = input.item_type === "SERVICE" ? "SERVICE" : "PRODUCT";
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      client_id: clientId,
      item_type: itemType,
      name,
      sku,
      barcode: input.barcode ? String(input.barcode).trim() : null,
      internal_code: input.internal_code ? String(input.internal_code).trim() : null,
      brand: input.brand ? String(input.brand).trim() : null,
      manufacturer: input.manufacturer ? String(input.manufacturer).trim() : null,
      category_id: input.category_id || null,
      description: input.description ?? null,
      quotation_description: input.quotation_description ?? null,
      status: input.status === "INACTIVE" || input.status === "ARCHIVED" ? input.status : "ACTIVE",
      unit: String(input.unit ?? "Each").trim() || "Each",
      selling_price: Number(input.selling_price) || 0,
      currency: String(input.currency ?? "USD"),
      tax_rate: input.tax_rate == null ? null : Number(input.tax_rate),
      cost_price: input.cost_price == null ? null : Number(input.cost_price),
      cost_currency: input.cost_currency ?? null,
      min_selling_price: input.min_selling_price == null ? null : Number(input.min_selling_price),
      track_inventory: itemType === "SERVICE" ? false : Boolean(input.track_inventory),
      allow_fractional_qty: Boolean(input.allow_fractional_qty),
      warranty: input.warranty ?? null,
      can_be_quoted: input.can_be_quoted !== false,
      requires_technical_confirmation: Boolean(input.requires_technical_confirmation),
      price_editable_on_quote: input.price_editable_on_quote !== false,
      discount_allowed: input.discount_allowed !== false,
      primary_image_url: input.primary_image_url ?? null,
      specs: input.specs ?? [],
      extra_images: input.extra_images ?? [],
      documents: input.documents ?? [],
      legacy_catalog_item_id: input.legacy_catalog_item_id ?? null,
      created_by: actorId,
      updated_by: actorId,
    })
    .select("*")
    .single();
  if (error) return { error: error.message, status: 500 };
  await logProductActivity(clientId, data.id as string, actorId, "product.created", { name });
  return { product: data };
}

export async function updateProduct(
  clientId: string,
  productId: string,
  actorId: string,
  input: Record<string, unknown>,
  canEditCost: boolean
) {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("products")
    .select("*")
    .eq("client_id", clientId)
    .eq("id", productId)
    .maybeSingle();
  if (!existing) return { error: "Not found", status: 404 as const };

  if (input.sku != null) {
    const sku = String(input.sku).trim();
    if (sku && (await skuExists(clientId, sku, { productId }))) {
      return { error: "SKU already exists for this company", status: 409 as const };
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: actorId };
  const assign = (key: string, val: unknown) => {
    if (val !== undefined) updates[key] = val;
  };
  if (input.name !== undefined) assign("name", String(input.name).trim());
  assign("sku", input.sku === undefined ? undefined : String(input.sku).trim() || null);
  assign("barcode", input.barcode === undefined ? undefined : input.barcode ? String(input.barcode).trim() : null);
  assign("internal_code", input.internal_code);
  assign("brand", input.brand === undefined ? undefined : input.brand ? String(input.brand).trim() : null);
  assign("manufacturer", input.manufacturer);
  assign("category_id", input.category_id === undefined ? undefined : input.category_id || null);
  assign("description", input.description);
  assign("quotation_description", input.quotation_description);
  if (input.item_type === "SERVICE" || input.item_type === "PRODUCT") {
    if (input.item_type === "SERVICE" && existing.item_type !== "SERVICE") {
      const { data: stockRows } = await supabase
        .from("inventory_balances")
        .select("on_hand")
        .eq("client_id", clientId)
        .eq("product_id", productId);
      const onHand = (stockRows ?? []).reduce((s, r) => s + (Number(r.on_hand) || 0), 0);
      if (onHand > 0) {
        return { error: "Cannot convert to a Service while stock is on hand. Adjust inventory to zero first.", status: 409 as const };
      }
      updates.item_type = "SERVICE";
      updates.track_inventory = false;
    } else {
      updates.item_type = input.item_type;
    }
  }
  if (input.status === "ACTIVE" || input.status === "INACTIVE" || input.status === "ARCHIVED") {
    updates.status = input.status;
  }
  assign("unit", input.unit);
  if (input.selling_price !== undefined) updates.selling_price = Number(input.selling_price) || 0;
  assign("currency", input.currency);
  if (input.tax_rate !== undefined) updates.tax_rate = input.tax_rate == null ? null : Number(input.tax_rate);
  if (canEditCost && input.cost_price !== undefined) {
    updates.cost_price = input.cost_price == null ? null : Number(input.cost_price);
  }
  if (input.min_selling_price !== undefined) {
    updates.min_selling_price = input.min_selling_price == null ? null : Number(input.min_selling_price);
  }
  if (input.track_inventory !== undefined && existing.item_type !== "SERVICE" && updates.item_type !== "SERVICE") {
    updates.track_inventory = Boolean(input.track_inventory);
  }
  if (updates.item_type === "SERVICE") updates.track_inventory = false;
  if (input.allow_fractional_qty !== undefined) updates.allow_fractional_qty = Boolean(input.allow_fractional_qty);
  assign("warranty", input.warranty);
  if (input.can_be_quoted !== undefined) updates.can_be_quoted = Boolean(input.can_be_quoted);
  if (input.requires_technical_confirmation !== undefined) {
    updates.requires_technical_confirmation = Boolean(input.requires_technical_confirmation);
  }
  if (input.price_editable_on_quote !== undefined) updates.price_editable_on_quote = Boolean(input.price_editable_on_quote);
  if (input.discount_allowed !== undefined) updates.discount_allowed = Boolean(input.discount_allowed);
  assign("primary_image_url", input.primary_image_url);
  assign("specs", input.specs);
  assign("documents", input.documents);
  assign("extra_images", input.extra_images);

  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", productId)
    .eq("client_id", clientId)
    .select("*")
    .single();
  if (error) return { error: error.message, status: 500 as const };

  if (input.selling_price !== undefined && Number(input.selling_price) !== Number(existing.selling_price)) {
    await logProductActivity(clientId, productId, actorId, "product.price_changed", {
      old: existing.selling_price,
      new: input.selling_price,
    });
  }
  if (canEditCost && input.cost_price !== undefined && Number(input.cost_price) !== Number(existing.cost_price)) {
    await logProductActivity(clientId, productId, actorId, "product.cost_changed", {
      old: existing.cost_price,
      new: input.cost_price,
    });
  }
  if (input.status === "ARCHIVED") {
    await logProductActivity(clientId, productId, actorId, "product.archived", {});
  } else if (input.status && input.status !== existing.status) {
    await logProductActivity(clientId, productId, actorId, "product.status_changed", {
      old: existing.status,
      new: input.status,
    });
  }
  return { product: data };
}

export async function cloneProduct(clientId: string, productId: string, actorId: string) {
  const loaded = await getProduct(clientId, productId, true);
  if ("error" in loaded && loaded.error) return loaded;
  const src = loaded.product as Record<string, unknown>;
  return createProduct(clientId, actorId, {
    ...src,
    name: `${src.name} (copy)`,
    sku: null,
    status: "INACTIVE",
  });
}

export async function bulkUpdateProducts(
  clientId: string,
  ids: string[],
  patch: { status?: ProductStatus; category_id?: string | null }
) {
  if (!ids.length) return { updated: 0 };
  const supabase = createAdminClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) updates.status = patch.status;
  if (patch.category_id !== undefined) updates.category_id = patch.category_id;
  const { error, count } = await supabase
    .from("products")
    .update(updates, { count: "exact" })
    .eq("client_id", clientId)
    .in("id", ids);
  if (error) return { error: error.message };
  return { updated: count ?? ids.length };
}

export async function upsertVariant(
  clientId: string,
  productId: string,
  input: Record<string, unknown>,
  variantId?: string
) {
  const supabase = createAdminClient();
  const sku = input.sku != null ? String(input.sku).trim() || null : null;
  if (sku && (await skuExists(clientId, sku, { variantId, productId }))) {
    return { error: "SKU already exists for this company", status: 409 as const };
  }
  const row = {
    client_id: clientId,
    product_id: productId,
    name: String(input.name ?? "").trim(),
    sku,
    barcode: input.barcode ? String(input.barcode).trim() : null,
    attributes: input.attributes ?? {},
    selling_price_override: input.selling_price_override == null ? null : Number(input.selling_price_override),
    cost_price_override: input.cost_price_override == null ? null : Number(input.cost_price_override),
    status: input.status === "INACTIVE" || input.status === "ARCHIVED" ? input.status : "ACTIVE",
    track_inventory: input.track_inventory !== false,
    updated_at: new Date().toISOString(),
  };
  if (!row.name) return { error: "Variant name is required", status: 400 as const };
  if (variantId) {
    const { data, error } = await supabase
      .from("product_variants")
      .update(row)
      .eq("id", variantId)
      .eq("client_id", clientId)
      .select("*")
      .single();
    if (error) return { error: error.message };
    return { variant: data };
  }
  const { data, error } = await supabase.from("product_variants").insert(row).select("*").single();
  if (error) return { error: error.message };
  return { variant: data };
}

export async function logProductActivity(
  clientId: string,
  productId: string | null,
  actorId: string | null,
  eventType: string,
  eventData: Record<string, unknown>,
  packageId?: string | null
) {
  try {
    const supabase = createAdminClient();
    await supabase.from("product_activity_events").insert({
      client_id: clientId,
      product_id: productId,
      package_id: packageId ?? null,
      actor_id: actorId,
      event_type: eventType,
      event_data: eventData,
    });
  } catch {
    /* never block writes */
  }
}

export async function listBrands(clientId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("products")
    .select("brand")
    .eq("client_id", clientId)
    .not("brand", "is", null)
    .limit(500);
  const set = new Set<string>();
  for (const row of data ?? []) {
    const b = String(row.brand ?? "").trim();
    if (b) set.add(b);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export async function listUnits(clientId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("units_of_measure")
    .select("id, code, name, allow_fractional, is_builtin, client_id")
    .or(`client_id.is.null,client_id.eq.${clientId}`)
    .order("name");
  if (error) return { error: error.message, units: [] as Array<Record<string, unknown>> };
  return { units: data ?? [] };
}

export async function listProductActivity(clientId: string, productId: string, limit = 80) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("product_activity_events")
    .select("id, event_type, event_data, actor_id, actor_name, created_at, package_id")
    .eq("client_id", clientId)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(Math.min(200, limit));
  if (error) return { error: error.message, events: [] as Array<Record<string, unknown>> };
  const actorIds = [...new Set((data ?? []).map((e) => e.actor_id as string | null).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (actorIds.length) {
    const { data: users } = await supabase.from("users").select("id, name").in("id", actorIds);
    for (const u of users ?? []) names.set(u.id as string, u.name as string);
  }
  return {
    events: (data ?? []).map((e) => ({
      ...e,
      actor_name: e.actor_name || (e.actor_id ? names.get(e.actor_id as string) ?? null : null),
    })),
  };
}

export async function upsertAttributeDef(
  clientId: string,
  productId: string,
  input: { id?: string; name: string; options?: string[]; sort_order?: number }
) {
  const name = input.name.trim();
  if (!name) return { error: "Attribute name is required", status: 400 as const };
  const supabase = createAdminClient();
  const row = {
    client_id: clientId,
    product_id: productId,
    name,
    attr_type: "SELECT" as const,
    options: input.options ?? [],
    sort_order: input.sort_order ?? 0,
  };
  if (input.id) {
    const { data, error } = await supabase
      .from("product_attribute_defs")
      .update(row)
      .eq("id", input.id)
      .eq("client_id", clientId)
      .select("*")
      .single();
    if (error) return { error: error.message };
    return { attributeDef: data };
  }
  const { data, error } = await supabase.from("product_attribute_defs").insert(row).select("*").single();
  if (error) return { error: error.message };
  return { attributeDef: data };
}
