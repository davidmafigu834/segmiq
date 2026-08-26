import { commercialContext, jsonErr, jsonOk } from "@/lib/commercial/api";
import { adjustStock, getAvailability, listMovements, transferStock } from "@/lib/inventory/service";
import { resolveInventoryProvider } from "@/lib/inventory/service";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "inventory.viewMovements");
  if ("error" in ctx) return ctx.error;
  const url = new URL(req.url);
  if (url.searchParams.get("availability") === "1") {
    const productId = url.searchParams.get("productId");
    if (!productId) return jsonErr("productId required");
    const provider = await resolveInventoryProvider(params.clientId);
    const avail = await provider.getAvailability({
      clientId: params.clientId,
      productId,
      variantId: url.searchParams.get("variantId"),
      locationId: url.searchParams.get("locationId"),
    });
    return jsonOk({ availability: avail });
  }
  const result = await listMovements({
    clientId: params.clientId,
    locationId: url.searchParams.get("locationId") ?? undefined,
    productId: url.searchParams.get("productId") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    limit: Number(url.searchParams.get("limit") || 50),
    offset: Number(url.searchParams.get("offset") || 0),
  });
  return jsonOk(result);
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action ?? "adjust");
  if (action === "transfer") {
    const ctx = await commercialContext(req, params.clientId, "inventory.transfer");
    if ("error" in ctx) return ctx.error;
    const result = await transferStock({
      clientId: params.clientId,
      fromLocationId: String(body.fromLocationId),
      toLocationId: String(body.toLocationId),
      productId: String(body.productId),
      variantId: (body.variantId as string | null) ?? null,
      quantity: Number(body.quantity),
      actorId: ctx.actor.userId,
      notes: (body.notes as string | null) ?? null,
    });
    if (result.error) return jsonErr(result.error, result.status ?? 400);
    return jsonOk(result);
  }
  const ctx = await commercialContext(req, params.clientId, "inventory.adjust");
  if ("error" in ctx) return ctx.error;
  const result = await adjustStock({
    clientId: params.clientId,
    locationId: String(body.locationId),
    productId: String(body.productId),
    variantId: (body.variantId as string | null) ?? null,
    delta: Number(body.delta),
    reason: String(body.reason ?? ""),
    note: (body.note as string | null) ?? null,
    actorId: ctx.actor.userId,
  });
  if (result.error) return jsonErr(result.error, result.status ?? 400);
  return jsonOk(result);
}
