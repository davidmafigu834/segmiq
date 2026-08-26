import { commercialContext, jsonErr, jsonOk } from "@/lib/commercial/api";
import {
  attentionItems,
  getInventorySettings,
  inventoryOverview,
  listLocations,
  saveInventorySettings,
  upsertLocation,
} from "@/lib/inventory/service";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "inventory.view");
  if ("error" in ctx) return ctx.error;
  const [overview, settings, locations, attention] = await Promise.all([
    inventoryOverview(params.clientId),
    getInventorySettings(params.clientId),
    listLocations(params.clientId),
    attentionItems(params.clientId),
  ]);
  return jsonOk({ overview, settings, locations: locations.locations, attention });
}

export async function PATCH(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "inventory.manageLocations");
  if ("error" in ctx) return ctx.error;
  const body = (await req.json()) as Record<string, unknown>;
  const result = await saveInventorySettings(params.clientId, {
    provider: body.provider as "SEGMIQ" | "EXTERNAL" | undefined,
    allowNegativeStock: body.allowNegativeStock as boolean | undefined,
    defaultLocationId: (body.defaultLocationId as string | null) ?? undefined,
    staleAfterMinutes: body.staleAfterMinutes as number | undefined,
    agentDisclosure: body.agentDisclosure as "EXACT" | "GENERAL" | "HIDDEN" | undefined,
    warnInsufficientStock: body.warnInsufficientStock as boolean | undefined,
    blockInsufficientStock: body.blockInsufficientStock as boolean | undefined,
    lowStockNotifications: body.lowStockNotifications as boolean | undefined,
  });
  if (result.error) return jsonErr(result.error, 400);
  return jsonOk(result);
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "inventory.manageLocations");
  if ("error" in ctx) return ctx.error;
  const body = (await req.json()) as Record<string, unknown>;
  const result = await upsertLocation(params.clientId, body, body.id as string | undefined);
  if (result.error) return jsonErr(result.error, result.status ?? 400);
  return jsonOk(result);
}
