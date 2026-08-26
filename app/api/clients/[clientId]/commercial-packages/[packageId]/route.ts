import { commercialContext, jsonErr, jsonOk } from "@/lib/commercial/api";
import { clonePackage, getPackage, savePackageContents, updatePackage } from "@/lib/packages/service";

export async function GET(req: Request, { params }: { params: { clientId: string; packageId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "packages.view");
  if ("error" in ctx) return ctx.error;
  const result = await getPackage(params.clientId, params.packageId, ctx.canSeeCost);
  if ("error" in result && result.error) return jsonErr(result.error, result.status ?? 500);
  return jsonOk(result);
}

export async function PATCH(req: Request, { params }: { params: { clientId: string; packageId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "packages.edit");
  if ("error" in ctx) return ctx.error;
  const body = (await req.json()) as Record<string, unknown>;
  if (body.items || body.sections) {
    const result = await savePackageContents(params.clientId, params.packageId, ctx.actor.userId, {
      sections: body.sections as Array<{ name: string; sort_order: number }> | undefined,
      items: body.items as Array<Record<string, unknown>> | undefined,
    });
    if ("error" in result && result.error) return jsonErr(String(result.error), 400);
    return jsonOk(result);
  }
  const result = await updatePackage(params.clientId, params.packageId, ctx.actor.userId, body);
  if (result.error) return jsonErr(result.error);
  return jsonOk(result);
}

export async function POST(req: Request, { params }: { params: { clientId: string; packageId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "packages.create");
  if ("error" in ctx) return ctx.error;
  const result = await clonePackage(params.clientId, params.packageId, ctx.actor.userId);
  if ("error" in result && result.error) return jsonErr(String(result.error), 400);
  return jsonOk(result, 201);
}
