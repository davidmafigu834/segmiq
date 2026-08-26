import { createAdminClient } from "@/lib/supabase/admin";
import { emitDomainEvent } from "@/lib/agent/proactive/events";
import { availableQty, canTransfer, crossedLowStock, crossedOutOfStock, stockStatus } from "./math";
import type { AvailabilityQuery, AvailabilityResult, InventoryProvider, InventorySettings } from "./provider";
import type { AgentDisclosure } from "@/lib/commercial/types";

export async function getInventorySettings(clientId: string): Promise<InventorySettings> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("inventory_settings").select("*").eq("client_id", clientId).maybeSingle();
  if (!data) {
    await supabase.from("inventory_settings").insert({ client_id: clientId });
    return {
      provider: "SEGMIQ",
      allowNegativeStock: false,
      defaultLocationId: null,
      staleAfterMinutes: 60,
      agentDisclosure: "GENERAL",
      warnInsufficientStock: true,
      blockInsufficientStock: false,
      lowStockNotifications: true,
      externalProviderName: null,
      lastSyncAt: null,
      lastSyncError: null,
    };
  }
  return {
    provider: data.provider === "EXTERNAL" ? "EXTERNAL" : "SEGMIQ",
    allowNegativeStock: Boolean(data.allow_negative_stock),
    defaultLocationId: (data.default_location_id as string | null) ?? null,
    staleAfterMinutes: Number(data.stale_after_minutes) || 60,
    agentDisclosure: (data.agent_disclosure as AgentDisclosure) || "GENERAL",
    warnInsufficientStock: data.warn_insufficient_stock !== false,
    blockInsufficientStock: Boolean(data.block_insufficient_stock),
    lowStockNotifications: data.low_stock_notifications !== false,
    externalProviderName: (data.external_provider_name as string | null) ?? null,
    lastSyncAt: (data.last_sync_at as string | null) ?? null,
    lastSyncError: (data.last_sync_error as string | null) ?? null,
  };
}

export async function saveInventorySettings(clientId: string, patch: Partial<InventorySettings>) {
  const supabase = createAdminClient();
  await getInventorySettings(clientId);
  const { data, error } = await supabase
    .from("inventory_settings")
    .update({
      provider: patch.provider,
      allow_negative_stock: patch.allowNegativeStock,
      default_location_id: patch.defaultLocationId,
      stale_after_minutes: patch.staleAfterMinutes,
      agent_disclosure: patch.agentDisclosure,
      warn_insufficient_stock: patch.warnInsufficientStock,
      block_insufficient_stock: patch.blockInsufficientStock,
      low_stock_notifications: patch.lowStockNotifications,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId)
    .select("*")
    .single();
  if (error) return { error: error.message };
  return { settings: data };
}

async function loadBalance(
  clientId: string,
  locationId: string,
  productId: string,
  variantId: string | null
) {
  const supabase = createAdminClient();
  let q = supabase
    .from("inventory_balances")
    .select("*")
    .eq("client_id", clientId)
    .eq("location_id", locationId)
    .eq("product_id", productId);
  q = variantId ? q.eq("variant_id", variantId) : q.is("variant_id", null);
  const { data } = await q.maybeSingle();
  return data;
}

async function ensureBalance(
  clientId: string,
  locationId: string,
  productId: string,
  variantId: string | null
) {
  const existing = await loadBalance(clientId, locationId, productId, variantId);
  if (existing) return existing;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("inventory_balances")
    .insert({
      client_id: clientId,
      location_id: locationId,
      product_id: productId,
      variant_id: variantId,
      on_hand: 0,
      reserved: 0,
    })
    .select("*")
    .single();
  if (error) {
    const again = await loadBalance(clientId, locationId, productId, variantId);
    if (again) return again;
    throw new Error(error.message);
  }
  return data;
}

export async function getAvailability(query: AvailabilityQuery): Promise<AvailabilityResult> {
  const supabase = createAdminClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, track_inventory, item_type, last_synced_at")
    .eq("client_id", query.clientId)
    .eq("id", query.productId)
    .maybeSingle();
  const settings = await getInventorySettings(query.clientId);
  const track = Boolean(product?.track_inventory) && product?.item_type !== "SERVICE";
  let bq = supabase
    .from("inventory_balances")
    .select("location_id, product_id, variant_id, on_hand, reserved, reorder_level")
    .eq("client_id", query.clientId)
    .eq("product_id", query.productId);
  if (query.variantId) bq = bq.eq("variant_id", query.variantId);
  if (query.locationId) bq = bq.eq("location_id", query.locationId);
  const { data: balances } = await bq;
  const { data: locations } = await supabase
    .from("inventory_locations")
    .select("id, name")
    .eq("client_id", query.clientId);
  const locName = new Map((locations ?? []).map((l) => [l.id as string, l.name as string]));
  const locationsOut = (balances ?? []).map((b) => {
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
  const onHand = locationsOut.reduce((s, l) => s + l.onHand, 0);
  const reserved = locationsOut.reduce((s, l) => s + l.reserved, 0);
  const available = availableQty(onHand, reserved);
  const lastSyncedAt = (product?.last_synced_at as string | null) ?? settings.lastSyncAt;
  const stale =
    settings.provider === "EXTERNAL" &&
    (!lastSyncedAt || Date.now() - Date.parse(lastSyncedAt) > settings.staleAfterMinutes * 60_000);
  return {
    productId: query.productId,
    variantId: query.variantId ?? null,
    onHand,
    reserved,
    available,
    status: stockStatus({ trackInventory: track, available }),
    trackInventory: track,
    lastSyncedAt,
    stale,
    locations: locationsOut,
  };
}

export async function adjustStock(opts: {
  clientId: string;
  locationId: string;
  productId: string;
  variantId?: string | null;
  delta: number;
  reason: string;
  note?: string | null;
  reference?: string | null;
  actorId: string;
  source?: string;
  movementType?: string;
}): Promise<{ onHand: number; available: number; error?: string; status?: number }> {
  const settings = await getInventorySettings(opts.clientId);
  if (settings.provider === "EXTERNAL") {
    return { onHand: 0, available: 0, error: "Inventory is managed by an external system", status: 409 };
  }
  if (!opts.reason.trim()) return { onHand: 0, available: 0, error: "Reason is required", status: 400 };
  if (opts.reason === "Other" && !opts.note?.trim()) {
    return { onHand: 0, available: 0, error: "A note is required for Other", status: 400 };
  }

  const supabase = createAdminClient();
  const balance = await ensureBalance(opts.clientId, opts.locationId, opts.productId, opts.variantId ?? null);
  const before = Number(balance.on_hand) || 0;
  const reserved = Number(balance.reserved) || 0;
  const after = before + opts.delta;
  if (after < 0 && !settings.allowNegativeStock) {
    return { onHand: before, available: availableQty(before, reserved), error: "Negative stock is not allowed", status: 409 };
  }
  const { data, error } = await supabase
    .from("inventory_balances")
    .update({
      on_hand: after,
      version: (Number(balance.version) || 1) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", balance.id)
    .eq("version", balance.version)
    .select("*")
    .maybeSingle();
  if (error) return { onHand: before, available: availableQty(before, reserved), error: error.message, status: 500 };
  if (!data) {
    return { onHand: before, available: availableQty(before, reserved), error: "Stock was updated by someone else. Refresh and try again.", status: 409 };
  }

  const type =
    opts.movementType ??
    (opts.source === "IMPORT" ? "IMPORT" : opts.delta >= 0 ? "STOCK_ADJUSTMENT" : "STOCK_ADJUSTMENT");
  await supabase.from("inventory_movements").insert({
    client_id: opts.clientId,
    location_id: opts.locationId,
    product_id: opts.productId,
    variant_id: opts.variantId ?? null,
    movement_type: type,
    quantity: opts.delta,
    balance_before: before,
    balance_after: after,
    reason: opts.note ? `${opts.reason}: ${opts.note}` : opts.reason,
    reference_type: opts.reference ? "NOTE" : null,
    performed_by: opts.actorId,
    source: opts.source ?? "USER",
  });

  const prevAvail = availableQty(before, reserved);
  const nextAvail = availableQty(after, reserved);
  const reorder = balance.reorder_level == null ? null : Number(balance.reorder_level);
  await emitStockEvents({
    clientId: opts.clientId,
    productId: opts.productId,
    variantId: opts.variantId ?? null,
    prevAvail,
    nextAvail,
    reorder,
    delta: opts.delta,
  });
  return { onHand: after, available: nextAvail };
}

export async function transferStock(opts: {
  clientId: string;
  fromLocationId: string;
  toLocationId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  actorId: string;
  notes?: string | null;
}) {
  if (opts.fromLocationId === opts.toLocationId) {
    return { error: "Choose two different locations", status: 400 as const };
  }
  if (!(opts.quantity > 0)) return { error: "Quantity must be positive", status: 400 as const };
  const settings = await getInventorySettings(opts.clientId);
  if (settings.provider === "EXTERNAL") {
    return { error: "Inventory is managed by an external system", status: 409 as const };
  }

  const supabase = createAdminClient();
  const from = await ensureBalance(opts.clientId, opts.fromLocationId, opts.productId, opts.variantId ?? null);
  const available = availableQty(Number(from.on_hand), Number(from.reserved));
  if (!canTransfer(available, opts.quantity, settings.allowNegativeStock)) {
    return { error: "Cannot transfer more than available", status: 409 as const };
  }

  const { data: transfer, error: tErr } = await supabase
    .from("inventory_transfers")
    .insert({
      client_id: opts.clientId,
      from_location_id: opts.fromLocationId,
      to_location_id: opts.toLocationId,
      product_id: opts.productId,
      variant_id: opts.variantId ?? null,
      quantity: opts.quantity,
      performed_by: opts.actorId,
      notes: opts.notes ?? null,
    })
    .select("id")
    .single();
  if (tErr) return { error: tErr.message, status: 500 as const };

  const out = await adjustStock({
    clientId: opts.clientId,
    locationId: opts.fromLocationId,
    productId: opts.productId,
    variantId: opts.variantId,
    delta: -opts.quantity,
    reason: "Transfer",
    actorId: opts.actorId,
    movementType: "TRANSFER_OUT",
    source: "TRANSFER",
    reference: transfer.id,
  });
  if (out.error) {
    await supabase.from("inventory_transfers").update({ status: "CANCELLED" }).eq("id", transfer.id);
    return { error: out.error, status: out.status };
  }
  const inn = await adjustStock({
    clientId: opts.clientId,
    locationId: opts.toLocationId,
    productId: opts.productId,
    variantId: opts.variantId,
    delta: opts.quantity,
    reason: "Transfer",
    actorId: opts.actorId,
    movementType: "TRANSFER_IN",
    source: "TRANSFER",
    reference: transfer.id,
  });
  if (inn.error) {
    await adjustStock({
      clientId: opts.clientId,
      locationId: opts.fromLocationId,
      productId: opts.productId,
      variantId: opts.variantId,
      delta: opts.quantity,
      reason: "Transfer rollback",
      actorId: opts.actorId,
      movementType: "TRANSFER_IN",
      source: "TRANSFER",
    });
    await supabase.from("inventory_transfers").update({ status: "CANCELLED" }).eq("id", transfer.id);
    return { error: inn.error, status: inn.status };
  }

  await emitDomainEvent({
    clientId: opts.clientId,
    type: "inventory.transferred",
    entityType: "INVENTORY",
    entityId: opts.productId,
    actorType: "HUMAN",
    actorId: opts.actorId,
    idempotencyKey: `transfer:${transfer.id}`,
    payload: { quantity: opts.quantity, from: opts.fromLocationId, to: opts.toLocationId },
  });
  return { transferId: transfer.id, from: out, to: inn };
}

export async function reserveStock(opts: {
  clientId: string;
  locationId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  sourceType: string;
  sourceId: string;
  actorId: string;
}) {
  const settings = await getInventorySettings(opts.clientId);
  const balance = await ensureBalance(opts.clientId, opts.locationId, opts.productId, opts.variantId ?? null);
  const available = availableQty(Number(balance.on_hand), Number(balance.reserved));
  if (!canTransfer(available, opts.quantity, settings.allowNegativeStock)) {
    return { error: "Insufficient available stock to reserve", status: 409 as const };
  }
  const supabase = createAdminClient();
  const nextReserved = (Number(balance.reserved) || 0) + opts.quantity;
  const { data, error } = await supabase
    .from("inventory_balances")
    .update({
      reserved: nextReserved,
      version: (Number(balance.version) || 1) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", balance.id)
    .eq("version", balance.version)
    .select("*")
    .maybeSingle();
  if (error || !data) return { error: error?.message ?? "Reservation conflict", status: 409 as const };
  const { data: reservation } = await supabase
    .from("inventory_reservations")
    .insert({
      client_id: opts.clientId,
      location_id: opts.locationId,
      product_id: opts.productId,
      variant_id: opts.variantId ?? null,
      quantity: opts.quantity,
      source_type: opts.sourceType,
      source_id: opts.sourceId,
      created_by: opts.actorId,
    })
    .select("*")
    .single();
  await supabase.from("inventory_movements").insert({
    client_id: opts.clientId,
    location_id: opts.locationId,
    product_id: opts.productId,
    variant_id: opts.variantId ?? null,
    movement_type: "RESERVATION",
    quantity: opts.quantity,
    reason: "Reservation",
    reference_type: opts.sourceType,
    reference_id: opts.sourceId,
    performed_by: opts.actorId,
    source: "USER",
  });
  return { reservation };
}

export async function releaseReservation(opts: { clientId: string; reservationId: string; actorId: string }) {
  const supabase = createAdminClient();
  const { data: reservation } = await supabase
    .from("inventory_reservations")
    .select("*")
    .eq("id", opts.reservationId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!reservation || reservation.status !== "ACTIVE") return { error: "Reservation not found", status: 404 as const };
  const balance = await ensureBalance(
    opts.clientId,
    reservation.location_id as string,
    reservation.product_id as string,
    (reservation.variant_id as string | null) ?? null
  );
  const nextReserved = Math.max(0, (Number(balance.reserved) || 0) - Number(reservation.quantity));
  await supabase
    .from("inventory_balances")
    .update({ reserved: nextReserved, version: (Number(balance.version) || 1) + 1, updated_at: new Date().toISOString() })
    .eq("id", balance.id)
    .eq("version", balance.version);
  await supabase
    .from("inventory_reservations")
    .update({ status: "RELEASED", released_at: new Date().toISOString() })
    .eq("id", opts.reservationId);
  await supabase.from("inventory_movements").insert({
    client_id: opts.clientId,
    location_id: reservation.location_id,
    product_id: reservation.product_id,
    variant_id: reservation.variant_id,
    movement_type: "RESERVATION_RELEASED",
    quantity: Number(reservation.quantity),
    performed_by: opts.actorId,
    source: "USER",
  });
  return { ok: true };
}

async function emitStockEvents(opts: {
  clientId: string;
  productId: string;
  variantId: string | null;
  prevAvail: number;
  nextAvail: number;
  reorder: number | null;
  delta: number;
}) {
  const entityId = opts.variantId ?? opts.productId;
  if (crossedOutOfStock(opts.prevAvail, opts.nextAvail)) {
    await emitDomainEvent({
      clientId: opts.clientId,
      type: "inventory.out_of_stock",
      entityType: "INVENTORY",
      entityId,
      actorType: "SYSTEM",
      idempotencyKey: `oos:${entityId}:${Date.now()}`,
      payload: { productId: opts.productId, variantId: opts.variantId },
    });
  } else if (crossedLowStock(opts.prevAvail, opts.nextAvail, opts.reorder)) {
    await emitDomainEvent({
      clientId: opts.clientId,
      type: "inventory.low_stock",
      entityType: "INVENTORY",
      entityId,
      actorType: "SYSTEM",
      idempotencyKey: `low:${entityId}:${Date.now()}`,
      payload: { productId: opts.productId, variantId: opts.variantId, available: opts.nextAvail },
    });
  }
  if (opts.delta > 0) {
    await emitDomainEvent({
      clientId: opts.clientId,
      type: opts.prevAvail <= 0 ? "inventory.stock_received" : "inventory.stock_adjusted",
      entityType: "INVENTORY",
      entityId,
      actorType: "SYSTEM",
      idempotencyKey: `adj:${entityId}:${opts.delta}:${Date.now()}`,
      payload: { delta: opts.delta, available: opts.nextAvail },
    });
  } else {
    await emitDomainEvent({
      clientId: opts.clientId,
      type: "inventory.stock_adjusted",
      entityType: "INVENTORY",
      entityId,
      actorType: "SYSTEM",
      idempotencyKey: `adj:${entityId}:${opts.delta}:${Date.now()}`,
      payload: { delta: opts.delta, available: opts.nextAvail },
    });
  }
}

export function createSegmiqInventoryProvider(): InventoryProvider {
  return {
    kind: "SEGMIQ",
    allowsMutations: true,
    getAvailability,
    getLocationAvailability: getAvailability,
  };
}

export function createExternalInventoryProvider(): InventoryProvider {
  return {
    kind: "EXTERNAL",
    allowsMutations: false,
    async getAvailability(query) {
      return getAvailability(query);
    },
  };
}

export async function resolveInventoryProvider(clientId: string): Promise<InventoryProvider> {
  const settings = await getInventorySettings(clientId);
  return settings.provider === "EXTERNAL" ? createExternalInventoryProvider() : createSegmiqInventoryProvider();
}

export async function listLocations(clientId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("client_id", clientId)
    .order("name");
  if (error) return { error: error.message, locations: [] };
  return { locations: data ?? [] };
}

export async function upsertLocation(clientId: string, input: Record<string, unknown>, locationId?: string) {
  const supabase = createAdminClient();
  const row = {
    client_id: clientId,
    name: String(input.name ?? "").trim(),
    code: input.code ? String(input.code).trim() : null,
    location_type: input.location_type || "WAREHOUSE",
    address: input.address ?? null,
    city: input.city ?? null,
    country: input.country ?? null,
    status: input.status || "ACTIVE",
    is_default: Boolean(input.is_default),
    updated_at: new Date().toISOString(),
  };
  if (!row.name) return { error: "Name is required", status: 400 as const };
  if (row.is_default) {
    await supabase.from("inventory_locations").update({ is_default: false }).eq("client_id", clientId);
  }
  if (locationId) {
    const { data, error } = await supabase
      .from("inventory_locations")
      .update(row)
      .eq("id", locationId)
      .eq("client_id", clientId)
      .select("*")
      .single();
    if (error) return { error: error.message };
    return { location: data };
  }
  const { data, error } = await supabase.from("inventory_locations").insert(row).select("*").single();
  if (error) return { error: error.message };
  if (row.is_default) {
    await supabase.from("inventory_settings").upsert({
      client_id: clientId,
      default_location_id: data.id,
    });
  }
  return { location: data };
}

export async function inventoryOverview(clientId: string) {
  const supabase = createAdminClient();
  const { data: balances } = await supabase
    .from("inventory_balances")
    .select("product_id, variant_id, on_hand, reserved, reorder_level, location_id")
    .eq("client_id", clientId);
  const { count: locationCount } = await supabase
    .from("inventory_locations")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "ACTIVE");

  const bySku = new Map<string, { available: number; reorder: number | null }>();
  for (const b of balances ?? []) {
    const key = `${b.product_id}:${b.variant_id ?? ""}`;
    const prev = bySku.get(key) ?? { available: 0, reorder: null };
    prev.available += availableQty(Number(b.on_hand), Number(b.reserved));
    if (b.reorder_level != null) prev.reorder = Number(b.reorder_level);
    bySku.set(key, prev);
  }
  let low = 0;
  let out = 0;
  for (const v of bySku.values()) {
    if (v.available <= 0) out += 1;
    else if (v.reorder != null && v.available <= v.reorder) low += 1;
  }
  return {
    stockedSkus: bySku.size,
    lowStock: low,
    outOfStock: out,
    locations: locationCount ?? 0,
  };
}

export async function listMovements(opts: {
  clientId: string;
  locationId?: string;
  productId?: string;
  type?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = createAdminClient();
  const limit = Math.min(100, opts.limit ?? 50);
  const offset = opts.offset ?? 0;
  let q = supabase
    .from("inventory_movements")
    .select("*", { count: "exact" })
    .eq("client_id", opts.clientId)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (opts.locationId) q = q.eq("location_id", opts.locationId);
  if (opts.productId) q = q.eq("product_id", opts.productId);
  if (opts.type) q = q.eq("movement_type", opts.type);
  const { data, error, count } = await q;
  if (error) return { error: error.message, movements: [], total: 0 };
  return { movements: data ?? [], total: count ?? 0 };
}

export async function attentionItems(clientId: string) {
  const supabase = createAdminClient();
  const { data: balances } = await supabase
    .from("inventory_balances")
    .select("product_id, variant_id, on_hand, reserved, reorder_level, location_id")
    .eq("client_id", clientId);
  const productIds = [...new Set((balances ?? []).map((b) => b.product_id as string))];
  const { data: products } = productIds.length
    ? await supabase.from("products").select("id, name, sku, status, track_inventory").eq("client_id", clientId).in("id", productIds)
    : { data: [] as Array<Record<string, unknown>> };
  const { data: variants } = productIds.length
    ? await supabase.from("product_variants").select("id, name, sku, product_id").eq("client_id", clientId).in("product_id", productIds)
    : { data: [] as Array<Record<string, unknown>> };
  const pMap = new Map((products ?? []).map((p) => [p.id as string, p]));
  const vMap = new Map((variants ?? []).map((v) => [v.id as string, v]));
  const items: Array<Record<string, unknown>> = [];
  for (const b of balances ?? []) {
    const avail = availableQty(Number(b.on_hand), Number(b.reserved));
    const reorder = b.reorder_level == null ? null : Number(b.reorder_level);
    const status = stockStatus({ trackInventory: true, available: avail, reorderLevel: reorder });
    if (status !== "LOW_STOCK" && status !== "OUT_OF_STOCK") continue;
    const product = pMap.get(b.product_id as string);
    const variant = b.variant_id ? vMap.get(b.variant_id as string) : null;
    items.push({
      productId: b.product_id,
      variantId: b.variant_id,
      name: variant ? `${product?.name ?? "Product"} · ${variant.name}` : product?.name,
      sku: variant?.sku ?? product?.sku,
      available: avail,
      reorderLevel: reorder,
      status,
    });
  }
  items.sort((a, b) => (a.status === "OUT_OF_STOCK" ? -1 : 1));
  return items.slice(0, 40);
}
